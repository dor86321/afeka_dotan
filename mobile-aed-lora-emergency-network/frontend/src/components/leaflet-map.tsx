"use client";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const emergencyIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const aedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const volunteerIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const draftIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

type Device = {
  id: string;
  ownerName: string;
  batteryStatus?: number;
  channel?: string;
  lastKnownGPS: { lat: number; lng: number };
  route: number[][];
  isActiveVolunteer?: boolean;
};

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function LeafletMap({
  pin,
  incidentActive,
  devices,
  onLocationSelect,
}: {
  pin: { lat: number; lng: number };
  incidentActive: boolean;
  devices: Device[];
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = [pin.lat, pin.lng];

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-slate-200 shadow-inner">
      <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-black">
        לחצו על המפה כדי לסמן מיקום אירוע · 🔴 אירוע · 🔵 מתנדב פעיל · 🟢 AED ממתין
      </div>
      <div className="h-[480px]">
        <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <RecenterMap center={center} />
          <MapClickHandler onSelect={onLocationSelect} />
          <Marker position={[pin.lat, pin.lng]} icon={incidentActive ? emergencyIcon : draftIcon}>
            <Popup>
              {incidentActive ? "מוקד אירוע פעיל" : "מיקום נבחר (טרם נשלחה קריאה)"}
              <br />
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </Popup>
          </Marker>
          {devices.map((device) => (
            <Marker
              key={device.id}
              position={[device.lastKnownGPS.lat, device.lastKnownGPS.lng]}
              icon={device.isActiveVolunteer ? volunteerIcon : aedIcon}
            >
              <Popup>
                <strong>{device.ownerName}</strong>
                {device.isActiveVolunteer ? " · מתנדב פעיל" : " · AED ממתין"}
                <br />
                {device.batteryStatus != null && `סוללה: ${device.batteryStatus}%`}
                {device.channel && ` · ${device.channel}`}
              </Popup>
            </Marker>
          ))}
          {devices.map((d) =>
            d.route.length > 0 ? (
              <Polyline
                key={`${d.id}-route`}
                positions={d.route as [number, number][]}
                pathOptions={{
                  color: d.isActiveVolunteer ? "#1d4ed8" : "#0284c7",
                  weight: d.isActiveVolunteer ? 5 : 4,
                  dashArray: d.isActiveVolunteer ? undefined : "8 6",
                }}
              />
            ) : null,
          )}
        </MapContainer>
      </div>
    </div>
  );
}
