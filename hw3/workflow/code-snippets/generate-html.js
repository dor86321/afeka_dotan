// n8n Code node: "Generate HTML"
// Paste template from templates/travel-page-template.html into TEMPLATE constant
// or load via separate Set node.

const data = $input.first().json;

// --- EMBED FULL TEMPLATE HERE (minified one-liner optional) ---
// For import: copy contents of templates/travel-page-template.html
const fs = ''; // replaced at build time — use Read Binary or include template string in workflow

// If template is in static data from "Set - HTML Template" node:
const TEMPLATE = $getWorkflowStaticData('global').htmlTemplate
  || `<!-- PASTE travel-page-template.html FROM REPO -->`;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const intro = data.introduction || '';
const recs = (data.travelRecommendations || [])
  .map((r) => `<li>${esc(r)}</li>`)
  .join('\n');

const attractions = data.attractions || [];
const attractionsHtml = attractions
  .map(
    (a) => `
    <article class="card">
      <span class="badge">${esc(a.category || 'sight')}</span>
      <h3>${esc(a.name)}</h3>
      <p>${esc(a.description)}</p>
      <p class="coords">${a.latitude}, ${a.longitude}</p>
    </article>`
  )
  .join('');

const coordsRows = attractions
  .map(
    (a) =>
      `<tr><td>${esc(a.name)}</td><td>${a.latitude}</td><td>${a.longitude}</td></tr>`
  )
  .join('');

const images = data.images || [];
const imagesHtml = images
  .map(
    (img, i) => `
    <figure>
      <img src="${esc(img.url)}" alt="${esc(img.alt || 'Photo ' + (i + 1))}" loading="lazy">
      <figcaption>${esc(img.caption)}</figcaption>
    </figure>`
  )
  .join('');

const mapEmbed = `<iframe title="Map of ${esc(data.location)}" src="${esc(data.mapEmbedUrl)}" loading="lazy" allowfullscreen></iframe>`;

const heroImage = images[0]?.url || 'https://source.unsplash.com/1200x600/?travel';

let html = TEMPLATE;
if (!html.includes('{{TITLE}}')) {
  throw new Error('HTML template not loaded. Paste templates/travel-page-template.html into workflow static data or this node.');
}

html = html
  .replace(/\{\{TITLE\}\}/g, esc(data.locationTitle || data.location))
  .replace(/\{\{HERO_IMAGE\}\}/g, heroImage)
  .replace(/\{\{INTRO\}\}/g, intro)
  .replace(/\{\{RECOMMENDATIONS\}\}/g, recs)
  .replace(/\{\{ATTRACTIONS_HTML\}\}/g, attractionsHtml)
  .replace(/\{\{IMAGES_HTML\}\}/g, imagesHtml)
  .replace(/\{\{MAP_EMBED\}\}/g, mapEmbed)
  .replace(/\{\{COORDS_ROWS\}\}/g, coordsRows)
  .replace(/\{\{YEAR\}\}/g, String(new Date().getFullYear()));

const githubRawUrl = `https://raw.githubusercontent.com/YOUR_OWNER/YOUR_REPO/main/${data.htmlFilePath || 'travel-pages/' + data.htmlFileName}`;

return {
  json: {
    ...data,
    html,
    githubRawUrl,
    metadata: {
      ...data.metadata,
      htmlLength: html.length,
    },
  },
};
