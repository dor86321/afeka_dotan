"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertChannelStatus } from "@/components/alert-channel-status";
import { BatteryIndicator } from "@/components/battery-indicator";
import { ChannelBadge } from "@/components/channel-badge";
import { adminAuthHeaders } from "@/lib/admin-auth";

const DynamicMap = dynamic(() => import("@/components/leaflet-map").then((m) => m.LeafletMap), { ssr: false });
const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type TimelineEvent = {
  type: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

type ActiveVolunteer = {
  alertId: string;
  ownerName: string;
  phone: string;
  status: string;
  deviceId: string;
  aedStatus: string;
  batteryStatus: number;
  loraId?: string | null;
  distanceMeters: number | null;
  etaMinutes: number | null;
  location: { lat: number; lng: number };
  route: number[][];
};

type CandidateDevice = {
  id: string;
  alertId: string;
  ownerName: string;
  phone: string;
  aedStatus: string;
  loraId?: string | null;
  lastKnownGPS: { lat: number; lng: number };
  batteryStatus: number;
  distanceMeters: number;
  etaMinutes: number;
  route: number[][];
  channel?: string;
  alertDelivery?: {
    cellular: { push: boolean; sms: boolean; reason?: string } | null;
    meshtastic: {
      delivered: boolean;
      gatewayLoraId: string | null;
      meshHops: number;
      deviceState: string;
      reason?: string;
    } | null;
  } | null;
};

type IncidentState = {
  incident: {
    id: string;
    lat: number;
    lng: number;
    status: string;
    description?: string | null;
    incidentCategory?: string | null;
    patientAgeGroup?: string | null;
    urgencyLevel?: string | null;
  };
  timeline: TimelineEvent[];
  activeVolunteer: ActiveVolunteer | null;
  candidateDevices: CandidateDevice[];
  onlineVolunteers?: OnlineVolunteer[];
  closure: { note: string | null; reason: string | null; closedAt: string | null } | null;
};

type OnlineVolunteer = {
  id: string;
  ownerName: string;
  phone: string;
  aedStatus?: string;
  lastKnownGPS: { lat: number; lng: number };
  batteryStatus: number;
  distanceMeters: number | null;
  etaMinutes: number | null;
  route: number[][];
  locationSource?: string | null;
};

const INCIDENT_CATEGORY_OPTIONS = [
  { value: "SUSPECTED_CARDIAC_ARREST", label: "חשד לדום לב" },
  { value: "UNCONSCIOUS_NOT_BREATHING", label: "חסר הכרה / לא נושם" },
  { value: "CPR_IN_PROGRESS", label: "CPR בתהליך" },
  { value: "SEIZURE", label: "התקף" },
  { value: "OTHER_MEDICAL", label: "אירוע רפואי אחר" },
];

const PATIENT_AGE_OPTIONS = [
  { value: "ADULT", label: "מבוגר" },
  { value: "CHILD", label: "ילד" },
  { value: "ELDERLY", label: "קשיש" },
  { value: "UNKNOWN", label: "לא ידוע" },
];

const URGENCY_OPTIONS = [
  { value: "CRITICAL", label: "קריטי" },
  { value: "HIGH", label: "גבוה" },
  { value: "MODERATE", label: "בינוני" },
];

const TIMELINE_HE: Record<string, string> = {
  INCIDENT_CREATED: "אירוע נוצר — מיקום נקלט בשרת",
  ALERTING_COMPLETE: "התרעות היברידיות הושלמו",
  CELLULAR_PUSH: "Push notification נשלח",
  CELLULAR_SMS: "SMS נשלח",
  GATEWAY_REACHED: "Gateway Meshtastic הגיע",
  DEVICE_BEEPING: "מכשיר LoRa מצפצף/מהבהב",
  LORA_FAILED: "LoRa downlink נכשל",
  VOLUNTEER_ACCEPTED: "מתנדב אישר יציאה",
  VOLUNTEER_ON_THE_WAY: "מתנדב בדרך לאירוע",
  AED_ARRIVED: "AED הגיע לזירה",
  INCIDENT_CLOSED: "אירוע נסגר על ידי מתנדב",
  VOLUNTEER_LOCATION: "עדכון מיקום מתנדב",
};

function formatCreateInfo(data: {
  alertedCount: number;
  onlineVolunteersCount: number;
  inRadiusCount?: number;
}): { text: string; tone: "success" | "warn" | "error" } {
  if (data.onlineVolunteersCount === 0) {
    return {
      text: "אין מתנדבים מחוברים. פתחו את אפליקציית המתנדב והתחברו לפני יצירת האירוע.",
      tone: "error",
    };
  }
  if (data.alertedCount === 0) {
    return {
      text: "לא ניתן לשלוח התרעה — ודאו שהמתנדב נרשם עם AED ומחובר באפליקציה.",
      tone: "error",
    };
  }
  const inRadius = data.inRadiusCount ?? data.alertedCount;
  const extra =
    inRadius < data.alertedCount
      ? ` (${inRadius} בטווח, ${data.alertedCount - inRadius} מחוץ לטווח — נשלחו לכל המחוברים)`
      : "";
  return {
    text: `התרעה נשלחה ל-${data.alertedCount} מתנדבים מחוברים${extra}`,
    tone: "success",
  };
}

const CLOSURE_HE: Record<string, string> = {
  AMBULANCE_ORDERED: "הזמנת אמבולנס (101)",
  PATIENT_RESPONDING: "המטופל מגיב / יציב",
  AED_USED: "בוצעה דפיברילציה",
  MDA_ARRIVED: "כוחות מד״א הגיעו",
  FALSE_ALARM: "אירוע שווא",
  OTHER: "אחר",
};

const STATUS_HE: Record<string, string> = {
  ALERTING: "שולח התרעות",
  ON_THE_WAY: "מתנדב בדרך",
  AED_ARRIVED: "AED בזירה",
  CLOSED: "אירוע נסגר",
};

function formatEvent(event: TimelineEvent) {
  const base = TIMELINE_HE[event.type] ?? event.type;
  const p = event.payload ?? {};
  const volunteer = typeof p.volunteer === "string" ? p.volunteer : null;
  if (volunteer) return `${base} — ${volunteer}`;
  if (event.type === "INCIDENT_CLOSED" && p.closureReason) {
    return `${base} (${CLOSURE_HE[String(p.closureReason)] ?? p.closureReason})`;
  }
  if (event.type === "VOLUNTEER_LOCATION" && p.lat != null) {
    return `${base} (${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)})`;
  }
  return base;
}

export default function SimulatorPage() {
  const [lat, setLat] = useState(32.073);
  const [lng, setLng] = useState(34.786);
  const [addressQuery, setAddressQuery] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [incidentState, setIncidentState] = useState<IncidentState | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");
  const [simModes, setSimModes] = useState({ noCellularMode: false, noGatewayMode: false });
  const [description, setDescription] = useState("");
  const [incidentCategory, setIncidentCategory] = useState(INCIDENT_CATEGORY_OPTIONS[0].value);
  const [patientAgeGroup, setPatientAgeGroup] = useState(PATIENT_AGE_OPTIONS[0].value);
  const [urgencyLevel, setUrgencyLevel] = useState(URGENCY_OPTIONS[0].value);
  const [createInfo, setCreateInfo] = useState<{ text: string; tone: "success" | "warn" | "error" } | null>(null);
  const [onlineVolunteers, setOnlineVolunteers] = useState<OnlineVolunteer[]>([]);
  const [formExpanded, setFormExpanded] = useState(true);
  const [closing, setClosing] = useState(false);
  const [adminCloseNote, setAdminCloseNote] = useState("");
  const [adminClosureReason, setAdminClosureReason] = useState("OTHER");

  function resetAfterClose() {
    setIncidentId(null);
    setIncidentState(null);
    setFormExpanded(true);
    setAdminCloseNote("");
    setAdminClosureReason("OTHER");
  }

  const refreshOnlineVolunteers = useCallback(async (activeIncidentId?: string | null) => {
    const q = activeIncidentId ? `?incidentId=${activeIncidentId}` : "";
    const resp = await fetch(`${API}/simulator/online-volunteers${q}`, { headers: adminAuthHeaders() });
    if (!resp.ok) return;
    const data = await resp.json();
    setOnlineVolunteers(data.volunteers ?? []);
  }, []);

  const refreshIncident = useCallback(async (id: string) => {
    const resp = await fetch(`${API}/simulator/incidents/${id}`, { headers: adminAuthHeaders() });
    if (!resp.ok) return;
    const data: IncidentState = await resp.json();
    if (data.incident.status === "CLOSED") {
      resetAfterClose();
      setCreateInfo({ text: "האירוע נסגר — מוכן לאירוע חדש.", tone: "success" });
      void refreshOnlineVolunteers(null);
      return;
    }
    setIncidentState(data);
    if (data.onlineVolunteers) setOnlineVolunteers(data.onlineVolunteers);
  }, [refreshOnlineVolunteers]);

  useEffect(() => {
    fetch(`${API}/admin/config`, { headers: adminAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg) setSimModes({ noCellularMode: cfg.noCellularMode, noGatewayMode: cfg.noGatewayMode });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshOnlineVolunteers(incidentId);
    const id = setInterval(() => refreshOnlineVolunteers(incidentId), 3000);
    return () => clearInterval(id);
  }, [incidentId, refreshOnlineVolunteers]);

  useEffect(() => {
    if (!incidentId) return;
    refreshIncident(incidentId);
    const id = setInterval(() => refreshIncident(incidentId), 2500);
    return () => clearInterval(id);
  }, [incidentId, refreshIncident]);

  const pin = useMemo(() => ({ lat, lng }), [lat, lng]);

  function setLocation(nextLat: number, nextLng: number, label?: string) {
    setLat(Number(nextLat.toFixed(6)));
    setLng(Number(nextLng.toFixed(6)));
    if (label) setSelectedAddress(label);
    setIncidentId(null);
    setIncidentState(null);
    setCreateInfo(null);
    setFormExpanded(true);
    setError("");
  }

  function pinNearVolunteer() {
    const v = onlineVolunteers[0];
    if (!v) {
      setError("אין מתנדב מחובר — התחברו קודם באפליקציית המתנדב.");
      return;
    }
    setLat(Number(v.lastKnownGPS.lat.toFixed(6)));
    setLng(Number(v.lastKnownGPS.lng.toFixed(6)));
    setSelectedAddress(`ליד ${v.ownerName}`);
    setIncidentId(null);
    setIncidentState(null);
    setCreateInfo(null);
    setError("");
  }

  async function closeIncidentAsAdmin() {
    if (!incidentId) return;
    setClosing(true);
    setError("");
    try {
      const resp = await fetch(`${API}/simulator/incidents/${incidentId}/close`, {
        method: "POST",
        headers: adminAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          note: adminCloseNote.trim() || undefined,
          closureReason: adminClosureReason,
        }),
      });
      if (!resp.ok) throw new Error("failed");
      resetAfterClose();
      setCreateInfo({ text: "האירוע נסגר — מוכן לאירוע חדש.", tone: "success" });
      void refreshOnlineVolunteers(null);
    } catch {
      setError("סגירת האירוע נכשלה.");
    } finally {
      setClosing(false);
    }
  }

  async function searchAddress(e?: FormEvent) {
    e?.preventDefault();
    if (!addressQuery.trim()) return;
    setSearchLoading(true);
    setError("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=il&q=${encodeURIComponent(addressQuery.trim())}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        setError("לא נמצאה כתובת. נסו שם רחוב + עיר.");
        return;
      }
      const hit = results[0];
      setLocation(Number(hit.lat), Number(hit.lon), hit.display_name);
    } catch {
      setError("חיפוש כתובת נכשל.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function createIncident() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/simulator/incidents`, {
        method: "POST",
        headers: adminAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          lat,
          lng,
          source: "SIMULATOR",
          description: description.trim() || undefined,
          incidentCategory,
          patientAgeGroup,
          urgencyLevel,
        }),
      });
      if (!response.ok) throw new Error("failed");
      const data = await response.json();
      setIncidentId(data.incident.id);
      setFormExpanded(false);
      setSelectedAddress("");
      setAddressQuery("");
      setCreateInfo(formatCreateInfo(data));
      await refreshIncident(data.incident.id);
    } catch {
      setError("יצירת קריאת מצוקה נכשלה. ודאו שהשרתים פועלים.");
    } finally {
      setLoading(false);
    }
  }

  const activeVolunteer = incidentState?.activeVolunteer ?? null;
  const candidates =
    incidentState && !activeVolunteer && incidentState.incident.status !== "CLOSED"
      ? incidentState.candidateDevices.length > 0
        ? incidentState.candidateDevices
        : onlineVolunteers.map((v) => ({
            id: v.id,
            alertId: "",
            ownerName: v.ownerName,
            phone: v.phone,
            aedStatus: v.aedStatus ?? "OK",
            loraId: null,
            lastKnownGPS: v.lastKnownGPS,
            batteryStatus: v.batteryStatus,
            distanceMeters: v.distanceMeters ?? 0,
            etaMinutes: v.etaMinutes ?? 0,
            route: v.route,
            channel: undefined,
            alertDelivery: null,
          }))
      : [];

  const mapDevices = useMemo(() => {
    if (activeVolunteer) {
      return [
        {
          id: activeVolunteer.deviceId,
          ownerName: activeVolunteer.ownerName,
          batteryStatus: activeVolunteer.batteryStatus,
          lastKnownGPS: activeVolunteer.location,
          route: activeVolunteer.route,
          isActiveVolunteer: true,
        },
      ];
    }
    const source = candidates.length > 0 ? candidates : onlineVolunteers;
    return source.map((d) => ({
      id: d.id,
      ownerName: d.ownerName,
      batteryStatus: d.batteryStatus,
      channel: "channel" in d ? d.channel : undefined,
      lastKnownGPS: d.lastKnownGPS,
      route: d.route ?? [],
      isActiveVolunteer: false,
    }));
  }, [activeVolunteer, candidates, onlineVolunteers]);

  const timeline = (incidentState?.timeline ?? []).filter((e) => e.type !== "VOLUNTEER_LOCATION");
  const incidentStatus = incidentState?.incident.status ?? (incidentId ? "ALERTING" : null);

  return (
    <div className="space-y-6">
      <section className="card border-red-300 bg-gradient-to-l from-red-50 to-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-red-800">Emergency Simulator</p>
            <h1 className="mt-1 text-3xl font-bold text-black">סימולטור אירוע דום לב</h1>
            <p className="mt-2 max-w-2xl font-medium text-black">
              התרעות נשלחות לאפליקציית המתנדב. עדכונים מגיעים בזמן אמת לכרטיס האירוע.
            </p>
          </div>
          <div className="rounded-xl border-2 border-red-400 bg-red-100 px-4 py-3 text-sm font-bold text-red-900">
            חובה: התקשרו מיד למד״א 101
          </div>
        </div>
      </section>

      {(simModes.noCellularMode || simModes.noGatewayMode) && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 font-bold text-black">
          מצב סימולציה פעיל:
          {simModes.noCellularMode && " · ללא קליטה סלולרית"}
          {simModes.noGatewayMode && " · ללא Gateway Meshtastic"}
        </div>
      )}

      {incidentId && (
        <section className="card border-2 border-red-300 bg-red-50/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title mb-0">אירוע פעיל — מעקב מתנדב</h2>
            <span className="rounded-full bg-red-700 px-3 py-1 text-sm font-bold text-white">
              {incidentStatus ? (STATUS_HE[incidentStatus] ?? incidentStatus) : "פעיל"}
            </span>
          </div>

          {activeVolunteer ? (
            <article className="mt-4 rounded-2xl border-2 border-blue-400 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-black">🔵 {activeVolunteer.ownerName}</p>
                  <p className="font-semibold text-black">{activeVolunteer.phone}</p>
                </div>
                <span className="rounded-lg bg-blue-100 px-3 py-1 text-sm font-bold text-blue-900">
                  {activeVolunteer.status === "ON_THE_WAY" ? "בדרך לאירוע" : activeVolunteer.status === "ARRIVED" ? "הגיע לזירה" : activeVolunteer.status}
                </span>
              </div>
              <div className="mt-3 grid gap-1 text-sm font-medium text-black sm:grid-cols-2">
                <p>מיקום: {activeVolunteer.location.lat.toFixed(5)}, {activeVolunteer.location.lng.toFixed(5)}</p>
                <p>מרחק: {activeVolunteer.distanceMeters ?? "?"} מ׳ · ETA {activeVolunteer.etaMinutes ?? "?"} דק׳</p>
                <p>AED: {activeVolunteer.aedStatus}</p>
                <p>LoRa: {activeVolunteer.loraId ?? "ללא"}</p>
              </div>
              <BatteryIndicator level={activeVolunteer.batteryStatus} />
            </article>
          ) : (
            <p className="mt-4 font-medium text-black">ממתין למתנדב מחובר שיאשר את הקריאה באפליקציה...</p>
          )}

          {incidentState?.incident.description && (
            <p className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-black">
              <strong>תיאור:</strong> {incidentState.incident.description}
            </p>
          )}

          {incidentState?.incident.status !== "CLOSED" && (
            <div className="mt-4 rounded-xl border border-slate-300 bg-white p-4">
              <p className="text-sm font-bold text-black">סגירת אירוע (אדמין)</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <select className="field" value={adminClosureReason} onChange={(e) => setAdminClosureReason(e.target.value)}>
                  {Object.entries(CLOSURE_HE).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <input className="field" placeholder="הערה (אופציונלי)" value={adminCloseNote} onChange={(e) => setAdminCloseNote(e.target.value)} />
              </div>
              <button type="button" className="btn-secondary mt-2" onClick={closeIncidentAsAdmin} disabled={closing}>
                {closing ? "סוגר..." : "סגור אירוע"}
              </button>
            </div>
          )}
        </section>
      )}

      <DynamicMap pin={pin} incidentActive={Boolean(incidentId)} devices={mapDevices} onLocationSelect={setLocation} />

      <section className={`card space-y-4 ${incidentId ? "border-slate-200 bg-slate-50/80" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title mb-0">{incidentId ? "פרטי האירוע" : "מיקום האירוע"}</h2>
          {incidentId && (
            <button type="button" className="text-sm font-bold text-red-800 underline" onClick={() => setFormExpanded((v) => !v)}>
              {formExpanded ? "צמצם" : "הרחב"}
            </button>
          )}
        </div>

        {(!incidentId || formExpanded) && (
          <>
            <form className="grid gap-3 lg:grid-cols-[1fr_auto_auto]" onSubmit={searchAddress}>
              <input className="field" placeholder="חיפוש כתובת (לדוגמה: הרצל 1 תל אביב)" value={addressQuery} onChange={(e) => setAddressQuery(e.target.value)} disabled={Boolean(incidentId)} />
              <button type="submit" className="btn-secondary" disabled={searchLoading || Boolean(incidentId)}>{searchLoading ? "מחפש..." : "חפש כתובת"}</button>
              <button type="button" className="btn-secondary" disabled={Boolean(incidentId)} onClick={() => setLocation(31.95 + Math.random() * 0.2, 34.75 + Math.random() * 0.25, "מיקום אקראי")}>מיקום אקראי</button>
            </form>
            {onlineVolunteers.length > 0 && !incidentId && (
              <button type="button" className="btn-secondary w-full sm:w-auto" onClick={pinNearVolunteer}>
                מיקום ליד מתנדב מחובר ({onlineVolunteers[0].ownerName})
              </button>
            )}
            {selectedAddress && !incidentId && (
              <p className="rounded-xl border-2 border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-black"><strong>כתובת:</strong> {selectedAddress}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="סוג אירוע">
                <select className="field" value={incidentCategory} onChange={(e) => setIncidentCategory(e.target.value)} disabled={Boolean(incidentId)}>
                  {INCIDENT_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FormField>
              <FormField label="קבוצת גיל">
                <select className="field" value={patientAgeGroup} onChange={(e) => setPatientAgeGroup(e.target.value)} disabled={Boolean(incidentId)}>
                  {PATIENT_AGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FormField>
              <FormField label="דחיפות">
                <select className="field" value={urgencyLevel} onChange={(e) => setUrgencyLevel(e.target.value)} disabled={Boolean(incidentId)}>
                  {URGENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="תיאור לאירוע (למתנדב)">
              <textarea className="field min-h-[72px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="לדוגמה: מטופל על הרצפה, לא נושם..." disabled={Boolean(incidentId)} />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="קו רוחב"><input className="field" type="number" step="0.000001" value={lat} onChange={(e) => setLocation(Number(e.target.value), lng)} disabled={Boolean(incidentId)} /></FormField>
              <FormField label="קו אורך"><input className="field" type="number" step="0.000001" value={lng} onChange={(e) => setLocation(lat, Number(e.target.value))} disabled={Boolean(incidentId)} /></FormField>
              <div className="flex items-end"><button className="btn-primary w-full" onClick={createIncident} disabled={loading || Boolean(incidentId)}>{loading ? "שולח..." : incidentId ? "אירוע פעיל" : "צור קריאת מצוקה"}</button></div>
            </div>
          </>
        )}

        {incidentId && !formExpanded && (
          <p className="text-sm font-medium text-black">
            {lat.toFixed(5)}, {lng.toFixed(5)}
            {description ? ` · ${description.slice(0, 60)}${description.length > 60 ? "…" : ""}` : ""}
          </p>
        )}

        {error && <p className="rounded-xl border-2 border-red-400 bg-red-50 px-3 py-2 text-sm font-bold text-red-900">{error}</p>}
        {createInfo && (
          <p
            className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${
              createInfo.tone === "success"
                ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                : createInfo.tone === "warn"
                  ? "border-amber-400 bg-amber-50 text-amber-900"
                  : "border-red-400 bg-red-50 text-red-900"
            }`}
          >
            {createInfo.text}
          </p>
        )}
      </section>

      {onlineVolunteers.length > 0 && (
        <section className={`card ${incidentId ? "py-3" : "border-emerald-300 bg-emerald-50/50"}`}>
          <h2 className={`section-title ${incidentId ? "mb-1 text-base" : "mb-2"}`}>
            מתנדבים מחוברים ({onlineVolunteers.length})
          </h2>
          {!incidentId && <p className="text-sm font-medium text-black">מוצגים על המפה בירוק — מוכנים לקבל התרעה</p>}
          <ul className={`${incidentId ? "mt-1 flex flex-wrap gap-2" : "mt-3 space-y-2"}`}>
            {onlineVolunteers.map((v) => (
              <li
                key={v.id}
                className={`text-sm font-medium text-black ${incidentId ? "rounded-full border border-emerald-300 bg-white px-3 py-1" : "rounded-lg border border-emerald-300 bg-white px-3 py-2"}`}
              >
                {v.ownerName} · {v.phone}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title mb-4">
            {activeVolunteer ? "מתנדב פעיל" : incidentState?.candidateDevices.length ? "מתנדבים ממתינים לאישור" : "מתנדבים מחוברים"}
          </h2>
          {activeVolunteer ? (
            <p className="font-medium text-black">מתנדב אחרים הוסרו מהמסך. רק {activeVolunteer.ownerName} מטפל באירוע.</p>
          ) : candidates.length === 0 ? (
            <p className="font-medium text-black">
              {incidentId ? "אין מתנדבים מחוברים — פתחו את אפליקציית המתנדב והתחברו." : "טרם נשלחה קריאה."}
            </p>
          ) : (
            <div className="space-y-4">
              {candidates.map((d, index) => (
                <article key={d.id} className="rounded-2xl border-2 border-slate-200 p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-black">#{index + 1} {d.ownerName}</p>
                      <p className="font-semibold text-black">{d.phone}</p>
                    </div>
                    {d.channel && <ChannelBadge channel={d.channel} />}
                  </div>
                  <div className="grid gap-1 text-sm font-medium text-black sm:grid-cols-2">
                    <p>AED: <strong>{d.aedStatus}</strong></p>
                    <p>LoRa: <strong>{d.loraId ?? "ללא"}</strong></p>
                    <p>מרחק: <strong>{d.distanceMeters} מ׳</strong></p>
                    <p>ETA: <strong>{d.etaMinutes} דק׳</strong></p>
                  </div>
                  <BatteryIndicator level={d.batteryStatus} />
                  {d.alertDelivery && (
                    <AlertChannelStatus cellular={d.alertDelivery.cellular} meshtastic={d.alertDelivery.meshtastic} />
                  )}
                  <p className="mt-2 text-xs font-bold text-emerald-800">
                    {incidentState?.candidateDevices.length ? "ממתין לאישור באפליקציית מתנדב" : "מחובר — התרעה נשלחה"}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="section-title mb-4">ציר זמן (חדש למעלה)</h2>
          {timeline.length === 0 ? (
            <p className="font-medium text-black">לאחר שליחת קריאה יוצג כאן ציר ההתרעה.</p>
          ) : (
            <ol className="space-y-2">
              {timeline.map((event, index) => (
                <li key={`${event.type}-${event.timestamp}-${index}`} className="flex gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 text-sm font-semibold text-black">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-700 text-xs font-bold text-white">{index + 1}</span>
                  <div>
                    <p>{formatEvent(event)}</p>
                    <p className="mt-0.5 text-xs font-medium text-neutral-600">
                      {new Date(event.timestamp).toLocaleString("he-IL")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
