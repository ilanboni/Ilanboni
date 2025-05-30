import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";

interface SimpleSearchAreaMapProps {
  searchArea: any;
}

export default function SimpleSearchAreaMap({ searchArea }: SimpleSearchAreaMapProps) {
  const [coordinates, setCoordinates] = useState<Array<[number, number]>>([]);
  const [center, setCenter] = useState<[number, number]>([45.464, 9.19]);

  useEffect(() => {
    if (!searchArea) return;

    try {
      let areaData = searchArea;
      if (typeof searchArea === 'string') {
        areaData = JSON.parse(searchArea);
      }

      if (areaData?.geometry?.coordinates?.[0]) {
        // Converte coordinate da GeoJSON [lng, lat] a Leaflet [lat, lng]
        const coords: Array<[number, number]> = areaData.geometry.coordinates[0].map(
          (coord: number[]) => [coord[1], coord[0]]
        );
        
        // Calcola centro
        const avgLat = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
        const avgLng = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
        
        setCoordinates(coords);
        setCenter([avgLat, avgLng]);
      }
    } catch (error) {
      console.error("Errore parsing area di ricerca:", error);
    }
  }, [searchArea]);

  // Se non ci sono coordinate, mostra un poligono di default
  const defaultPolygon: Array<[number, number]> = [
    [45.489, 9.210],
    [45.481, 9.210], 
    [45.482, 9.232],
    [45.490, 9.231],
    [45.489, 9.210]
  ];

  const polygonToShow = coordinates.length > 0 ? coordinates : defaultPolygon;

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
          positions={polygonToShow}
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