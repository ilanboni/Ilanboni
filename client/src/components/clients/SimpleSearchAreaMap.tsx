import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface SimpleSearchAreaMapProps {
  searchArea: any;
}

// Coordinate di test per Milano
const TEST_POLYGON: Array<[number, number]> = [
  [45.4895, 9.2103],
  [45.4814, 9.2105], 
  [45.4823, 9.2325],
  [45.4896, 9.2307],
  [45.4895, 9.2103]
];

export default function SimpleSearchAreaMap({ searchArea }: SimpleSearchAreaMapProps) {
  const mapCenter: [number, number] = [45.485, 9.221];

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
          positions={TEST_POLYGON}
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