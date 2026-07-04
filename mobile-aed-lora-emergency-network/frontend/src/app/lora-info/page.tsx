const cards = [
  {
    name: "Heltec WiFi LoRa 32 V3",
    use: "מכשיר LoRa קומפקטי לנשיאה — מתנדבים, רוכבי אופניים ומטיילים",
    cost: "₪180–₪320",
    link: "https://heltec.org/project/wifi-lora-32-v3/",
    vendor: "Heltec (רשמי)",
  },
  {
    name: "LilyGo T-Beam / T-Echo",
    use: "Meshtastic עם GPS מובנה ו-Bluetooth לטלפון",
    cost: "₪250–₪450",
    link: "https://www.lilygo.cc/products/t-beam",
    vendor: "LilyGo",
  },
  {
    name: "Meshtastic — רשימת חומרה",
    use: "מדריך רשמי לבחירת מכשירים תואמים Meshtastic",
    cost: "משתנה לפי דגם",
    link: "https://meshtastic.org/docs/hardware/devices/",
    vendor: "Meshtastic.org",
  },
  {
    name: "AliExpress — Heltec V3",
    use: "חיפוש מוכן לדגמי Heltec LoRa (בדקו תדר 433 MHz)",
    cost: "₪150–₪280 + משלוח",
    link: "https://www.aliexpress.com/w/wholesale-heltec-lora-v3.html",
    vendor: "AliExpress",
  },
  {
    name: "Amazon — Meshtastic GPS",
    use: "מכשירים עם GPS לפרויקטים קהילתיים",
    cost: "משתנה",
    link: "https://www.amazon.com/s?k=meshtastic+gps+lora",
    vendor: "Amazon",
  },
  {
    name: "Banggood — LoRa 433MHz",
    use: "אפשרות רכישה חלופית — ודאו תדר 433 MHz לישראל",
    cost: "משתנה",
    link: "https://www.banggood.com/search/lora-433.html",
    vendor: "Banggood",
  },
];

export default function LoraInfoPage() {
  return (
    <div className="space-y-6">
      <section className="card">
        <h1 className="text-2xl font-bold text-black">מידע ורכישת ציוד LoRa</h1>
        <p className="mt-2 text-black">קישורים לספקים ויצרנים — ודאו תדר 433 MHz לשימוש בישראל.</p>
      </section>

      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 font-bold text-black">
        חשוב: לפרויקט זה יש לעבוד בתדר <span className="text-red-800">433 MHz</span> בלבד.
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <article key={card.name} className="card flex flex-col">
            <h2 className="font-bold text-black">{card.name}</h2>
            <p className="mt-2 flex-1 text-black">{card.use}</p>
            <p className="mt-3 text-sm font-semibold text-black">תדר: 433 MHz</p>
            <p className="text-sm font-semibold text-black">עלות משוערת: {card.cost}</p>
            <p className="text-xs font-medium text-neutral-700">ספק: {card.vendor}</p>
            <a
              href={card.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block font-bold text-blue-800 underline"
            >
              פתח באתר הספק ↗
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
