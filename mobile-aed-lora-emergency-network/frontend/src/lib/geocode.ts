export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; label: string }> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("Empty address");
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=il&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Address not found");
  }
  const hit = results[0];
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    label: hit.display_name as string,
  };
}
