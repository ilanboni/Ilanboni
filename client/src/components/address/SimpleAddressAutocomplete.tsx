import React, { useState } from 'react';

interface AddressAutocompleteProps {
  onSelect: (data: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  initialValue?: string;
}

export default function SimpleAddressAutocomplete({ 
  onSelect, 
  placeholder = "Inserisci indirizzo", 
  className = "",
  initialValue = "" 
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (value: string) => {
    setQuery(value);
    setError('');
    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5&lang=it`);
      if (!res.ok) {
        throw new Error(`Errore API: ${res.status}`);
      }
      const data = await res.json();
      
      if (!data.features || data.features.length === 0) {
        setError('Nessun risultato trovato.');
        setSuggestions([]);
      } else {
        setSuggestions(data.features);
        console.log('Suggerimenti trovati:', data.features.length);
      }
    } catch (err) {
      console.error('Errore nella ricerca indirizzi:', err);
      setError('Errore durante la ricerca.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (feature: any) => {
    try {
      const { coordinates } = feature.geometry;
      const { name, street, housenumber, city, state, country } = feature.properties;
      
      // Costruisci l'indirizzo nel formato preferito
      const streetPart = street ? (housenumber ? `${street}, ${housenumber}` : street) : (name || "");
      const cityPart = city || state || "";
      const address = [streetPart, cityPart, country].filter(Boolean).join(", ");
      
      console.log('Selezione indirizzo:', {
        address,
        coordinates: [coordinates[1], coordinates[0]],
        properties: feature.properties
      });
      
      setQuery(address);
      setSuggestions([]);
      
      onSelect({
        address,
        lat: coordinates[1], 
        lng: coordinates[0]
      });
    } catch (err) {
      console.error('Errore nella selezione dell\'indirizzo:', err, feature);
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
          {suggestions.map((feature, index) => {
            const { name, street, housenumber, city, state, country } = feature.properties;
            let displayAddress = "";
            
            try {
              const parts = [
                street ? (housenumber ? `${street}, ${housenumber}` : street) : (name || ""),
                city || state || "",
                country || ""
              ].filter(Boolean);
              
              displayAddress = parts.join(", ");
            } catch (err) {
              displayAddress = "Indirizzo non valido";
              console.error('Errore nel formato dell\'indirizzo:', err, feature);
            }
            
            return (
              <li
                key={index}
                onClick={() => handleSelect(feature)}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-b-0"
              >
                {displayAddress || "Indirizzo non disponibile"}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}