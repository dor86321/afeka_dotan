"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type Stats = {
  totalUsers: number;
  totalAeds: number;
  withLora: number;
  withoutLora: number;
  carriersOnly: number;
  activeIncidents: number;
  lowBatteryDevices: number;
};

type UserRow = {
  id: string;
  firstName: string;
  lastName?: string;
  phone: string;
  registrationType: string;
  createdAt: string;
  volunteerOnlineAt?: string | null;
  locationSource?: string | null;
  volunteerLat?: number | null;
  volunteerLng?: number | null;
  aedDevice?: { batteryLevel: number; status: string } | null;
};

type SortKey = "createdAt" | "firstName" | "registrationType" | "online";

type SiteContent = {
  callForVolunteers: string;
  loraBuyInfo: string;
  maintenanceInfo: string;
  registrationHelp: string;
};

type SimConfig = {
  searchRadiusMeters: number;
  noCellularMode: boolean;
  noGatewayMode: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  MOBILE_AED_WITH_LORA: "AED + LoRa",
  MOBILE_AED_NO_LORA: "AED ללא LoRa",
  LORA_CARRIER_ONLY: "נושא LoRa בלבד",
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [content, setContent] = useState<SiteContent | null>(null);
  const [simConfig, setSimConfig] = useState<SimConfig | null>(null);
  const [contentMsg, setContentMsg] = useState("");
  const [configMsg, setConfigMsg] = useState("");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [replay, setReplay] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("ALL");
  const [onlineFilter, setOnlineFilter] = useState("ALL");
  const [userSort, setUserSort] = useState<SortKey>("createdAt");
  const [sortDesc, setSortDesc] = useState(true);

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    setError("");
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [statsRes, usersRes, alertsRes, contentRes, configRes, incidentsRes] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers }),
        fetch(`${API}/admin/users`, { headers }),
        fetch(`${API}/admin/maintenance-alerts`, { headers }),
        fetch(`${API}/public/content`),
        fetch(`${API}/admin/config`, { headers }),
        fetch(`${API}/admin/incidents`, { headers }),
      ]);

      if (statsRes.status === 401 || usersRes.status === 401 || configRes.status === 401) {
        localStorage.removeItem("accessToken");
        router.replace("/login");
        return;
      }

      if (!statsRes.ok || !usersRes.ok || !alertsRes.ok) {
        throw new Error("fetch failed");
      }

      const [s, u, a, c, cfg, inc] = await Promise.all([
        statsRes.json(),
        usersRes.json(),
        alertsRes.json(),
        contentRes.json(),
        configRes.ok ? configRes.json() : null,
        incidentsRes.ok ? incidentsRes.json() : [],
      ]);
      setStats(s);
      setUsers(Array.isArray(u) ? u : []);
      setAlerts(Array.isArray(a) ? a : []);
      if (c) {
        setContent({
          callForVolunteers: c.callForVolunteers,
          loraBuyInfo: c.loraBuyInfo,
          maintenanceInfo: c.maintenanceInfo,
          registrationHelp: c.registrationHelp,
        });
      }
      if (cfg) {
        setSimConfig({
          searchRadiusMeters: cfg.searchRadiusMeters,
          noCellularMode: cfg.noCellularMode,
          noGatewayMode: cfg.noGatewayMode,
        });
      }
      setIncidents(Array.isArray(inc) ? inc : []);
    } catch {
      setError("טעינת הנתונים נכשלה. ודאו שהשרת פועל והתחברתם מחדש.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function markHandled(alertId: string) {
    const token = localStorage.getItem("accessToken");
    await fetch(`${API}/admin/maintenance-alerts/${alertId}/handled`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, isHandled: true } : a)));
  }

  async function saveContent(key: keyof SiteContent) {
    if (!content) return;
    const token = localStorage.getItem("accessToken");
    await fetch(`${API}/admin/content/${key}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value: content[key] }),
    });
    setContentMsg("תוכן שיווקי נשמר");
  }

  async function saveSimConfig() {
    if (!simConfig) return;
    const token = localStorage.getItem("accessToken");
    const resp = await fetch(`${API}/admin/config`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(simConfig),
    });
    setConfigMsg(resp.ok ? "הגדרות סימולטור נשמרו" : "שמירה נכשלה");
  }

  async function replayIncident(incidentId: string) {
    const token = localStorage.getItem("accessToken");
    const resp = await fetch(`${API}/simulator/incidents/${incidentId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    setReplay(data.timeline ?? []);
  }

  async function exportIncident(incidentId: string) {
    const token = localStorage.getItem("accessToken");
    const resp = await fetch(`${API}/admin/incidents/${incidentId}/export`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await resp.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-${incidentId}.json`;
    a.click();
  }

  async function runHeartbeatSim() {
    const token = localStorage.getItem("accessToken");
    await fetch(`${API}/simulator/telemetry/heartbeat-all`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    loadDashboard();
  }

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const onlineMs = 10 * 60 * 1000;
    let list = users.filter((u) => {
      if (userTypeFilter !== "ALL" && u.registrationType !== userTypeFilter) return false;
      const online = u.volunteerOnlineAt && Date.now() - new Date(u.volunteerOnlineAt).getTime() <= onlineMs;
      if (onlineFilter === "ONLINE" && !online) return false;
      if (onlineFilter === "OFFLINE" && online) return false;
      if (!q) return true;
      const hay = `${u.firstName} ${u.lastName ?? ""} ${u.phone}`.toLowerCase();
      return hay.includes(q);
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (userSort === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (userSort === "firstName") cmp = a.firstName.localeCompare(b.firstName, "he");
      else if (userSort === "registrationType") cmp = a.registrationType.localeCompare(b.registrationType);
      else if (userSort === "online") {
        const ao = a.volunteerOnlineAt ? new Date(a.volunteerOnlineAt).getTime() : 0;
        const bo = b.volunteerOnlineAt ? new Date(b.volunteerOnlineAt).getTime() : 0;
        cmp = ao - bo;
      }
      return sortDesc ? -cmp : cmp;
    });
    return list;
  }, [users, userSearch, userTypeFilter, onlineFilter, userSort, sortDesc]);

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">לוח ניהול</h1>
          <p className="mt-1 text-black">סטטיסטיקות, משתמשים והתראות תחזוקה</p>
        </div>
        <button type="button" className="btn-secondary" onClick={loadDashboard} disabled={loading}>
          {loading ? "טוען..." : "רענון נתונים"}
        </button>
      </section>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900">{error}</p>
      )}

      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card title="סה״כ משתמשים רשומים" value={stats.totalUsers} accent="blue" />
          <Card title="סה״כ AED" value={stats.totalAeds} />
          <Card title="AED עם LoRa" value={stats.withLora} />
          <Card title="AED ללא LoRa" value={stats.withoutLora} />
          <Card title="נשאי LoRa בלבד" value={stats.carriersOnly} />
          <Card title="אירועים פעילים" value={stats.activeIncidents} />
          <Card title="סוללה נמוכה" value={stats.lowBatteryDevices} accent="red" />
        </div>
      )}

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-black">משתמשים רשומים ({filteredUsers.length} / {users.length})</h2>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="field lg:col-span-2"
            placeholder="חיפוש: שם / טלפון"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          <select className="field" value={userTypeFilter} onChange={(e) => setUserTypeFilter(e.target.value)}>
            <option value="ALL">כל הסוגים</option>
            <option value="MOBILE_AED_WITH_LORA">AED + LoRa</option>
            <option value="MOBILE_AED_NO_LORA">AED ללא LoRa</option>
            <option value="LORA_CARRIER_ONLY">נושא LoRa</option>
          </select>
          <select className="field" value={onlineFilter} onChange={(e) => setOnlineFilter(e.target.value)}>
            <option value="ALL">כולם</option>
            <option value="ONLINE">מחוברים כעת</option>
            <option value="OFFLINE">לא מחוברים</option>
          </select>
          <select className="field" value={userSort} onChange={(e) => setUserSort(e.target.value as SortKey)}>
            <option value="createdAt">מיון: תאריך</option>
            <option value="firstName">מיון: שם</option>
            <option value="registrationType">מיון: סוג</option>
            <option value="online">מיון: חיבור</option>
          </select>
        </div>
        <button type="button" className="btn-secondary mb-3 text-sm" onClick={() => setSortDesc((d) => !d)}>
          {sortDesc ? "↓ יורד" : "↑ עולה"}
        </button>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm text-black">
            <thead className="bg-slate-100">
              <tr className="text-right">
                <th className="px-3 py-2 font-bold">שם</th>
                <th className="px-3 py-2 font-bold">טלפון</th>
                <th className="px-3 py-2 font-bold">סוג</th>
                <th className="px-3 py-2 font-bold">סטטוס</th>
                <th className="px-3 py-2 font-bold">מיקום</th>
                <th className="px-3 py-2 font-bold">תאריך הרשמה</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center">
                    אין משתמשים להצגה
                  </td>
                </tr>
              )}
              {filteredUsers.map((u) => {
                const online = u.volunteerOnlineAt && Date.now() - new Date(u.volunteerOnlineAt).getTime() <= 10 * 60 * 1000;
                return (
                  <tr key={u.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">
                      {u.firstName} {u.lastName ?? ""}
                    </td>
                    <td className="px-3 py-2">{u.phone}</td>
                    <td className="px-3 py-2">{TYPE_LABELS[u.registrationType] ?? u.registrationType}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${online ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
                        {online ? "מחובר" : "לא מחובר"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {u.volunteerLat != null
                        ? `${u.volunteerLat.toFixed(4)}, ${u.volunteerLng?.toFixed(4)} (${u.locationSource ?? "?"})`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">{new Date(u.createdAt).toLocaleString("he-IL")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-bold text-black">התראות תחזוקה (סוללה &lt; 20%)</h2>
        <div className="space-y-2">
          {alerts.length === 0 && <p className="text-black">אין התראות פתוחות.</p>}
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-black"
            >
              <span className="font-medium">
                מכשיר {alert.deviceId.slice(0, 8)}… | סוללה {alert.battery}% | {alert.isHandled ? "טופל" : "פתוח"}
              </span>
              {!alert.isHandled && (
                <button className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white" onClick={() => markHandled(alert.id)}>
                  סמן כטופל
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {content && (
        <section className="card space-y-4">
          <h2 className="text-lg font-bold text-black">עריכת דפי שיווק</h2>
          {(
            [
              ["callForVolunteers", "קול קורא להשתתפות"],
              ["loraBuyInfo", "מידע רכישת LoRa"],
              ["maintenanceInfo", "הוראות אחזקה"],
              ["registrationHelp", "עזרה לרישום"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="field-label">{label}</label>
              <textarea
                className="field min-h-[80px]"
                value={content[key]}
                onChange={(e) => setContent({ ...content, [key]: e.target.value })}
              />
              <button type="button" className="btn-secondary mt-2" onClick={() => saveContent(key)}>
                שמור {label}
              </button>
            </div>
          ))}
          {contentMsg && <p className="font-bold text-emerald-800">{contentMsg}</p>}
        </section>
      )}

      {simConfig && (
        <section className="card space-y-4">
          <h2 className="text-lg font-bold text-black">הגדרות סימולטור</h2>
          <label className="block">
            <span className="field-label">רדיוס חיפוש (מטרים)</span>
            <input
              className="field"
              type="number"
              min={200}
              max={20000}
              value={simConfig.searchRadiusMeters}
              onChange={(e) => setSimConfig({ ...simConfig, searchRadiusMeters: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 font-bold text-black">
            <input
              type="checkbox"
              checked={simConfig.noCellularMode}
              onChange={(e) => setSimConfig({ ...simConfig, noCellularMode: e.target.checked })}
            />
            מצב סימולציה: ללא קליטה סלולרית
          </label>
          <label className="flex items-center gap-2 font-bold text-black">
            <input
              type="checkbox"
              checked={simConfig.noGatewayMode}
              onChange={(e) => setSimConfig({ ...simConfig, noGatewayMode: e.target.checked })}
            />
            מצב סימולציה: ללא Gateway Meshtastic
          </label>
          <button type="button" className="btn-primary" onClick={saveSimConfig}>
            שמור הגדרות
          </button>
          {configMsg && <p className="font-bold text-emerald-800">{configMsg}</p>}
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-black">אירועים + Replay + Export (100)</h2>
          <button type="button" className="btn-secondary" onClick={runHeartbeatSim}>סימולציית Heartbeat יומי</button>
        </div>
        {incidents.slice(0, 10).map((inc) => (
          <div key={inc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium text-black">
            <span>{inc.status} · {inc.lat.toFixed(4)}, {inc.lng.toFixed(4)} · {new Date(inc.createdAt).toLocaleString("he-IL")}</span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary py-1 text-xs" onClick={() => replayIncident(inc.id)}>Replay</button>
              <button type="button" className="btn-secondary py-1 text-xs" onClick={() => exportIncident(inc.id)}>Export JSON</button>
            </div>
          </div>
        ))}
        {replay.length > 0 && (
          <ol className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-black">
            {replay.map((e: { type: string; timestamp: string }, i: number) => (
              <li key={i}>{i + 1}. {e.type} — {new Date(e.timestamp).toLocaleTimeString("he-IL")}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Card({ title, value, accent }: { title: string; value: number; accent?: "red" | "blue" }) {
  const border =
    accent === "red" ? "border-red-200" : accent === "blue" ? "border-sky-200" : "";
  return (
    <div className={`card ${border}`}>
      <p className="text-sm font-semibold text-black">{title}</p>
      <p className="text-3xl font-bold text-black">{value}</p>
    </div>
  );
}
