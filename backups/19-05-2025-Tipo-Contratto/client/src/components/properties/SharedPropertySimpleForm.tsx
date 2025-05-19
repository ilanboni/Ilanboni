import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MapSelector } from "@/components/maps/MapSelector";
import { InsertSharedProperty } from "@shared/schema";

type SharedPropertySimpleFormProps = {
  initialData: Partial<InsertSharedProperty>;
  onSubmit: (data: InsertSharedProperty) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function SharedPropertySimpleForm({ initialData, onSubmit, onCancel, isSubmitting = false }: SharedPropertySimpleFormProps) {
  // Creiamo uno stato locale che non usa React Hook Form
  const [formData, setFormData] = useState<Partial<InsertSharedProperty>>({
    address: "",
    city: "",
    size: undefined,
    price: undefined,
    type: "",
    ownerName: "",
    ownerPhone: "",
    ownerEmail: "",
    ownerNotes: "",
    floor: "",
    agency1Name: "",
    agency1Link: "",
    agency2Name: "",
    agency2Link: "",
    agency3Name: "",
    agency3Link: "",
    rating: 3,
    stage: "address_found",
    stageResult: "",
    isAcquired: false,
    matchBuyers: false,
    location: null
  });

  const [locationData, setLocationData] = useState<{lat?: number; lng?: number} | null>(
    initialData?.location as {lat?: number; lng?: number} | null
  );

  // Inizializza il form con i dati iniziali
  useEffect(() => {
    if (initialData) {
      console.log("Dati iniziali caricati nel form:", initialData);
      setFormData({
        ...initialData
      });
    }
  }, [initialData]);

  // Gestione dei campi di input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    console.log(`Campo ${name} cambiato in: ${value}`);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Gestione speciale per campi numerici
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericValue = value === "" ? undefined : parseInt(value, 10);
    console.log(`Campo numerico ${name} cambiato in: ${numericValue}`);
    setFormData(prev => ({ ...prev, [name]: numericValue }));
  };

  // Gestione per switch
  const handleSwitchChange = (name: string, checked: boolean) => {
    console.log(`Switch ${name} cambiato in: ${checked}`);
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  // Gestione per select
  const handleSelectChange = (name: string, value: string) => {
    console.log(`Select ${name} cambiato in: ${value}`);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Gestione per rating
  const handleRatingChange = (value: string) => {
    console.log(`Rating cambiato in: ${value}`);
    setFormData(prev => ({ ...prev, rating: parseInt(value, 10) }));
  };

  // Invio del form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepara i dati da inviare
    const dataToSubmit = {
      ...formData,
      location: locationData,
      // Assicuriamoci che i campi siano definiti correttamente
      floor: formData.floor || "",
      agency1Name: formData.agency1Name || "",
      agency1Link: formData.agency1Link || "",
      agency2Name: formData.agency2Name || "",
      agency2Link: formData.agency2Link || "",
      agency3Name: formData.agency3Name || "",
      agency3Link: formData.agency3Link || ""
    } as InsertSharedProperty;
    
    console.log("Dati completi del form da inviare:", dataToSubmit);
    onSubmit(dataToSubmit);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Informazioni generali</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FormLabel htmlFor="address">Indirizzo</FormLabel>
            <Input 
              id="address"
              name="address"
              placeholder="Inserisci l'indirizzo completo" 
              value={formData.address || ""} 
              onChange={handleInputChange}
              className="mt-1"
              required
            />
          </div>
          
          <div>
            <FormLabel htmlFor="city">Città</FormLabel>
            <Input 
              id="city"
              name="city"
              placeholder="Inserisci la città" 
              value={formData.city || ""} 
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
          
          <div>
            <FormLabel htmlFor="size">Superficie (m²)</FormLabel>
            <Input 
              id="size"
              name="size"
              type="number"
              placeholder="Inserisci la superficie in m²" 
              value={formData.size || ""} 
              onChange={handleNumberChange}
              className="mt-1"
            />
          </div>
          
          <div>
            <FormLabel htmlFor="price">Prezzo (€)</FormLabel>
            <Input 
              id="price"
              name="price"
              type="number"
              placeholder="Inserisci il prezzo in €" 
              value={formData.price || ""} 
              onChange={handleNumberChange}
              className="mt-1"
            />
          </div>
          
          <div>
            <FormLabel htmlFor="type">Tipo di immobile</FormLabel>
            <Select 
              value={formData.type || ""} 
              onValueChange={(value) => handleSelectChange("type", value)}
            >
              <SelectTrigger id="type" className="mt-1">
                <SelectValue placeholder="Seleziona tipo di immobile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apartment">Appartamento</SelectItem>
                <SelectItem value="house">Casa indipendente</SelectItem>
                <SelectItem value="commercial">Commerciale</SelectItem>
                <SelectItem value="land">Terreno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <FormLabel htmlFor="rating">Valutazione</FormLabel>
            <Select 
              value={formData.rating?.toString() || "3"} 
              onValueChange={handleRatingChange}
            >
              <SelectTrigger id="rating" className="mt-1">
                <SelectValue placeholder="Seleziona una valutazione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 stella - Basso interesse</SelectItem>
                <SelectItem value="2">2 stelle - Interesse moderato</SelectItem>
                <SelectItem value="3">3 stelle - Buon potenziale</SelectItem>
                <SelectItem value="4">4 stelle - Molto interessante</SelectItem>
                <SelectItem value="5">5 stelle - Eccezionale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <FormLabel htmlFor="floor">Piano dell'appartamento</FormLabel>
            <Input 
              id="floor"
              name="floor"
              placeholder="es. 3° piano" 
              value={formData.floor || ""} 
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
        </div>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Link altre agenzie</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FormLabel htmlFor="agency1Name">Nome agenzia 1</FormLabel>
              <Input 
                id="agency1Name"
                name="agency1Name"
                placeholder="es. Immobiliare Rossi" 
                value={formData.agency1Name || ""} 
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
            <div>
              <FormLabel htmlFor="agency1Link">Link agenzia 1</FormLabel>
              <Input 
                id="agency1Link"
                name="agency1Link"
                placeholder="https://example.com/property/1234" 
                value={formData.agency1Link || ""} 
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FormLabel htmlFor="agency2Name">Nome agenzia 2</FormLabel>
              <Input 
                id="agency2Name"
                name="agency2Name"
                placeholder="es. Immobiliare Bianchi" 
                value={formData.agency2Name || ""} 
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
            <div>
              <FormLabel htmlFor="agency2Link">Link agenzia 2</FormLabel>
              <Input 
                id="agency2Link"
                name="agency2Link"
                placeholder="https://example.com/property/1234" 
                value={formData.agency2Link || ""} 
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FormLabel htmlFor="agency3Name">Nome agenzia 3</FormLabel>
              <Input 
                id="agency3Name"
                name="agency3Name"
                placeholder="es. Immobiliare Verdi" 
                value={formData.agency3Name || ""} 
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
            <div>
              <FormLabel htmlFor="agency3Link">Link agenzia 3</FormLabel>
              <Input 
                id="agency3Link"
                name="agency3Link"
                placeholder="https://example.com/property/1234" 
                value={formData.agency3Link || ""} 
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Dettagli proprietario</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FormLabel htmlFor="ownerName">Nome proprietario</FormLabel>
            <Input 
              id="ownerName"
              name="ownerName"
              placeholder="Inserisci il nome del proprietario" 
              value={formData.ownerName || ""} 
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
          
          <div>
            <FormLabel htmlFor="ownerPhone">Telefono proprietario</FormLabel>
            <Input 
              id="ownerPhone"
              name="ownerPhone"
              placeholder="Inserisci il telefono del proprietario" 
              value={formData.ownerPhone || ""} 
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
          
          <div>
            <FormLabel htmlFor="ownerEmail">Email proprietario</FormLabel>
            <Input 
              id="ownerEmail"
              name="ownerEmail"
              type="email"
              placeholder="Inserisci l'email del proprietario" 
              value={formData.ownerEmail || ""} 
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
        </div>
        
        <div className="mt-4">
          <FormLabel htmlFor="ownerNotes">Note sul proprietario</FormLabel>
          <Textarea 
            id="ownerNotes"
            name="ownerNotes"
            placeholder="Inserisci note sul proprietario" 
            value={formData.ownerNotes || ""} 
            onChange={handleInputChange}
            className="mt-1"
          />
        </div>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Stato trattativa</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <FormLabel htmlFor="stage">Stato</FormLabel>
            <Select 
              value={formData.stage || "address_found"} 
              onValueChange={(value) => handleSelectChange("stage", value)}
            >
              <SelectTrigger id="stage" className="mt-1">
                <SelectValue placeholder="Seleziona lo stato della trattativa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="address_found">Indirizzo trovato</SelectItem>
                <SelectItem value="owner_found">Proprietario trovato</SelectItem>
                <SelectItem value="owner_contact_found">Contatto del proprietario</SelectItem>
                <SelectItem value="owner_contacted">Proprietario contattato</SelectItem>
                <SelectItem value="result">Risultato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <FormLabel htmlFor="stageResult">Risultato trattativa</FormLabel>
            <Textarea 
              id="stageResult"
              name="stageResult"
              placeholder="Inserisci dettagli sul risultato della trattativa" 
              value={formData.stageResult || ""} 
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <FormLabel htmlFor="isAcquired">Immobile acquisito</FormLabel>
            <Switch 
              id="isAcquired" 
              checked={formData.isAcquired || false}
              onCheckedChange={(checked) => handleSwitchChange("isAcquired", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <FormLabel htmlFor="matchBuyers">Attiva matching con acquirenti</FormLabel>
            <Switch 
              id="matchBuyers" 
              checked={formData.matchBuyers || false}
              onCheckedChange={(checked) => handleSwitchChange("matchBuyers", checked)}
            />
          </div>
        </div>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Posizione</h3>
        <MapSelector 
          initialLocation={locationData} 
          onLocationSelected={setLocationData} 
          address={formData.address}
          autoGeocode={true}
        />
      </Card>
      
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvataggio..." : "Salva proprietà condivisa"}
        </Button>
      </div>
    </form>
  );
}