import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapLocationSelectorProps {
  value?: any;
  onChange: (value: any) => void;
  className?: string;
  readOnly?: boolean;
}

export default function MapLocationSelector({
  value,
  onChange,
  className,
  readOnly = false
}: MapLocationSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  useEffect(() => {
    // Only initialize if leaflet is available
    if (!window.L) {
      const linkElement = document.createElement('link');
      linkElement.rel = 'stylesheet';
      linkElement.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/leaflet.css';
      document.head.appendChild(linkElement);
      
      const scriptElement = document.createElement('script');
      scriptElement.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/leaflet.js';
      scriptElement.onload = () => setIsMapLoaded(true);
      document.head.appendChild(scriptElement);
      return;
    } else {
      setIsMapLoaded(true);
    }
  }, []);
  
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !window.L) return;
    
    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      // Set default view to Milan, Italy
      mapInstanceRef.current = L.map(mapRef.current).setView([45.4642, 9.1900], 12);
      
      // Add base tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
      
      // Add click handler for placing marker
      if (!readOnly) {
        mapInstanceRef.current.on('click', function(e: any) {
          addMarker(e.latlng);
        });
      }
    }
    
    // Load existing marker if available
    if (value && value.lat && value.lng) {
      addMarker({ lat: value.lat, lng: value.lng });
    } else if (mapInstanceRef.current && !markerRef.current) {
      // Se non c'è un valore, centriamo comunque la mappa su Milano
      mapInstanceRef.current.setView([45.4642, 9.1900], 12);
    }
    
    // Fix map rendering issue
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);
    
    // Cleanup function
    return () => {
      // Only remove event listeners, keep map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click');
      }
    };
  }, [isMapLoaded, value, onChange, readOnly]);
  
  const addMarker = (latlng: { lat: number, lng: number }) => {
    // Remove existing marker
    if (markerRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
    }
    
    // Create new marker
    markerRef.current = L.marker(latlng, {
      draggable: !readOnly
    }).addTo(mapInstanceRef.current);
    
    // Update form value
    onChange({ lat: latlng.lat, lng: latlng.lng });
    
    // Add drag end event handler
    if (!readOnly) {
      markerRef.current.on('dragend', function() {
        const pos = markerRef.current.getLatLng();
        onChange({ lat: pos.lat, lng: pos.lng });
      });
    }
    
    // Center map on marker
    mapInstanceRef.current.setView(latlng);
  };
  
  const handleClearLocation = () => {
    if (markerRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    onChange(undefined);
  };
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Use Nominatim for geocoding
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const location = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        
        addMarker(location);
        mapInstanceRef.current.setView(location, 16);
      } else {
        alert("Indirizzo non trovato. Prova a essere più specifico.");
      }
    } catch (error) {
      console.error("Errore nella ricerca indirizzo:", error);
      alert("Errore nella ricerca. Riprova più tardi.");
    }
  };
  
  return (
    <div className={cn("relative", className)}>
      {!readOnly && (
        <div className="absolute top-2 left-2 right-2 z-[400] bg-white rounded shadow-sm flex">
          <form onSubmit={handleSearch} className="flex flex-1">
            <Input
              type="text"
              placeholder="Cerca indirizzo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-r-none border-r-0"
            />
            <Button type="submit" variant="default" className="rounded-l-none px-3">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
      
      <div ref={mapRef} className="h-full min-h-[250px] rounded-md z-0" />
      
      {!readOnly && (
        <div className="absolute bottom-2 right-2 z-[400]">
          <Button 
            type="button" 
            variant="secondary" 
            size="sm"
            onClick={handleClearLocation}
            className="bg-white"
          >
            Cancella posizione
          </Button>
        </div>
      )}
      
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 rounded-md">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Caricamento mappa...</p>
          </div>
        </div>
      )}
      
      {isMapLoaded && !readOnly && (
        <div className="absolute top-16 left-2 z-[400] bg-white p-2 rounded shadow-sm text-xs text-gray-600">
          Clicca sulla mappa per posizionare l'immobile o cerca un indirizzo
        </div>
      )}
    </div>
  );
}
