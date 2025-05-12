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

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=5&lang=it`);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch (err) {
      console.error('Errore nella ricerca indirizzi:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (feature: any) => {
    const { coordinates } = feature.geometry;
    const { name, street, housenumber, city, state, country } = feature.properties;
    
    // Costruisci l'indirizzo nel formato preferito
    const streetPart = street ? (housenumber ? `${street}, ${housenumber}` : street) : (name || "");
    const cityPart = city || state || "";
    const address = [streetPart, cityPart, country].filter(Boolean).join(", ");
    
    setQuery(address);
    setSuggestions([]);
    onSelect({
      address,
      lat: coordinates[1],
      lng: coordinates[0]
    });
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
      
      {suggestions.length > 0 && (
        <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((feature, index) => {
            const { name, street, housenumber, city, state } = feature.properties;
            const displayAddress = [
              street ? (housenumber ? `${street}, ${housenumber}` : street) : (name || ""),
              city || state || ""
            ].filter(Boolean).join(", ");
            
            return (
              <li
                key={index}
                onClick={() => handleSelect(feature)}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
              >
                {displayAddress}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}