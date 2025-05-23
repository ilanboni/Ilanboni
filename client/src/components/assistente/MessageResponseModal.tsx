import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Bot, User, Send, Loader2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MessageResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: {
    id: number;
    content: string;
    clientFirstName: string;
    clientLastName: string;
    clientId?: number;
    createdAt: string;
  } | null;
}

export default function MessageResponseModal({ isOpen, onClose, message }: MessageResponseModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [aiResponse, setAiResponse] = useState("");
  const [manualResponse, setManualResponse] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [identifiedProperties, setIdentifiedProperties] = useState<any[]>([]);

  // Query per caricare tutte le proprietà disponibili
  const { data: properties = [] } = useQuery({
    queryKey: ['/api/properties'],
    enabled: isOpen,
  });

  // Reset state quando il modal si apre/chiude
  useEffect(() => {
    if (isOpen && message) {
      setManualResponse("");
      setAiResponse("");
      generateAIResponse();
    }
  }, [isOpen, message]);

  // Mutation per generare risposta AI
  const generateAIResponse = async () => {
    if (!message) return;
    
    setIsGeneratingAI(true);
    try {
      const response = await apiRequest('/api/virtual-assistant/generate-response', {
        method: 'POST',
        data: {
          messageId: message.id,
          messageContent: message.content,
          clientName: `${message.clientFirstName} ${message.clientLastName}`
        }
      });
      
      if (response?.suggestedResponse) {
        setAiResponse(response.suggestedResponse);
      } else {
        setAiResponse("Grazie per il tuo messaggio. Ti risponderemo al più presto.");
      }
    } catch (error) {
      console.error("Errore generazione risposta AI:", error);
      setAiResponse("Grazie per il tuo messaggio. Ti risponderemo al più presto.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Mutation per inviare messaggio
  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async ({ content, isAI }: { content: string; isAI: boolean }) => {
      if (!message) throw new Error("Messaggio non disponibile");
      
      return await apiRequest('/api/whatsapp/send', {
        method: 'POST',
        data: {
          clientId: message.clientId,
          message: content,
          isResponse: true,
          originalMessageId: message.id
        }
      });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Messaggio inviato",
        description: `Risposta ${variables.isAI ? 'AI' : 'manuale'} inviata con successo al cliente`,
      });
      
      // Invalida le query per aggiornare i dati
      queryClient.invalidateQueries({ queryKey: ['/api/virtual-assistant/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      
      // Chiudi il modal
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Errore nell'invio",
        description: "Si è verificato un errore durante l'invio del messaggio",
        variant: "destructive",
      });
    },
  });

  const handleSendAI = () => {
    if (aiResponse.trim()) {
      sendMessage({ content: aiResponse, isAI: true });
    }
  };

  const handleSendManual = () => {
    if (manualResponse.trim()) {
      sendMessage({ content: manualResponse, isAI: false });
    }
  };

  if (!message) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rispondi al Messaggio</DialogTitle>
          <DialogDescription>
            Scegli tra risposta AI automatica o scrivi una risposta personalizzata
          </DialogDescription>
        </DialogHeader>

        {/* Messaggio Originale */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {message.clientFirstName?.[0]}{message.clientLastName?.[0]}
                </AvatarFallback>
              </Avatar>
              {message.clientFirstName} {message.clientLastName}
              <Badge variant="outline" className="ml-auto">
                {new Date(message.createdAt).toLocaleDateString('it-IT')} - {new Date(message.createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{message.content}</p>
          </CardContent>
        </Card>

        {/* Selezione Immobile */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-green-500" />
              Immobile di Riferimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {identifiedProperties.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-green-600">
                  ✓ Immobili identificati automaticamente:
                </Label>
                <div className="mt-2 space-y-2">
                  {identifiedProperties.map((ref: any) => (
                    <Badge key={ref.propertyId} variant="outline" className="mr-2">
                      ID: {ref.propertyId} (Confidenza: {Math.round(ref.confidence * 100)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="property-select">
                {identifiedProperties.length === 0 
                  ? "Seleziona immobile (identificazione automatica non riuscita)" 
                  : "Conferma o cambia immobile di riferimento"}
              </Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli un immobile..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessun immobile specifico</SelectItem>
                  {properties.map((property: any) => (
                    <SelectItem key={property.id} value={property.id.toString()}>
                      {property.address}, {property.city} - €{property.price?.toLocaleString('it-IT')} ({property.size}mq)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPropertyId && (
                <p className="text-xs text-muted-foreground">
                  La risposta sarà associata a questo immobile e apparirà anche nella sua scheda comunicazioni.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Risposta AI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-500" />
                Risposta AI Suggerita
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isGeneratingAI ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Generando risposta...</span>
                </div>
              ) : (
                <Textarea
                  value={aiResponse}
                  onChange={(e) => setAiResponse(e.target.value)}
                  placeholder="La risposta AI apparirà qui..."
                  className="min-h-[120px] resize-none"
                />
              )}
              
              <Button 
                onClick={handleSendAI}
                disabled={!aiResponse.trim() || isSending || isGeneratingAI}
                className="w-full"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Invia Risposta AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Risposta Manuale */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-green-500" />
                Risposta Manuale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={manualResponse}
                onChange={(e) => setManualResponse(e.target.value)}
                placeholder="Scrivi la tua risposta personalizzata..."
                className="min-h-[120px] resize-none"
              />
              
              <Button 
                onClick={handleSendManual}
                disabled={!manualResponse.trim() || isSending}
                variant="outline"
                className="w-full"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Invia Risposta Manuale
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-4" />

        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Dopo l'invio, il messaggio verrà rimosso dalla lista dei messaggi da rispondere
          </p>
          <Button variant="ghost" onClick={onClose}>
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}