import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function WhatsAppSender() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const { toast } = useToast();

  const sendWhatsAppMutation = useMutation({
    mutationFn: async (data: { phones: string[]; message: string }) => {
      if (data.phones.length === 1) {
        return apiRequest("/api/whatsapp/send", {
          method: "POST",
          data: { to: data.phones[0], message: data.message }
        });
      } else {
        const results = [];
        for (const phone of data.phones) {
          try {
            const result = await apiRequest("/api/whatsapp/send", {
              method: "POST",
              data: { to: phone, message: data.message }
            });
            results.push({ phone, success: true, result });
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            results.push({ phone, success: false, error: (error as any)?.message || 'Errore sconosciuto' });
          }
        }
        return results;
      }
    },
    onSuccess: (data) => {
      if (Array.isArray(data)) {
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
      phoneNumbers = [normalizePhoneNumber(phone)];
    }

    sendWhatsAppMutation.mutate({
      phones: phoneNumbers,
      message: message.trim()
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Invia WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="broadcast-mode"
              checked={isBroadcast}
              onCheckedChange={setIsBroadcast}
            />
            <Label htmlFor="broadcast-mode" className="text-sm">Invio multiplo</Label>
          </div>
          
          <div>
            <Label htmlFor="phone">
              {isBroadcast ? "Numeri di telefono" : "Numero di telefono"}
            </Label>
            {isBroadcast ? (
              <Textarea
                id="phone"
                placeholder="39334567890, 39335678901&#10;39336789012"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                rows={3}
                className="mt-1"
              />
            ) : (
              <Input
                id="phone"
                type="tel"
                placeholder="39334567890 o 334567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              {isBroadcast 
                ? "Inserisci i numeri separati da virgola o a capo"
                : "Inserisci il numero con prefisso internazionale (es: 393334567890)"
              }
            </p>
            {isBroadcast && phone && (
              <p className="text-xs text-blue-600 mt-1">
                Numeri: {phone.split(/[,\n]/).filter(p => p.trim().length > 0).length}
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
              rows={4}
              className="mt-1"
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={sendWhatsAppMutation.isPending}
            className="w-full"
          >
            {sendWhatsAppMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {isBroadcast ? "Invio broadcast..." : "Invio in corso..."}
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
  );
}