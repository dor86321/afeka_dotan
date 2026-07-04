"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchIpLocation, resolveDeviceLocation, type LocationSource } from "@/lib/geolocation";
import { geocodeAddress } from "@/lib/geocode";
import { playAlertPop, primeAlertSound } from "@/lib/alert-sound";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type VolunteerAlert = {
  id: string;
  status: string;
  deviceId?: string;
  cellularPush: boolean;
  cellularSms: boolean;
  meshtasticDelivered: boolean;
  meshtasticGateway: string | null;
  meshtasticBeeping: boolean;
  distanceMeters: number | null;
  etaMinutes: number | null;
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
  deviceLocation: { lat: number; lng: number } | null;
};

type Profile = {
  firstName: string;
  phone: string;
  registrationType: string;
  deviceLocation?: { lat: number; lng: number } | null;
};

const CLOSURE_OPTIONS = [
  { value: "AMBULANCE_ORDERED", label: "הזמנת אמבולנס (101)" },
  { value: "PATIENT_RESPONDING", label: "המטופל מגיב / יציב" },
  { value: "AED_USED", label: "בוצעה דפיברילציה עם AED" },
  { value: "MDA_ARRIVED", label: "כוחות מד״א הגיעו לזירה" },
  { value: "FALSE_ALARM", label: "אירוע שווא" },
  { value: "OTHER", label: "אחר" },
] as const;

const INCIDENT_CATEGORY_HE: Record<string, string> = {
  SUSPECTED_CARDIAC_ARREST: "חשד לדום לב",
  UNCONSCIOUS_NOT_BREATHING: "חסר הכרה / לא נושם",
  CPR_IN_PROGRESS: "CPR בתהליך",
  SEIZURE: "התקף",
  OTHER_MEDICAL: "אירוע רפואי אחר",
};

const PATIENT_AGE_HE: Record<string, string> = {
  ADULT: "מבוגר",
  CHILD: "ילד",
  ELDERLY: "קשיש",
  UNKNOWN: "לא ידוע",
};

const URGENCY_HE: Record<string, string> = {
  CRITICAL: "קריטי",
  HIGH: "גבוה",
  MODERATE: "בינוני",
};

const SOURCE_HE: Record<string, string> = {
  gps: "GPS מכשיר",
  ip: "מיקום לפי IP",
  manual: "ידני",
  registration: "מיקום הרשמה",
};

const STATUS_HE: Record<string, string> = {
  PENDING: "ממתין לתגובה",
  ON_THE_WAY: "בדרך",
  ARRIVED: "הגיע לזירה",
};

function pickActiveAlert(data: VolunteerAlert[]): VolunteerAlert | null {
  return (
    data.find((a) => a.status === "PENDING") ??
    data.find((a) => a.status === "ON_THE_WAY") ??
    data.find((a) => a.status === "ARRIVED") ??
    null
  );
}

export default function VolunteerAppPage() {
  const router = useRouter();
  const mutatingRef = useRef(false);
  const locRef = useRef<{ lat: number; lng: number } | null>(null);
  const sourceRef = useRef<LocationSource>("registration");
  const activeRef = useRef<VolunteerAlert | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [alerts, setAlerts] = useState<VolunteerAlert[]>([]);
  const [active, setActive] = useState<VolunteerAlert | null>(null);
  const [pulse, setPulse] = useState(false);
  const [note, setNote] = useState("");
  const [closureReason, setClosureReason] = useState<string>(CLOSURE_OPTIONS[0].value);
  const [actionError, setActionError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [locStatus, setLocStatus] = useState("מאתחל מיקום...");
  const [manualAddress, setManualAddress] = useState("");
  const [manualAddressLabel, setManualAddressLabel] = useState("");
  const [showManualLoc, setShowManualLoc] = useState(false);
  const [manualSearchLoading, setManualSearchLoading] = useState(false);
  const profileRef = useRef<Profile | null>(null);
  const knownAlertIdsRef = useRef<Set<string>>(new Set());
  const alertsInitializedRef = useRef(false);

  activeRef.current = active;

  const sendLocation = useCallback(async (incidentId?: string) => {
    const token = localStorage.getItem("volunteerToken");
    if (!token || !locRef.current) return;
    await fetch(`${API}/volunteer/location`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: locRef.current.lat,
        lng: locRef.current.lng,
        source: sourceRef.current,
        incidentId,
      }),
    });
  }, []);

  const refreshLocation = useCallback(async (opts?: { fromAddress?: boolean }) => {
    if (opts?.fromAddress) {
      if (!manualAddress.trim()) return;
      setManualSearchLoading(true);
      try {
        const hit = await geocodeAddress(manualAddress);
        locRef.current = { lat: hit.lat, lng: hit.lng };
        sourceRef.current = "manual";
        setManualAddressLabel(hit.label);
        setLocStatus(`${SOURCE_HE.manual}: ${hit.label}`);
        await sendLocation(activeRef.current?.incident.id);
      } catch {
        setLocStatus("כתובת לא נמצאה — נסו שם רחוב + עיר");
      } finally {
        setManualSearchLoading(false);
      }
      return;
    }

    setLocStatus("מעדכן מיקום...");
    try {
      const loc = await resolveDeviceLocation();
      locRef.current = { lat: loc.lat, lng: loc.lng };
      sourceRef.current = loc.source;
      setLocStatus(`${SOURCE_HE[loc.source]}: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
    } catch {
      const reg = profileRef.current?.deviceLocation;
      if (reg) {
        locRef.current = { lat: reg.lat, lng: reg.lng };
        sourceRef.current = "registration";
        setLocStatus(`${SOURCE_HE.registration}: ${reg.lat.toFixed(5)}, ${reg.lng.toFixed(5)}`);
      } else {
        try {
          const loc = await fetchIpLocation();
          locRef.current = { lat: loc.lat, lng: loc.lng };
          sourceRef.current = "ip";
          setLocStatus(`${SOURCE_HE.ip}: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
        } catch {
          setLocStatus("לא ניתן לקבל מיקום — עדכנו כתובת ידנית");
          setShowManualLoc(true);
          return;
        }
      }
    }
    await sendLocation(activeRef.current?.incident.id);
  }, [manualAddress, sendLocation]);

  const loadAlerts = useCallback(async () => {
    if (mutatingRef.current) return;
    const token = localStorage.getItem("volunteerToken");
    if (!token) {
      router.replace("/login");
      return;
    }
    await fetch(`${API}/volunteer/presence`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const resp = await fetch(`${API}/volunteer/alerts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status === 401) {
      localStorage.removeItem("volunteerToken");
      router.replace("/login");
      return;
    }
    const data: VolunteerAlert[] = await resp.json();
    const newPending = data.filter(
      (a) => a.status === "PENDING" && !knownAlertIdsRef.current.has(a.id),
    );
    if (alertsInitializedRef.current && newPending.length > 0) {
      playAlertPop();
    }
    knownAlertIdsRef.current = new Set(data.map((a) => a.id));
    alertsInitializedRef.current = true;
    setAlerts(data);
    const next = pickActiveAlert(data);
    setActive(next);
    setPulse(next?.status === "PENDING");
  }, [router]);

  useEffect(() => {
    primeAlertSound();
    const unlock = () => {
      primeAlertSound();
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);

    const raw = localStorage.getItem("volunteerProfile");
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      profileRef.current = p;
      setProfile(p);
      if (p.deviceLocation) {
        locRef.current = { ...p.deviceLocation };
        sourceRef.current = "registration";
        setLocStatus(`${SOURCE_HE.registration}: ${p.deviceLocation.lat.toFixed(5)}, ${p.deviceLocation.lng.toFixed(5)}`);
        void sendLocation();
      } else {
        void refreshLocation();
      }
    } else {
      void refreshLocation();
    }
    loadAlerts();
    const alertId = setInterval(loadAlerts, 3000);
    const presenceId = setInterval(() => {
      const token = localStorage.getItem("volunteerToken");
      if (token) {
        fetch(`${API}/volunteer/presence`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      }
    }, 10000);
    return () => {
      clearInterval(alertId);
      clearInterval(presenceId);
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAlerts]);

  useEffect(() => {
    const onCall = active && (active.status === "ON_THE_WAY" || active.status === "ARRIVED");
    const intervalMs = onCall ? 60_000 : 15 * 60_000;
    const id = setInterval(() => refreshLocation(), intervalMs);
    return () => clearInterval(id);
  }, [active?.status, active?.id, refreshLocation]);

  async function acceptAlert(alertId: string) {
    setActionError("");
    await refreshLocation();
    mutatingRef.current = true;
    setBusy(true);
    const token = localStorage.getItem("volunteerToken");
    const resp = await fetch(`${API}/volunteer/alerts/${alertId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    mutatingRef.current = false;
    setBusy(false);
    if (!resp.ok) return setActionError("אישור יציאה נכשל");
    const data = await resp.json();
    if (data.alert) {
      setActive(data.alert);
      setPulse(false);
      await sendLocation(data.alert.incident.id);
    }
    loadAlerts();
  }

  async function markArrived(alertId: string) {
    setActionError("");
    await refreshLocation();
    mutatingRef.current = true;
    setBusy(true);
    const token = localStorage.getItem("volunteerToken");
    const resp = await fetch(`${API}/volunteer/alerts/${alertId}/arrived`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    mutatingRef.current = false;
    setBusy(false);
    if (!resp.ok) return setActionError("עדכון הגעה לזירה נכשל");
    const data = await resp.json();
    if (data.alert) {
      setActive(data.alert);
      setPulse(false);
      await sendLocation(data.alert.incident.id);
    }
    loadAlerts();
  }

  async function closeIncident(alertId: string) {
    setActionError("");
    setActionMsg("");
    mutatingRef.current = true;
    setBusy(true);
    const token = localStorage.getItem("volunteerToken");
    const resp = await fetch(`${API}/volunteer/alerts/${alertId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ note: note.trim() || undefined, closureReason }),
    });
    mutatingRef.current = false;
    setBusy(false);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return setActionError(err.message ?? "סגירת אירוע נכשלה");
    }
    setActive(null);
    setNote("");
    setClosureReason(CLOSURE_OPTIONS[0].value);
    setActionMsg("האירוע נסגר בהצלחה");
    await refreshLocation();
    loadAlerts();
  }

  async function logout() {
    const token = localStorage.getItem("volunteerToken");
    if (token) {
      await fetch(`${API}/volunteer/offline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    localStorage.removeItem("volunteerToken");
    localStorage.removeItem("volunteerProfile");
    router.push("/login");
  }

  const mapsUrl = active
    ? `https://www.google.com/maps/dir/?api=1&destination=${active.incident.lat},${active.incident.lng}`
    : "#";

  function IncidentDetails({ inc }: { inc: VolunteerAlert["incident"] }) {
    if (!inc.description && !inc.incidentCategory && !inc.patientAgeGroup && !inc.urgencyLevel) return null;
    return (
      <div className="mt-3 space-y-1 rounded-xl bg-white/15 p-3 text-sm">
        {inc.incidentCategory && <p>סוג: {INCIDENT_CATEGORY_HE[inc.incidentCategory] ?? inc.incidentCategory}</p>}
        {inc.patientAgeGroup && <p>גיל: {PATIENT_AGE_HE[inc.patientAgeGroup] ?? inc.patientAgeGroup}</p>}
        {inc.urgencyLevel && <p>דחיפות: {URGENCY_HE[inc.urgencyLevel] ?? inc.urgencyLevel}</p>}
        {inc.description && <p>תיאור: {inc.description}</p>}
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="bg-red-700 px-4 py-4 text-white safe-top">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase opacity-90">Volunteer App</p>
            <h1 className="text-lg font-bold">שלום, {profile?.firstName ?? "מתנדב"}</h1>
          </div>
          <button type="button" onClick={logout} className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold">
            יציאה
          </button>
        </div>
        <p className="mt-1 text-xs font-medium">{locStatus}</p>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <section className="rounded-2xl border-2 border-slate-300 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-black">מיקום נוכחי</h3>
            <button type="button" className="text-xs font-bold text-red-800 underline" onClick={() => refreshLocation()}>
              רענן GPS
            </button>
          </div>
          <p className="mt-1 text-xs font-medium text-black">{locStatus}</p>
          <button
            type="button"
            className="mt-2 text-xs font-bold text-sky-800 underline"
            onClick={() => setShowManualLoc((v) => !v)}
          >
            {showManualLoc ? "הסתר מיקום ידני" : "עדכון מיקום ידני"}
          </button>
          {showManualLoc && (
            <div className="mt-3 space-y-2">
              <input
                className="field"
                placeholder="כתובת (לדוגמה: הרצל 1 תל אביב)"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
              />
              {manualAddressLabel && (
                <p className="text-xs font-medium text-black">נבחר: {manualAddressLabel}</p>
              )}
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={manualSearchLoading}
                onClick={() => refreshLocation({ fromAddress: true })}
              >
                {manualSearchLoading ? "מחפש..." : "שמור מיקום לפי כתובת"}
              </button>
            </div>
          )}
        </section>

        {actionMsg && (
          <p className="rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{actionMsg}</p>
        )}
        {actionError && (
          <p className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">{actionError}</p>
        )}

        {!active && (
          <section className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-6 text-center">
            <p className="text-4xl">✓</p>
            <p className="mt-2 text-lg font-bold text-black">מוכן לחירום</p>
            <p className="mt-1 text-sm font-medium text-black">מחובר — ממתין להתרעות</p>
          </section>
        )}

        {active && active.status === "PENDING" && (
          <section className={`rounded-2xl border-4 border-red-600 bg-red-600 p-5 text-white shadow-lg ${pulse ? "animate-pulse-alert" : ""}`}>
            <p className="text-center text-sm font-bold uppercase tracking-widest">🚨 התרעת חירום</p>
            <h2 className="mt-2 text-center text-2xl font-black">דום לב — AED נדרש!</h2>
            <p className="mt-3 text-center text-sm font-bold">התקשרו מיד ל-101</p>
            <IncidentDetails inc={active.incident} />
            <div className="mt-4 space-y-2 rounded-xl bg-white/15 p-3 text-sm">
              {active.cellularPush && <p>📱 Push + SMS נשלחו לטלפון שלך</p>}
              {active.meshtasticBeeping && (
                <p>📡 Meshtastic: מכשיר מצפצף {active.meshtasticGateway ? `(Gateway ${active.meshtasticGateway})` : ""}</p>
              )}
              {active.distanceMeters != null && <p>📍 מרחק: {active.distanceMeters} מ׳ · ETA ~{active.etaMinutes} דק׳</p>}
            </div>
            <button type="button" disabled={busy} className="mt-5 w-full rounded-2xl bg-white py-4 text-lg font-black text-red-700 shadow-md active:scale-95 disabled:opacity-60" onClick={() => acceptAlert(active.id)}>
              אני יוצא/ת עם AED
            </button>
          </section>
        )}

        {active && active.status === "ON_THE_WAY" && (
          <section className="rounded-2xl border-2 border-sky-500 bg-sky-50 p-5">
            <h2 className="text-xl font-bold text-black">בדרך לאירוע</h2>
            <IncidentDetails inc={active.incident} />
            <p className="mt-2 text-sm font-medium text-black">יעד: {active.incident.lat.toFixed(5)}, {active.incident.lng.toFixed(5)}</p>
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center rounded-2xl bg-sky-700 py-4 text-lg font-bold text-white">
              פתח ניווט (Maps)
            </a>
            <button type="button" disabled={busy} className="btn-success mt-3 w-full py-4 text-lg disabled:opacity-60" onClick={() => markArrived(active.id)}>
              AED הגיע לזירה
            </button>
          </section>
        )}

        {active && active.status === "ARRIVED" && (
          <section className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-5">
            <h2 className="text-xl font-bold text-black">✓ הגעת לזירה</h2>
            <p className="mt-2 text-sm font-medium text-black">עדכן את המוקד וסגור את האירוע</p>
            <label className="mt-4 block">
              <span className="field-label">הערה על האירוע (אופציונלי)</span>
              <textarea className="field min-h-[88px] resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder="לדוגמה: המטופל מגיב..." maxLength={2000} />
            </label>
            <label className="mt-3 block">
              <span className="field-label">סיבת סגירת האירוע</span>
              <select className="field" value={closureReason} onChange={(e) => setClosureReason(e.target.value)}>
                {CLOSURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <button type="button" disabled={busy} className="btn-primary mt-4 w-full py-4 text-lg disabled:opacity-60" onClick={() => closeIncident(active.id)}>
              סגור אירוע
            </button>
          </section>
        )}

        <section className="rounded-2xl border-2 border-slate-300 bg-white p-4">
          <h3 className="font-bold text-black">היסטוריית התרעות</h3>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm font-medium text-black">אין התרעות פעילות</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-200 p-2 text-sm font-medium text-black">
                  {STATUS_HE[a.status] ?? a.status} · מרחק {a.distanceMeters ?? "?"}מ׳
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-300 bg-white p-3 text-center text-xs font-bold text-black">
        <Link href="/login" className="text-red-800 underline">התחברות</Link>
      </footer>
    </div>
  );
}
