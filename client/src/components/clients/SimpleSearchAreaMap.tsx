import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

interface SimpleSearchAreaMapProps {
  searchArea: any;
}

export default function SimpleSearchAreaMap({ searchArea }: SimpleSearchAreaMapProps) {
  // Coordinate del cliente dal log: 
  // [[45.48955972967647,9.210321005266076],[45.4814412870147,9.210492631642266],[45.482313323977436,9.232503714388411],[45.48955972967647,9.230701637438425],[45.48955972967647,9.210321005266076]]
  const fixedPolygon: Array<[number, number]> = [
    [45.48955972967647, 9.210321005266076],
    [45.4814412870147, 9.210492631642266], 
    [45.482313323977436, 9.232503714388411],
    [45.48955972967647, 9.230701637438425],
    [45.48955972967647, 9.210321005266076]
  ];

  const center: [number, number] = [45.485, 9.221];

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
            color: "#ef4444",
            fillColor: "#ef4444", 
            fillOpacity: 0.2,
            weight: 2,
            opacity: 1
          }}
        />
      </MapContainer>
    </div>
  );
}