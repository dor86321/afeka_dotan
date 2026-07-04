import Link from "next/link";
import { FlowDiagram } from "@/components/flow-diagram";

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="card overflow-hidden border-red-200 p-0">
        <div className="bg-gradient-to-l from-red-700 to-red-900 px-6 py-8 text-white">
          <p className="text-sm font-bold uppercase tracking-widest text-red-100">Life-Saving Platform Simulator</p>
          <h1 className="mt-2 text-4xl font-bold">רשת חירום AED ניידת עם LoRa</h1>
          <p className="mt-3 max-w-3xl text-base text-red-50">
            מיפוי והתרעה על defibrillator ניידים בזמן דום לב — במיוחד בשטח פתוח ללא קליטה סלולרית.
          </p>
        </div>
        <div className="space-y-3 px-6 py-5 text-black">
          <p>LoRa היא תקשורת ארוכת טווח עם צריכת חשמל נמוכה, שפועלת גם ללא קליטה סלולרית.</p>
          <p>בעת קריאת מצוקה, השרת מזהה מכשירי AED ניידים ומתנדבים קרובים לפי מיקום ועדכניות דיווח.</p>
          <p>המערכת שולחת התראות במקביל דרך Push/SMS ודרך LoRa/Meshtastic כדי לצמצם זמן הגעה.</p>
          <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-4 font-bold text-red-900">
            חובה להתקשר מיד למד״א 101. הפלטפורמה היא סימולטור לימודי ואינה מחליפה שירותי חירום.
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-black">ציר זמן רפואי קריטי</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-black">
            <p className="font-bold text-emerald-800">0–4 דקות</p>
            <p className="mt-1">חלון הזהב — סיכוי הישרדות עד 70%+ עם דפיברילציה מוקדמת.</p>
          </div>
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-black">
            <p className="font-bold text-amber-800">4–10 דקות</p>
            <p className="mt-1">כל דקה ללא דפיברילציה מורידה סיכוי הישרדות בכ-7%–10%.</p>
          </div>
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-black">
            <p className="font-bold text-red-800">מעל 10 דקות</p>
            <p className="mt-1">סיכוי הישרדות נמוך מאוד ללא CPR, אך AED עדיין עשוי לסייע.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-4 text-xl font-bold text-black">זרימת מערכת — LoRa/Meshtastic + סלולר</h2>
        <FlowDiagram />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/registration" className="card flex items-center justify-center bg-emerald-700 text-center font-bold text-white transition hover:bg-emerald-800">
          רישום AED נייד / מתנדב LoRa
        </Link>
        <Link href="/simulator" className="card flex items-center justify-center bg-red-700 text-center font-bold text-white transition hover:bg-red-800">
          מסך 1: סימולטור חירום (Desktop)
        </Link>
      </section>

      <section className="card text-black">
        <a className="font-bold text-blue-800 underline" href="https://www.mdais.org/101/aed" target="_blank" rel="noreferrer">
          למפת AED קבועים (מד״א / מפה רשמית)
        </a>
        <p className="mt-2 text-sm font-medium">הפרויקט הוא סימולטור הדגמה לקורס טכנולוגיות ווב.</p>
      </section>
    </div>
  );
}
