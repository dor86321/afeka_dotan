export default function TechnologyPage() {
  const topics = [
    { title: "מה זה LoRa?", body: "תקשורת אלחוטית לטווח ארוך עם צריכת חשמל נמוכה — ללא תלות בספק סלולרי או מנוי חודשי." },
    { title: "מה זה Meshtastic?", body: "תוכנה שהופכת מכשירי LoRa לרשת Mesh קהילתית: כל צומת יכול להעביר הודעות, כולל מיקום GPS." },
    { title: "מה קורה בלי קליטה סלולרית?", body: "ההתראה עוברת דרך LoRa Gateway למתנדבים קרובים, עם הצפנה (AES-256) ברשת Meshtastic." },
    { title: "איך הטלפון מתחבר?", body: "מכשיר LoRa מתקשר לטלפון ב-Bluetooth — חוויית צ׳אט/מפה גם ללא אינטרנט." },
    { title: "למה Gateways חשובים?", body: "תחנות שער (אמבulance, מתנדבים, בתים ליד שמורות טבע) מגשרות LoRa ↔ אינטרנט." },
    { title: "המשך עתידי", body: "מפות אופליין, נתיבי טרקים בינלאומיים, ושילוב אמצעי חירום לווייניים." },
  ];

  return (
    <div className="space-y-4">
      <section className="card">
        <h1 className="text-2xl font-bold text-black">הסבר טכנולוגי: LoRa ו-Meshtastic</h1>
        <p className="mt-2 text-black">טכנולוגיות התקשורת שמאפשרות התרעה גם בשטח פתוח ללא קליטה.</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {topics.map((t) => (
          <article key={t.title} className="card">
            <h2 className="font-bold text-red-800">{t.title}</h2>
            <p className="mt-2 text-black">{t.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
