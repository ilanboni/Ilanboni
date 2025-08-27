import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Clock, User, Phone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface WhatsAppReminder {
  id: number;
  phone: string;
  clientName?: string;
  lastMessage: string;
  lastMessageAt: string;
  needsResponse: boolean;
}

interface ConversationMessage {
  id: number;
  content: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
  externalId?: string;
}

export default function WhatsAppReminders() {
  const [selectedReminder, setSelectedReminder] = useState<WhatsAppReminder | null>(null);
  const [responseText, setResponseText] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch promemoria messaggi non risposti
  const { data: reminders, isLoading } = useQuery({
    queryKey: ['/api/whatsapp/reminders'],
    queryFn: async () => {
      const response = await fetch('/api/whatsapp/reminders');
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei promemoria');
      }
      return response.json() as WhatsAppReminder[];
    },
    refetchInterval: 30000, // Aggiorna ogni 30 secondi
  });

  // Fetch storico conversazione
  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['/api/whatsapp/conversation', selectedReminder?.phone],
    queryFn: async () => {
      if (!selectedReminder?.phone) return [];
      const response = await fetch(`/api/whatsapp/conversation/${encodeURIComponent(selectedReminder.phone)}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento della conversazione');
      }
      return response.json() as ConversationMessage[];
    },
    enabled: !!selectedReminder?.phone,
  });

  // Mutation per inviare risposta
  const sendResponseMutation = useMutation({
    mutationFn: async ({ phone, message }: { phone: string; message: string }) => {
      return apiRequest(`/api/whatsapp/send-response`, {
        method: 'POST',
        body: JSON.stringify({ phone, message }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Risposta inviata",
        description: "Il messaggio è stato inviato con successo",
      });
      setResponseText("");
      setDialogOpen(false);
      setSelectedReminder(null);
      // Invalida le query per aggiornare i dati
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/reminders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversation'] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore nell'invio",
        description: error.message || "Si è verificato un errore durante l'invio",
        variant: "destructive",
      });
    },
  });

  const handleOpenConversation = (reminder: WhatsAppReminder) => {
    setSelectedReminder(reminder);
    setDialogOpen(true);
  };

  const handleSendResponse = () => {
    if (!selectedReminder || !responseText.trim()) return;
    
    sendResponseMutation.mutate({
      phone: selectedReminder.phone,
      message: responseText.trim(),
    });
  };

  const formatPhone = (phone: string) => {
    // Formatta il numero di telefono per visualizzazione
    if (phone.startsWith('39')) {
      return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5)}`;
    }
    return phone;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffMinutes} min fa`;
    } else if (diffHours < 24) {
      return `${diffHours}h fa`;
    } else {
      return date.toLocaleDateString('it-IT', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Messaggi da Rispondere
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Messaggi da Rispondere
            {reminders && reminders.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {reminders.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!reminders || reminders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Nessun messaggio in attesa di risposta</p>
              <p className="text-sm mt-1">Ottimo lavoro! Sei in pari con tutte le conversazioni.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      {reminder.clientName ? (
                        <User className="h-5 w-5 text-green-600" />
                      ) : (
                        <Phone className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {reminder.clientName || formatPhone(reminder.phone)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {reminder.lastMessage}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {formatTime(reminder.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleOpenConversation(reminder)}
                    className="ml-2"
                  >
                    Rispondi
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog conversazione */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl h-[600px] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Conversazione con {selectedReminder?.clientName || formatPhone(selectedReminder?.phone || '')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col">
            {/* Storico messaggi */}
            <ScrollArea className="flex-1 pr-4">
              {conversationLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-16 w-48 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {conversation?.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.direction === 'outbound'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Area risposta */}
            <div className="border-t pt-4 mt-4">
              <div className="space-y-3">
                <Textarea
                  placeholder="Scrivi la tua risposta..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Chiudi
                  </Button>
                  <Button
                    onClick={handleSendResponse}
                    disabled={!responseText.trim() || sendResponseMutation.isPending}
                  >
                    {sendResponseMutation.isPending ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Invio...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Invia Risposta
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}