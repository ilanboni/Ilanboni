import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Clock, User, Phone, ArrowLeft } from "lucide-react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto scroll per i messaggi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

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

      {/* Dialog conversazione - Stile WhatsApp Web */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl h-[700px] flex flex-col p-0 gap-0 bg-[#f0f2f5]">
          {/* Header della chat */}
          <div className="bg-[#075e54] text-white p-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="text-white hover:bg-green-700 p-2 h-auto"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
              <User className="h-6 w-6 text-gray-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">
                {selectedReminder?.clientName || formatPhone(selectedReminder?.phone || '')}
              </h3>
              <p className="text-sm text-green-100">Online</p>
            </div>
          </div>
          
          {/* Area messaggi con sfondo chat pattern */}
          <div 
            className="flex-1 p-4 overflow-y-auto bg-[#e5ddd5]"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ddd6ce' fill-opacity='0.1' fill-rule='evenodd'%3E%3Cpath d='m0 40l40-40h-40v40zm40 0v-40h-40l40 40z'/%3E%3C/g%3E%3C/svg%3E\")"
            }}
          >
            {conversationLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <Skeleton className="h-16 w-60 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {conversation?.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg shadow-sm ${
                        message.direction === 'outbound'
                          ? 'bg-[#dcf8c6] text-gray-900 rounded-br-sm'
                          : 'bg-white text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      <div className={`flex justify-end items-center gap-1 mt-1`}>
                        <p className="text-xs text-gray-500">
                          {new Date(message.createdAt).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {message.direction === 'outbound' && (
                          <div className="text-green-600">
                            <svg width="12" height="12" viewBox="0 0 16 15" fill="currentColor">
                              <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l3.61 3.464c.143.14.361.125.484-.033L10.91 3.904a.366.366 0 0 0-.064-.512z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Barra di input in basso */}
          <div className="bg-[#f0f2f5] p-4 border-t">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Scrivi un messaggio..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendResponse();
                    }
                  }}
                  className="rounded-full border-0 bg-white px-4 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <Button
                onClick={handleSendResponse}
                disabled={!responseText.trim() || sendResponseMutation.isPending}
                size="sm"
                className="rounded-full bg-[#075e54] hover:bg-[#0a6b5d] text-white p-3 h-auto"
              >
                {sendResponseMutation.isPending ? (
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}