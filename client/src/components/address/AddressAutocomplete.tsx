import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from 'lucide-react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: any) => void;
  placeholder?: string;
  city?: string;
  className?: string;
}

interface AutocompleteResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
  };
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Inserisci un indirizzo...",
  city = "",
  className = ""
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Gestione click esterno
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Aggiorna il valore di debounce quando l'utente digita
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [value]);

  // Effettua la ricerca quando il valore debounced cambia
  useEffect(() => {
    if (!debouncedValue || debouncedValue.length < 3) {
      setSuggestions([]);
      return;
    }
    
    setIsLoading(true);
    
    // Costruisci la query di ricerca
    let query = debouncedValue;
    if (city) {
      query += `, ${city}`;
    }
    query += ', Italia';  // Limitiamo ai risultati italiani
    
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=it`)
      .then(response => response.json())
      .then((data: AutocompleteResult[]) => {
        setSuggestions(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Errore durante la ricerca indirizzi:', error);
        setIsLoading(false);
      });
  }, [debouncedValue, city]);

  // Gestisce la selezione di un indirizzo dai suggerimenti
  const handleSelectSuggestion = (suggestion: AutocompleteResult) => {
    // Estrai solo la via dall'indirizzo completo
    const roadName = suggestion.address.road || "";
    const houseNumber = suggestion.address.house_number || "";
    const streetAddress = (roadName + (houseNumber ? ` ${houseNumber}` : "")).trim();
    
    // Aggiorna il valore dell'input
    onChange(streetAddress);
    
    // Notifica il parent component con la selezione completa
    if (onSelect) {
      onSelect({
        address: streetAddress,
        location: {
          lat: parseFloat(suggestion.lat),
          lng: parseFloat(suggestion.lon)
        },
        fullAddress: suggestion.display_name
      });
    }
    
    // Chiudi i suggerimenti
    setSuggestions([]);
  };

  // Pulisci l'input
  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-16"
          onFocus={() => setIsFocused(true)}
        />
        <div className="absolute right-0 flex">
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={isLoading}
          >
            <Search className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
          </Button>
        </div>
      </div>
      
      {/* Dropdown suggerimenti */}
      {suggestions.length > 0 && isFocused && (
        <div 
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          <ul className="py-1">
            {suggestions.map((suggestion, index) => (
              <li 
                key={index}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                {suggestion.display_name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}