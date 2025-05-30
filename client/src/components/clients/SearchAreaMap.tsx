import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

interface SearchAreaMapProps {
  searchArea: any;
}

export default function SearchAreaMap({ searchArea }: SearchAreaMapProps) {
  const [polygonCoords, setPolygonCoords] = useState<Array<[number, number]>>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([45.464, 9.19]);
  const [hasValidData, setHasValidData] = useState(false);

  useEffect(() => {
    console.log("🔍 [SearchAreaMap] Inizializzazione con searchArea:", searchArea);
    
    if (!searchArea) {
      console.log("❌ [SearchAreaMap] Nessun searchArea fornito");
      setHasValidData(false);
      return;
    }

    try {
      let areaData = searchArea;
      if (typeof searchArea === 'string') {
        console.log("📝 [SearchAreaMap] Parsing JSON string");
        areaData = JSON.parse(searchArea);
      }

      console.log("📊 [SearchAreaMap] Dati area processati:", areaData);

      if (areaData?.geometry?.coordinates?.[0]) {
        console.log("✅ [SearchAreaMap] Coordinate trovate:", areaData.geometry.coordinates[0]);
        
        // Converti da GeoJSON [lng, lat] a Leaflet [lat, lng]
        const leafletCoords: Array<[number, number]> = areaData.geometry.coordinates[0].map(
          (coord: number[]) => [coord[1], coord[0]]
        );
        
        console.log("🗺️ [SearchAreaMap] Coordinate Leaflet:", leafletCoords);
        
        // Calcola centro per centrare la mappa
        const avgLat = leafletCoords.reduce((sum, coord) => sum + coord[0], 0) / leafletCoords.length;
        const avgLng = leafletCoords.reduce((sum, coord) => sum + coord[1], 0) / leafletCoords.length;
        
        console.log("📍 [SearchAreaMap] Centro mappa calcolato:", [avgLat, avgLng]);
        
        setPolygonCoords(leafletCoords);
        setMapCenter([avgLat, avgLng]);
        setHasValidData(true);
        console.log("✅ [SearchAreaMap] Setup completato con successo");
      } else {
        console.log("❌ [SearchAreaMap] Coordinate non valide o mancanti");
        setHasValidData(false);
      }
    } catch (error) {
      console.error("❌ [SearchAreaMap] Errore nel parsing dell'area di ricerca:", error);
      setHasValidData(false);
    }
  }, [searchArea]);

  if (!hasValidData) {
    return (
      <div className="h-64 w-full rounded-lg border bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">📍</div>
          <p className="text-sm">Area di ricerca non definita</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={mapCenter}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Polygon
          positions={polygonCoords}
          pathOptions={{
            color: "#dc2626",
            fillColor: "#dc2626", 
            fillOpacity: 0.3,
            weight: 3,
            opacity: 0.8
          }}
        />
      </MapContainer>
    </div>
  );
}