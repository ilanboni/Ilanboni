import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Definizione di un'interfaccia semplificata per il GeoJSON
interface SimpleGeoJSON {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties?: Record<string, any>;
}

// Crea un oggetto GeoJSON vuoto da usare come fallback
const DEFAULT_EMPTY_GEOJSON: SimpleGeoJSON = { 
  type: "Feature", 
  geometry: { 
    type: "Polygon", 
    coordinates: [[]] 
  },
  properties: {} 
};

// Interfaccia per le props del componente
interface SimpleAreaSelectorProps {
  initialArea?: any;
  onAreaSelected: (area: any) => void;
  className?: string;
}

export function SimpleAreaSelector({
  initialArea,
  onAreaSelected,
  className
}: SimpleAreaSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const currentPolygonRef = useRef<L.Polygon | null>(null);
  const pointsRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Inizializza la mappa
  useEffect(() => {
    if (!mapRef.current) return;
    
    // Assicuriamoci che Leaflet sia correttamente caricato
    if (!L) {
      console.error("Leaflet non è disponibile");
      return;
    }
    
    // Inizializza la mappa se non è già stata creata
    if (!mapInstanceRef.current) {
      // Imposta la vista di default su Milano, Italia
      mapInstanceRef.current = L.map(mapRef.current).setView([45.4642, 9.1900], 13);
      
      // Aggiungi il layer delle tile
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
      
      // Carica l'area iniziale se fornita
      if (initialArea) {
        try {
          const parsedArea = typeof initialArea === 'string' ? JSON.parse(initialArea) : initialArea;
          
          if (parsedArea && parsedArea.geometry && parsedArea.geometry.coordinates && parsedArea.geometry.coordinates.length > 0) {
            // Converti le coordinate GeoJSON in coordinate Leaflet (inversione lat/lng)
            const latLngs = parsedArea.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]);
            
            // Crea un poligono e aggiungilo alla mappa
            currentPolygonRef.current = L.polygon(latLngs as L.LatLngExpression[]).addTo(mapInstanceRef.current);
            
            // Zoom sul poligono
            mapInstanceRef.current.fitBounds(currentPolygonRef.current.getBounds());
          }
        } catch (error) {
          console.error("Errore nel caricamento dell'area iniziale:", error);
        }
      }
    }
    
    // Imposta il flag di caricamento
    setIsMapLoaded(true);
    
    // Fix per il rendering della mappa
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);
    
    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', handleMapClick);
      }
    };
  }, [initialArea]);
  
  // Aggiungi o rimuovi l'evento click quando isDrawing cambia
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    // Rimuovi prima l'evento per evitare di aggiungerne multipli
    mapInstanceRef.current.off('click', handleMapClick);
    
    // Aggiungi l'evento solo se stiamo disegnando
    if (isDrawing) {
      console.log("Modalità disegno attivata - click sulla mappa per aggiungere punti");
      mapInstanceRef.current.on('click', handleMapClick);
    }
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', handleMapClick);
      }
    };
  }, [isDrawing]);
  
  // Funzione per gestire il click sulla mappa
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (!isDrawing || !mapInstanceRef.current) return;
    
    console.log("Click sulla mappa rilevato!", e.latlng);
    
    // Aggiungi un marker alla posizione del click
    const marker = L.marker(e.latlng).addTo(mapInstanceRef.current);
    pointsRef.current.push(marker);
    
    // Aggiorna la polyline
    updatePolyline();
    
    // Se abbiamo almeno 3 punti, possiamo creare un poligono valido
    if (pointsRef.current.length >= 3) {
      updatePolygon();
    }
  };
  
  // Aggiorna la polyline tra i punti
  const updatePolyline = () => {
    // Rimuovi la polyline esistente
    if (polylineRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(polylineRef.current);
    }
    
    // Crea una nuova polyline se abbiamo almeno 2 punti
    if (pointsRef.current.length >= 2 && mapInstanceRef.current) {
      const latLngs = pointsRef.current.map(marker => marker.getLatLng());
      polylineRef.current = L.polyline(latLngs).addTo(mapInstanceRef.current);
    }
  };
  
  // Aggiorna il poligono
  const updatePolygon = () => {
    // Rimuovi il poligono esistente
    if (currentPolygonRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(currentPolygonRef.current);
    }
    
    // Crea un nuovo poligono se abbiamo almeno 3 punti
    if (pointsRef.current.length >= 3 && mapInstanceRef.current) {
      const latLngs = pointsRef.current.map(marker => marker.getLatLng());
      currentPolygonRef.current = L.polygon(latLngs).addTo(mapInstanceRef.current);
      
      // Converti il poligono in GeoJSON e notifica
      const coordinates = latLngs.map(latlng => [latlng.lng, latlng.lat]);
      coordinates.push([latLngs[0].lng, latLngs[0].lat]); // Chiudi il poligono
      
      const geoJSON: SimpleGeoJSON = {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [coordinates]
        }
      };
      
      onAreaSelected(geoJSON);
    }
  };
  
  // Inizia o termina il disegno
  const toggleDrawing = () => {
    setIsDrawing(!isDrawing);
  };
  
  // Cancella l'area disegnata
  const handleClearAreas = () => {
    if (!mapInstanceRef.current) return;
    
    // Rimuovi il poligono
    if (currentPolygonRef.current) {
      mapInstanceRef.current.removeLayer(currentPolygonRef.current);
      currentPolygonRef.current = null;
    }
    
    // Rimuovi la polyline
    if (polylineRef.current) {
      mapInstanceRef.current.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    
    // Rimuovi tutti i marker
    pointsRef.current.forEach(marker => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    
    // Resetta l'array dei punti
    pointsRef.current = [];
    
    // Notifica che l'area è stata cancellata
    onAreaSelected(null);
  };
  
  return (
    <div className={cn("relative", className)}>
      <div ref={mapRef} className="h-full min-h-[250px] rounded-md z-0" />
      
      <div className="absolute bottom-2 right-2 z-[400] flex gap-2">
        <Button 
          type="button" 
          variant={isDrawing ? "default" : "outline"} 
          size="sm"
          onClick={toggleDrawing}
          className="bg-white"
        >
          {isDrawing ? "Termina disegno" : "Inizia disegno"}
        </Button>
        
        <Button 
          type="button" 
          variant="secondary" 
          size="sm"
          onClick={handleClearAreas}
          className="bg-white"
        >
          Cancella area
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
      
      {isMapLoaded && isDrawing && (
        <div className="absolute top-2 left-2 z-[400] bg-white p-2 rounded shadow-sm text-xs text-gray-600">
          Clicca sulla mappa per aggiungere punti all'area
        </div>
      )}
      
      {isMapLoaded && !isDrawing && (
        <div className="absolute top-2 left-2 z-[400] bg-white p-2 rounded shadow-sm text-xs text-gray-600">
          Clicca "Inizia disegno" per delimitare un'area
        </div>
      )}
    </div>
  );
}