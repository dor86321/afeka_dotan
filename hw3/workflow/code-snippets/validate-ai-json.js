// n8n Code node: "Validate AI JSON"
// Accepts Groq HTTP response OR already-parsed JSON from regeneration path.

const input = $input.first().json;
const row = $('Get destination row').first().json;
let data = {};

if (input.choices?.[0]?.message?.content) {
  try {
    data = JSON.parse(input.choices[0].message.content);
  } catch (e) {
    data = {};
  }
} else {
  data = { ...input };
  delete data.choices;
  delete data.row;
}

const location = data.locationTitle || data.title || row.CityOrCountry;
let version = Number(row.Version || 1);
try {
  if ($('Update sheet on Reject').first()) {
    version = Number(row.Version || 1) + 1;
  }
} catch (e) {
  /* first run — reject node not executed */
}
if (input.version) {
  version = Number(input.version);
}

const mapCenter = data.mapCenter || {
  latitude: 48.8566,
  longitude: 2.3522,
  zoom: 12,
};

const fallbackAttractions = [
  {
    name: `${location} City Center`,
    description: `Explore the heart of ${location} with local shops, cafes, and architecture.`,
    latitude: mapCenter.latitude,
    longitude: mapCenter.longitude,
    category: 'culture',
  },
  {
    name: `${location} Historic Quarter`,
    description: `Walk through historic streets and landmarks that define ${location}.`,
    latitude: mapCenter.latitude + 0.01,
    longitude: mapCenter.longitude + 0.01,
    category: 'history',
  },
  {
    name: `${location} Scenic Viewpoint`,
    description: `A popular viewpoint with panoramic views over ${location}.`,
    latitude: mapCenter.latitude - 0.008,
    longitude: mapCenter.longitude + 0.012,
    category: 'viewpoint',
  },
];

let attractions = Array.isArray(data.attractions) ? data.attractions : [];
if (attractions.length < 3) {
  attractions = [...attractions, ...fallbackAttractions].slice(0, Math.max(4, attractions.length));
}

attractions = attractions.map((a, i) => ({
  name: a.name || `Attraction ${i + 1}`,
  description: a.description || `A recommended place to visit in ${location}.`,
  latitude: Number(a.latitude) || mapCenter.latitude + i * 0.005,
  longitude: Number(a.longitude) || mapCenter.longitude + i * 0.005,
  category: a.category || 'sight',
}));

const imageSearchTerms = (data.imageSearchTerms || [
  `${location} landmark`,
  `${location} skyline`,
  `${location} culture`,
]).slice(0, 3);

const travelRecommendations =
  Array.isArray(data.travelRecommendations) && data.travelRecommendations.length >= 3
    ? data.travelRecommendations
    : [
        `Best season to visit ${location}`,
        'Use public transport or walking tours',
        'Book popular attractions in advance',
        'Try local food and markets',
        'Keep copies of maps offline',
      ];

const coordinates = attractions.map((a) => ({
  name: a.name,
  latitude: a.latitude,
  longitude: a.longitude,
}));

return {
  json: {
    title: data.title || location,
    locationTitle: location,
    country: data.country || '',
    introduction:
      data.introduction ||
      `<p>Welcome to ${location}. This AI-generated guide highlights attractions, maps, and travel tips.</p>`,
    travelRecommendations,
    attractions,
    imageSearchTerms,
    mapCenter,
    seoTitle: data.seoTitle || `${location} Travel Guide`,
    shortSummary: data.shortSummary || `Discover ${location} with attractions, maps, and tips.`,
    coordinates,
    row,
    version,
    UserEmail: row.UserEmail,
    CityOrCountry: row.CityOrCountry,
    userComment: input.userComment || row.UserComment || '',
  },
};
