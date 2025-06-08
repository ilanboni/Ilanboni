import { useState } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function WhatsAppPage() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const { toast } = useToast();

  const sendWhatsAppMutation = useMutation({
    mutationFn: async (data: { phones: string[]; message: string }) => {
      if (data.phones.length === 1) {
        // Invio singolo
        return apiRequest("/api/whatsapp/send-direct", {
          method: "POST",
          data: { to: data.phones[0], message: data.message }
        });
      } else {
        // Invio multiplo
        const results = [];
        for (const phone of data.phones) {
          try {
            const result = await apiRequest("/api/whatsapp/send-direct", {
              method: "POST",
              data: { to: phone, message: data.message }
            });
            results.push({ phone, success: true, result });
            // Piccola pausa tra gli invii per non sovraccaricare l'API
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            results.push({ phone, success: false, error: (error as any)?.message || 'Errore sconosciuto' });
          }
        }
        return results;
      }
    },
    onSuccess: (data) => {
      if (Array.isArray(data)) {
        // Invio multiplo
        const successful = data.filter(r => r.success).length;
        const failed = data.filter(r => !r.success).length;
        
        if (failed === 0) {
          toast({
            title: "Messaggi inviati",
            description: `Tutti i ${successful} messaggi sono stati inviati con successo`,
          });
        } else {
          toast({
            title: "Invio completato",
            description: `${successful} messaggi inviati con successo, ${failed} non riusciti`,
            variant: failed > successful ? "destructive" : "default",
          });
        }
      } else {
        // Invio singolo
        toast({
          title: "Messaggio inviato",
          description: "Il messaggio WhatsApp è stato inviato con successo",
        });
      }
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

  const normalizePhoneNumber = (phoneStr: string): string => {
    let normalized = phoneStr.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
    if (normalized.startsWith("0")) {
      normalized = "39" + normalized.substring(1);
    } else if (!normalized.startsWith("39") && !normalized.startsWith("+39")) {
      if (normalized.startsWith("+")) {
        normalized = normalized.substring(1);
      } else {
        normalized = "39" + normalized;
      }
    }
    return normalized;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim() || !message.trim()) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci sia il numero/i di telefono che il messaggio",
        variant: "destructive",
      });
      return;
    }

    let phoneNumbers: string[] = [];
    
    if (isBroadcast) {
      // Modalità broadcast: separa i numeri per virgola o a capo
      const rawNumbers = phone.split(/[,\n]/).map(p => p.trim()).filter(p => p.length > 0);
      
      if (rawNumbers.length === 0) {
        toast({
          title: "Numeri non validi",
          description: "Inserisci almeno un numero di telefono valido",
          variant: "destructive",
        });
        return;
      }
      
      phoneNumbers = rawNumbers.map(normalizePhoneNumber);
    } else {
      // Modalità singola
      phoneNumbers = [normalizePhoneNumber(phone)];
    }

    sendWhatsAppMutation.mutate({
      phones: phoneNumbers,
      message: message.trim()
    });
  };

  // Template messages for quick selection
  const messageTemplates = [
    {
      title: "Conferma appuntamento",
      content: "Gentile cliente, le confermo l'appuntamento per la visita dell'immobile. La ringrazio per la disponibilità.",
      broadcast: false
    },
    {
      title: "Proposta immobile",
      content: "Buongiorno, ho trovato un immobile che potrebbe interessarle. Quando sarebbe disponibile per una visita?",
      broadcast: false
    },
    {
      title: "Follow-up dopo visita",
      content: "Spero che la visita di oggi sia stata di suo gradimento. Sono a disposizione per qualsiasi chiarimento.",
      broadcast: false
    },
    {
      title: "Richiesta documenti",
      content: "Per procedere con la pratica, avrei bisogno di alcuni documenti. Quando potremmo organizzarci per il ritiro?",
      broadcast: false
    },
    {
      title: "Newsletter immobiliare",
      content: "🏠 NOVITÀ IMMOBILIARI\n\nGentili clienti, vi informiamo delle nuove opportunità disponibili sul mercato. Visitate il nostro portale per vedere gli ultimi immobili inseriti.\n\nPer informazioni: [Il vostro nome] - [Agenzia]",
      broadcast: true
    },
    {
      title: "Invito evento",
      content: "📅 EVENTO SPECIALE\n\nSiete invitati alla presentazione dei nostri nuovi immobili il [data] alle [ora] presso [indirizzo].\n\nConfermate la vostra presenza. Rinfresco offerto.\n\n[Il vostro nome] - [Agenzia]",
      broadcast: true
    },
    {
      title: "Auguri festività",
      content: "🎉 AUGURI\n\nI migliori auguri di [festività] a voi e alle vostre famiglie.\n\nGrazie per la fiducia che ci accordate.\n\n[Il vostro nome] - [Agenzia]",
      broadcast: true
    },
    {
      title: "Cancellazione visite per proposta",
      content: "Gentile cliente, con riferimento all'immobile di Viale Abruzzi per il quale avevamo fissato un appuntamento, la informo che in data odierna è stata presentata una proposta d'acquisto e, d'accordo con la proprietà, abbiamo deciso di congelare le visite. Sarà mia premura aggiornarla sull'evoluzione di questa trattativa. Colgo l'occasione per augurarle una buona domenica, Ilan Boni - Cavour Immobiliare",
      broadcast: true
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
                {/* Switch per modalità broadcast */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="broadcast-mode"
                    checked={isBroadcast}
                    onCheckedChange={setIsBroadcast}
                  />
                  <Label htmlFor="broadcast-mode">Invio multiplo (Broadcast)</Label>
                </div>
                
                <div>
                  <Label htmlFor="phone">
                    {isBroadcast ? "Numeri di telefono" : "Numero di telefono"}
                  </Label>
                  {isBroadcast ? (
                    <Textarea
                      id="phone"
                      placeholder="39334567890, 39335678901&#10;39336789012&#10;..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      rows={4}
                      className="mt-2"
                    />
                  ) : (
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="39334567890 o 334567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-2"
                    />
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {isBroadcast 
                      ? "Inserisci i numeri separati da virgola o a capo. Ogni numero con prefisso internazionale (es: 393334567890)"
                      : "Inserisci il numero con prefisso internazionale (es: 393334567890)"
                    }
                  </p>
                  {isBroadcast && phone && (
                    <p className="text-xs text-blue-600 mt-1">
                      Numeri rilevati: {phone.split(/[,\n]/).filter(p => p.trim().length > 0).length}
                    </p>
                  )}
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
                      {isBroadcast ? "Invio broadcast in corso..." : "Invio in corso..."}
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      {isBroadcast ? "Invia Broadcast" : "Invia Messaggio"}
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
                {messageTemplates
                  .filter(template => isBroadcast ? template.broadcast : !template.broadcast)
                  .map((template, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setMessage(template.content)}
                    >
                      <h4 className="font-medium text-sm mb-1">
                        {template.title}
                        {template.broadcast && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1 rounded">Broadcast</span>}
                      </h4>
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