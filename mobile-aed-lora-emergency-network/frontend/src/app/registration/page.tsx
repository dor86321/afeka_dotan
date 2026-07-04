"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField, FormSection } from "@/components/form-field";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const TYPE_OPTIONS = [
  {
    value: "MOBILE_AED_WITH_LORA",
    title: "בעל AED נייד + Meshtastic",
    desc: "Defibrillator נייד עם מכשיר LoRa/Meshtastic (433 MHz)",
  },
  {
    value: "MOBILE_AED_NO_LORA",
    title: "בעל AED נייד ללא LoRa",
    desc: "Defibrillator נייד — התרעה דרך סלולר בלבד",
  },
  {
    value: "LORA_CARRIER_ONLY",
    title: "נושא Meshtastic בלבד",
    desc: "מחזק את רשת ה-Mesh — אין AED",
  },
];

export default function RegistrationPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    registrationType: "MOBILE_AED_WITH_LORA",
    loraId: "",
    medicalTraining: "",
    aedStatus: "OK",
    batteryLevel: 90,
    consent: false,
    lat: 32.08,
    lng: 34.78,
  });

  const needsLora = form.registrationType !== "MOBILE_AED_NO_LORA";
  const needsAed = form.registrationType !== "LORA_CARRIER_ONLY";

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.phone.trim()) {
      return setMessage("שם פרטי וטלפון נייד הם שדות חובה.");
    }
    if (needsLora && !form.loraId.trim()) {
      return setMessage("יש להזין Meshtastic Node ID / LoRa ID (DevEUI).");
    }
    if (!form.consent) {
      return setMessage("נדרשת הסכמה להשתתפות ברשת המתנדבים.");
    }

    setSubmitting(true);
    setMessage("");
    try {
      const resp = await fetch(`${API}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setMessage(err.message === "LoRa ID is required for LoRa participation"
          ? "יש להזין Meshtastic Node ID."
          : "הרישום נכשל. בדקו את הנתונים ונסו שוב.");
        return;
      }
      const data = await resp.json();
      router.push(`/login?firstName=${encodeURIComponent(data.firstName)}&phone=${encodeURIComponent(data.phone)}`);
    } catch {
      setMessage("שגיאת רשת. ודאו שהשרת פועל.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="card border-emerald-200 bg-gradient-to-l from-emerald-50 to-white">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Volunteer Network</p>
        <h1 className="mt-1 text-3xl font-bold text-black">הרשמה לרשת AED ו-Meshtastic</h1>
        <p className="mt-2 font-medium text-black">
          הצטרפו כמתנדבים עם defibrillator נייד או כנושאי Meshtastic (433 MHz) לחיזוק רשת החירום.
        </p>
      </header>

      <form className="card space-y-6" onSubmit={submitForm}>
        <FormSection title="פרטים אישיים" description="פרטי קשר לשליחת התרעות חירום">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="שם פרטי" required>
              <input
                className="field"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="לדוגמה: יוסי"
              />
            </FormField>
            <FormField label="שם משפחה">
              <input
                className="field"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="אופציונלי"
              />
            </FormField>
            <FormField label="טלפון נייד" required hint="לשליחת Push/SMS בסימולציה">
              <input
                className="field"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="050-1234567"
              />
            </FormField>
            <FormField label="הכשרה רפואית">
              <input
                className="field"
                value={form.medicalTraining}
                onChange={(e) => setForm({ ...form, medicalTraining: e.target.value })}
                placeholder="לדוגמה: מע״ר, BLS"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="סוג השתתפות" description="בחרו את תפקידכם ברשת">
          <div className="grid gap-3">
            {TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition ${
                  form.registrationType === opt.value
                    ? "border-red-600 bg-red-50"
                    : "border-slate-300 bg-white hover:border-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="registrationType"
                  className="mt-1 h-5 w-5 accent-red-700"
                  checked={form.registrationType === opt.value}
                  onChange={() => setForm({ ...form, registrationType: opt.value })}
                />
                <span>
                  <span className="block font-bold text-black">{opt.title}</span>
                  <span className="block text-sm font-medium text-black">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </FormSection>

        {needsLora && (
          <FormSection title="Meshtastic / LoRa" description="תדר חובה: 433 MHz · הצפנה AES-256">
            <FormField label="Meshtastic Node ID / LoRa DevEUI" required hint="מזהה המכשיר ברשת ה-Mesh">
              <input
                className="field font-mono"
                value={form.loraId}
                onChange={(e) => setForm({ ...form, loraId: e.target.value })}
                placeholder="IL433-1234"
              />
            </FormField>
          </FormSection>
        )}

        {needsAed && (
          <FormSection title="פרטי AED" description="מצב המכשיר והסוללה">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="סטטוס AED">
                <select className="field" value={form.aedStatus} onChange={(e) => setForm({ ...form, aedStatus: e.target.value })}>
                  <option value="OK">תקין וזמין</option>
                  <option value="MAINTENANCE">דורש תחזוקה</option>
                  <option value="UNKNOWN">לא ידוע</option>
                </select>
              </FormField>
              <FormField label="רמת סוללה (%)" hint="0–100">
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={100}
                  value={form.batteryLevel}
                  onChange={(e) => setForm({ ...form, batteryLevel: Number(e.target.value) })}
                />
              </FormField>
            </div>
          </FormSection>
        )}

        <label className="flex items-start gap-3 rounded-xl border-2 border-slate-300 bg-white p-4">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-red-700"
            checked={form.consent}
            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          />
          <span className="text-sm font-semibold text-black">
            אני מאשר/ת הצטרפות לרשת מתנדבי החירום ומסכים/ה לקבל התרעות Push/SMS ו/או Meshtastic במקרה חירום.
          </span>
        </label>

        <button type="submit" className="btn-success w-full sm:w-auto" disabled={submitting}>
          {submitting ? "שולח..." : "שליחת הרשמה"}
        </button>

        {message && (
          <p
            className={`rounded-xl border-2 px-4 py-3 text-sm font-bold ${
              message.includes("הצלח")
                ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                : "border-red-400 bg-red-50 text-red-900"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
