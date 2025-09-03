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
    
    try {
      console.log('Ricerca con API proxy backend:', value);
      
      // Usa la nostra API proxy per indirizzi puliti e formattati
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(value + ', Italia')}`);
      
      if (!res.ok) {
        throw new Error(`Errore API: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (!data || data.length === 0) {
        setError('Nessun risultato trovato.');
        setSuggestions([]);
      } else {
        // Converte i risultati dal formato server al formato Nominatim compatibile
        const convertedSuggestions = data.map((item: any) => ({
          display_name: item.display_name, // Già formattato pulitamente dal server
          lat: item.lat.toString(),
          lon: item.lng.toString(),
          address: item.address
        }));
        
        setSuggestions(convertedSuggestions);
        console.log('Suggerimenti trovati (API Proxy):', convertedSuggestions.length);
      }
    } catch (err) {
      console.error('Errore nella ricerca indirizzi:', err);
      setError('');
      setSuggestions([]);
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