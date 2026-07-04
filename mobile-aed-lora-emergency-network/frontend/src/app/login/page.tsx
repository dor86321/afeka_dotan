"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";

import { setAdminSession } from "@/lib/admin-auth";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = params.get("role") === "admin" ? "admin" : "volunteer";
  const [tab, setTab] = useState<"admin" | "volunteer">(initialTab);
  const [error, setError] = useState("");

  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [volFirst, setVolFirst] = useState(params.get("firstName") ?? "");
  const [volPhone, setVolPhone] = useState(params.get("phone") ?? "");

  async function loginAdmin(e: FormEvent) {
    e.preventDefault();
    setError("");
    const resp = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: adminUser, password: adminPass }),
    });
    if (!resp.ok) return setError("פרטי אדמין שגויים");
    const data = await resp.json();
    setAdminSession(data.accessToken, data.admin?.username ?? adminUser);
    localStorage.removeItem("volunteerToken");
    localStorage.removeItem("volunteerProfile");
    router.push("/admin");
  }

  async function loginVolunteer(e: FormEvent) {
    e.preventDefault();
    setError("");
    const resp = await fetch(`${API}/auth/volunteer/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: volFirst.trim(), phone: volPhone.trim() }),
    });
    if (!resp.ok) return setError("משתמש לא נמצא. הירשמו תחילה.");
    const data = await resp.json();
    localStorage.setItem("volunteerToken", data.accessToken);
    localStorage.setItem(
      "volunteerProfile",
      JSON.stringify({ ...data.volunteer, deviceLocation: data.deviceLocation ?? null }),
    );
    localStorage.removeItem("accessToken");
    if (data.deviceLocation) {
      await fetch(`${API}/volunteer/location`, {
        method: "POST",
        headers: { Authorization: `Bearer ${data.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: data.deviceLocation.lat,
          lng: data.deviceLocation.lng,
          source: "registration",
        }),
      });
    }
    await fetch(`${API}/volunteer/presence`, {
      method: "POST",
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    router.push("/volunteer");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header className="card text-center">
        <h1 className="text-2xl font-bold text-black">התחברות למערכת</h1>
        <p className="mt-2 text-sm font-medium text-black">אדמין — ניהול מלא · מתנדב — קבלת התרעות חירום</p>
      </header>

      <div className="flex rounded-xl border-2 border-slate-300 bg-white p-1">
        <button
          type="button"
          className={`flex-1 rounded-lg py-3 text-sm font-bold ${tab === "volunteer" ? "bg-red-700 text-white" : "text-black"}`}
          onClick={() => setTab("volunteer")}
        >
          מתנדב / AED
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg py-3 text-sm font-bold ${tab === "admin" ? "bg-slate-800 text-white" : "text-black"}`}
          onClick={() => setTab("admin")}
        >
          אדמין
        </button>
      </div>

      {tab === "admin" ? (
        <form className="card space-y-4" onSubmit={loginAdmin}>
          <h2 className="font-bold text-black">כניסת מנהל מערכת</h2>
          <input className="field" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} placeholder="שם משתמש" autoComplete="off" required />
          <input className="field" type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="סיסמה" autoComplete="new-password" required />
          <button type="submit" className="btn-primary w-full">כניסה ללוח ניהול</button>
        </form>
      ) : (
        <form className="card space-y-4" onSubmit={loginVolunteer}>
          <h2 className="font-bold text-black">כניסת מתנדב</h2>
          <p className="text-sm font-medium text-black">לאחר הרשמה — התחברו עם שם פרטי וטלפון (ללא סיסמה)</p>
          <input className="field" value={volFirst} onChange={(e) => setVolFirst(e.target.value)} placeholder="שם פרטי" required />
          <input className="field" type="tel" value={volPhone} onChange={(e) => setVolPhone(e.target.value)} placeholder="טלפון נייד" required />
          <button type="submit" className="btn-primary w-full">כניסה לאפליקציית מתנדב</button>
          <Link href="/registration" className="block text-center text-sm font-bold text-red-800 underline">
            עדיין לא נרשמת? לחץ להרשמה
          </Link>
        </form>
      )}

      {error && <p className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card text-center font-bold text-black">טוען...</div>}>
      <LoginForm />
    </Suspense>
  );
}
