import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimpleAreaSelector } from "@/components/maps/SimpleAreaSelector";
import { Feature, Polygon } from "geojson";
import axios from "axios";

export default function SimpleNewClient() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState<"buyer" | "seller">("buyer");
  const [searchArea, setSearchArea] = useState<Feature<Polygon> | null>(null);
  
  // Form state
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
    searchNotes: "Note ricerca test"
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Prepara i dati del cliente con il minimo di formattazione
      const clientData = {
        type: clientType,
        salutation: formData.salutation,
        firstName: formData.firstName,
        lastName: formData.lastName,
        isFriend: formData.isFriend,
        email: formData.email,
        phone: formData.phone,
        religion: formData.religion,
        notes: formData.notes,
        // Aggiungi i dati specifici in base al tipo di cliente
        buyer: clientType === 'buyer' ? {
          searchArea,
          minSize: parseInt(formData.minSize) || 0,
          maxPrice: parseInt(formData.maxPrice) || 0,
          urgency: parseInt(formData.urgency) || 3,
          rating: parseInt(formData.rating) || 3,
          searchNotes: formData.searchNotes
        } : undefined
      };
      
      console.log("Dati semplificati:", clientData);
      
      // Invio diretto con axios invece di usare react-query
      const response = await axios.post('/api/clients', clientData);
      
      toast({
        title: "Cliente salvato con successo",
        description: `Cliente ${formData.firstName} ${formData.lastName} creato.`
      });
      
      // Redirect alla pagina del cliente
      navigate(`/clients/${response.data.id}`);
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il salvataggio del cliente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Nuovo Cliente (Versione Semplificata)</h1>
      
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            <div>
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
            
            <div>
              <label className="block mb-2">Note</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                rows={3}
              />
            </div>
            
            {/* Dati specifici compratore */}
            {clientType === 'buyer' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Preferenze di Ricerca</h3>
                
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                
                <div>
                  <label className="block mb-2">Note di Ricerca</label>
                  <textarea
                    name="searchNotes"
                    value={formData.searchNotes}
                    onChange={handleChange}
                    className="w-full p-2 border rounded"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block mb-2">Area di Ricerca</label>
                  <p className="text-sm text-gray-500 mb-2">Clicca sulla mappa per disegnare il perimetro dell'area di interesse.</p>
                  <div className="h-[400px] border rounded">
                    <SimpleAreaSelector 
                      value={searchArea} 
                      onChange={setSearchArea} 
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-4 mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/clients')}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvataggio...' : 'Salva Cliente'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}