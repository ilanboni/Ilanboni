import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleAreaSelector } from "@/components/maps/SimpleAreaSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NLPreferencesInput from "@/components/clients/NLPreferencesInput";
import { Badge } from "@/components/ui/badge";
import axios from "axios";

export default function DirectNewClient() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState<"buyer" | "seller">("buyer");
  const [searchArea, setSearchArea] = useState(null);
  
  // Form state - precompilato con valori di esempio per velocizzare i test
  const [formData, setFormData] = useState({
    salutation: "caro",
    firstName: "Mario",
    lastName: "Rossi",
    isFriend: false,
    email: "mario.rossi@example.com",
    phone: "3771234567",
    religion: "catholic",
    notes: "Cliente test",
    minSize: "80",
    maxPrice: "250000",
    urgency: "3",
    rating: "3",
    searchNotes: "Note di ricerca test",
    // Campi AI-extracted preferences
    propertyType: "",
    rooms: "",
    bathrooms: "",
    zones: [] as string[],
    features: {
      elevator: false,
      balconyOrTerrace: false,
      parking: false,
      garden: false
    }
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  // Callback per quando l'AI estrae i filtri
  const handleAIFiltersExtracted = (filters: any) => {
    console.log("[DirectNewClient] AI filters extracted:", filters);
    
    setFormData(prev => ({
      ...prev,
      maxPrice: filters.budgetMax ? String(filters.budgetMax) : prev.maxPrice,
      minSize: filters.sizeMin ? String(filters.sizeMin) : prev.minSize,
      propertyType: filters.propertyType || prev.propertyType,
      rooms: filters.rooms ? String(filters.rooms) : prev.rooms,
      bathrooms: filters.bathrooms ? String(filters.bathrooms) : prev.bathrooms,
      zones: filters.zones || prev.zones,
      features: {
        elevator: filters.features?.elevator || prev.features.elevator,
        balconyOrTerrace: filters.features?.balconyOrTerrace || prev.features.balconyOrTerrace,
        parking: filters.features?.parking || prev.features.parking,
        garden: filters.features?.garden || prev.features.garden
      }
    }));

    toast({
      title: "Campi precompilati",
      description: "I criteri sono stati estratti dall'AI e i campi sono stati aggiornati.",
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submit iniziato...");
    setLoading(true);
    
    try {
      // Feedback visivo temporaneo per l'utente
      toast({
        title: "Salvataggio in corso",
        description: "Salvataggio dei dati del cliente...",
      });
      
      // Prepara i dati del cliente in modo minimalista per evitare problemi di validazione
      const clientData: any = {
        type: clientType,
        salutation: formData.salutation || "caro",
        firstName: formData.firstName || "Nome",
        lastName: formData.lastName || "Cognome",
        isFriend: !!formData.isFriend,
        email: formData.email || "",
        phone: formData.phone || "1234567890",
        religion: formData.religion || "",
        notes: formData.notes || "",
      };
      
      // Aggiungi i dati specifici per buyer/seller con tutti i dati AI-extracted
      if (clientType === 'buyer') {
        clientData.buyer = {
          minSize: formData.minSize ? parseInt(formData.minSize) : 0,
          maxPrice: formData.maxPrice ? parseInt(formData.maxPrice) : 0,
          propertyType: formData.propertyType || null,
          rooms: formData.rooms ? parseInt(formData.rooms) : null,
          bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
          zones: formData.zones.length > 0 ? formData.zones : null,
          elevator: formData.features.elevator || false,
          balconyOrTerrace: formData.features.balconyOrTerrace || false,
          parking: formData.features.parking || false,
          garden: formData.features.garden || false,
          urgency: formData.urgency ? parseInt(formData.urgency) : 3,
          rating: formData.rating ? parseInt(formData.rating) : 3,
          searchNotes: formData.searchNotes || "",
          searchArea: searchArea
        };
      } else {
        clientData.seller = {
          propertyAddress: "",
          propertyNotes: ""
        };
      }
      
      console.log("[DirectNewClient] Dati cliente con preferenze AI:", clientData);
      console.log("[DirectNewClient] Form state completo:", formData);
      
      // Invio diretto con axios - senza attendere la risposta per debug
      axios.post('/api/clients', clientData)
        .then(response => {
          console.log("Risposta salvataggio cliente:", response.data);
          
          toast({
            title: "Cliente salvato con successo",
            description: `Cliente ${formData.firstName} ${formData.lastName} creato con ID: ${response.data.id}`,
          });
          
          // Redirect alla pagina client list invece che al dettaglio
          setTimeout(() => navigate('/clients'), 1500);
        })
        .catch(error => {
          console.error("Errore API salvataggio:", error);
          toast({
            title: "Errore API",
            description: `Errore durante il salvataggio: ${error.message}`,
            variant: "destructive"
          });
        })
        .finally(() => {
          setLoading(false);
        });
    } catch (error) {
      console.error("Errore durante la preparazione dati:", error);
      toast({
        title: "Errore interno",
        description: "Si è verificato un errore durante la preparazione dei dati del cliente.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Nuovo Cliente (Versione Diretta)</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Inserisci i dati del cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo cliente */}
            <div className="mb-4">
              <label className="block mb-2">Tipo Cliente</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="clientType"
                    value="buyer"
                    checked={clientType === 'buyer'}
                    onChange={() => setClientType('buyer')}
                    className="mr-2"
                  />
                  Acquirente
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="clientType"
                    value="seller"
                    checked={clientType === 'seller'}
                    onChange={() => setClientType('seller')}
                    className="mr-2"
                  />
                  Venditore
                </label>
              </div>
            </div>
            
            <Tabs defaultValue="anagrafica" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="anagrafica">Dati Anagrafici</TabsTrigger>
                {clientType === 'buyer' && <TabsTrigger value="preferenze">Preferenze Acquisto</TabsTrigger>}
              </TabsList>
              
              <TabsContent value="anagrafica">
                {/* Dati base cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2">Formula di Saluto</label>
                    <select
                      name="salutation"
                      value={formData.salutation}
                      onChange={handleChange}
                      className="w-full p-2 border rounded"
                    >
                      <option value="egr_dott">Egr. Dott.</option>
                      <option value="gentma_sigra">Gent.ma Sig.ra</option>
                      <option value="egr_avvto">Egr. Avv.to</option>
                      <option value="caro">Caro</option>
                      <option value="cara">Cara</option>
                      <option value="ciao">Ciao</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block mb-2">Contatto amichevole</label>
                    <input
                      type="checkbox"
                      name="isFriend"
                      checked={formData.isFriend as boolean}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    Sì
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block mb-2">Nome*</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-2">Cognome*</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block mb-2">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-2">Telefono*</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block mb-2">Religione</label>
                  <select
                    name="religion"
                    value={formData.religion}
                    onChange={handleChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">Seleziona...</option>
                    <option value="catholic">Cattolica</option>
                    <option value="jewish">Ebraica</option>
                    <option value="muslim">Musulmana</option>
                    <option value="other">Altra</option>
                  </select>
                </div>
                
                <div className="mt-4">
                  <label className="block mb-2">Note</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    className="w-full p-2 border rounded"
                    rows={3}
                  />
                </div>
              </TabsContent>
              
              {clientType === 'buyer' && (
                <TabsContent value="preferenze">
                  {/* Componente AI per estrazione automatica preferenze */}
                  <div className="mb-6">
                    <NLPreferencesInput
                      standaloneMode={true}
                      onFiltersExtracted={handleAIFiltersExtracted}
                    />
                  </div>

                  {/* Mostra criteri estratti se presenti */}
                  {(formData.zones.length > 0 || formData.propertyType || formData.rooms || formData.bathrooms) && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
                      <h3 className="font-semibold mb-2 text-green-800">Criteri estratti dall'AI:</h3>
                      <div className="flex flex-wrap gap-2">
                        {formData.propertyType && <Badge variant="secondary">Tipo: {formData.propertyType}</Badge>}
                        {formData.rooms && <Badge variant="secondary">Locali: {formData.rooms}</Badge>}
                        {formData.bathrooms && <Badge variant="secondary">Bagni: {formData.bathrooms}</Badge>}
                        {formData.zones.map(zone => <Badge key={zone} variant="secondary">📍 {zone}</Badge>)}
                        {formData.features.elevator && <Badge variant="secondary">✅ Ascensore</Badge>}
                        {formData.features.balconyOrTerrace && <Badge variant="secondary">✅ Balcone/Terrazzo</Badge>}
                        {formData.features.parking && <Badge variant="secondary">✅ Parcheggio</Badge>}
                        {formData.features.garden && <Badge variant="secondary">✅ Giardino</Badge>}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2">Dimensione Min (mq)</label>
                      <input
                        type="number"
                        name="minSize"
                        value={formData.minSize}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    
                    <div>
                      <label className="block mb-2">Prezzo Max (€)</label>
                      <input
                        type="number"
                        name="maxPrice"
                        value={formData.maxPrice}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block mb-2">Urgenza (1-5)</label>
                      <input
                        type="range"
                        name="urgency"
                        min="1"
                        max="5"
                        value={formData.urgency}
                        onChange={handleChange}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs">
                        <span>Bassa</span>
                        <span>Media</span>
                        <span>Alta</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block mb-2">Rating (1-5)</label>
                      <input
                        type="range"
                        name="rating"
                        min="1" 
                        max="5"
                        value={formData.rating}
                        onChange={handleChange}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs">
                        <span>Basso</span>
                        <span>Medio</span>
                        <span>Alto</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block mb-2">Note di Ricerca</label>
                    <textarea
                      name="searchNotes"
                      value={formData.searchNotes}
                      onChange={handleChange}
                      className="w-full p-2 border rounded"
                      rows={3}
                    />
                  </div>
                  
                  <div className="mt-6">
                    <label className="block mb-2">Area di Ricerca</label>
                    <p className="text-sm text-gray-500 mb-2">Clicca sul pulsante "Inizia disegno" e poi sulla mappa per delimitare l'area di interesse.</p>
                    <div className="h-[400px] border rounded">
                      <SimpleAreaSelector
                        initialArea={searchArea}
                        onAreaSelected={setSearchArea}
                        className="h-full w-full"
                      />
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
            
            <div className="flex justify-end space-x-4 mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/clients')}
              >
                Annulla
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold" 
                disabled={loading}
                onClick={() => console.log("Button click registrato")}
              >
                {loading ? 'Salvataggio...' : 'Salva Cliente'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}