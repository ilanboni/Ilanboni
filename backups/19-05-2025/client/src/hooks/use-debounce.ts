import { useState, useEffect } from 'react';

/**
 * Hook personalizzato per implementare un debounce
 * Utile per ritardare l'esecuzione di funzioni come ricerche in tempo reale
 * 
 * @param value Il valore da ritardare
 * @param delay Il tempo di ritardo in millisecondi
 * @returns Il valore dopo il ritardo
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Aggiorna il valore dopo il delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancella il timer se il valore cambia (o il componente viene smontato)
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}