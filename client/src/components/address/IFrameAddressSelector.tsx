import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from 'lucide-react';

interface IFrameAddressSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (data: { address: string; location?: { lat: number; lng: number }; fullAddress?: string }) => void;
  placeholder?: string;
  className?: string;
}

// URL del micro-frontend che ospita il selettore di indirizzi
// Nota: questo URL dovrà essere sostituito con l'URL reale del tuo micro-frontend una volta creato
const ADDRESS_SELECTOR_URL = "https://address-selector-microapp.replit.app";

export default function IFrameAddressSelector({
  value,
  onChange,
  onSelect,
  placeholder = "Inserisci un indirizzo...",
  className = ""
}: IFrameAddressSelectorProps) {
  const [showIframe, setShowIframe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Imposta il listener per i messaggi provenienti dall'iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verifica che il messaggio provenga dal tuo micro-frontend
      if (event.origin !== new URL(ADDRESS_SELECTOR_URL).origin) {
        return;
      }
      
      const data = event.data;
      
      // Gestisci i vari tipi di messaggi
      if (data.type === 'READY') {
        // L'iframe è pronto a ricevere messaggi
        setIframeReady(true);
        setIsLoading(false);
      } else if (data.type === 'ADDRESS_SELECTED') {
        // Indirizzo selezionato dall'utente nell'iframe
        onChange(data.address);
        
        if (onSelect) {
          onSelect({
            address: data.address,
            location: data.location,
            fullAddress: data.fullAddress
          });
        }
        
        // Chiudi l'iframe dopo la selezione
        setShowIframe(false);
      } else if (data.type === 'CLOSE') {
        // L'utente ha chiesto di chiudere l'iframe
        setShowIframe(false);
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onChange, onSelect]);

  // Apre il selettore di indirizzi
  const openAddressSelector = () => {
    setShowIframe(true);
    setIsLoading(true);
  };

  // Invia l'indirizzo attuale all'iframe quando è pronto
  useEffect(() => {
    if (showIframe && iframeReady && iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        { type: 'INIT', currentAddress: value },
        ADDRESS_SELECTOR_URL
      );
    }
  }, [showIframe, iframeReady, value]);

  return (
    <div className={`relative ${className}`}>
      <div className="flex w-full items-center space-x-2">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button" 
          variant="outline"
          onClick={openAddressSelector}
          className="whitespace-nowrap"
        >
          {isLoading && showIframe ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Seleziona indirizzo
        </Button>
      </div>
      
      {showIframe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative bg-white rounded-lg shadow-lg w-[90%] max-w-3xl h-[80vh] overflow-hidden">
            <div className="h-full w-full">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Caricamento del selettore indirizzi...</span>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={ADDRESS_SELECTOR_URL}
                className="w-full h-full border-0"
                onLoad={() => setIsLoading(false)}
              />
            </div>
            <div className="absolute top-4 right-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full w-8 h-8 p-0" 
                onClick={() => setShowIframe(false)}
              >
                ✕
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}