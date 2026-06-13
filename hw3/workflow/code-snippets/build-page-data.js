// n8n Code node: "Build page data"
// Input: validated JSON from "Validate AI JSON" node

const data = $input.first().json;
const row = data.row || $('Get destination row').first().json;

const location = data.locationTitle || data.title || row.CityOrCountry;
const version = Number(data.version || row.Version || 1);

const terms = data.imageSearchTerms || ['landmark', 'cityscape', 'culture'];
const images = terms.slice(0, 3).map((term) => ({
  url: `https://source.unsplash.com/800x600/?${encodeURIComponent(term)}`,
  caption: term,
  alt: `${location} - ${term}`,
}));

const center = data.mapCenter || data.attractions?.[0] || {
  latitude: 48.8566,
  longitude: 2.3522,
  zoom: 12,
};
const lat = Number(center.latitude);
const lng = Number(center.longitude);
const zoom = center.zoom || 13;

const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.08}%2C${lat - 0.05}%2C${lng + 0.08}%2C${lat + 0.05}&layer=mapnik&marker=${lat}%2C${lng}`;
const mapLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;

const slug = location
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const ts = $now.toFormat('yyyy-MM-dd-HH-mm-ss');
const htmlFileName = `${slug}-v${version}-${ts}.html`;
const jsonFileName = `${slug}-v${version}-${ts}.json`;
const htmlFilePath = `travel-pages/${htmlFileName}`;
const jsonFilePath = `backups/${jsonFileName}`;

const coordinates = (data.coordinates || data.attractions || []).map((a) => ({
  name: a.name,
  latitude: a.latitude,
  longitude: a.longitude,
}));

const metadata = {
  location,
  country: data.country,
  version,
  rowId: row.ID,
  cityOrCountry: row.CityOrCountry,
  userEmail: row.UserEmail,
  attractions: data.attractions,
  coordinates,
  mapCenter: center,
  mapLink,
  mapEmbedUrl,
  imageSearchTerms: terms,
  seoTitle: data.seoTitle,
  shortSummary: data.shortSummary,
  executionId: $execution.id,
  createdAt: row.CreatedAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

return {
  json: {
    ...data,
    location,
    locationTitle: location,
    images,
    mapEmbedUrl,
    mapLink,
    htmlFileName,
    jsonFileName,
    htmlFilePath,
    jsonFilePath,
    coordinates,
    metadata,
    version,
    row,
    UserEmail: row.UserEmail,
    CityOrCountry: row.CityOrCountry,
  },
};
