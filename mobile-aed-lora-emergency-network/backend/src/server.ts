import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { requireAdmin, requireVolunteer, signAccessToken, signRefreshToken, signVolunteerToken, verifyRefreshToken } from "./auth";
import { buildSimulatorRoute, channelStatus, distanceMeters } from "./simulator";
import { dispatchHybridAlerts } from "./alerting";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const SIMULATOR_URL = process.env.SIMULATOR_URL ?? "http://localhost:4200";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const VOLUNTEER_ONLINE_MS = 30 * 60 * 1000;

function isVolunteerOnline(lastSeen: Date | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= VOLUNTEER_ONLINE_MS;
}

async function markVolunteerOnline(userId: string, lat: number, lng: number, source: string) {
  const safeLat = Number.isFinite(lat) && lat !== 0 ? lat : undefined;
  const safeLng = Number.isFinite(lng) && lng !== 0 ? lng : undefined;
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { aedDevice: true } });
  const finalLat = safeLat ?? user?.aedDevice?.lastLat ?? user?.volunteerLat ?? 0;
  const finalLng = safeLng ?? user?.aedDevice?.lastLng ?? user?.volunteerLng ?? 0;

  await prisma.user.update({
    where: { id: userId },
    data: {
      volunteerOnlineAt: new Date(),
      volunteerLat: finalLat,
      volunteerLng: finalLng,
      locationSource: source,
    },
  });
  const device = user?.aedDevice ?? (await prisma.aEDDevice.findFirst({ where: { ownerId: userId } }));
  if (device && finalLat !== 0 && finalLng !== 0) {
    await prisma.aEDDevice.update({
      where: { id: device.id },
      data: { lastLat: finalLat, lastLng: finalLng, lastSeenAt: new Date() },
    });
  }
  const lora = await prisma.loRaDevice.findFirst({ where: { ownerId: userId } });
  if (lora && finalLat !== 0 && finalLng !== 0) {
    await prisma.loRaDevice.update({
      where: { id: lora.id },
      data: { lastLat: finalLat, lastLng: finalLng, lastSeenAt: new Date() },
    });
  }
}

async function getOnlineVolunteerDevices() {
  const devices = await prisma.aEDDevice.findMany({
    where: { isAvailable: true },
    include: { owner: true },
  });
  return devices.filter((d) => isVolunteerOnline(d.owner.volunteerOnlineAt));
}

function mapDeviceToVolunteer(d: Awaited<ReturnType<typeof getOnlineVolunteerDevices>>[number], incidentLat?: number, incidentLng?: number) {
  const vLat = d.owner.volunteerLat ?? d.lastLat;
  const vLng = d.owner.volunteerLng ?? d.lastLng;
  const distance =
    incidentLat != null && incidentLng != null ? Math.round(distanceMeters(incidentLat, incidentLng, vLat, vLng)) : null;
  return {
    id: d.id,
    ownerName: d.owner.firstName,
    phone: d.owner.phone,
    aedStatus: d.status,
    loraId: d.loraDeviceId,
    lastKnownGPS: { lat: vLat, lng: vLng },
    batteryStatus: d.batteryLevel,
    locationSource: d.owner.locationSource,
    onlineAt: d.owner.volunteerOnlineAt,
    distanceMeters: distance,
    etaMinutes: distance != null ? Math.max(2, Math.round((distance / 230) * 0.8)) : null,
    route:
      incidentLat != null && incidentLng != null
        ? buildSimulatorRoute({ lat: vLat, lng: vLng }, { lat: incidentLat, lng: incidentLng })
        : [],
  };
}

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/auth/login", async (req, res) => {
  const schema = z.object({ username: z.string(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const admin = await prisma.adminUser.findUnique({ where: { username: parsed.data.username } });
  if (!admin) return res.status(401).json({ message: "Bad credentials" });

  const ok = await bcrypt.compare(parsed.data.password, admin.passwordHash);
  if (!ok) return res.status(401).json({ message: "Bad credentials" });

  const claims = { adminId: admin.id, username: admin.username };
  const accessToken = signAccessToken(claims);
  const refreshToken = signRefreshToken(claims);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      adminId: admin.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie("refreshToken", refreshToken, { httpOnly: true, sameSite: "lax" });
  return res.json({ accessToken, admin: { username: admin.username } });
});

app.post("/auth/refresh", async (req, res) => {
  const token = req.cookies.refreshToken ?? req.body.refreshToken;
  if (!token) return res.status(401).json({ message: "Missing refresh token" });
  const exists = await prisma.refreshToken.findUnique({ where: { token } });
  if (!exists) return res.status(401).json({ message: "Invalid refresh token" });
  try {
    const claims = verifyRefreshToken(token);
    const accessToken = signAccessToken(claims);
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ message: "Expired refresh token" });
  }
});

app.post("/auth/logout", async (req, res) => {
  const token = req.cookies.refreshToken ?? req.body.refreshToken;
  if (token) await prisma.refreshToken.deleteMany({ where: { token } });
  res.clearCookie("refreshToken");
  return res.json({ ok: true });
});

app.post("/auth/volunteer/login", async (req, res) => {
  const schema = z.object({ phone: z.string().min(5), firstName: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const normalize = (p: string) => p.replace(/\D/g, "");
  const phoneNorm = normalize(parsed.data.phone);
  const users = await prisma.user.findMany({ where: { firstName: parsed.data.firstName.trim() } });
  const match = users.find((u) => normalize(u.phone) === phoneNorm || u.phone === parsed.data.phone);

  if (!match) return res.status(401).json({ message: "User not found. Register first." });

  const aed = await prisma.aEDDevice.findUnique({ where: { ownerId: match.id } });
  const lat = match.volunteerLat ?? aed?.lastLat ?? 0;
  const lng = match.volunteerLng ?? aed?.lastLng ?? 0;
  await markVolunteerOnline(match.id, lat, lng, match.locationSource ?? "registration");
  const token = signVolunteerToken({ userId: match.id, firstName: match.firstName, phone: match.phone });
  return res.json({
    accessToken: token,
    volunteer: { id: match.id, firstName: match.firstName, phone: match.phone, registrationType: match.registrationType },
    deviceLocation: aed ? { lat: aed.lastLat, lng: aed.lastLng } : null,
  });
});

app.get("/volunteer/alerts", requireVolunteer, async (req, res) => {
  const userId = req.volunteer!.userId;
  const alerts = await prisma.volunteerAlert.findMany({
    where: {
      userId,
      OR: [
        {
          status: { in: ["PENDING", "ON_THE_WAY"] },
          incident: { status: { in: ["ALERTING", "ACCEPTED", "ON_THE_WAY"] } },
        },
        {
          status: "ARRIVED",
          incident: { status: "AED_ARRIVED" },
        },
      ],
    },
    include: { incident: true, user: { include: { aedDevice: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  res.json(
    alerts.map((a) => ({
      id: a.id,
      status: a.status,
      deviceId: a.deviceId,
      cellularPush: a.cellularPush,
      cellularSms: a.cellularSms,
      meshtasticDelivered: a.meshtasticDelivered,
      meshtasticGateway: a.meshtasticGateway,
      meshtasticBeeping: a.meshtasticBeeping,
      distanceMeters: a.distanceMeters,
      etaMinutes: a.etaMinutes,
      incident: a.incident,
      deviceLocation:
        a.user.volunteerLat != null && a.user.volunteerLng != null
          ? { lat: a.user.volunteerLat, lng: a.user.volunteerLng }
          : a.user.aedDevice
            ? { lat: a.user.aedDevice.lastLat, lng: a.user.aedDevice.lastLng }
            : null,
    })),
  );
});

app.post("/volunteer/alerts/:id/accept", requireVolunteer, async (req, res) => {
  const alertId = String(req.params.id);
  const alert = await prisma.volunteerAlert.findFirst({
    where: { id: alertId, userId: req.volunteer!.userId },
    include: { incident: true, user: { include: { aedDevice: true } } },
  });
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  if (alert.status !== "PENDING") {
    return res.status(400).json({ message: "Alert already handled" });
  }

  await prisma.volunteerAlert.updateMany({
    where: { incidentId: alert.incidentId, id: { not: alertId }, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await prisma.volunteerAlert.update({ where: { id: alertId }, data: { status: "ON_THE_WAY" } });
  await prisma.incident.update({ where: { id: alert.incidentId }, data: { status: "ON_THE_WAY" } });

  await fetch(`${SIMULATOR_URL}/incident-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incidentId: alert.incidentId,
      type: "VOLUNTEER_ACCEPTED",
      payload: { volunteer: req.volunteer!.firstName, deviceId: alert.deviceId, via: "volunteer-app" },
    }),
  });
  await fetch(`${SIMULATOR_URL}/incident-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incidentId: alert.incidentId,
      type: "VOLUNTEER_ON_THE_WAY",
      payload: { volunteer: req.volunteer!.firstName },
    }),
  });

  res.json({
    ok: true,
    incident: alert.incident,
    alert: {
      id: alert.id,
      status: "ON_THE_WAY",
      deviceId: alert.deviceId,
      cellularPush: alert.cellularPush,
      cellularSms: alert.cellularSms,
      meshtasticDelivered: alert.meshtasticDelivered,
      meshtasticGateway: alert.meshtasticGateway,
      meshtasticBeeping: alert.meshtasticBeeping,
      distanceMeters: alert.distanceMeters,
      etaMinutes: alert.etaMinutes,
      incident: alert.incident,
      deviceLocation:
        alert.user.volunteerLat != null && alert.user.volunteerLng != null
          ? { lat: alert.user.volunteerLat, lng: alert.user.volunteerLng }
          : alert.user.aedDevice
            ? { lat: alert.user.aedDevice.lastLat, lng: alert.user.aedDevice.lastLng }
            : null,
    },
  });
});

app.post("/volunteer/alerts/:id/arrived", requireVolunteer, async (req, res) => {
  const alertId = String(req.params.id);
  const alert = await prisma.volunteerAlert.findFirst({
    where: { id: alertId, userId: req.volunteer!.userId },
    include: { incident: true },
  });
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  if (alert.status === "ARRIVED") {
    return res.json({ ok: true, alert });
  }

  const updated = await prisma.volunteerAlert.update({
    where: { id: alertId },
    data: { status: "ARRIVED" },
    include: { incident: true },
  });
  await prisma.incident.update({ where: { id: alert.incidentId }, data: { status: "AED_ARRIVED" } });

  await fetch(`${SIMULATOR_URL}/incident-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incidentId: alert.incidentId,
      type: "AED_ARRIVED",
      payload: { volunteer: req.volunteer!.firstName },
    }),
  });

  res.json({ ok: true, alert: { ...updated, status: "ARRIVED" as const, incident: { ...updated.incident, status: "AED_ARRIVED" } } });
});

app.post("/volunteer/alerts/:id/close", requireVolunteer, async (req, res) => {
  const alertId = String(req.params.id);
  const body = z
    .object({
      note: z.string().max(2000).optional(),
      closureReason: z.enum([
        "AMBULANCE_ORDERED",
        "PATIENT_RESPONDING",
        "AED_USED",
        "MDA_ARRIVED",
        "FALSE_ALARM",
        "OTHER",
      ]),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Invalid payload" });

  const alert = await prisma.volunteerAlert.findFirst({
    where: { id: alertId, userId: req.volunteer!.userId },
    include: { incident: true },
  });
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  if (alert.status !== "ARRIVED") {
    return res.status(400).json({ message: "יש לסמן הגעה לזירה לפני סגירת האירוע" });
  }

  const incident = await prisma.incident.update({
    where: { id: alert.incidentId },
    data: {
      status: "CLOSED",
      volunteerNote: body.data.note?.trim() || null,
      closureReason: body.data.closureReason,
      closedAt: new Date(),
    },
  });

  await fetch(`${SIMULATOR_URL}/incident-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incidentId: alert.incidentId,
      type: "INCIDENT_CLOSED",
      payload: {
        volunteer: req.volunteer!.firstName,
        closureReason: body.data.closureReason,
        note: body.data.note?.trim() || null,
      },
    }),
  });

  res.json({ ok: true, incident });
});

app.post("/volunteer/location", requireVolunteer, async (req, res) => {
  const body = z
    .object({
      lat: z.number(),
      lng: z.number(),
      source: z.enum(["gps", "ip", "manual", "registration"]).default("gps"),
      incidentId: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Invalid payload" });

  await markVolunteerOnline(req.volunteer!.userId, body.data.lat, body.data.lng, body.data.source);

  const device = await prisma.aEDDevice.findFirst({ where: { ownerId: req.volunteer!.userId } });

  if (body.data.incidentId) {
    await fetch(`${SIMULATOR_URL}/incident-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentId: body.data.incidentId,
        type: "VOLUNTEER_LOCATION",
        payload: {
          volunteer: req.volunteer!.firstName,
          lat: body.data.lat,
          lng: body.data.lng,
          source: body.data.source,
          deviceId: device?.id,
        },
      }),
    });
  }

  res.json({ ok: true, location: { lat: body.data.lat, lng: body.data.lng, source: body.data.source } });
});

app.post("/volunteer/presence", requireVolunteer, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.volunteer!.userId },
    include: { aedDevice: true },
  });
  if (!user) return res.status(404).json({ message: "User not found" });

  const lat = user.volunteerLat ?? user.aedDevice?.lastLat ?? 0;
  const lng = user.volunteerLng ?? user.aedDevice?.lastLng ?? 0;
  await markVolunteerOnline(user.id, lat, lng, user.locationSource ?? "registration");
  res.json({ ok: true, online: true });
});

app.post("/volunteer/offline", requireVolunteer, async (req, res) => {
  await prisma.user.update({
    where: { id: req.volunteer!.userId },
    data: { volunteerOnlineAt: null },
  });
  res.json({ ok: true });
});

app.post("/registrations", async (req, res) => {
  const schema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    phone: z.string().min(5),
    registrationType: z.enum(["MOBILE_AED_WITH_LORA", "MOBILE_AED_NO_LORA", "LORA_CARRIER_ONLY"]),
    loraId: z.string().optional(),
    medicalTraining: z.string().optional(),
    aedStatus: z.enum(["OK", "MAINTENANCE", "UNKNOWN"]).optional(),
    batteryLevel: z.number().min(1).max(100).optional(),
    consent: z.boolean(),
    lat: z.number(),
    lng: z.number(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Validation failed" });

  const d = parsed.data;
  if (!d.consent) {
    return res.status(400).json({ message: "Consent is required" });
  }
  if (d.registrationType !== "MOBILE_AED_NO_LORA" && !d.loraId) {
    return res.status(400).json({ message: "LoRa ID is required for LoRa participation" });
  }

  const created = await prisma.user.create({
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      registrationType: d.registrationType,
      medicalTraining: d.medicalTraining,
      consent: d.consent,
      volunteerLat: d.lat,
      volunteerLng: d.lng,
      locationSource: "registration",
    },
  });

  const loraId =
    d.registrationType !== "MOBILE_AED_NO_LORA"
      ? (d.loraId ?? `LORA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
      : undefined;

  if (d.registrationType !== "LORA_CARRIER_ONLY") {
    await prisma.aEDDevice.create({
      data: {
        ownerId: created.id,
        hasLora: d.registrationType === "MOBILE_AED_WITH_LORA",
        loraDeviceId: loraId,
        status: d.aedStatus ?? "OK",
        batteryLevel: d.batteryLevel ?? 95,
        lastLat: d.lat,
        lastLng: d.lng,
        lastSeenAt: new Date(),
        isAvailable: true,
      },
    });
  }

  if (d.registrationType !== "MOBILE_AED_NO_LORA") {
    await prisma.loRaDevice.create({
      data: {
        ownerId: created.id,
        loraId: loraId!,
        role: d.registrationType === "LORA_CARRIER_ONLY" ? "CARRIER_ONLY" : "AED_ATTACHED",
        batteryLevel: d.batteryLevel ?? 90,
        lastLat: d.lat,
        lastLng: d.lng,
        lastSeenAt: new Date(),
        signalStatus: "MEDIUM",
      },
    });
  }

  return res.status(201).json({ id: created.id, firstName: created.firstName, phone: created.phone });
});

app.get("/public/content", async (_, res) => {
  const cfg = await prisma.simulatorConfig.findUnique({ where: { id: "default" } });
  return res.json(cfg);
});

app.get("/public/config", async (_, res) => {
  const cfg = await prisma.simulatorConfig.findUnique({ where: { id: "default" } });
  return res.json({
    searchRadiusMeters: cfg?.searchRadiusMeters ?? 3000,
    noCellularMode: cfg?.noCellularMode ?? false,
    noGatewayMode: cfg?.noGatewayMode ?? false,
  });
});

app.get("/admin/stats", requireAdmin, async (_, res) => {
  const [totalUsers, totalAeds, withLora, withoutLora, carriersOnly, activeIncidents, lowBatteryDevices] =
    await Promise.all([
      prisma.user.count(),
      prisma.aEDDevice.count(),
      prisma.aEDDevice.count({ where: { hasLora: true } }),
      prisma.aEDDevice.count({ where: { hasLora: false } }),
      prisma.user.count({ where: { registrationType: "LORA_CARRIER_ONLY" } }),
      prisma.incident.count({ where: { status: { in: ["CREATED", "ALERTING", "ACCEPTED", "ON_THE_WAY"] } } }),
      prisma.aEDDevice.count({ where: { batteryLevel: { lt: 20 } } }),
    ]);
  res.json({ totalUsers, totalAeds, withLora, withoutLora, carriersOnly, activeIncidents, lowBatteryDevices });
});

app.get("/admin/users", requireAdmin, async (_, res) => {
  const users = await prisma.user.findMany({
    include: { aedDevice: true, loraDevice: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

app.post("/admin/users", requireAdmin, async (req, res) => {
  const payload = z.object({
    firstName: z.string(),
    phone: z.string(),
    registrationType: z.enum(["MOBILE_AED_WITH_LORA", "MOBILE_AED_NO_LORA", "LORA_CARRIER_ONLY"]),
  });
  const parsed = payload.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bad payload" });
  const user = await prisma.user.create({ data: { ...parsed.data, consent: true } });
  res.status(201).json(user);
});

app.put("/admin/users/:id", requireAdmin, async (req, res) => {
  const user = await prisma.user.update({ where: { id: String(req.params.id) }, data: req.body });
  res.json(user);
});

app.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  await prisma.user.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

app.get("/admin/devices", requireAdmin, async (_, res) => {
  const [aedDevices, loraDevices] = await Promise.all([prisma.aEDDevice.findMany(), prisma.loRaDevice.findMany()]);
  res.json({ aedDevices, loraDevices });
});

app.put("/admin/devices/:id", requireAdmin, async (req, res) => {
  const updated = await prisma.aEDDevice.update({ where: { id: String(req.params.id) }, data: req.body });
  res.json(updated);
});

app.get("/admin/incidents", requireAdmin, async (_, res) => {
  const incidents = await prisma.incident.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  res.json(incidents);
});

app.get("/admin/telemetry", requireAdmin, async (_, res) => {
  const response = await fetch(`${SIMULATOR_URL}/telemetry`);
  const data = await response.json();
  res.json(data);
});

app.put("/admin/content/:pageKey", requireAdmin, async (req, res) => {
  const pageKey = String(req.params.pageKey);
  const value = String(req.body.value ?? "");
  const config = await prisma.simulatorConfig.findUnique({ where: { id: "default" } });
  if (!config) return res.status(404).json({ message: "No config" });
  if (!(pageKey in config)) return res.status(400).json({ message: "Unknown content key" });
  const nextConfig = await prisma.simulatorConfig.update({
    where: { id: "default" },
    data: { [pageKey]: value } as Record<string, unknown>,
  });
  res.json(nextConfig);
});

app.get("/admin/config", requireAdmin, async (_, res) => {
  const cfg = await prisma.simulatorConfig.findUnique({ where: { id: "default" } });
  res.json(cfg);
});

app.put("/admin/config", requireAdmin, async (req, res) => {
  const payload = z.object({
    searchRadiusMeters: z.number().min(200).max(20000),
    noCellularMode: z.boolean(),
    noGatewayMode: z.boolean(),
  });
  const parsed = payload.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid config" });
  const cfg = await prisma.simulatorConfig.update({ where: { id: "default" }, data: parsed.data });
  res.json(cfg);
});

app.get("/admin/maintenance-alerts", requireAdmin, async (_, res) => {
  const alerts = await prisma.maintenanceAlert.findMany({ orderBy: { createdAt: "desc" } });
  res.json(alerts);
});

app.put("/admin/maintenance-alerts/:id/handled", requireAdmin, async (req, res) => {
  const alert = await prisma.maintenanceAlert.update({
    where: { id: String(req.params.id) },
    data: { isHandled: true, contactedAt: new Date() },
  });
  res.json(alert);
});

app.get("/admin/incidents/:id/export", requireAdmin, async (req, res) => {
  const incident = await prisma.incident.findUnique({ where: { id: String(req.params.id) } });
  if (!incident) return res.status(404).json({ message: "Not found" });
  const [volunteerAlerts, timeline] = await Promise.all([
    prisma.volunteerAlert.findMany({ where: { incidentId: incident.id }, include: { user: true } }),
    fetch(`${SIMULATOR_URL}/incident-events/${incident.id}`).then((r) => r.json()),
  ]);
  res.json({ incident, volunteerAlerts, timeline });
});

app.post("/simulator/telemetry/heartbeat-all", requireAdmin, async (_, res) => {
  const devices = await prisma.aEDDevice.findMany({ take: 10 });
  for (const d of devices) {
    const battery = Math.max(5, d.batteryLevel - Math.floor(Math.random() * 3));
    await prisma.aEDDevice.update({
      where: { id: d.id },
      data: { batteryLevel: battery, lastSeenAt: new Date() },
    });
    await fetch(`${SIMULATOR_URL}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: d.id, type: "HEARTBEAT", payload: { battery, simulated: true } }),
    });
  }
  res.json({ ok: true, updated: devices.length });
});

app.get("/simulator/online-volunteers", requireAdmin, async (req, res) => {
  const incidentId = typeof req.query.incidentId === "string" ? req.query.incidentId : undefined;
  let incidentLat: number | undefined;
  let incidentLng: number | undefined;
  if (incidentId) {
    const inc = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (inc) {
      incidentLat = inc.lat;
      incidentLng = inc.lng;
    }
  }
  const online = await getOnlineVolunteerDevices();
  res.json({
    count: online.length,
    volunteers: online.map((d) => mapDeviceToVolunteer(d, incidentLat, incidentLng)),
  });
});

app.post("/simulator/incidents", requireAdmin, async (req, res) => {
  const payload = z.object({
    lat: z.number(),
    lng: z.number(),
    source: z.string().default("SIMULATOR"),
    description: z.string().max(2000).optional(),
    incidentCategory: z
      .enum([
        "SUSPECTED_CARDIAC_ARREST",
        "UNCONSCIOUS_NOT_BREATHING",
        "CPR_IN_PROGRESS",
        "SEIZURE",
        "OTHER_MEDICAL",
      ])
      .optional(),
    patientAgeGroup: z.enum(["ADULT", "CHILD", "ELDERLY", "UNKNOWN"]).optional(),
    urgencyLevel: z.enum(["CRITICAL", "HIGH", "MODERATE"]).optional(),
  });
  const parsed = payload.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bad payload" });
  const cfg = await prisma.simulatorConfig.findUnique({ where: { id: "default" } });
  const radius = cfg?.searchRadiusMeters ?? 3000;

  const devices = await prisma.aEDDevice.findMany({
    where: { isAvailable: true },
    include: { owner: true },
  });
  const onlineDevices = devices.filter((d) => isVolunteerOnline(d.owner.volunteerOnlineAt));
  const rankedAll = onlineDevices
    .map((d) => {
      const vLat = d.owner.volunteerLat ?? d.lastLat;
      const vLng = d.owner.volunteerLng ?? d.lastLng;
      const distance = distanceMeters(parsed.data.lat, parsed.data.lng, vLat, vLng);
      const freshnessMinutes = (Date.now() - d.lastSeenAt.getTime()) / 60000;
      const healthScore = d.batteryLevel >= 20 ? 1 : 0.3;
      const availability = d.status === "OK" ? 1 : 0.4;
      const channel = channelStatus(d.hasLora, cfg?.noCellularMode ?? false, cfg?.noGatewayMode ?? false);
      const channelScore = channel === "BOTH" ? 1 : channel === "OFFLINE" ? 0.1 : 0.7;
      const score =
        (1 / Math.max(distance, 50)) * 300 +
        Math.max(0, 1 - freshnessMinutes / 180) * 50 +
        healthScore * 25 +
        availability * 15 +
        channelScore * 10;
      return { ...d, vLat, vLng, distance, freshnessMinutes, channel, score, inRadius: distance <= radius };
    })
    .sort((a, b) => b.score - a.score);

  // Demo: alert ALL online volunteers (sorted by score). Radius is informational only.
  const ranked = rankedAll.slice(0, 10);
  const inRadiusCount = rankedAll.filter((d) => d.inRadius).length;

  const incident = await prisma.incident.create({
    data: {
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      source: parsed.data.source,
      status: "ALERTING",
      description: parsed.data.description?.trim() || null,
      incidentCategory: parsed.data.incidentCategory ?? null,
      patientAgeGroup: parsed.data.patientAgeGroup ?? null,
      urgencyLevel: parsed.data.urgencyLevel ?? null,
    },
  });

  const meshNodes = await prisma.loRaDevice.findMany({
    select: { id: true, loraId: true, role: true, lastLat: true, lastLng: true, signalStatus: true },
  });

  const alertTargets = ranked.map((d) => ({
    deviceId: d.id,
    userId: d.owner.id,
    ownerName: d.owner.firstName,
    phone: d.owner.phone,
    hasLora: d.hasLora,
    loraId: d.loraDeviceId,
    lat: d.vLat,
    lng: d.vLng,
    channel: d.channel,
    distanceMeters: Math.round(d.distance),
    etaMinutes: Math.max(2, Math.round((d.distance / 230) * 0.8)),
  }));

  const { deliveries, timeline } = await dispatchHybridAlerts(
    incident.id,
    parsed.data.lat,
    parsed.data.lng,
    alertTargets,
    meshNodes.map((n) => ({
      id: n.id,
      loraId: n.loraId,
      role: n.role,
      lat: n.lastLat,
      lng: n.lastLng,
      signalStatus: n.signalStatus,
    })),
    {
      noCellularMode: cfg?.noCellularMode ?? false,
      noGatewayMode: cfg?.noGatewayMode ?? false,
    },
  );

  res.status(201).json({
    incident,
    rankedDevices: ranked.map((d) => {
      const delivery = deliveries.find((x) => x.deviceId === d.id);
      return {
        id: d.id,
        ownerName: d.owner.firstName,
        phone: d.owner.phone,
        aedStatus: d.status,
        loraId: d.loraDeviceId,
        lastKnownGPS: { lat: d.vLat, lng: d.vLng },
        lastTransmissionTime: d.lastSeenAt,
        batteryStatus: d.batteryLevel,
        channel: d.channel,
        distanceMeters: Math.round(d.distance),
        route: buildSimulatorRoute({ lat: d.vLat, lng: d.vLng }, { lat: incident.lat, lng: incident.lng }),
        etaMinutes: Math.max(2, Math.round((d.distance / 230) * 0.8)),
        alertDelivery: delivery ?? null,
      };
    }),
    alertTimeline: timeline,
    radius,
    onlineVolunteersCount: onlineDevices.length,
    alertedCount: ranked.length,
    inRadiusCount,
    meshtasticInfo: {
      frequencyMhz: 433,
      encryption: "AES-256",
      protocol: "Meshtastic mesh downlink (simulated)",
    },
  });
});

app.get("/simulator/incidents/:id", requireAdmin, async (req, res) => {
  const incident = await prisma.incident.findUnique({ where: { id: String(req.params.id) } });
  if (!incident) return res.status(404).json({ message: "Not found" });

  const [logsRaw, alerts] = await Promise.all([
    fetch(`${SIMULATOR_URL}/incident-events/${incident.id}`).then((r) => r.json()),
    prisma.volunteerAlert.findMany({
      where: { incidentId: incident.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  type LogEvent = { type: string; timestamp: string; payload?: Record<string, unknown> };
  const timeline = (Array.isArray(logsRaw) ? logsRaw : []).sort(
    (a: LogEvent, b: LogEvent) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const activeAlert = alerts.find((a) => a.status === "ON_THE_WAY" || a.status === "ARRIVED");

  let activeVolunteer: Record<string, unknown> | null = null;
  if (activeAlert) {
    const device = await prisma.aEDDevice.findUnique({
      where: { id: activeAlert.deviceId },
      include: { owner: true },
    });
    if (device) {
      const vLat = device.owner.volunteerLat ?? device.lastLat;
      const vLng = device.owner.volunteerLng ?? device.lastLng;
      const dist = distanceMeters(incident.lat, incident.lng, vLat, vLng);
      activeVolunteer = {
        alertId: activeAlert.id,
        ownerName: activeAlert.user.firstName,
        phone: activeAlert.user.phone,
        status: activeAlert.status,
        deviceId: device.id,
        aedStatus: device.status,
        batteryStatus: device.batteryLevel,
        loraId: device.loraDeviceId,
        distanceMeters: Math.round(dist),
        etaMinutes: Math.max(2, Math.round((dist / 230) * 0.8)),
        location: { lat: vLat, lng: vLng },
        locationSource: device.owner.locationSource,
        route: buildSimulatorRoute({ lat: vLat, lng: vLng }, { lat: incident.lat, lng: incident.lng }),
      };
    }
  }

  const candidateDevices: Record<string, unknown>[] = [];
  if (!activeVolunteer && incident.status !== "CLOSED") {
    for (const alert of alerts.filter((a) => a.status === "PENDING")) {
      const device = await prisma.aEDDevice.findUnique({
        where: { id: alert.deviceId },
        include: { owner: true },
      });
      if (!device) continue;
      const vLat = device.owner.volunteerLat ?? device.lastLat;
      const vLng = device.owner.volunteerLng ?? device.lastLng;
      const distance = distanceMeters(incident.lat, incident.lng, vLat, vLng);
      candidateDevices.push({
        id: device.id,
        alertId: alert.id,
        ownerName: device.owner.firstName,
        phone: device.owner.phone,
        aedStatus: device.status,
        loraId: device.loraDeviceId,
        lastKnownGPS: { lat: vLat, lng: vLng },
        batteryStatus: device.batteryLevel,
        distanceMeters: Math.round(distance),
        etaMinutes: Math.max(2, Math.round((distance / 230) * 0.8)),
        route: buildSimulatorRoute({ lat: vLat, lng: vLng }, { lat: incident.lat, lng: incident.lng }),
        alertStatus: alert.status,
        isOnline: isVolunteerOnline(device.owner.volunteerOnlineAt),
      });
    }
  }

  res.json({
    incident,
    timeline,
    activeVolunteer,
    candidateDevices,
    onlineVolunteers: (await getOnlineVolunteerDevices()).map((d) =>
      mapDeviceToVolunteer(d, incident.lat, incident.lng),
    ),
    closure:
      incident.status === "CLOSED"
        ? {
            note: incident.volunteerNote,
            reason: incident.closureReason,
            closedAt: incident.closedAt,
          }
        : null,
  });
});

app.post("/simulator/incidents/:id/alert", requireAdmin, async (req, res) => {
  const incidentId = String(req.params.id);
  await fetch(`${SIMULATOR_URL}/incident-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incidentId, type: "ALERT_SENT", payload: req.body }),
  });
  res.json({ ok: true });
});

app.post("/simulator/incidents/:id/accept", requireAdmin, async (req, res) => {
  const incidentId = String(req.params.id);
  const body = z.object({ deviceId: z.string(), volunteer: z.string() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Bad payload" });

  await prisma.incident.update({ where: { id: incidentId }, data: { status: "ON_THE_WAY" } });

  await fetch(`${SIMULATOR_URL}/incident-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incidentId,
      type: "VOLUNTEER_ACCEPTED",
      payload: body.data,
    }),
  });
  await fetch(`${SIMULATOR_URL}/incident-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incidentId,
      type: "VOLUNTEER_ON_THE_WAY",
      payload: { volunteer: body.data.volunteer, deviceId: body.data.deviceId },
    }),
  });

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  const logs = await fetch(`${SIMULATOR_URL}/incident-events/${incidentId}`).then((r) => r.json());

  res.json({ ok: true, incident, timeline: logs });
});

const CLOSURE_REASONS = [
  "AMBULANCE_ORDERED",
  "PATIENT_RESPONDING",
  "AED_USED",
  "MDA_ARRIVED",
  "FALSE_ALARM",
  "OTHER",
] as const;

app.post("/simulator/incidents/:id/close", requireAdmin, async (req, res) => {
  const incidentId = String(req.params.id);
  const body = z
    .object({
      note: z.string().max(2000).optional(),
      closureReason: z.enum(CLOSURE_REASONS).optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Bad payload" });

  const existing = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!existing) return res.status(404).json({ message: "Not found" });
  if (existing.status === "CLOSED") return res.json({ ok: true, incident: existing });

  const incident = await prisma.incident.update({
    where: { id: incidentId },
    data: {
      status: "CLOSED",
      volunteerNote: body.data.note?.trim() || null,
      closureReason: body.data.closureReason ?? "OTHER",
      closedAt: new Date(),
    },
  });

  await prisma.volunteerAlert.updateMany({
    where: { incidentId, status: { in: ["PENDING", "ON_THE_WAY", "ARRIVED"] } },
    data: { status: "CANCELLED" },
  });

  await fetch(`${SIMULATOR_URL}/incident-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incidentId,
      type: "INCIDENT_CLOSED",
      payload: {
        volunteer: "admin",
        closureReason: body.data.closureReason ?? "OTHER",
        note: body.data.note?.trim() || null,
        closedBy: "admin",
      },
    }),
  }).catch(() => undefined);

  res.json({ ok: true, incident });
});

app.post("/simulator/telemetry/heartbeat", async (req, res) => {
  const schema = z.object({
    deviceId: z.string(),
    batteryLevel: z.number().min(0).max(100),
    lat: z.number(),
    lng: z.number(),
    hasLora: z.boolean(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bad payload" });
  await prisma.aEDDevice.updateMany({
    where: { id: parsed.data.deviceId },
    data: {
      batteryLevel: parsed.data.batteryLevel,
      lastLat: parsed.data.lat,
      lastLng: parsed.data.lng,
      hasLora: parsed.data.hasLora,
      lastSeenAt: new Date(),
    },
  });
  if (parsed.data.batteryLevel < 20) {
    const device = await prisma.aEDDevice.findUnique({
      where: { id: parsed.data.deviceId },
      include: { owner: true },
    });
    await prisma.maintenanceAlert.create({
      data: { deviceId: parsed.data.deviceId, battery: parsed.data.batteryLevel },
    });
    if (device?.owner) {
      await fetch(`${SIMULATOR_URL}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: parsed.data.deviceId,
          type: "MAINTENANCE_PUSH",
          payload: {
            phone: device.owner.phone,
            ownerName: device.owner.firstName,
            battery: parsed.data.batteryLevel,
            message: "סוללת AED/LoRa נמוכה — נדרשת טעינה/החלפה",
          },
        }),
      });
    }
  }
  await fetch(`${SIMULATOR_URL}/telemetry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: parsed.data.deviceId, type: "HEARTBEAT", payload: parsed.data }),
  });
  res.json({ ok: true });
});

app.post("/simulator/reset", async (_, res) => {
  await prisma.incident.deleteMany();
  await fetch(`${SIMULATOR_URL}/reset`, { method: "POST" });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
