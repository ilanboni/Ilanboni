import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { GeoPolygon } from "@/types";

// This would be fetched from the API in a real app
const sampleAreas = [
  {
    name: 'Zona Centro',
    priority: 'high',
    color: '#ef4444',
    coordinates: [
      [9.1800, 45.4700],
      [9.1900, 45.4750],
      [9.2000, 45.4700],
      [9.1900, 45.4650]
    ]
  },
  {
    name: 'Zona Nord',
    priority: 'medium',
    color: '#f59e0b',
    coordinates: [
      [9.1700, 45.4800],
      [9.1800, 45.4850],
      [9.1900, 45.4800],
      [9.1800, 45.4750]
    ]
  },
  {
    name: 'Zona Est',
    priority: 'low',
    color: '#3b82f6',
    coordinates: [
      [9.2000, 45.4650],
      [9.2100, 45.4700],
      [9.2200, 45.4650],
      [9.2100, 45.4600]
    ]
  }
];

// Sample properties
const sampleProperties = [
  { lat: 45.4642, lng: 9.1900, title: 'Appartamento moderno', price: '€350.000' },
  { lat: 45.4720, lng: 9.1850, title: 'Villa con giardino', price: '€780.000' },
  { lat: 45.4680, lng: 9.2050, title: 'Loft industriale', price: '€420.000' }
];

interface MapAreaData {
  searchAreas: any[];
  properties: any[];
}

export default function MapVisualization() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  
  // In a real app, we would fetch this data from the API
  const { data, isLoading } = useQuery({
    queryKey: ['/api/map/areas'],
    queryFn: async () => {
      // This would be replaced with a real API call
      return {
        searchAreas: sampleAreas,
        properties: sampleProperties
      } as MapAreaData;
    }
  });
  
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    
    // Initialize the map if it doesn't exist
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([45.4642, 9.1900], 12);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
    }
    
    // Clear existing layers
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polygon) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    
    // Add polygons and markers if data is available
    if (data) {
      // Add polygons (search areas)
      data.searchAreas.forEach((area: any) => {
        const polygon = L.polygon(area.coordinates.map((coords: number[]) => [coords[1], coords[0]]), {
          color: area.color,
          fillOpacity: 0.3,
          weight: 2
        }).addTo(mapInstanceRef.current);
        
        polygon.bindTooltip(area.name + ' - ' + area.priority + ' priorità');
      });
      
      // Add property markers
      data.properties.forEach((property: any) => {
        const marker = L.marker([property.lat, property.lng]).addTo(mapInstanceRef.current);
        marker.bindPopup(`<b>${property.title}</b><br>${property.price}`);
      });
    }
    
    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        // Just cleanup markers and polygons, but keep the map instance
        mapInstanceRef.current.eachLayer((layer: any) => {
          if (layer instanceof L.Marker || layer instanceof L.Polygon) {
            mapInstanceRef.current.removeLayer(layer);
          }
        });
      }
    };
  }, [data]);
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg text-gray-800">Zone di Ricerca Attive</h2>
        <div className="flex items-center space-x-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-40 h-8 text-sm border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <SelectValue placeholder="Tutte le zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le zone</SelectItem>
              <SelectItem value="center">Centro città</SelectItem>
              <SelectItem value="north">Zona Nord</SelectItem>
              <SelectItem value="east">Zona Est</SelectItem>
            </SelectContent>
          </Select>
          <a href="/maps" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Vedi dettagli</a>
        </div>
      </div>
      
      <div className="p-5">
        {isLoading ? (
          <Skeleton className="h-[350px] w-full rounded-md" />
        ) : (
          <div ref={mapRef} className="h-[350px] w-full rounded-md z-0"></div>
        )}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <div className="flex items-center">
            <span className="h-4 w-4 rounded-full bg-red-500 mr-2"></span>
            <span className="text-xs text-gray-700">Alta priorità (4)</span>
          </div>
          <div className="flex items-center">
            <span className="h-4 w-4 rounded-full bg-amber-500 mr-2"></span>
            <span className="text-xs text-gray-700">Media priorità (8)</span>
          </div>
          <div className="flex items-center">
            <span className="h-4 w-4 rounded-full bg-blue-500 mr-2"></span>
            <span className="text-xs text-gray-700">Bassa priorità (12)</span>
          </div>
          <div className="flex items-center">
            <span className="h-4 w-4 rounded-full bg-green-500 mr-2"></span>
            <span className="text-xs text-gray-700">Immobili attivi (56)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
