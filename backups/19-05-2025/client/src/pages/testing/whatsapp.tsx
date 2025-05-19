import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

export default function WhatsAppTestPage() {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId || !message) {
      toast({
        title: "Errore",
        description: "Compilare tutti i campi",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await apiRequest(
        "POST",
        "/api/whatsapp/test-webhook",
        {
          clientId: parseInt(clientId),
          message,
        }
      );
      const result = await response.json();
      
      setResponse(result);
      
      toast({
        title: "Messaggio simulato",
        description: "Il messaggio in arrivo è stato simulato con successo",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <Helmet>
        <title>Test WhatsApp | Gestionale Immobiliare</title>
        <meta 
          name="description"
          content="Pagina di test per simulare messaggi WhatsApp in arrivo"
        />
      </Helmet>
      
      <div className="container max-w-3xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Test Messaggi WhatsApp</CardTitle>
            <CardDescription>
              Simula la ricezione di un messaggio WhatsApp da un cliente
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="clientId">
                  ID Cliente
                </label>
                <Input
                  id="clientId"
                  type="number"
                  placeholder="Inserisci l'ID del cliente"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="message">
                  Messaggio
                </label>
                <Textarea
                  id="message"
                  placeholder="Inserisci il testo del messaggio in arrivo"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              
              {response && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-semibold mb-2">Risposta:</h3>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
            
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="mr-2 animate-spin">
                      <i className="fas fa-spinner"></i>
                    </span>
                    Simulazione in corso...
                  </>
                ) : (
                  <>Simula messaggio in arrivo</>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </>
  );
}