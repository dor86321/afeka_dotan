export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildSimulatorRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  const midLat = (start.lat + end.lat) / 2 + 0.0025;
  const midLng = (start.lng + end.lng) / 2 - 0.002;
  return [
    [start.lat, start.lng],
    [midLat, midLng],
    [end.lat, end.lng],
  ];
}

export function channelStatus(hasLora: boolean, noCellularMode: boolean, noGatewayMode: boolean) {
  if (hasLora && !noGatewayMode && !noCellularMode) return "BOTH";
  if (!noCellularMode) return "CELLULAR";
  if (hasLora && !noGatewayMode) return "LORA";
  return "OFFLINE";
}
