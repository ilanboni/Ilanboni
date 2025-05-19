import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { geocodeAddress } from "@/lib/geocoding";
import { useDebounce } from '@/hooks/use-debounce';

interface AddressResult {
  display_name: string;
  lat: number;
  lng: number;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

interface AddressAutoCompleteProps {
  onSelect: (result: { address: string; lat: number; lng: number }) => void;
  initialValue?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function AddressAutoComplete({
  onSelect,
  initialValue = '',
  placeholder = 'Cerca indirizzo...',
  className = '',
  disabled = false
}: AddressAutoCompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 500);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Gestisce il click fuori dal componente per chiudere i suggerimenti
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Effetto per la ricerca quando il query cambia
  useEffect(() => {
    const searchAddress = async () => {
      if (!debouncedQuery || debouncedQuery.length < 3) {
        setSuggestions([]);
        setError('');
        return;
      }
      
      setLoading(true);
      setError('');
      
      try {
        console.log("Ricerca indirizzo:", debouncedQuery);
        const results = await geocodeAddress(debouncedQuery);
        
        if (results.length === 0) {
          setError('Nessun risultato trovato.');
          setSuggestions([]);
        } else {
          setSuggestions(results);
          setIsOpen(true);
        }
      } catch (err: any) {
        console.error("Errore durante la ricerca dell'indirizzo:", err);
        setError(err.message || 'Errore durante la ricerca.');
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };
    
    searchAddress();
  }, [debouncedQuery]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Apri o chiudi il dropdown in base al contenuto
    if (value.length >= 3) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSuggestions([]);
      setError('');
    }
  };
  
  const handleSelect = (result: AddressResult) => {
    setQuery(result.display_name);
    setIsOpen(false);
    setSuggestions([]);
    
    onSelect({
      address: result.display_name,
      lat: result.lat,
      lng: result.lng
    });
  };
  
  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setError('');
    setIsOpen(false);
    onSelect({ address: '', lat: 0, lng: 0 });
  };
  
  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="flex w-full relative">
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-20"
          onFocus={() => query.length >= 3 && setIsOpen(true)}
        />
        
        <div className="absolute right-0 top-0 h-full flex items-center gap-1 pr-2">
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          
          {query && (
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={handleClear}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={() => setIsOpen(query.length >= 3)}
            disabled={disabled || query.length < 3}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {isOpen && (suggestions.length > 0 || error) && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg border border-gray-200">
          {error ? (
            <div className="px-4 py-2 text-sm text-red-500">{error}</div>
          ) : (
            <ul>
              {suggestions.map((result, index) => (
                <li
                  key={`${result.lat}-${result.lng}-${index}`}
                  className="px-4 py-2 text-sm cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSelect(result)}
                >
                  {result.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {error && !isOpen && (
        <div className="text-xs text-red-500 mt-1">{error}</div>
      )}
    </div>
  );
}