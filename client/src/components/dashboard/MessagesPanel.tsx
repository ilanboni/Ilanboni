import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, User, Calendar, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface WhatsAppContact {
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
}

export default function MessagesPanel() {
  const [selectedContact, setSelectedContact] = useState<WhatsAppContact | null>(null);
  const [messageText, setMessageText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch tutti i contatti con cronologia messaggi
  const { data: contacts, isLoading } = useQuery<WhatsAppContact[]>({
    queryKey: ['/api/whatsapp/contacts'],
    refetchInterval: 30000, // Aggiorna ogni 30 secondi
  });

  // Fetch conversazione del contatto selezionato
  const { data: conversation, isLoading: conversationLoading } = useQuery<ConversationMessage[]>({
    queryKey: ['/api/whatsapp/conversation', selectedContact?.phone],
    enabled: !!selectedContact?.phone,
    refetchInterval: 5000, // Aggiorna ogni 5 secondi quando una chat è aperta
  });

  // Mutation per inviare messaggio
  const sendMessageMutation = useMutation({
    mutationFn: async ({ phone, message }: { phone: string; message: string }) => {
      return await apiRequest(`/api/whatsapp/send-response`, {
        method: 'POST',
        data: { phone, message }
      });
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversation'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/contacts'] });
      toast({
        title: "Messaggio inviato",
        description: "Il messaggio è stato inviato con successo"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'invio del messaggio",
        variant: "destructive"
      });
    }
  });

  // Mutation per creare task
  const createTaskMutation = useMutation({
    mutationFn: async ({ clientPhone }: { clientPhone: string }) => {
      return await apiRequest(`/api/whatsapp/create-task`, {
        method: 'POST',
        data: { clientPhone }
      });
    },
    onSuccess: () => {
      toast({
        title: "Task creato",
        description: "Task e appuntamento Google Calendar creati con successo"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella creazione del task",
        variant: "destructive"
      });
    }
  });

  const handleSendMessage = () => {
    if (!selectedContact || !messageText.trim()) return;
    
    sendMessageMutation.mutate({
      phone: selectedContact.phone,
      message: messageText.trim(),
    });
  };

  const handleCreateTask = () => {
    if (!selectedContact) return;
    
    createTaskMutation.mutate({
      clientPhone: selectedContact.phone
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  // Separa contatti urgenti e normali
  const urgentContacts = contacts?.filter(c => c.needsResponse) || [];
  const normalContacts = contacts?.filter(c => !c.needsResponse) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Messaggi WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messaggi WhatsApp
          {urgentContacts.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {urgentContacts.length} urgenti
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 h-[calc(100%-4rem)]">
        <div className="flex h-full">
          {/* Lista contatti */}
          <div className="w-1/3 border-r bg-gray-50">
            <ScrollArea className="h-full">
              {/* Sezione Urgenti */}
              {urgentContacts.length > 0 && (
                <div className="p-3 border-b bg-red-50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-800">URGENTE</span>
                  </div>
                  {urgentContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => setSelectedContact(contact)}
                      className={`p-3 cursor-pointer border border-red-200 rounded-lg mb-2 hover:bg-red-100 transition-colors ${
                        selectedContact?.id === contact.id ? 'bg-red-200 border-red-300' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-red-900">
                          {contact.clientName || contact.phone}
                        </span>
                        <span className="text-xs text-red-600">
                          {new Date(contact.lastMessageAt).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-red-700 truncate">
                        {contact.lastMessage}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Sezione Contatti Normali */}
              <div className="p-3">
                {urgentContacts.length > 0 && (
                  <div className="mb-3">
                    <span className="text-sm font-semibold text-gray-600">Altri messaggi</span>
                  </div>
                )}
                {normalContacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`p-3 cursor-pointer rounded-lg mb-2 hover:bg-gray-100 transition-colors ${
                      selectedContact?.id === contact.id ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {contact.clientName || contact.phone}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(contact.lastMessageAt).toLocaleTimeString('it-IT', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">
                      {contact.lastMessage}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Area conversazione */}
          <div className="flex-1 flex flex-col">
            {selectedContact ? (
              <>
                {/* Header conversazione */}
                <div className="p-4 bg-[#f0f2f5] border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">
                        {selectedContact.clientName || selectedContact.phone}
                      </h3>
                      <p className="text-xs text-gray-600">{selectedContact.phone}</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateTask}
                    disabled={createTaskMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
                  >
                    {createTaskMutation.isPending ? (
                      <div className="animate-spin h-4 w-4 border-2 border-orange-600 border-t-transparent rounded-full mr-2" />
                    ) : (
                      <Calendar className="h-4 w-4 mr-2" />
                    )}
                    Crea Task
                  </Button>
                </div>

                {/* Messaggi */}
                <div className="flex-1 bg-[#e5ddd5] bg-opacity-50 overflow-hidden">
                  <ScrollArea className="h-full p-4">
                    {conversationLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-12 w-3/4" />
                        ))}
                      </div>
                    ) : conversation && conversation.length > 0 ? (
                      <div className="space-y-2">
                        {conversation.map((message: ConversationMessage) => (
                          <div
                            key={message.id}
                            className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm ${
                                message.direction === 'outbound'
                                  ? 'bg-[#dcf8c6] text-gray-900'
                                  : 'bg-white text-gray-900'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(message.createdAt).toLocaleTimeString('it-IT', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 mt-8">
                        Nessun messaggio trovato
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Input messaggio */}
                <div className="p-4 bg-[#f0f2f5] border-t">
                  <div className="flex gap-2">
                    <Textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Scrivi un messaggio..."
                      className="flex-1 resize-none bg-white"
                      rows={1}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={sendMessageMutation.isPending || !messageText.trim()}
                      size="icon"
                      className="bg-[#25d366] hover:bg-[#20ba5a] text-white"
                    >
                      {sendMessageMutation.isPending ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[#e5ddd5] bg-opacity-30">
                <div className="text-center text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Seleziona una conversazione per iniziare</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}