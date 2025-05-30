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
  // Poligono di test per Milano - hardcoded per debug
  const testPolygon: Array<[number, number]> = [
    [45.4640, 9.1896],  // Centro Milano
    [45.4740, 9.1996],  // Nord-Est
    [45.4540, 9.1996],  // Sud-Est  
    [45.4540, 9.1796],  // Sud-Ovest
    [45.4640, 9.1796]   // Nord-Ovest
  ];

  // Centro Milano
  const center: [number, number] = [45.4640, 9.1896];

  console.log("🗺️ Test polygon:", testPolygon);
  console.log("🗺️ Final positions for Leaflet:", [testPolygon]);

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
          positions={[testPolygon]}
          pathOptions={{
            color: "#ff0000",
            fillColor: "#ff0000", 
            fillOpacity: 0.5,
            weight: 5,
            opacity: 1
          }}
        />
        <Marker position={center}>
          <Popup>Centro area di ricerca</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}