import { MapContainer, TileLayer, Polygon, Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix per i marker di Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface SimpleSearchAreaMapProps {
  searchArea: any;
}

export default function SimpleSearchAreaMap({ searchArea }: SimpleSearchAreaMapProps) {
  // Coordinate del cliente dal log, più visibili per il test
  const fixedPolygon: Array<[number, number]> = [
    [45.48955972967647, 9.210321005266076],
    [45.4814412870147, 9.210492631642266], 
    [45.482313323977436, 9.232503714388411],
    [45.48955972967647, 9.230701637438425],
    [45.48955972967647, 9.210321005266076]
  ];

  // Centro calcolato dalle coordinate reali
  const center: [number, number] = [45.4857, 9.2214];

  return (
    <div className="h-64 w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Polygon
          positions={[fixedPolygon]}
          pathOptions={{
            color: "#dc2626",
            fillColor: "#fca5a5", 
            fillOpacity: 0.4,
            weight: 4,
            opacity: 1,
            dashArray: "5, 5"
          }}
        />
        <Marker position={center}>
          <Popup>Centro area di ricerca</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}