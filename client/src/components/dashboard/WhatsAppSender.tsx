import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function WhatsAppSender() {
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
          <div>
            <Label htmlFor="phone">Numero di telefono</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="39334567890 o 334567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
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
  );
}