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
  const [polygonCoords, setPolygonCoords] = useState<Array<[number, number]>>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([45.4640, 9.1896]);
  const [hasValidData, setHasValidData] = useState(false);

  useEffect(() => {
    console.log("🔍 [SimpleSearchAreaMap] Inizializzazione con searchArea:", searchArea);
    
    if (!searchArea) {
      console.log("❌ [SimpleSearchAreaMap] Nessun searchArea fornito");
      setHasValidData(false);
      return;
    }

    try {
      let areaData = searchArea;
      if (typeof searchArea === 'string') {
        console.log("📝 [SimpleSearchAreaMap] Parsing JSON string");
        areaData = JSON.parse(searchArea);
      }

      console.log("📊 [SimpleSearchAreaMap] Dati area processati:", areaData);

      if (areaData?.geometry?.coordinates?.[0]) {
        console.log("✅ [SimpleSearchAreaMap] Coordinate trovate:", areaData.geometry.coordinates[0]);
        
        // Converti da GeoJSON [lng, lat] a Leaflet [lat, lng]
        const leafletCoords: Array<[number, number]> = areaData.geometry.coordinates[0].map(
          (coord: number[]) => [coord[1], coord[0]]
        );
        
        console.log("🗺️ [SimpleSearchAreaMap] Coordinate Leaflet:", leafletCoords);
        
        // Calcola centro per centrare la mappa
        const avgLat = leafletCoords.reduce((sum, coord) => sum + coord[0], 0) / leafletCoords.length;
        const avgLng = leafletCoords.reduce((sum, coord) => sum + coord[1], 0) / leafletCoords.length;
        
        console.log("📍 [SimpleSearchAreaMap] Centro mappa calcolato:", [avgLat, avgLng]);
        
        setPolygonCoords(leafletCoords);
        setMapCenter([avgLat, avgLng]);
        setHasValidData(true);
        console.log("✅ [SimpleSearchAreaMap] Setup completato con successo");
      } else {
        console.log("❌ [SimpleSearchAreaMap] Coordinate non valide o mancanti");
        setHasValidData(false);
      }
    } catch (error) {
      console.error("❌ [SimpleSearchAreaMap] Errore nel parsing dell'area di ricerca:", error);
      setHasValidData(false);
    }
  }, [searchArea]);

  // Poligono di test per Milano - hardcoded per debug
  const testPolygon: Array<[number, number]> = [
    [45.4640, 9.1896],  // Centro Milano
    [45.4740, 9.1996],  // Nord-Est
    [45.4540, 9.1996],  // Sud-Est  
    [45.4540, 9.1796],  // Sud-Ovest
    [45.4640, 9.1796]   // Nord-Ovest
  ];

  console.log("🗺️ Test polygon:", testPolygon);
  console.log("🗺️ Real polygon coords:", polygonCoords);
  console.log("🗺️ Has valid data:", hasValidData);

  return (
    <div className="h-64 w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={mapCenter}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Poligono reale dell'area di ricerca del cliente */}
        {hasValidData && polygonCoords.length > 0 && (
          <Polygon
            positions={polygonCoords}
            pathOptions={{
              color: "#22c55e",
              fillColor: "#22c55e", 
              fillOpacity: 0.3,
              weight: 3,
              opacity: 0.8
            }}
          />
        )}
        
        {/* TEST POLYGON - per debug */}
        <Polygon 
          positions={[[[45.4640, 9.1896], [45.4740, 9.1996], [45.4540, 9.1996], [45.4640, 9.1896]]]}
          pathOptions={{ 
            color: '#ff0000',
            fillColor: '#ff0000', 
            fillOpacity: 0.8,
            weight: 10,
            opacity: 1 
          }} 
        />
        <Polygon
          positions={[testPolygon]}
          pathOptions={{
            color: "#0000ff",
            fillColor: "#0000ff", 
            fillOpacity: 0.5,
            weight: 5,
            opacity: 1
          }}
        />
        
        <Marker position={mapCenter}>
          <Popup>Centro area di ricerca</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}