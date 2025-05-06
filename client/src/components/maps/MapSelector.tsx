import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GeoPolygon } from "@/types";

interface MapSelectorProps {
  value?: any;
  onChange: (value: any) => void;
  className?: string;
  readOnly?: boolean;
}

export default function MapSelector({
  value,
  onChange,
  className,
  readOnly = false
}: MapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  useEffect(() => {
    // Only initialize if leaflet is available
    if (!window.L) {
      const linkElement = document.createElement('link');
      linkElement.rel = 'stylesheet';
      linkElement.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/leaflet.css';
      document.head.appendChild(linkElement);
      
      const scriptElement = document.createElement('script');
      scriptElement.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/leaflet.js';
      scriptElement.onload = () => {
        // Load Leaflet Draw after Leaflet
        const drawScriptElement = document.createElement('script');
        drawScriptElement.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js';
        drawScriptElement.onload = () => setIsMapLoaded(true);
        document.head.appendChild(drawScriptElement);
        
        const drawCssElement = document.createElement('link');
        drawCssElement.rel = 'stylesheet';
        drawCssElement.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css';
        document.head.appendChild(drawCssElement);
      };
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
      
      // Initialize feature group for drawn items
      drawnItemsRef.current = new L.FeatureGroup();
      mapInstanceRef.current.addLayer(drawnItemsRef.current);
      
      // Initialize draw control
      if (!readOnly) {
        drawControlRef.current = new L.Control.Draw({
          draw: {
            marker: false,
            circlemarker: false,
            circle: false,
            rectangle: true,
            polyline: false,
            polygon: {
              allowIntersection: false,
              showArea: true,
              drawError: {
                color: '#e1e100',
                message: '<strong>Errore:</strong> Il poligono non può intersecare se stesso!'
              },
              shapeOptions: {
                color: '#3b82f6'
              }
            }
          },
          edit: {
            featureGroup: drawnItemsRef.current,
            poly: {
              allowIntersection: false
            }
          }
        });
        mapInstanceRef.current.addControl(drawControlRef.current);
        
        // Handle draw events
        mapInstanceRef.current.on(L.Draw.Event.CREATED, function(e: any) {
          const layer = e.layer;
          
          // Add layer to feature group
          drawnItemsRef.current.addLayer(layer);
          
          // Get GeoJSON and update form
          const geoJSON = drawnItemsRef.current.toGeoJSON();
          if (geoJSON.features.length > 0) {
            onChange({
              type: 'Feature',
              properties: { name: 'Search Area' },
              geometry: geoJSON.features[0].geometry
            });
          }
        });
        
        mapInstanceRef.current.on(L.Draw.Event.EDITED, function() {
          // Update form when shapes are edited
          const geoJSON = drawnItemsRef.current.toGeoJSON();
          if (geoJSON.features.length > 0) {
            onChange({
              type: 'Feature',
              properties: { name: 'Search Area' },
              geometry: geoJSON.features[0].geometry
            });
          }
        });
        
        mapInstanceRef.current.on(L.Draw.Event.DELETED, function() {
          // Clear form value when all shapes are deleted
          if (drawnItemsRef.current.getLayers().length === 0) {
            onChange(undefined);
          }
        });
      }
    }
    
    // Load existing value if available
    if (value && drawnItemsRef.current) {
      // Clear existing layers
      drawnItemsRef.current.clearLayers();
      
      try {
        // Add layer from GeoJSON
        const layer = L.geoJSON(value);
        layer.eachLayer((l: any) => {
          drawnItemsRef.current.addLayer(l);
        });
        
        // Fit bounds to show the polygon
        if (drawnItemsRef.current.getBounds().isValid()) {
          mapInstanceRef.current.fitBounds(drawnItemsRef.current.getBounds());
        }
      } catch (error) {
        console.error("Error loading GeoJSON data:", error);
      }
    }
    
    // Fix map rendering issue
    setTimeout(() => {
      mapInstanceRef.current.invalidateSize();
    }, 100);
    
    // Cleanup function
    return () => {
      // Only remove controls and event listeners, keep map instance
      if (drawControlRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeControl(drawControlRef.current);
      }
    };
  }, [isMapLoaded, value, onChange, readOnly]);
  
  const handleClearSelection = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      onChange(undefined);
    }
  };
  
  return (
    <div className={cn("relative", className)}>
      <div ref={mapRef} className="h-full min-h-[250px] rounded-md z-0" />
      
      {!readOnly && (
        <div className="absolute bottom-2 right-2 z-[400]">
          <Button 
            type="button" 
            variant="secondary" 
            size="sm"
            onClick={handleClearSelection}
            className="bg-white"
          >
            Cancella selezione
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
        <div className="absolute top-2 left-2 z-[400] bg-white p-2 rounded shadow-sm text-xs text-gray-600">
          Utilizza gli strumenti di disegno per definire l'area di ricerca
        </div>
      )}
    </div>
  );
}
