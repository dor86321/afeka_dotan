/** Visual flow diagram per PRD: distress → server → dual channel alerting */
export function FlowDiagram() {
  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-slate-300 bg-white p-4">
      <div className="flex min-w-[720px] flex-col gap-4">
        <div className="flex items-center justify-center">
          <Box color="red" title="קריאת מצוקה" subtitle="GPS / כתובת / 101" />
        </div>
        <Arrow />
        <div className="flex items-center justify-center">
          <Box color="slate" title="שרת מרכזי" subtitle="Geo-fencing + דירוג AED" />
        </div>
        <Arrow />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-center text-xs font-bold uppercase text-black">ערוץ Meshtastic / LoRa</p>
            <Box color="violet" title="Gateway 433 MHz" subtitle="Mesh hops · AES-256" />
            <Arrow />
            <Box color="violet" title="מכשיר LoRa" subtitle="צפצוף / הבהוב + GPS" />
            <Arrow />
            <Box color="green" title="מתנדב + AED" subtitle="Bluetooth → אפליקציה" />
          </div>
          <div className="space-y-2">
            <p className="text-center text-xs font-bold uppercase text-black">ערוץ סלולר</p>
            <Box color="sky" title="Push + SMS" subtitle="טלפון + מיקום" />
            <Arrow />
            <Box color="sky" title="מתנדב" subtitle="שם · מספר · ניווט" />
            <Arrow />
            <Box color="green" title="הגעה לזירה" subtitle="מסלול אופניים" />
          </div>
        </div>
        <p className="text-center text-sm font-bold text-red-800">
          תמיד להתקשר תחילה למד״א 101 — המערכת משלימה, לא מחליפה
        </p>
      </div>
    </div>
  );
}

function Box({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  const colors: Record<string, string> = {
    red: "border-red-400 bg-red-50",
    slate: "border-slate-400 bg-slate-50",
    violet: "border-violet-400 bg-violet-50",
    sky: "border-sky-400 bg-sky-50",
    green: "border-emerald-400 bg-emerald-50",
  };
  return (
    <div className={`rounded-xl border-2 px-4 py-3 text-center ${colors[color]}`}>
      <p className="font-bold text-black">{title}</p>
      <p className="text-xs font-semibold text-black">{subtitle}</p>
    </div>
  );
}

function Arrow() {
  return <div className="text-center text-xl font-bold text-black">↓</div>;
}
