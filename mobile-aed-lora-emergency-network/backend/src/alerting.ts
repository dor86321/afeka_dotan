import { channelStatus } from "./simulator";
import { meshtasticPayload, simulateMeshtasticDownlink, type MeshNode } from "./meshtastic";
import { prisma } from "./prisma";

const SIMULATOR_URL = process.env.SIMULATOR_URL ?? "http://localhost:4200";

export type AlertTarget = {
  deviceId: string;
  userId: string;
  ownerName: string;
  phone: string;
  hasLora: boolean;
  loraId: string | null;
  lat: number;
  lng: number;
  channel: string;
  distanceMeters?: number;
  etaMinutes?: number;
};

export type AlertDelivery = {
  deviceId: string;
  ownerName: string;
  cellular: { push: boolean; sms: boolean; reason?: string } | null;
  meshtastic: {
    delivered: boolean;
    gatewayLoraId: string | null;
    meshHops: number;
    carriersUsed: string[];
    deviceState: string;
    reason?: string;
  } | null;
};

async function logIncidentEvent(incidentId: string, type: string, payload: unknown) {
  try {
    await fetch(`${SIMULATOR_URL}/incident-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId, type, payload }),
    });
  } catch {
    // Simulator service optional — alerts still persist in DB
  }
}

async function logTelemetry(deviceId: string, type: string, payload: unknown) {
  try {
    await fetch(`${SIMULATOR_URL}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, type, payload }),
    });
  } catch {
    // ignore
  }
}

/** Parallel hybrid alerting: Cellular (Push/SMS) + Meshtastic LoRa downlink */
export async function dispatchHybridAlerts(
  incidentId: string,
  incidentLat: number,
  incidentLng: number,
  targets: AlertTarget[],
  meshNodes: MeshNode[],
  options: { noCellularMode: boolean; noGatewayMode: boolean },
): Promise<{ deliveries: AlertDelivery[]; timeline: string[] }> {
  const timeline: string[] = ["INCIDENT_CREATED"];
  const deliveries: AlertDelivery[] = [];
  const meshMessage = meshtasticPayload(incidentId, incidentLat, incidentLng);

  await logIncidentEvent(incidentId, "INCIDENT_CREATED", {
    lat: incidentLat,
    lng: incidentLng,
    targetCount: targets.length,
  });

  for (const target of targets) {
    const channel = target.channel;
    let cellular: AlertDelivery["cellular"] = null;
    let meshtastic: AlertDelivery["meshtastic"] = null;

    // --- Cellular channel (Push + SMS) ---
    if ((channel === "CELLULAR" || channel === "BOTH") && !options.noCellularMode) {
      cellular = { push: true, sms: true };
      await logIncidentEvent(incidentId, "CELLULAR_PUSH", {
        deviceId: target.deviceId,
        phone: target.phone,
        volunteer: target.ownerName,
      });
      await logIncidentEvent(incidentId, "CELLULAR_SMS", {
        deviceId: target.deviceId,
        phone: target.phone,
        message: `חירום AED: דום לב ב-${incidentLat.toFixed(4)}, ${incidentLng.toFixed(4)}. התקשרו 101.`,
      });
      await logTelemetry(target.deviceId, "ALERT", { channel: "CELLULAR", push: true, sms: true });
      timeline.push(`CELLULAR_PUSH:${target.ownerName}`);
      timeline.push(`CELLULAR_SMS:${target.ownerName}`);
    } else if (options.noCellularMode) {
      cellular = { push: false, sms: false, reason: "No cellular reception (simulated)" };
    }

    // --- Meshtastic / LoRa channel ---
    if ((channel === "LORA" || channel === "BOTH") && target.hasLora) {
      const downlink = simulateMeshtasticDownlink(
        {
          deviceId: target.deviceId,
          loraId: target.loraId ?? "",
          lat: target.lat,
          lng: target.lng,
          hasLora: target.hasLora,
        },
        meshNodes,
        incidentLat,
        incidentLng,
        options.noGatewayMode,
      );

      meshtastic = {
        delivered: downlink.delivered,
        gatewayLoraId: downlink.gatewayLoraId,
        meshHops: downlink.meshHops,
        carriersUsed: downlink.carriersUsed,
        deviceState: downlink.deviceState,
        reason: downlink.reason,
      };

      await logIncidentEvent(incidentId, "MESHTASTIC_DOWNLINK", {
        ...meshMessage,
        targetLoraId: target.loraId,
        encrypted: downlink.encrypted,
      });

      if (downlink.gatewayLoraId) {
        await logIncidentEvent(incidentId, "GATEWAY_REACHED", {
          gatewayLoraId: downlink.gatewayLoraId,
          meshHops: downlink.meshHops,
          carriersUsed: downlink.carriersUsed,
        });
        timeline.push(`GATEWAY_REACHED:${downlink.gatewayLoraId}`);
      }

      if (downlink.delivered) {
        await logIncidentEvent(incidentId, "DEVICE_BEEPING", {
          deviceId: target.deviceId,
          loraId: target.loraId,
          state: downlink.deviceState,
          viaBluetooth: "Phone receives alert via Meshtastic BT bridge",
        });
        await logTelemetry(target.deviceId, "DOWNLINK", {
          protocol: "Meshtastic",
          ...downlink,
          payload: meshMessage,
        });
        timeline.push(`DEVICE_BEEPING:${target.ownerName}`);
      } else {
        timeline.push(`LORA_FAILED:${target.ownerName}`);
      }
    }

    deliveries.push({ deviceId: target.deviceId, ownerName: target.ownerName, cellular, meshtastic });

    await prisma.volunteerAlert.create({
      data: {
        incidentId,
        userId: target.userId,
        deviceId: target.deviceId,
        cellularPush: cellular?.push ?? false,
        cellularSms: cellular?.sms ?? false,
        meshtasticDelivered: meshtastic?.delivered ?? false,
        meshtasticGateway: meshtastic?.gatewayLoraId ?? null,
        meshtasticBeeping: meshtastic?.delivered ?? false,
        distanceMeters: target.distanceMeters ?? null,
        etaMinutes: target.etaMinutes ?? null,
      },
    });
  }

  await logIncidentEvent(incidentId, "ALERTING_COMPLETE", {
    cellularSent: deliveries.filter((d) => d.cellular?.push).length,
    meshtasticDelivered: deliveries.filter((d) => d.meshtastic?.delivered).length,
  });
  timeline.push("ALERTING_COMPLETE");

  return { deliveries, timeline };
}

export function resolveChannel(hasLora: boolean, noCellularMode: boolean, noGatewayMode: boolean) {
  return channelStatus(hasLora, noCellularMode, noGatewayMode);
}
