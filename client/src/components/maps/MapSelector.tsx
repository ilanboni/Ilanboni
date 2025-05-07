import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search } from "lucide-react";

// Add window properties to avoid TypeScript errors
declare global {
  interface Window {
    L: typeof L & {
      Control: {
        Draw: any;
      };
    }
  }
}

interface MapSelectorProps {
  initialLocation?: { lat?: number; lng?: number } | null;
  onLocationSelected: (location: { lat: number; lng: number } | null) => void;
  className?: string;
  address?: string;
  autoGeocode?: boolean;
}

export function MapSelector({
  initialLocation,
  onLocationSelected,
  className,
  address,
  autoGeocode = false
}: MapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState(address || "");
  const [isSearching, setIsSearching] = useState(false);
  
  useEffect(() => {
    // Load Leaflet-draw dynamically
    if (!document.getElementById('leaflet-draw-css')) {
      const linkElement = document.createElement('link');
      linkElement.id = 'leaflet-draw-css';
      linkElement.rel = 'stylesheet';
      linkElement.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css';
      document.head.appendChild(linkElement);
    }
    
    if (!window.L || !window.L.Control || !window.L.Control.Draw) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js';
      script.onload = () => {
        setIsMapLoaded(true);
      };
      document.head.appendChild(script);
    } else {
      setIsMapLoaded(true);
    }
  }, []);
  
  // Effetto per geocodificare automaticamente un indirizzo quando viene fornito e autoGeocode è true
  useEffect(() => {
    if (isMapLoaded && autoGeocode && address && address.trim() !== "" && mapInstanceRef.current) {
      geocodeAddress(address);
    }
  }, [isMapLoaded, autoGeocode, address]);
  
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !window.L) return;
    
    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      // Set default view to Milan, Italy or use initial location
      const initialCenter = initialLocation 
        ? [initialLocation.lat || 45.4642, initialLocation.lng || 9.1900] 
        : [45.4642, 9.1900];
      
      mapInstanceRef.current = L.map(mapRef.current).setView(initialCenter, 13);
      
      // Add base tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
      
      // Setup click handler to set marker
      mapInstanceRef.current.on('click', function(e: any) {
        const { lat, lng } = e.latlng;
        
        // Remove existing marker if any
        if (markerRef.current) {
          mapInstanceRef.current.removeLayer(markerRef.current);
        }
        
        // Add new marker
        markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
        
        // Update location
        onLocationSelected({ lat, lng });
      });
    }
    
    // Add initial marker if location is provided
    if (initialLocation && initialLocation.lat && initialLocation.lng) {
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
      }
      
      markerRef.current = L.marker([initialLocation.lat, initialLocation.lng]).addTo(mapInstanceRef.current);
      mapInstanceRef.current.setView([initialLocation.lat, initialLocation.lng], 15);
    }
    
    // Fix map rendering issue
    setTimeout(() => {
      mapInstanceRef.current.invalidateSize();
    }, 100);
    
    // Cleanup function
    return () => {
      // Only remove controls and event listeners, keep map instance
      if (markerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
      }
    };
  }, [isMapLoaded, initialLocation, onLocationSelected]);
  
  const handleClearLocation = () => {
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
      onLocationSelected(null);
    }
  };
  
  const geocodeAddress = async (addressToGeocode: string) => {
    if (!addressToGeocode.trim()) return;
    
    setIsSearching(true);
    
    try {
      // Use Nominatim for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressToGeocode)}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const location = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        
        // Remove existing marker if any
        if (markerRef.current && mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(markerRef.current);
        }
        
        // Add new marker
        markerRef.current = L.marker([location.lat, location.lng]).addTo(mapInstanceRef.current);
        
        // Update location
        onLocationSelected(location);
        
        // Center map on marker
        mapInstanceRef.current.setView([location.lat, location.lng], 16);
      } else {
        console.log("Indirizzo non trovato");
      }
    } catch (error) {
      console.error("Errore nella geocodifica:", error);
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    geocodeAddress(searchQuery);
  };
  
  return (
    <div className={cn("relative", className)}>
      <div className="absolute top-2 left-2 right-2 z-[400] bg-white rounded shadow-sm flex">
        <div className="flex flex-1">
          <Input
            type="text"
            placeholder="Cerca indirizzo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-r-none border-r-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch(e);
              }
            }}
          />
          <Button 
            type="button" 
            variant="default" 
            className="rounded-l-none px-3"
            disabled={isSearching}
            onClick={handleSearch}
          >
            {isSearching ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      <div ref={mapRef} className="h-full min-h-[250px] rounded-md z-0" />
      
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
      
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 rounded-md">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Caricamento mappa...</p>
          </div>
        </div>
      )}
      
      {isMapLoaded && (
        <div className="absolute top-16 left-2 z-[400] bg-white p-2 rounded shadow-sm text-xs text-gray-600">
          Cerca un indirizzo o clicca sulla mappa per selezionare la posizione
        </div>
      )}
    </div>
  );
}