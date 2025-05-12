import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MapPin } from 'lucide-react';
import SimpleAddressAutocomplete from './SimpleAddressAutocomplete';

interface AddressSelectorPlaceholderProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (data: { address: string; location?: { lat: number; lng: number }; fullAddress?: string }) => void;
  placeholder?: string;
  className?: string;
}

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Gestisce la selezione dall'autocompletamento nel dialogo
  const handleDialogSelect = (data: { address: string; lat: number; lng: number }) => {
    setCustomAddress(data.address);
    setCustomLat(data.lat.toString());
    setCustomLng(data.lng.toString());
  };

  // Gestisce la selezione diretta dall'autocompletamento inline
  const handleInlineSelect = (data: { address: string; lat: number; lng: number }) => {
    onChange(data.address);
    
    if (onSelect) {
      onSelect({
        address: data.address,
        location: {
          lat: data.lat,
          lng: data.lng
        },
        fullAddress: data.address
      });
    }
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
          {/* Integrazione con SimpleAddressAutocomplete */}
          <SimpleAddressAutocomplete
            onSelect={handleInlineSelect}
            placeholder={placeholder}
            initialValue={value}
            className="w-full"
          />
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
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="addressSearchFilter" className="text-base">Ricerca indirizzo</Label>
              
              {/* Integrazione con SimpleAddressAutocomplete nel dialogo */}
              <SimpleAddressAutocomplete
                onSelect={handleDialogSelect}
                placeholder="Cerca un indirizzo..."
                initialValue={customAddress}
                className="w-full"
              />
              
              <div className="mt-4">
                <Label htmlFor="customAddress" className="text-sm">Indirizzo completo</Label>
                <Input
                  id="customAddress"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="Indirizzo completo"
                  className="mt-1"
                />
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