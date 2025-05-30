import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { LatLngExpression } from "leaflet";

interface SearchAreaMapProps {
  searchArea: any;
}

export default function SearchAreaMap({ searchArea }: SearchAreaMapProps) {
  const [coordinates, setCoordinates] = useState<LatLngExpression[]>([]);
  const [center, setCenter] = useState<[number, number]>([45.464, 9.19]);

  useEffect(() => {
    try {
      console.log("🗺️ SearchAreaMap - Dati ricevuti:", searchArea);
      
      if (!searchArea) {
        console.log("❌ Nessun searchArea fornito");
        return;
      }

      let searchAreaData;
      if (typeof searchArea === 'string') {
        searchAreaData = JSON.parse(searchArea);
      } else {
        searchAreaData = searchArea;
      }

      console.log("📍 SearchAreaData processato:", searchAreaData);

      if (searchAreaData?.geometry?.coordinates?.[0]) {
        // Converti coordinate da [lng, lat] a [lat, lng] per Leaflet
        const coords = searchAreaData.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
        
        // Calcola il centro del poligono
        const centerLat = coords.reduce((sum: number, coord: [number, number]) => sum + coord[0], 0) / coords.length;
        const centerLng = coords.reduce((sum: number, coord: [number, number]) => sum + coord[1], 0) / coords.length;
        
        console.log("🎯 Centro calcolato:", { centerLat, centerLng });
        console.log("🔷 Coordinate del poligono per Leaflet:", coords);
        console.log("🔷 Numero di coordinate:", coords.length);
        
        setCoordinates(coords);
        setCenter([centerLat, centerLng]);
      } else {
        console.error("❌ Struttura dati searchArea non valida:", searchAreaData);
      }
    } catch (error) {
      console.error("❌ Errore nel parsing dell'area di ricerca:", error);
    }
  }, [searchArea]);

  return (
    <div className="h-64 w-full rounded-lg overflow-hidden border">
      <MapContainer
        key={`map-${coordinates.length}`}
        style={{ height: "100%", width: "100%" }}
        center={center}
        zoom={15}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {coordinates.length > 0 && (
          <Polygon
            positions={coordinates}
            pathOptions={{
              color: "#ff0000",
              fillColor: "#ff0000",
              fillOpacity: 0.4,
              weight: 4,
              opacity: 1
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}