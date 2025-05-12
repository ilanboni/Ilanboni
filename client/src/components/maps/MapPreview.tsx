import React, { useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/utils";

interface MapPreviewProps {
  lat?: number | null;
  lng?: number | null;
  height?: string | number;
  width?: string | number;
  className?: string;
  zoom?: number;
}

/**
 * Componente semplificato per la visualizzazione statica di una mappa
 * Ottimizzato per essere leggero e affidabile nel mostrare coordinate
 */
export default function MapPreview({ 
  lat, 
  lng, 
  height = '300px', 
  width = '100%',
  className,
  zoom = 15
}: MapPreviewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  // Effetto per caricare Leaflet
  useEffect(() => {
    // Carica le risorse di Leaflet se non sono già disponibili
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
  
  // Effetto per inizializzare o aggiornare la mappa
  useEffect(() => {
    if (!isMapLoaded || !mapContainerRef.current || !window.L) return;
    
    const L = window.L;
    const hasValidCoordinates = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
    
    // Coordinate di default per Milano se non sono specificate coordinate valide
    const defaultLat = 45.4642;
    const defaultLng = 9.1900;
    
    const centerLat = hasValidCoordinates ? lat : defaultLat;
    const centerLng = hasValidCoordinates ? lng : defaultLng;
    
    // Inizializza la mappa se non esiste già
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([centerLat, centerLng], zoom);
      
      // Aggiungi layer tile
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);
      
      // Correggi il problema di rendering
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    } else {
      // Aggiorna il centro della mappa esistente
      mapRef.current.setView([centerLat, centerLng], zoom);
    }
    
    // Gestisci il marker
    if (hasValidCoordinates) {
      // Rimuovi marker esistente se presente
      if (markerRef.current) {
        mapRef.current.removeLayer(markerRef.current);
      }
      
      // Crea nuovo marker
      markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
    } else if (markerRef.current) {
      // Rimuovi marker se le coordinate non sono valide
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    
    // Funzione di pulizia
    return () => {
      // Non distruggere la mappa per evitare problemi di performance
      // Solo rimuovi eventuali eventi
      if (mapRef.current) {
        mapRef.current.off();
      }
    };
  }, [isMapLoaded, lat, lng, zoom]);
  
  // Effetto di pulizia quando il componente viene smontato
  useEffect(() => {
    return () => {
      // Distruggi la mappa solo quando il componente viene smontato
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);
  
  return (
    <div className={cn("relative", className)} style={{ position: 'relative' }}>
      <div 
        ref={mapContainerRef} 
        style={{ height, width, borderRadius: '8px' }}
        className="z-10" 
      />
      
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 bg-opacity-70 rounded-md z-20">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Caricamento mappa...</p>
          </div>
        </div>
      )}
      
      {isMapLoaded && (!lat || !lng) && (
        <div className="absolute top-2 left-0 right-0 bg-white bg-opacity-80 z-20 p-2 text-center text-sm">
          Posizione non specificata - Visualizzazione di Milano
        </div>
      )}
    </div>
  );
}