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
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Gestione click esterno
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      try {
        const target = event.target as Node;
        const dropdownContains = dropdownRef.current?.contains(target) || false;
        const inputContains = inputRef.current?.contains(target) || false;
        
        if (!dropdownContains && !inputContains) {
          setSuggestions([]);
        }
      } catch (error) {
        console.error('Errore nella gestione del click esterno:', error);
        // In caso di errore, chiudi comunque il dropdown
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
    // Resetta l'errore quando inizia una nuova ricerca
    setError(null);
    
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
      .then((data: any) => {
        // Assicuriamoci che data sia un array e facciamo validazione
        const validResults = Array.isArray(data) ? data.filter(item => 
          item && 
          typeof item === 'object' && 
          typeof item.display_name === 'string' &&
          typeof item.lat === 'string' &&
          typeof item.lon === 'string'
        ) : [];
        
        setSuggestions(validResults as AutocompleteResult[]);
        
        // Mostra un messaggio se non ci sono risultati
        if (validResults.length === 0 && debouncedValue.length >= 3) {
          setError('Nessun indirizzo trovato. Prova a essere più specifico o verifica l\'indirizzo inserito.');
        }
        
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Errore durante la ricerca indirizzi:', error);
        setError('Si è verificato un errore durante la ricerca. Riprova più tardi.');
        setIsLoading(false);
      });
  }, [debouncedValue, city]);

  // Gestisce la selezione di un indirizzo dai suggerimenti
  const handleSelectSuggestion = (suggestion: AutocompleteResult) => {
    // Estrai solo la via dall'indirizzo completo
    const address = suggestion.address || {};
    const roadName = address.road || "";
    const houseNumber = address.house_number || "";
    const streetAddress = (roadName + (houseNumber ? ` ${houseNumber}` : "")).trim();
    
    // Aggiorna il valore dell'input
    onChange(streetAddress);
    
    // Notifica il parent component con la selezione completa
    if (onSelect) {
      try {
        // Convertiamo le coordinate in numeri con gestione di eventuali errori
        const lat = parseFloat(suggestion.lat);
        const lng = parseFloat(suggestion.lon);
        
        // Verifichiamo che siano numeri validi
        const location = !isNaN(lat) && !isNaN(lng) 
          ? { lat, lng }
          : undefined;
        
        onSelect({
          address: streetAddress,
          location: location,
          fullAddress: suggestion.display_name
        });
      } catch (error) {
        console.error('Errore durante l\'elaborazione delle coordinate:', error);
        // Notifica senza coordinate
        onSelect({
          address: streetAddress,
          fullAddress: suggestion.display_name
        });
      }
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
          onBlur={() => {
            // Ritardiamo la chiusura del dropdown per permettere il click
            setTimeout(() => setIsFocused(false), 200);
          }}
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
      {(suggestions.length > 0 || error) && isFocused && (
        <div 
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {error ? (
            <div className="px-4 py-3 text-sm text-red-600">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}