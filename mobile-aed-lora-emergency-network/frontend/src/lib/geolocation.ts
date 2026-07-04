export type LocationSource = "gps" | "ip" | "manual" | "registration";

export type ResolvedLocation = {
  lat: number;
  lng: number;
  source: LocationSource;
};

function readGps(): Promise<ResolvedLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "gps",
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

export async function fetchIpLocation(): Promise<ResolvedLocation> {
  const resp = await fetch("https://ipapi.co/json/");
  if (!resp.ok) throw new Error("IP geolocation failed");
  const data = await resp.json();
  if (data.latitude == null || data.longitude == null) throw new Error("Invalid IP location");
  return { lat: Number(data.latitude), lng: Number(data.longitude), source: "ip" };
}

export async function resolveDeviceLocation(): Promise<ResolvedLocation> {
  try {
    return await readGps();
  } catch {
    return fetchIpLocation();
  }
}
