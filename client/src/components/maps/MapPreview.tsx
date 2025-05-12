import 'leaflet/dist/leaflet.css';
import React, { useEffect } from 'react';
import L from 'leaflet';

interface MapPreviewProps {
  lat?: number;
  lng?: number;
  className?: string;
  height?: string;
}

export default function MapPreview({ 
  lat, 
  lng, 
  className = "", 
  height = "300px" 
}: MapPreviewProps) {
  useEffect(() => {
    // Assicuriamoci che lat e lng siano numeri validi
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      console.log('Coordinate non valide:', { lat, lng });
      return;
    }

    // Verifica che il contenitore esista
    const container = document.getElementById('map-preview');
    if (!container) {
      console.error('Contenitore della mappa non trovato');
      return;
    }

    console.log('Inizializzazione mappa con coordinate:', { lat, lng });

    // Inizializza la mappa
    const map = L.map('map-preview', {
      center: [lat, lng],
      zoom: 16,
      zoomControl: true,
    });

    // Aggiungi il layer delle tile
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Aggiungi il marker
    L.marker([lat, lng]).addTo(map);

    // Aggiorna le dimensioni della mappa (necessario per mappe in contenitori nascosti)
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    // Funzione di cleanup
    return () => {
      console.log('Rimozione mappa');
      map.remove();
    };
  }, [lat, lng]); // Riesegui l'effetto quando cambiano le coordinate

  return (
    <div className={className}>
      <div 
        id="map-preview" 
        style={{ 
          height, 
          width: '100%', 
          borderRadius: '8px',
          backgroundColor: '#f0f0f0'
        }} 
      />
    </div>
  );
}