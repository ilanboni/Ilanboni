import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { MapPin } from 'lucide-react';

interface AddressSelectorPlaceholderProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (data: { address: string; location?: { lat: number; lng: number }; fullAddress?: string }) => void;
  placeholder?: string;
  className?: string;
}

// Lista di indirizzi predefiniti per facilitare i test
const SAMPLE_ADDRESSES = [
  // Milano - Centro
  { address: "Via Monte Napoleone, 8", location: { lat: 45.4686, lng: 9.1975 }, fullAddress: "Via Monte Napoleone, 8, 20121 Milano" },
  { address: "Via Montenapoleone, 23", location: { lat: 45.4693, lng: 9.1977 }, fullAddress: "Via Montenapoleone, 23, 20121 Milano" },
  { address: "Via della Spiga, 2", location: { lat: 45.4686, lng: 9.1965 }, fullAddress: "Via della Spiga, 2, 20121 Milano" },
  { address: "Corso Como, 10", location: { lat: 45.4818, lng: 9.1875 }, fullAddress: "Corso Como, 10, 20154 Milano" },
  { address: "Via Brera, 28", location: { lat: 45.4720, lng: 9.1880 }, fullAddress: "Via Brera, 28, 20121 Milano" },
  
  // Milano - Altri quartieri
  { address: "Viale Abruzzi, 48", location: { lat: 45.4805, lng: 9.2149 }, fullAddress: "Viale Abruzzi, 48, 20131 Milano" },
  { address: "Via Solferino, 12", location: { lat: 45.4729, lng: 9.1874 }, fullAddress: "Via Solferino, 12, 20121 Milano" },
  { address: "Via Tortona, 56", location: { lat: 45.4528, lng: 9.1614 }, fullAddress: "Via Tortona, 56, 20144 Milano" },
  { address: "Via Pontaccio, 12", location: { lat: 45.4721, lng: 9.1834 }, fullAddress: "Via Pontaccio, 12, 20121 Milano" },
  { address: "Viale Piave, 39", location: { lat: 45.4702, lng: 9.2068 }, fullAddress: "Viale Piave, 39, 20129 Milano" },
  { address: "Via Belfiore, 16", location: { lat: 45.4553, lng: 9.1629 }, fullAddress: "Via Belfiore, 16, 20145 Milano" },
  { address: "Corso Garibaldi, 71", location: { lat: 45.4786, lng: 9.1865 }, fullAddress: "Corso Garibaldi, 71, 20121 Milano" },
  { address: "Via Padova, 23", location: { lat: 45.4915, lng: 9.2278 }, fullAddress: "Via Padova, 23, 20127 Milano" },
  
  // Roma
  { address: "Via del Corso, 12", location: { lat: 41.9018, lng: 12.4781 }, fullAddress: "Via del Corso, 12, 00186 Roma" },
  { address: "Via Veneto, 50", location: { lat: 41.9065, lng: 12.4882 }, fullAddress: "Via Veneto, 50, 00187 Roma" },
  { address: "Via dei Condotti, 8", location: { lat: 41.9052, lng: 12.4803 }, fullAddress: "Via dei Condotti, 8, 00187 Roma" },
  
  // Firenze
  { address: "Via Tornabuoni, 16", location: { lat: 43.7703, lng: 11.2510 }, fullAddress: "Via Tornabuoni, 16, 50123 Firenze" },
  { address: "Via dei Calzaiuoli, 12", location: { lat: 43.7714, lng: 11.2550 }, fullAddress: "Via dei Calzaiuoli, 12, 50122 Firenze" },
  
  // Napoli
  { address: "Via Chiaia, 45", location: { lat: 40.8376, lng: 14.2475 }, fullAddress: "Via Chiaia, 45, 80121 Napoli" },
  { address: "Via Toledo, 152", location: { lat: 40.8409, lng: 14.2488 }, fullAddress: "Via Toledo, 152, 80134 Napoli" }
];

export default function AddressSelectorPlaceholder({
  value,
  onChange,
  onSelect,
  placeholder = "Inserisci un indirizzo...",
  className = ""
}: AddressSelectorPlaceholderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customAddress, setCustomAddress] = useState("");
  const [customLat, setCustomLat] = useState("45.4642");
  const [customLng, setCustomLng] = useState("9.1900");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<typeof SAMPLE_ADDRESSES>(SAMPLE_ADDRESSES);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtra i suggerimenti in base a ciò che l'utente digita
  const filterSuggestions = (input: string) => {
    if (!input || input.length < 1) {
      // Se l'input è vuoto, mostriamo tutti gli indirizzi
      setFilteredSuggestions(SAMPLE_ADDRESSES);
      setShowSuggestions(SAMPLE_ADDRESSES.length > 0);
      return;
    }

    const inputLower = input.toLowerCase();
    const matches = SAMPLE_ADDRESSES.filter(
      addr => 
        addr.address.toLowerCase().includes(inputLower) || 
        addr.fullAddress.toLowerCase().includes(inputLower)
    );
    
    setFilteredSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    
    // Log per debug
    console.log(`Filtrando per "${input}": trovati ${matches.length} risultati`);
  };

  // Aggiorna i suggerimenti quando cambia l'input
  useEffect(() => {
    filterSuggestions(value);
  }, [value]);

  // Gestisce il click fuori dall'area dei suggerimenti
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current && 
        !suggestionRef.current.contains(event.target as Node) &&
        inputRef.current && 
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Gestisce la selezione da un suggerimento
  const handleSelectSuggestion = (sample: any) => {
    onChange(sample.address);
    
    if (onSelect) {
      onSelect({
        address: sample.address,
        location: sample.location,
        fullAddress: sample.fullAddress
      });
    }
    
    setShowSuggestions(false);
  };

  // Gestisce la selezione da un indirizzo predefinito nella finestra di dialogo
  const handleSelectSampleAddress = (sample: any) => {
    onChange(sample.address);
    
    if (onSelect) {
      onSelect({
        address: sample.address,
        location: sample.location,
        fullAddress: sample.fullAddress
      });
    }
    
    setDialogOpen(false);
  };

  // Gestisce l'inserimento manuale dell'indirizzo e delle coordinate
  const handleSubmitCustomAddress = () => {
    const trimmedAddress = customAddress.trim();
    if (!trimmedAddress) return;
    
    onChange(trimmedAddress);
    
    if (onSelect) {
      onSelect({
        address: trimmedAddress,
        location: {
          lat: parseFloat(customLat) || 45.4642,
          lng: parseFloat(customLng) || 9.1900
        },
        fullAddress: trimmedAddress
      });
    }
    
    setDialogOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex w-full items-center space-x-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1"
            onFocus={() => {
              // Mostra sempre i suggerimenti quando l'utente clicca sull'input
              setShowSuggestions(true);
              
              // Se l'input è vuoto ma abbiamo suggerimenti precaricati, mostra tutti gli indirizzi
              if (!value && filteredSuggestions.length === 0) {
                setFilteredSuggestions(SAMPLE_ADDRESSES);
              }
              
              console.log("Focus - Showing suggestions:", filteredSuggestions.length);
            }}
            onClick={() => {
              // Mostra i suggerimenti anche al click
              setShowSuggestions(true);
              
              // Se l'input è vuoto, mostra tutti gli indirizzi
              if (!value || value.length < 2) {
                setFilteredSuggestions(SAMPLE_ADDRESSES);
              }
            }}
          />
          
          {/* Suggerimenti in tempo reale mentre l'utente digita */}
          {showSuggestions && (
            <div 
              ref={suggestionRef}
              className="absolute z-20 w-full mt-1 bg-white border rounded-md shadow-md max-h-60 overflow-y-auto"
            >
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2 cursor-pointer hover:bg-gray-100 text-sm border-b last:border-b-0 flex justify-between items-center"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    <div className="flex items-center">
                      <MapPin className="h-3 w-3 mr-2 text-gray-500" />
                      <span className="font-medium">{suggestion.address}</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">
                      {suggestion.fullAddress.split(", ").slice(-1)[0]}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500">
                  Nessun indirizzo trovato. Prova a modificare la ricerca o seleziona "Seleziona sulla mappa" per inserire manualmente.
                </div>
              )}
            </div>
          )}
        </div>
        <Button
          type="button" 
          variant="outline"
          onClick={() => {
            setCustomAddress(value);
            setDialogOpen(true);
          }}
          className="whitespace-nowrap"
        >
          <MapPin className="mr-2 h-4 w-4" /> Seleziona sulla mappa
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Seleziona un indirizzo</DialogTitle>
          </DialogHeader>
          
          <Alert className="mt-4 border-amber-500 text-amber-600 bg-amber-50">
            <AlertDescription>
              Questo è un componente placeholder temporaneo in attesa del micro-frontend per la selezione degli indirizzi.
            </AlertDescription>
          </Alert>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="addressSearchFilter" className="text-base">Ricerca indirizzo</Label>
              <Input
                id="addressSearchFilter"
                placeholder="Digita per cercare un indirizzo..."
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
              />
              
              <Label htmlFor="sampleAddresses" className="text-base mt-2">Indirizzi disponibili</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                {SAMPLE_ADDRESSES
                  .filter(addr => 
                    !customAddress || 
                    addr.address.toLowerCase().includes(customAddress.toLowerCase()) ||
                    addr.fullAddress.toLowerCase().includes(customAddress.toLowerCase())
                  )
                  .map((sample, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleSelectSampleAddress(sample)}
                      className="p-2 hover:bg-gray-100 cursor-pointer rounded-sm text-sm flex justify-between"
                    >
                      <span>{sample.address}</span>
                      <span className="text-gray-500 text-xs">
                        {sample.fullAddress.split(", ").slice(-1)[0]}
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="manualCoordinates" className="text-base">Coordinate geografiche</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="customLat" className="text-sm">Latitudine</Label>
                  <Input
                    id="customLat"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    placeholder="Es. 45.4642"
                  />
                </div>
                <div>
                  <Label htmlFor="customLng" className="text-sm">Longitudine</Label>
                  <Input
                    id="customLng"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    placeholder="Es. 9.1900"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Le coordinate verranno applicate all'indirizzo selezionato o inserito manualmente.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={handleSubmitCustomAddress}>
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}