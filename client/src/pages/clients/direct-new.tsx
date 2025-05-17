import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";

export default function DirectNewClient() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState<"buyer" | "seller">("buyer");
  
  // Form state - precompilato con valori di esempio per velocizzare i test
  const [formData, setFormData] = useState({
    salutation: "caro",
    firstName: "Mario",
    lastName: "Rossi",
    isFriend: false,
    email: "mario.rossi@example.com",
    phone: "3771234567",
    religion: "catholic",
    notes: "Cliente test"
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
      // Prepara i dati del cliente nella forma più semplice possibile
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
        
        // Oggetto vuoto per buyer/seller per soddisfare la struttura dei dati del server
        buyer: clientType === 'buyer' ? {} : undefined,
        seller: clientType === 'seller' ? {} : undefined
      };
      
      console.log("Dati cliente semplificati:", clientData);
      
      // Invio diretto con axios invece di usare react-query per evitare problemi
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
      <h1 className="text-2xl font-bold mb-6">Nuovo Cliente (Versione Diretta)</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Inserisci solo i dati essenziali del cliente</CardTitle>
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