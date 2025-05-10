import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  { 
    address: "Via Monte Napoleone, 8", 
    location: { lat: 45.4686, lng: 9.1975 },
    fullAddress: "Via Monte Napoleone, 8, 20121 Milano MI, Italia"
  },
  { 
    address: "Via Montenapoleone, 23", 
    location: { lat: 45.4693, lng: 9.1977 },
    fullAddress: "Via Montenapoleone, 23, 20121 Milano MI, Italia"
  },
  { 
    address: "Via della Spiga, 2", 
    location: { lat: 45.4686, lng: 9.1965 },
    fullAddress: "Via della Spiga, 2, 20121 Milano MI, Italia"
  },
  { 
    address: "Corso Como, 10", 
    location: { lat: 45.4818, lng: 9.1875 },
    fullAddress: "Corso Como, 10, 20154 Milano MI, Italia"
  },
  { 
    address: "Via Brera, 28", 
    location: { lat: 45.4720, lng: 9.1880 },
    fullAddress: "Via Brera, 28, 20121 Milano MI, Italia"
  }
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

  // Gestisce la selezione da un indirizzo predefinito
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
          onClick={() => {
            setCustomAddress(value);
            setDialogOpen(true);
          }}
          className="whitespace-nowrap"
        >
          <MapPin className="mr-2 h-4 w-4" /> Seleziona indirizzo
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
          
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Indirizzi di esempio:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {SAMPLE_ADDRESSES.map((sample, index) => (
                <Button 
                  key={index} 
                  variant="outline" 
                  className="w-full justify-start text-left"
                  onClick={() => handleSelectSampleAddress(sample)}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  <span className="truncate">{sample.address}</span>
                </Button>
              ))}
            </div>
          </div>
          
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Inserimento manuale:</h4>
            <div className="space-y-2">
              <Input
                placeholder="Indirizzo completo"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Latitudine"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                />
                <Input
                  placeholder="Longitudine"
                  value={customLng}
                  onChange={(e) => setCustomLng(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSubmitCustomAddress}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}