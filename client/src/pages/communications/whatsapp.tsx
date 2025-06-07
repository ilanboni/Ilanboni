import { useState } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function WhatsAppPage() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const sendWhatsAppMutation = useMutation({
    mutationFn: (data: { to: string; message: string }) =>
      apiRequest("/api/whatsapp/send", {
        method: "POST",
        data
      }),
    onSuccess: () => {
      toast({
        title: "Messaggio inviato",
        description: "Il messaggio WhatsApp è stato inviato con successo",
      });
      setPhone("");
      setMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error?.message || "Errore nell'invio del messaggio",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim() || !message.trim()) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci sia il numero di telefono che il messaggio",
        variant: "destructive",
      });
      return;
    }

    // Normalizza il numero di telefono
    let normalizedPhone = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = "39" + normalizedPhone.substring(1);
    } else if (!normalizedPhone.startsWith("39") && !normalizedPhone.startsWith("+39")) {
      if (normalizedPhone.startsWith("+")) {
        normalizedPhone = normalizedPhone.substring(1);
      } else {
        normalizedPhone = "39" + normalizedPhone;
      }
    }

    sendWhatsAppMutation.mutate({
      to: normalizedPhone,
      message: message.trim()
    });
  };

  // Template messages for quick selection
  const messageTemplates = [
    {
      title: "Conferma appuntamento",
      content: "Gentile cliente, le confermo l'appuntamento per la visita dell'immobile. La ringrazio per la disponibilità."
    },
    {
      title: "Proposta immobile",
      content: "Buongiorno, ho trovato un immobile che potrebbe interessarle. Quando sarebbe disponibile per una visita?"
    },
    {
      title: "Follow-up dopo visita",
      content: "Spero che la visita di oggi sia stata di suo gradimento. Sono a disposizione per qualsiasi chiarimento."
    },
    {
      title: "Richiesta documenti",
      content: "Per procedere con la pratica, avrei bisogno di alcuni documenti. Quando potremmo organizzarci per il ritiro?"
    }
  ];

  return (
    <>
      <Helmet>
        <title>Invia WhatsApp | Gestionale Immobiliare</title>
        <meta name="description" content="Invia messaggi WhatsApp a qualsiasi numero di telefono" />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/communications">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invia WhatsApp</h1>
            <p className="text-gray-500 mt-1">
              Invia messaggi WhatsApp a qualsiasi numero di telefono
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Nuovo Messaggio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="phone">Numero di telefono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="39334567890 o 334567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Inserisci il numero con prefisso internazionale (es: 393334567890)
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="message">Messaggio</Label>
                  <Textarea
                    id="message"
                    placeholder="Scrivi il tuo messaggio..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="mt-2"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500">
                      Caratteri: {message.length}
                    </p>
                    {message.length > 1000 && (
                      <p className="text-xs text-orange-600">
                        Messaggio lungo, considera di accorciarlo
                      </p>
                    )}
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={sendWhatsAppMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {sendWhatsAppMutation.isPending ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Invia Messaggio
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Message templates */}
          <Card>
            <CardHeader>
              <CardTitle>Template Messaggi</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Clicca su un template per utilizzarlo come base per il tuo messaggio
              </p>
              <div className="space-y-3">
                {messageTemplates.map((template, index) => (
                  <div
                    key={index}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setMessage(template.content)}
                  >
                    <h4 className="font-medium text-sm mb-1">{template.title}</h4>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {template.content}
                    </p>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-sm text-blue-900 mb-2">
                  <i className="fas fa-info-circle mr-2"></i>
                  Suggerimenti
                </h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Mantieni i messaggi professionali e concisi</li>
                  <li>• Includi sempre il tuo nome e agenzia</li>
                  <li>• Verifica il numero prima dell'invio</li>
                  <li>• Rispetta gli orari di lavoro per i contatti</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}