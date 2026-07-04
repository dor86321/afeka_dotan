import { distanceMeters } from "./simulator";

/** Simulated Meshtastic mesh constants (433 MHz Israel band) */
export const MESHTASTIC = {
  frequencyMhz: 433,
  encryption: "AES-256",
  maxDirectRangeMeters: 4000,
  maxGatewayRangeMeters: 12000,
  meshHopRangeMeters: 2500,
} as const;

export type MeshNode = {
  id: string;
  loraId: string;
  role: "GATEWAY" | "CARRIER_ONLY" | "AED_ATTACHED";
  lat: number;
  lng: number;
  signalStatus: string;
};

export type MeshtasticDownlinkResult = {
  deviceId: string;
  loraId: string;
  gatewayId: string | null;
  gatewayLoraId: string | null;
  meshHops: number;
  carriersUsed: string[];
  encrypted: boolean;
  delivered: boolean;
  deviceState: "BEEPING" | "BLINKING" | "OFFLINE";
  reason?: string;
};

function nearestGateway(nodes: MeshNode[], lat: number, lng: number) {
  return nodes
    .filter((n) => n.role === "GATEWAY")
    .map((n) => ({ node: n, distance: distanceMeters(lat, lng, n.lat, n.lng) }))
    .filter((g) => g.distance <= MESHTASTIC.maxGatewayRangeMeters)
    .sort((a, b) => a.distance - b.distance)[0]?.node ?? null;
}

function meshCarriersBetween(
  carriers: MeshNode[],
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;
  const used = carriers
    .filter(
      (c) =>
        distanceMeters(c.lat, c.lng, midLat, midLng) <= MESHTASTIC.meshHopRangeMeters ||
        distanceMeters(c.lat, c.lng, from.lat, from.lng) <= MESHTASTIC.meshHopRangeMeters ||
        distanceMeters(c.lat, c.lng, to.lat, to.lng) <= MESHTASTIC.meshHopRangeMeters,
    )
    .slice(0, 3)
    .map((c) => c.loraId);
  return used;
}

/** Simulates Meshtastic encrypted downlink via gateway + mesh repeaters */
export function simulateMeshtasticDownlink(
  target: { deviceId: string; loraId: string; lat: number; lng: number; hasLora: boolean },
  meshNodes: MeshNode[],
  incidentLat: number,
  incidentLng: number,
  noGatewayMode: boolean,
): MeshtasticDownlinkResult {
  if (!target.hasLora || !target.loraId) {
    return {
      deviceId: target.deviceId,
      loraId: target.loraId ?? "N/A",
      gatewayId: null,
      gatewayLoraId: null,
      meshHops: 0,
      carriersUsed: [],
      encrypted: false,
      delivered: false,
      deviceState: "OFFLINE",
      reason: "Device has no LoRa/Meshtastic radio",
    };
  }

  if (noGatewayMode) {
    return {
      deviceId: target.deviceId,
      loraId: target.loraId,
      gatewayId: null,
      gatewayLoraId: null,
      meshHops: 0,
      carriersUsed: [],
      encrypted: true,
      delivered: false,
      deviceState: "OFFLINE",
      reason: "No gateway in range (simulated no-gateway mode)",
    };
  }

  const gateway = nearestGateway(meshNodes, incidentLat, incidentLng);
  if (!gateway) {
    return {
      deviceId: target.deviceId,
      loraId: target.loraId,
      gatewayId: null,
      gatewayLoraId: null,
      meshHops: 0,
      carriersUsed: [],
      encrypted: true,
      delivered: false,
      deviceState: "OFFLINE",
      reason: "No Meshtastic gateway reachable within 12km",
    };
  }

  const carriers = meshNodes.filter((n) => n.role === "CARRIER_ONLY");
  const carriersUsed = meshCarriersBetween(
    carriers,
    { lat: gateway.lat, lng: gateway.lng },
    { lat: target.lat, lng: target.lng },
  );
  const directDistance = distanceMeters(gateway.lat, gateway.lng, target.lat, target.lng);
  const meshHops = directDistance > MESHTASTIC.maxDirectRangeMeters ? Math.max(1, carriersUsed.length) : 0;

  return {
    deviceId: target.deviceId,
    loraId: target.loraId,
    gatewayId: gateway.id,
    gatewayLoraId: gateway.loraId,
    meshHops,
    carriersUsed,
    encrypted: true,
    delivered: true,
    deviceState: "BEEPING",
  };
}

export function meshtasticPayload(incidentId: string, lat: number, lng: number) {
  return {
    protocol: "Meshtastic",
    frequencyMhz: MESHTASTIC.frequencyMhz,
    encryption: MESHTASTIC.encryption,
    messageType: "EMERGENCY_AED_REQUEST",
    incidentId,
    coordinates: { lat, lng },
    channel: "emergency-mesh",
  };
}
