import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from 'lucide-react';

interface SimpleAddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: any) => void;
  placeholder?: string;
  city?: string;
  className?: string;
}

// Lista di indirizzi comuni per un'autocompletamento base
// Questa è la principale differenza: invece di chiamate API in tempo reale,
// utilizziamo dati statici o dati precaricati
const COMMON_STREETS = [
  "Via Roma", "Via Milano", "Via Napoli", "Via Torino", "Via Firenze",
  "Via Venezia", "Via Bologna", "Via Genova", "Via Palermo", "Via Verona",
  "Corso Italia", "Corso Europa", "Corso Francia", "Corso Vittorio Emanuele",
  "Viale Monza", "Viale Certosa", "Viale Zara", "Viale Fulvio Testi",
  "Piazza Duomo", "Piazza San Babila", "Piazza della Repubblica", "Piazza Cordusio",
  "Via Monte Napoleone", "Via della Spiga", "Via Manzoni", "Via Dante",
  "Via Brera", "Via Solferino", "Via Tortona", "Via Savona",
  "Via Washington", "Via Foppa", "Via Sardegna", "Via Sicilia"
];

export default function SimpleAddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Inserisci un indirizzo...",
  city = "",
  className = ""
}: SimpleAddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
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
          setIsFocused(false);
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

  // Funzione per generare suggerimenti in base all'input
  const generateSuggestions = (input: string) => {
    setError(null);
    
    if (!input || input.length < 2) {
      setSuggestions([]);
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Simuliamo un breve ritardo di caricamento
      setTimeout(() => {
        const inputLower = input.toLowerCase();
        const results = COMMON_STREETS
          .filter(street => street.toLowerCase().includes(inputLower))
          .map(street => street + (city ? `, ${city}` : ''));
        
        setSuggestions(results);
        
        if (results.length === 0) {
          setError('Nessun indirizzo trovato nei comuni. Puoi digitare manualmente l\'indirizzo completo.');
        }
        
        setIsLoading(false);
      }, 100);
    } catch (e) {
      console.error('Errore durante la generazione dei suggerimenti:', e);
      setError('Si è verificato un errore. Puoi continuare a digitare manualmente.');
      setIsLoading(false);
    }
  };

  // Genera suggerimenti quando cambia il valore dell'input
  useEffect(() => {
    generateSuggestions(value);
  }, [value, city]);

  // Gestisce la selezione di un indirizzo dai suggerimenti
  const handleSelectSuggestion = (suggestion: string) => {
    // Estrai solo la via dall'indirizzo completo
    const streetAddress = suggestion.split(',')[0];
    
    // Aggiorna il valore dell'input
    onChange(streetAddress);
    
    // Notifica il parent component con la selezione completa
    if (onSelect) {
      try {
        // Simuliamo una posizione (nella realtà si userebbero i servizi di geocoding)
        // Questa è una posizione generica nel centro di Milano
        const location = {
          lat: 45.4642 + (Math.random() - 0.5) * 0.04, // Aggiungiamo un po' di randomness per simulare posizioni diverse
          lng: 9.1900 + (Math.random() - 0.5) * 0.04
        };
        
        onSelect({
          address: streetAddress,
          location: location,
          fullAddress: suggestion
        });
      } catch (error) {
        console.error('Errore durante l\'elaborazione della selezione:', error);
        // Notifica senza coordinate
        onSelect({
          address: streetAddress,
          fullAddress: suggestion
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
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
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
            <div className="px-4 py-3 text-sm text-amber-600">
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
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {/* Messaggio informativo */}
      <div className="text-xs text-gray-500 mt-1">
        Suggerimenti disponibili da un database locale. Per indirizzi più precisi, digitare manualmente.
      </div>
    </div>
  );
}