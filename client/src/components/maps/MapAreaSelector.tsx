import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

interface MapAreaSelectorProps {
  initialArea?: any;
  onAreaSelected: (area: any) => void;
  className?: string;
}

export function MapAreaSelector({
  initialArea,
  onAreaSelected,
  className
}: MapAreaSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDrawLoaded, setIsDrawLoaded] = useState(false);
  
  useEffect(() => {
    // Load Leaflet-draw dynamically
    if (!document.getElementById('leaflet-draw-css')) {
      const linkElement = document.createElement('link');
      linkElement.id = 'leaflet-draw-css';
      linkElement.rel = 'stylesheet';
      linkElement.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css';
      document.head.appendChild(linkElement);
    }
    
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js';
      script.onload = () => {
        setIsMapLoaded(true);
        
        // Load Leaflet Draw after Leaflet is loaded
        if (!window.L.Control.Draw) {
          const drawScript = document.createElement('script');
          drawScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js';
          drawScript.onload = () => {
            setIsDrawLoaded(true);
          };
          document.head.appendChild(drawScript);
        } else {
          setIsDrawLoaded(true);
        }
      };
      document.head.appendChild(script);
    } else {
      setIsMapLoaded(true);
      
      if (!window.L.Control.Draw) {
        const drawScript = document.createElement('script');
        drawScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js';
        drawScript.onload = () => {
          setIsDrawLoaded(true);
        };
        document.head.appendChild(drawScript);
      } else {
        setIsDrawLoaded(true);
      }
    }
  }, []);
  
  useEffect(() => {
    if (!isMapLoaded || !isDrawLoaded || !mapRef.current || !window.L || !window.L.Control.Draw) return;
    
    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      // Set default view to Milan, Italy
      mapInstanceRef.current = L.map(mapRef.current).setView([45.4642, 9.1900], 13);
      
      // Add base tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);
      
      // Initialize feature group for drawn items
      drawnItemsRef.current = new L.FeatureGroup();
      mapInstanceRef.current.addLayer(drawnItemsRef.current);
      
      // Initialize draw control
      drawControlRef.current = new L.Control.Draw({
        edit: {
          featureGroup: drawnItemsRef.current,
          poly: {
            allowIntersection: false
          }
        },
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true
          },
          rectangle: true,
          circle: false,
          circlemarker: false,
          marker: false,
          polyline: false
        }
      });
      
      mapInstanceRef.current.addControl(drawControlRef.current);
      
      // Event handler for drawn objects
      mapInstanceRef.current.on(L.Draw.Event.CREATED, function(e: any) {
        const layer = e.layer;
        drawnItemsRef.current.addLayer(layer);
        
        // Convert the drawn shape to GeoJSON
        const geoJSON = layer.toGeoJSON();
        onAreaSelected(geoJSON);
      });
      
      // Event handler for edited objects
      mapInstanceRef.current.on(L.Draw.Event.EDITED, function(e: any) {
        const layers = e.layers;
        let geoJSON: any = null;
        
        layers.eachLayer(function(layer: any) {
          geoJSON = layer.toGeoJSON();
        });
        
        if (geoJSON) {
          onAreaSelected(geoJSON);
        }
      });
      
      // Event handler for deleted objects
      mapInstanceRef.current.on(L.Draw.Event.DELETED, function() {
        if (drawnItemsRef.current.getLayers().length === 0) {
          onAreaSelected(null);
        }
      });
    }
    
    // Load initial area if provided
    if (initialArea) {
      try {
        const parsedArea = typeof initialArea === 'string' ? JSON.parse(initialArea) : initialArea;
        
        // Clear existing layers
        drawnItemsRef.current.clearLayers();
        
        // Add the polygon from GeoJSON
        const layer = L.geoJSON(parsedArea);
        layer.eachLayer((l) => {
          drawnItemsRef.current.addLayer(l);
        });
        
        // Fit map to the bounds of the area
        if (drawnItemsRef.current.getBounds().isValid()) {
          mapInstanceRef.current.fitBounds(drawnItemsRef.current.getBounds());
        }
      } catch (error) {
        console.error("Error loading initial area:", error);
      }
    }
    
    // Fix map rendering issue
    setTimeout(() => {
      mapInstanceRef.current.invalidateSize();
    }, 100);
    
    // Cleanup function
    return () => {
      // Remove event listeners
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off(L.Draw.Event.CREATED);
        mapInstanceRef.current.off(L.Draw.Event.EDITED);
        mapInstanceRef.current.off(L.Draw.Event.DELETED);
      }
    };
  }, [isMapLoaded, isDrawLoaded, initialArea, onAreaSelected]);
  
  const handleClearAreas = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      onAreaSelected(null);
    }
  };
  
  return (
    <div className={cn("relative", className)}>
      <div ref={mapRef} className="h-full min-h-[250px] rounded-md z-0" />
      
      <div className="absolute bottom-2 right-2 z-[400]">
        <Button 
          type="button" 
          variant="secondary" 
          size="sm"
          onClick={handleClearAreas}
          className="bg-white"
        >
          Cancella aree
        </Button>
      </div>
      
      {(!isMapLoaded || !isDrawLoaded) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 rounded-md">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Caricamento mappa...</p>
          </div>
        </div>
      )}
      
      {isMapLoaded && isDrawLoaded && (
        <div className="absolute top-2 left-2 z-[400] bg-white p-2 rounded shadow-sm text-xs text-gray-600">
          Usa gli strumenti di disegno per delimitare le aree di ricerca
        </div>
      )}
    </div>
  );
}