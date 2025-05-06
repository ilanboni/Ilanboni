import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

// Aggiungiamo dichiarazioni per Leaflet e il plugin heatmap
declare global {
  interface Window {
    L: any;
  }
}

// Dichiarazione temporanea per L
const L: any = typeof window !== "undefined" ? window.L : null;

interface HeatMapProps {
  data?: any[];
  className?: string;
}

export default function HeatMap({
  data = [],
  className
}: HeatMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [minSize, setMinSize] = useState<number>(50);
  const [maxPrice, setMaxPrice] = useState<number>(500000);
  // Per potenziali sviluppi futuri potremmo aggiungere range slider per prezzo e dimensione
  
  // Filter data based on min size and max price
  const filteredData = data.filter(item => {
    return (
      (!minSize || (item.minSize && item.minSize >= minSize)) && 
      (!maxPrice || (item.maxPrice && item.maxPrice <= maxPrice))
    );
  });
  
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
        // Load Leaflet.heat plugin after Leaflet
        const heatScriptElement = document.createElement('script');
        heatScriptElement.src = 'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js';
        heatScriptElement.onload = () => setIsMapLoaded(true);
        document.head.appendChild(heatScriptElement);
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
      
      // Add legend
      const legend = L.control({position: 'bottomright'});
      legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = `
          <div style="background: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            <h4 style="margin: 0 0 5px 0;">Intensità ricerche</h4>
            <div style="display: flex; align-items: center; margin-bottom: 5px;">
              <div style="width: 20px; height: 20px; background: linear-gradient(to right, #00ff00, #ffff00, #ff0000); margin-right: 5px;"></div>
              <span>Bassa - Alta</span>
            </div>
          </div>
        `;
        return div;
      };
      legend.addTo(mapInstanceRef.current);
    }
    
    // Update the heat layer with filtered data
    updateHeatLayer();
    
    // Fix map rendering issue
    setTimeout(() => {
      mapInstanceRef.current.invalidateSize();
    }, 100);
    
  }, [isMapLoaded, data, minSize, maxPrice]);
  
  const updateHeatLayer = () => {
    // Remove existing heat layer if it exists
    if (heatLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatLayerRef.current);
    }
    
    // Convert data to heat points - this is a simplified example
    // Real implementation would use actual coordinates and intensity values
    const heatPoints = filteredData.map(item => {
      // Here we assume item.location contains lat/lng data and item.intensity represents search frequency
      return [
        item.location?.lat || 45.4642 + (Math.random() * 0.1 - 0.05), // For demo only - randomize if no real data
        item.location?.lng || 9.1900 + (Math.random() * 0.1 - 0.05),
        item.intensity || Math.random() * 0.8 + 0.2 // Intensity between 0.2 and 1.0
      ];
    });
    
    // Create and add the heat layer if we have points and the Leaflet.heat plugin is available
    if (heatPoints.length > 0 && window.L.heatLayer) {
      heatLayerRef.current = L.heatLayer(heatPoints, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: {0.2: 'blue', 0.4: 'lime', 0.6: 'yellow', 0.8: 'orange', 1: 'red'}
      }).addTo(mapInstanceRef.current);
    }
  };
  
  // Sample data generator for preview
  const generateSampleData = () => {
    const sampleData = [];
    // Generate data points with different min sizes and max prices
    for (let i = 0; i < 30; i++) {
      const minSizeValue = Math.floor(Math.random() * 150) + 30;
      const maxPriceValue = Math.floor(Math.random() * 800000) + 200000;
      
      sampleData.push({
        id: i,
        location: {
          lat: 45.4642 + (Math.random() * 0.1 - 0.05),
          lng: 9.1900 + (Math.random() * 0.1 - 0.05)
        },
        minSize: minSizeValue,
        maxPrice: maxPriceValue,
        intensity: Math.random() * 0.8 + 0.2
      });
    }
    return sampleData;
  };
  
  // Use sample data if none provided
  const displayData = data.length > 0 ? data : generateSampleData();
  
  return (
    <Card className={cn("relative", className)}>
      <CardHeader>
        <CardTitle>Mappa di Calore delle Ricerche</CardTitle>
        <CardDescription>
          Visualizza le zone più ricercate in base ai criteri selezionati
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-1">Metratura minima: {minSize} m²</h3>
            <Slider
              value={[minSize]}
              min={0}
              max={200}
              step={10}
              onValueChange={(value) => setMinSize(value[0])}
            />
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-1">Prezzo massimo: €{maxPrice.toLocaleString()}</h3>
            <Slider
              value={[maxPrice]}
              min={100000}
              max={1000000}
              step={50000}
              onValueChange={(value) => setMaxPrice(value[0])}
            />
          </div>
          
          <div className="relative">
            <div ref={mapRef} className="h-[400px] rounded-md z-0" />
            
            {!isMapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 rounded-md">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Caricamento mappa...</p>
                </div>
              </div>
            )}
            
            {isMapLoaded && (
              <div className="absolute top-2 left-2 z-[400] bg-white p-2 rounded shadow-sm text-xs text-gray-600">
                <p>La mappa mostra {filteredData.length} aree di ricerca</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}