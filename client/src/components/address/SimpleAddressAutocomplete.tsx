import React, { useState } from 'react';

interface AddressAutocompleteProps {
  onSelect: (data: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  initialValue?: string;
}

// Interfaccia per i risultati di Photon
interface PhotonFeature {
  geometry: {
    coordinates: number[];
  };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

// Interfaccia per i risultati di Nominatim
interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

// Tipo unione per gestire entrambi i formati di risultato
type SuggestionItem = PhotonFeature | NominatimResult;

// Funzione per determinare se un elemento è un risultato Photon o Nominatim
function isPhotonFeature(item: SuggestionItem): item is PhotonFeature {
  return 'geometry' in item && 'properties' in item;
}

export default function SimpleAddressAutocomplete({ 
  onSelect, 
  placeholder = "Inserisci indirizzo", 
  className = "",
  initialValue = "" 
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchProvider, setSearchProvider] = useState<'photon' | 'nominatim'>('photon');

  const handleSearch = async (value: string) => {
    setQuery(value);
    setError('');
    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    
    // Prima proviamo con Photon (più veloce)
    try {
      console.log(`Ricerca con provider: ${searchProvider}`);
      
      if (searchProvider === 'photon') {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5&lang=it`);
        
        if (!res.ok) {
          // Se Photon fallisce, prova con Nominatim
          console.log('Photon non disponibile, tento con Nominatim...');
          setSearchProvider('nominatim');
          throw new Error(`Errore Photon API: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!data.features || data.features.length === 0) {
          console.log('Nessun risultato da Photon, tento con Nominatim...');
          setSearchProvider('nominatim');
          throw new Error('Nessun risultato trovato');
        } else {
          setSuggestions(data.features);
          console.log('Suggerimenti trovati (Photon):', data.features.length);
        }
      } else {
        // Utilizzo Nominatim come fallback
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1&countrycodes=it`;
        
        const res = await fetch(nominatimUrl).catch(() => null);
        if (!res || !res.ok) {
          // Continua senza errore se l'API non è disponibile
          setSuggestions([]);
          return;
        }
        
        const data = await res.json();
        
        if (!data || data.length === 0) {
          setError('Nessun risultato trovato.');
          setSuggestions([]);
        } else {
          setSuggestions(data);
          console.log('Suggerimenti trovati (Nominatim):', data.length);
        }
      }
    } catch (err) {
      console.error('Errore nella ricerca indirizzi:', err);
      
      // Se siamo già in modalità Nominatim e fallisce, permettiamo comunque l'inserimento manuale
      if (searchProvider === 'nominatim') {
        setError('');
        setSuggestions([]);
      } else {
        // Altrimenti prova con Nominatim
        try {
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1&countrycodes=it`;
          
          const res = await fetch(nominatimUrl).catch(() => null);
          if (!res || !res.ok) {
            // API non disponibile, continua senza errore
            setSuggestions([]);
            return;
          }
          
          const data = await res.json();
          
          if (!data || data.length === 0) {
            setError('Nessun risultato trovato.');
            setSuggestions([]);
          } else {
            setSuggestions(data);
            console.log('Suggerimenti trovati (Nominatim fallback):', data.length);
          }
        } catch (fallbackErr) {
          console.error('Fallback Nominatim fallito:', fallbackErr);
          // Non mostriamo errore per permettere l'inserimento manuale
          setError('');
          setSuggestions([]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: SuggestionItem) => {
    try {
      let address: string;
      let lat: number;
      let lng: number;
      
      if (isPhotonFeature(item)) {
        // Formato Photon
        const { coordinates } = item.geometry;
        const { name, street, housenumber, city, state, country } = item.properties;
        
        // Costruisci l'indirizzo nel formato preferito
        const streetPart = street ? (housenumber ? `${street}, ${housenumber}` : street) : (name || "");
        const cityPart = city || state || "";
        address = [streetPart, cityPart, country].filter(Boolean).join(", ");
        
        lat = coordinates[1];
        lng = coordinates[0];
      } else {
        // Formato Nominatim
        address = item.display_name;
        lat = parseFloat(item.lat);
        lng = parseFloat(item.lon);
      }
      
      console.log('Selezione indirizzo:', {
        address,
        lat, 
        lng,
        provider: isPhotonFeature(item) ? 'photon' : 'nominatim'
      });
      
      setQuery(address);
      setSuggestions([]);
      
      onSelect({
        address,
        lat, 
        lng
      });
    } catch (err) {
      console.error('Errore nella selezione dell\'indirizzo:', err, item);
      setError('Errore nella selezione dell\'indirizzo');
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      {loading && <div className="text-xs mt-1 text-gray-500">Caricamento...</div>}
      {error && <div className="text-xs mt-1 text-red-500">{error}</div>}
      
      {suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((item, index) => {
            let displayAddress = "";
            
            try {
              if (isPhotonFeature(item)) {
                // Formato Photon
                const { name, street, housenumber, city, state, country } = item.properties;
                const parts = [
                  street ? (housenumber ? `${street}, ${housenumber}` : street) : (name || ""),
                  city || state || "",
                  country || ""
                ].filter(Boolean);
                
                displayAddress = parts.join(", ");
              } else {
                // Formato Nominatim
                displayAddress = item.display_name;
              }
            } catch (err) {
              displayAddress = "Indirizzo non valido";
              console.error('Errore nel formato dell\'indirizzo:', err, item);
            }
            
            // Badge che indica il provider
            const providerBadge = (
              <span 
                className={`inline-block text-xs px-1 mr-1 rounded ${
                  isPhotonFeature(item) 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {isPhotonFeature(item) ? 'Photon' : 'OSM'}
              </span>
            );
            
            return (
              <li
                key={index}
                onClick={() => handleSelect(item)}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-b-0"
              >
                {providerBadge} {displayAddress || "Indirizzo non disponibile"}
              </li>
            );
          })}
        </ul>
      )}
      
      {/* Indicatore del provider attivo */}
      <div className="text-xs text-gray-400 mt-1">
        Provider: {searchProvider === 'photon' ? 'Photon' : 'Nominatim (OpenStreetMap)'}
      </div>
    </div>
  );
}