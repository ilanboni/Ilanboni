import { MapContainer, TileLayer, Polygon, Circle, Marker, Popup } from "react-leaflet";
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
  const [mapCenter, setMapCenter] = useState<[number, number]>([45.4640, 9.1896]);
  const [areaType, setAreaType] = useState<'none' | 'polygon' | 'circle' | 'address'>('none');
  const [polygonCoords, setPolygonCoords] = useState<Array<[number, number]>>([]);
  const [circleData, setCircleData] = useState<{center: [number, number], radius: number} | null>(null);
  const [addressInfo, setAddressInfo] = useState<string>("");

  useEffect(() => {
    if (!searchArea) {
      setAreaType('none');
      return;
    }

    try {
      let areaData = searchArea;
      if (typeof searchArea === 'string') {
        areaData = JSON.parse(searchArea);
      }

      // Handle circular search areas
      if (areaData?.type === 'circle') {
        if (typeof areaData.center === 'string') {
          // Center is an address string, show as text overlay
          setAreaType('address');
          setAddressInfo(areaData.center);
          setMapCenter([45.4640, 9.1896]); // Default Milano
        } else if (areaData.center?.lat && areaData.center?.lng) {
          // Center has valid coordinates
          setAreaType('circle');
          setCircleData({
            center: [areaData.center.lat, areaData.center.lng],
            radius: areaData.radius || 500
          });
          setMapCenter([areaData.center.lat, areaData.center.lng]);
        } else {
          setAreaType('none');
        }
        return;
      }

      // Handle polygon search areas
      if (areaData?.geometry?.coordinates?.[0]) {
        const leafletCoords: Array<[number, number]> = areaData.geometry.coordinates[0].map(
          (coord: number[]) => [coord[1], coord[0]]
        );
        
        // Calculate center
        const avgLat = leafletCoords.reduce((sum, coord) => sum + coord[0], 0) / leafletCoords.length;
        const avgLng = leafletCoords.reduce((sum, coord) => sum + coord[1], 0) / leafletCoords.length;
        
        setAreaType('polygon');
        setPolygonCoords(leafletCoords);
        setMapCenter([avgLat, avgLng]);
        return;
      }

      setAreaType('none');
    } catch (error) {
      console.error("Errore nel parsing dell'area di ricerca:", error);
      setAreaType('none');
    }
  }, [searchArea]);

  return (
    <div className="h-64 w-full rounded-lg overflow-hidden border relative">
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
        
        {/* Render polygon area */}
        {areaType === 'polygon' && polygonCoords.length > 0 && (
          <Polygon
            positions={polygonCoords}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6", 
              fillOpacity: 0.2,
              weight: 2,
              opacity: 0.8
            }}
          />
        )}
        
        {/* Render circle area */}
        {areaType === 'circle' && circleData && (
          <Circle
            center={circleData.center}
            radius={circleData.radius}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.2,
              weight: 2
            }}
          />
        )}
        
        <Marker position={mapCenter}>
          <Popup>
            {areaType === 'address' ? `Zona: ${addressInfo}` : 'Centro area di ricerca'}
          </Popup>
        </Marker>
      </MapContainer>
      
      {/* Show address info overlay when we have an address string */}
      {areaType === 'address' && (
        <div className="absolute bottom-2 left-2 right-2 bg-white bg-opacity-90 p-2 rounded text-sm z-[1000]">
          <div className="text-gray-600 font-medium">Area di ricerca:</div>
          <div className="text-gray-800">{addressInfo}</div>
        </div>
      )}
    </div>
  );
}