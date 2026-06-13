/**
 * One-off script: generate sample travel pages in travel-pages/
 * Run: node hw3/workflow/code-snippets/generate-sample-pages.js
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../../../travel-pages');

const CSS = `:root{--bg:#0f1419;--surface:#1a2332;--accent:#3d9be9;--accent-2:#f59e0b;--text:#e8eef4;--muted:#94a3b8;--radius:14px;--shadow:0 12px 40px rgba(0,0,0,.35)}*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.65}.hero{position:relative;min-height:52vh;display:flex;align-items:flex-end;padding:3rem 1.5rem;background:linear-gradient(135deg,#1e3a5f 0%,#0f1419 60%),var(--hero-img) center/cover no-repeat;background-blend-mode:overlay}.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,var(--bg),transparent 55%)}.hero-inner{position:relative;z-index:1;max-width:1100px;margin:0 auto;width:100%}.hero h1{margin:0 0 .5rem;font-size:clamp(2rem,5vw,3.2rem);font-weight:700}.hero .tagline{color:var(--muted);font-size:1.1rem}.container{max-width:1100px;margin:0 auto;padding:2rem 1.5rem 4rem}section{margin-bottom:3rem}h2{font-size:1.5rem;margin:0 0 1.25rem;padding-bottom:.5rem;border-bottom:2px solid var(--accent);display:inline-block}.intro p{color:var(--muted);margin:0 0 1rem}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}.gallery figure{margin:0;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);background:var(--surface)}.gallery img{width:100%;height:220px;object-fit:cover;display:block}.gallery figcaption{padding:.75rem 1rem;font-size:.9rem;color:var(--muted)}.rec-list{list-style:none;padding:0;margin:0;display:grid;gap:.75rem}.rec-list li{background:var(--surface);padding:1rem 1.25rem;border-radius:var(--radius);border-left:4px solid var(--accent-2)}.attractions{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.25rem}.card{background:var(--surface);border-radius:var(--radius);padding:1.25rem;box-shadow:var(--shadow)}.card h3{margin:0 0 .5rem;font-size:1.15rem;color:var(--accent)}.card .coords{font-size:.8rem;color:var(--muted);font-family:ui-monospace,monospace;margin-top:.75rem}.card .badge{display:inline-block;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;background:rgba(61,155,233,.2);color:var(--accent);padding:.2rem .5rem;border-radius:4px;margin-bottom:.5rem}.map-wrap{border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);background:var(--surface)}.map-wrap iframe{width:100%;height:420px;border:0;display:block}.coords-table{width:100%;border-collapse:collapse;margin-top:1rem;font-size:.9rem}.coords-table th,.coords-table td{padding:.6rem .75rem;text-align:left;border-bottom:1px solid rgba(255,255,255,.08)}.coords-table th{color:var(--accent)}footer{text-align:center;padding:2rem 1.5rem;color:var(--muted);font-size:.85rem;border-top:1px solid rgba(255,255,255,.06)}@media(max-width:600px){.hero{min-height:40vh;padding:2rem 1rem}.map-wrap iframe{height:300px}}`;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mapEmbed(lat, lng) {
  const bbox = `${lng - 0.06}%2C${lat - 0.04}%2C${lng + 0.06}%2C${lat + 0.04}`;
  return `<iframe title="Map" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}" loading="lazy"></iframe>`;
}

function buildPage(p) {
  const recs = p.recommendations.map((r) => `<li>${esc(r)}</li>`).join('');
  const images = p.images
    .map(
      (img) =>
        `<figure><img src="${esc(img.url)}" alt="${esc(img.alt)}" loading="lazy"><figcaption>${esc(img.caption)}</figcaption></figure>`
    )
    .join('');
  const attractions = p.attractions
    .map(
      (a) =>
        `<article class="card"><span class="badge">${esc(a.category)}</span><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p><p class="coords">${a.lat}, ${a.lng}</p></article>`
    )
    .join('');
  const coordsRows = p.attractions
    .map((a) => `<tr><td>${esc(a.name)}</td><td>${a.lat}</td><td>${a.lng}</td></tr>`)
    .join('');
  const intro = p.intro.map((para) => `<p>${esc(para)}</p>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(p.title)} — Travel Guide</title>
  <style>${CSS}</style>
</head>
<body>
  <header class="hero" style="--hero-img: url('${esc(p.heroImage)}')">
    <div class="hero-inner">
      <h1>${esc(p.title)}</h1>
      <p class="tagline">${esc(p.tagline)}</p>
    </div>
  </header>
  <main class="container">
    <section class="intro"><h2>Introduction</h2>${intro}</section>
    <section class="gallery"><h2 style="grid-column:1/-1;border:none;margin-bottom:0">Gallery</h2>${images}</section>
    <section><h2>Travel recommendations</h2><ul class="rec-list">${recs}</ul></section>
    <section><h2>Top attractions</h2><div class="attractions">${attractions}</div></section>
    <section><h2>Map &amp; coordinates</h2><div class="map-wrap">${mapEmbed(p.mapLat, p.mapLng)}</div>
      <table class="coords-table"><thead><tr><th>Attraction</th><th>Latitude</th><th>Longitude</th></tr></thead><tbody>${coordsRows}</tbody></table>
    </section>
  </main>
  <footer><p>Generated by n8n · Groq AI · ${new Date().getFullYear()}</p><p>${esc(p.title)} travel guide</p></footer>
</body>
</html>`;
}

const pages = [
  {
    file: 'paris-v1.html',
    title: 'Paris, France',
    tagline: 'City of Light — art, cuisine, and iconic landmarks',
    heroImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Eiffel_Tower_from_the_Tour_Montparnasse_3%2C_Paris_May_2014.jpg/1280px-Eiffel_Tower_from_the_Tour_Montparnasse_3%2C_Paris_May_2014.jpg',
    mapLat: 48.8566,
    mapLng: 2.3522,
    intro: [
      'Paris is one of the world\'s great capitals — a city of elegant boulevards, world-class museums, and café culture that has inspired artists for centuries.',
      'From the Eiffel Tower to hidden patisseries in Le Marais, Paris rewards slow exploration on foot and by Metro.',
    ],
    recommendations: [
      'Buy a Paris Visite or Navigo pass for unlimited Metro and bus travel.',
      'Book timed tickets for the Louvre and Eiffel Tower weeks ahead in peak season.',
      'Visit museums on the first Sunday of the month when many offer free entry.',
      'Walk along the Seine at sunset — start near Notre-Dame and head toward the Eiffel Tower.',
      'Try a classic bistro lunch; many offer fixed-price menus at midday.',
    ],
    images: [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Eiffel_Tower_from_the_Tour_Montparnasse_3%2C_Paris_May_2014.jpg/800px-Eiffel_Tower_from_the_Tour_Montparnasse_3%2C_Paris_May_2014.jpg', caption: 'Eiffel Tower skyline', alt: 'Eiffel Tower Paris' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Louvre_Museum_Wikimedia_Commons.jpg/800px-Louvre_Museum_Wikimedia_Commons.jpg', caption: 'Louvre Museum', alt: 'Louvre Paris' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/La_Sainte-Chapelle%2C_Paris_7e.jpg/800px-La_Sainte-Chapelle%2C_Paris_7e.jpg', caption: 'Sainte-Chapelle stained glass', alt: 'Sainte-Chapelle Paris' },
    ],
    attractions: [
      { name: 'Eiffel Tower', category: 'viewpoint', lat: 48.8584, lng: 2.2945, description: 'The iron lattice tower built for the 1889 Exposition Universelle — Paris\'s most recognizable symbol with panoramic city views from the top.' },
      { name: 'Louvre Museum', category: 'culture', lat: 48.8606, lng: 2.3376, description: 'Home to the Mona Lisa and thousands of masterpieces spanning ancient civilizations to the 19th century in a former royal palace.' },
      { name: 'Notre-Dame Cathedral', category: 'history', lat: 48.853, lng: 2.3499, description: 'Gothic masterpiece on the Île de la Cité; the exterior and square remain open while restoration continues after the 2019 fire.' },
      { name: 'Montmartre & Sacré-Cœur', category: 'culture', lat: 48.8867, lng: 2.3431, description: 'Hilltop basilica with sweeping views, artist squares, and winding cobblestone streets in a bohemian neighborhood.' },
    ],
  },
  {
    file: 'tel-aviv-v1.html',
    title: 'Tel Aviv, Israel',
    tagline: 'Mediterranean beaches, Bauhaus architecture, and vibrant nightlife',
    heroImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Tel_Aviv_Skyline_2019_%28cropped%29.jpg/1280px-Tel_Aviv_Skyline_2019_%28cropped%29.jpg',
    mapLat: 32.0853,
    mapLng: 34.7818,
    intro: [
      'Tel Aviv is Israel\'s economic and cultural hub — a modern coastal city where Bauhaus buildings, tech startups, and beach life meet.',
      'Known as the "White City" for its UNESCO-listed architecture, Tel Aviv offers excellent food markets, galleries, and a relaxed Mediterranean atmosphere.',
    ],
    recommendations: [
      'Rent a bike or use Tel-O-Fun bike-share to explore the flat coastal promenade (Tayelet).',
      'Visit Carmel Market (Shuk HaCarmel) in the morning for fresh produce and street food.',
      'Beach season peaks April–October; bring sun protection and arrive early on weekends.',
      'Friday afternoons many businesses close for Shabbat — plan dining reservations ahead.',
      'Try hummus and shakshuka at local eateries in Jaffa and Florentin.',
    ],
    images: [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Tel_Aviv_Skyline_2019_%28cropped%29.jpg/800px-Tel_Aviv_Skyline_2019_%28cropped%29.jpg', caption: 'Tel Aviv skyline', alt: 'Tel Aviv skyline' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Tel_Aviv_promenade_southwards.jpg/800px-Tel_Aviv_promenade_southwards.jpg', caption: 'Beach promenade', alt: 'Tel Aviv beach' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Rothschild_Boulevard%2C_Tel_Aviv-Yafo%2C_Israel.jpg/800px-Rothschild_Boulevard%2C_Tel_Aviv-Yafo%2C_Israel.jpg', caption: 'Rothschild Boulevard', alt: 'Rothschild Tel Aviv' },
    ],
    attractions: [
      { name: 'Tel Aviv Beach & Tayelet', category: 'nature', lat: 32.079, lng: 34.768, description: 'Golden Mediterranean beaches linked by a paved promenade — ideal for swimming, jogging, and sunset walks.' },
      { name: 'Carmel Market', category: 'food', lat: 32.069, lng: 34.769, description: 'Bustling open-air market with spices, fresh fish, pastries, and casual food stalls in the heart of the city.' },
      { name: 'Old Jaffa', category: 'history', lat: 32.052, lng: 34.752, description: 'Ancient port city with stone alleys, art galleries, the clock tower, and views back toward modern Tel Aviv.' },
      { name: 'Rothschild Boulevard', category: 'culture', lat: 32.063, lng: 34.775, description: 'Tree-lined avenue showcasing Bauhaus "White City" buildings, cafés, and the Independence Hall area.' },
    ],
  },
  {
    file: 'holon-v1.html',
    title: 'Holon, Israel',
    tagline: 'Design, museums, and family-friendly attractions south of Tel Aviv',
    heroImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Design_Museum_Holon_building.jpg/1280px-Design_Museum_Holon_building.jpg',
    mapLat: 32.0167,
    mapLng: 34.7792,
    intro: [
      'Holon is a creative city in the Tel Aviv metropolitan area, known for design institutions, children\'s museums, and urban renewal projects.',
      'Once an industrial suburb, Holon has reinvented itself as a destination for culture and family outings — just a short drive or train ride from Tel Aviv.',
    ],
    recommendations: [
      'Combine Holon with a day trip from Tel Aviv — trains stop at Holon Junction and Moshe Dayan.',
      'Book tickets online for Design Museum Holon and children\'s museums on busy holidays.',
      'Visit Water Park Meymadion in summer; arrive early to avoid long queues.',
      'Explore the Mediatheque cultural center for exhibitions and performances.',
      'Evening walks around Holon Park and the lake are pleasant in spring and autumn.',
    ],
    images: [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Design_Museum_Holon_building.jpg/800px-Design_Museum_Holon_building.jpg', caption: 'Design Museum Holon', alt: 'Design Museum Holon' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Holon_City_Hall.jpg/800px-Holon_City_Hall.jpg', caption: 'Holon city center', alt: 'Holon city' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Israeli_Children%27s_Museum%2C_Holon.jpg/800px-Israeli_Children%27s_Museum%2C_Holon.jpg', caption: 'Israeli Children\'s Museum', alt: 'Children Museum Holon' },
    ],
    attractions: [
      { name: 'Design Museum Holon', category: 'culture', lat: 32.011, lng: 34.779, description: 'Ron Arad-designed museum dedicated to contemporary design — rotating exhibitions of fashion, industrial design, and art.' },
      { name: 'Israeli Children\'s Museum', category: 'culture', lat: 32.009, lng: 34.782, description: 'Interactive immersive experiences for kids and families, including dialogue-in-the-dark and invitation-to silence programs.' },
      { name: 'Meymadion Water Park', category: 'nature', lat: 32.037, lng: 34.789, description: 'Large water park with slides, pools, and wave machines — popular summer destination for families.' },
      { name: 'Holon Mediatheque', category: 'culture', lat: 32.014, lng: 34.776, description: 'Cultural complex with theater, library, galleries, and community events in a modern civic building.' },
    ],
  },
  {
    file: 'jerusalem-v1.html',
    title: 'Jerusalem, Israel',
    tagline: 'Ancient holy city — history, faith, and diverse neighborhoods',
    heroImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Dome_of_the_Rock%2C_Temple_Mount%2C_Jerusalem.jpg/1280px-Dome_of_the_Rock%2C_Temple_Mount%2C_Jerusalem.jpg',
    mapLat: 31.7683,
    mapLng: 35.2137,
    intro: [
      'Jerusalem is one of the oldest cities in the world, sacred to Judaism, Christianity, and Islam — a place where ancient stone alleys and modern neighborhoods coexist.',
      'The Old City\'s four quarters, the Mount of Olives, and vibrant markets like Mahane Yehuda make Jerusalem unforgettable for history and culture lovers.',
    ],
    recommendations: [
      'Dress modestly when visiting religious sites; shoulders and knees covered.',
      'The Old City is best explored on foot; wear comfortable shoes on cobblestones.',
      'Visit Western Wall and Temple Mount areas early to avoid crowds and midday heat.',
      'Mahane Yehuda market is lively by day and transforms into a nightlife spot on Thursday nights.',
      'Light Rail connects many neighborhoods — useful for trips to Yad Vashem or Ein Kerem.',
    ],
    images: [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Dome_of_the_Rock%2C_Temple_Mount%2C_Jerusalem.jpg/800px-Dome_of_the_Rock%2C_Temple_Mount%2C_Jerusalem.jpg', caption: 'Dome of the Rock', alt: 'Dome of the Rock Jerusalem' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Western_Wall%2C_Jerusalem%2C_2010.jpg/800px-Western_Wall%2C_Jerusalem%2C_2010.jpg', caption: 'Western Wall', alt: 'Western Wall Jerusalem' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Jerusalem_Old_City_aerial_view.jpg/800px-Jerusalem_Old_City_aerial_view.jpg', caption: 'Old City aerial view', alt: 'Jerusalem Old City' },
    ],
    attractions: [
      { name: 'Western Wall (Kotel)', category: 'history', lat: 31.7767, lng: 35.2345, description: 'Judaism\'s holiest prayer site — a remnant of the Second Temple retaining wall in the Old City.' },
      { name: 'Dome of the Rock', category: 'history', lat: 31.778, lng: 35.2354, description: 'Iconic golden-domed shrine on the Temple Mount, among Islam\'s most revered landmarks (access rules vary).' },
      { name: 'Church of the Holy Sepulchre', category: 'history', lat: 31.7784, lng: 35.2296, description: 'Major Christian pilgrimage site believed to contain Golgotha and the tomb of Jesus in the Christian Quarter.' },
      { name: 'Mahane Yehuda Market', category: 'food', lat: 31.785, lng: 35.212, description: 'Vibrant shuk with spices, halva, fresh juice, restaurants, and bars — the culinary heart of modern Jerusalem.' },
    ],
  },
  {
    file: 'bologna-v1.html',
    title: 'Bologna, Italy',
    tagline: 'Medieval towers, portico-lined streets, and Italy\'s food capital',
    heroImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Two_Towers_Bologna.jpg/1280px-Two_Towers_Bologna.jpg',
    mapLat: 44.4949,
    mapLng: 11.3426,
    intro: [
      'Bologna is the capital of Emilia-Romagna — famous for tortellini, ragù alla bolognese, and miles of elegant porticos (arcaded walkways).',
      'Home to Europe\'s oldest university, leaning medieval towers, and a beautifully preserved historic center, Bologna is one of Italy\'s most rewarding cities to explore on foot.',
    ],
    recommendations: [
      'Climb the Asinelli Tower for panoramic views — book a time slot in advance.',
      'Eat tagliatelle al ragù and mortadella at traditional trattorias in the Quadrilatero district.',
      'Walk the Portico di San Luca — 3.8 km of covered walkway to the hilltop sanctuary.',
      'Bologna is a great base for day trips to Modena, Parma, and Ravenna by train.',
      'Visit in spring or autumn for pleasant weather and fewer crowds than peak summer.',
    ],
    images: [
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Two_Towers_Bologna.jpg/800px-Two_Towers_Bologna.jpg', caption: 'Two Towers (Due Torri)', alt: 'Two Towers Bologna' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Piazza_Maggiore_%28Bologna%29.jpg/800px-Piazza_Maggiore_%28Bologna%29.jpg', caption: 'Piazza Maggiore', alt: 'Piazza Maggiore Bologna' },
      { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Portico_di_San_Luca_%28Bologna%29.jpg/800px-Portico_di_San_Luca_%28Bologna%29.jpg', caption: 'Portico di San Luca', alt: 'San Luca portico Bologna' },
    ],
    attractions: [
      { name: 'Two Towers (Due Torri)', category: 'viewpoint', lat: 44.4942, lng: 11.3467, description: 'Leaning medieval towers — Torre degli Asinelli (97 m) can be climbed for sweeping views over red rooftops.' },
      { name: 'Piazza Maggiore', category: 'culture', lat: 44.4938, lng: 11.3427, description: 'Main square surrounded by Basilica di San Petronio, Palazzo d\'Accursio, and lively cafés.' },
      { name: 'Archiginnasio & Anatomical Theatre', category: 'history', lat: 44.492, lng: 11.3435, description: 'Historic university building with carved wooden anatomical theater where medical students once studied.' },
      { name: 'Sanctuary of Madonna di San Luca', category: 'viewpoint', lat: 44.479, lng: 11.298, description: 'Hilltop basilica reached via the world\'s longest portico — a classic Bologna pilgrimage walk.' },
    ],
  },
];

fs.mkdirSync(OUT, { recursive: true });
for (const p of pages) {
  const html = buildPage(p);
  fs.writeFileSync(path.join(OUT, p.file), html, 'utf8');
  console.log('Created', p.file);
}
