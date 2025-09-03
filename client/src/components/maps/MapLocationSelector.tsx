import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { geocodeAddress } from "@/lib/geocoding";

interface MapLocationSelectorProps {
  value?: any;
  onChange: (value: any) => void;
  className?: string;
  readOnly?: boolean;
  addressToSearch?: string;
}

export default function MapLocationSelector({
  value,
  onChange,
  className,
  readOnly = false,
  addressToSearch
}: MapLocationSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  useEffect(() => {
    // Check if Leaflet is already available and immediately set loaded state
    if (window.L) {
      console.log("Leaflet già disponibile, inizializzazione immediata");
      setIsMapLoaded(true);
      return;
    }

    // Load leaflet assets if not present
    console.log("Caricamento Leaflet in corso...");
    const linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet';
    linkElement.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    linkElement.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    linkElement.crossOrigin = '';
    document.head.appendChild(linkElement);
    
    const scriptElement = document.createElement('script');
    scriptElement.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    scriptElement.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    scriptElement.crossOrigin = '';
    scriptElement.onload = () => {
      console.log("Leaflet caricato con successo");
      setIsMapLoaded(true);
    };
    scriptElement.onerror = () => {
      console.error("Errore nel caricamento di Leaflet");
    };
    document.head.appendChild(scriptElement);
  }, []);
  
  // Funzione per cercare un indirizzo usando il proxy backend
  const searchAddress = async (address: string) => {
    if (!address.trim()) return;
    
    try {
      console.log("Ricerca indirizzo tramite API proxy:", address);
      const results = await geocodeAddress(address);
      
      if (results && results.length > 0) {
        const location = {
          lat: results[0].lat,
          lng: results[0].lng
        };
        
        console.log("Risultato geocoding:", location);
        
        addMarker(location);
        mapInstanceRef.current?.setView(location, 16);
        return true;
      }
    } catch (error) {
      console.error("Errore nella ricerca indirizzo:", error);
    }
    return false;
  };

  // Effetto per inizializzare la mappa
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !window.L) {
      console.log("Map initialization skipped:", { isMapLoaded, hasMapRef: !!mapRef.current, hasLeaflet: !!window.L });
      return;
    }
    
    console.log("Initializing map with value:", value);
    
    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      console.log("Creating new map instance");
      try {
        // Set default view to Milan, Italy
        mapInstanceRef.current = window.L.map(mapRef.current).setView([45.4642, 9.1900], 12);
        console.log("Map instance created successfully");
        
        // Add base tile layer
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstanceRef.current);
        
        // Add click handler for placing marker
        if (!readOnly) {
          mapInstanceRef.current.on('click', function(e: any) {
            addMarker(e.latlng);
          });
        }
        
        // Fix map rendering issue with multiple attempts
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 100);
        
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 500);
        
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 1000);
        
      } catch (error) {
        console.error("Error creating map instance:", error);
        return;
      }
    }
    
    // Load existing marker if available
    if (value && value.lat && value.lng) {
      console.log("Adding marker with coordinates:", value);
      addMarker({ lat: value.lat, lng: value.lng });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([value.lat, value.lng], 16);
      }
    } else if (mapInstanceRef.current && !markerRef.current) {
      // Se non c'è un valore, centriamo comunque la mappa su Milano
      mapInstanceRef.current.setView([45.4642, 9.1900], 12);
    }
    
    // Cleanup function
    return () => {
      // Only remove event listeners, keep map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click');
      }
    };
  }, [isMapLoaded, readOnly]);
  
  // Effetto per gestire gli aggiornamenti del valore
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;
    
    // Se abbiamo un valore con coordinate valide, aggiorna il marker
    if (value && typeof value.lat === 'number' && typeof value.lng === 'number') {
      console.log("Value changed, updating marker with:", value);
      
      // Rimuovi il marker esistente se presente
      if (markerRef.current) {
        mapInstanceRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      
      // Aggiungi il nuovo marker
      const newPosition = { lat: value.lat, lng: value.lng };
      
      // Crea nuovo marker
      markerRef.current = window.L.marker(newPosition, {
        draggable: !readOnly
      }).addTo(mapInstanceRef.current);
      
      // Aggiungi handler per drag se non in modalità sola lettura
      if (!readOnly) {
        markerRef.current.on('dragend', function() {
          const pos = markerRef.current.getLatLng();
          onChange({ lat: pos.lat, lng: pos.lng });
        });
      }
      
      // Centra la mappa sul marker
      mapInstanceRef.current.setView(newPosition, 16);
      
      // Invalida le dimensioni della mappa per assicurarsi che venga renderizzata correttamente
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);
    }
  }, [value, isMapLoaded, readOnly]);
  
  // Effetto per cercare l'indirizzo quando cambia
  const previousAddressRef = useRef<string | undefined>();
  
  useEffect(() => {
    const searchIfNeeded = async () => {
      // Controlla se l'indirizzo è cambiato e se è diverso da quello precedente
      if (
        addressToSearch && 
        isMapLoaded && 
        mapInstanceRef.current && 
        addressToSearch !== previousAddressRef.current &&
        addressToSearch.trim() !== ""
      ) {
        console.log("Searching for address:", addressToSearch);
        previousAddressRef.current = addressToSearch;
        
        try {
          // Utilizziamo il proxy backend per la geocodifica
          console.log("Geocodifica indirizzo tramite API proxy:", addressToSearch);
          const results = await geocodeAddress(addressToSearch);
          
          if (results && results.length > 0) {
            const location = {
              lat: results[0].lat,
              lng: results[0].lng
            };
            
            // Verifica che i valori siano numeri validi
            if (!isNaN(location.lat) && !isNaN(location.lng)) {
              console.log("Posizione trovata con API proxy:", location);
              
              // Aggiorna il marker e centra la mappa
              onChange(location);
              
              // Non c'è bisogno di chiamare addMarker o setView qui
              // perché l'useEffect che osserva il valore si occuperà di aggiornare la mappa
              return true;
            }
          } else {
            console.log("Nessun risultato trovato per:", addressToSearch);
            return false;
          }
        } catch (error) {
          console.error("Errore nella geocodifica:", error);
          return false;
        }
      }
      return false;
    };
    
    searchIfNeeded();
  }, [addressToSearch, isMapLoaded]);
  
  const addMarker = (latlng: { lat: number, lng: number }) => {
    // Remove existing marker
    if (markerRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current);
    }
    
    // Create new marker
    markerRef.current = window.L.marker(latlng, {
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
  
  const handleSearch = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Utilizziamo il proxy backend per il geocoding
    try {
      console.log("Ricerca indirizzo da campo di ricerca:", searchQuery);
      const results = await geocodeAddress(searchQuery);
      
      if (results && results.length > 0) {
        const location = {
          lat: results[0].lat,
          lng: results[0].lng
        };
        
        console.log("Risultato geocoding da campo di ricerca:", location);
        
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
          <Input
            type="text"
            placeholder="Cerca indirizzo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-r-none border-r-0"
            onKeyPress={(e) => {
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
            onClick={handleSearch}
          >
            <Search className="h-4 w-4" />
          </Button>
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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Caricamento mappa...</p>
          </div>
        </div>
      )}
      
      {isMapLoaded && !mapInstanceRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100 rounded-md">
          <div className="text-center text-red-600">
            <p className="text-sm">Errore caricamento mappa</p>
            <button 
              onClick={() => window.location.reload()} 
              className="text-xs underline mt-1"
            >
              Ricarica pagina
            </button>
          </div>
        </div>
      )}
      
      {false && (
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
