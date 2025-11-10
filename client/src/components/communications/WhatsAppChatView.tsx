import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type Communication } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface WhatsAppChatViewProps {
  clientId: number;
  communications: Communication[];
}

export function WhatsAppChatView({ clientId, communications }: WhatsAppChatViewProps) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filtra solo messaggi WhatsApp e ordina per data
  const whatsappMessages = communications
    .filter(comm => comm.type === "whatsapp" && comm.createdAt)
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });

  // Scroll automatico all'ultimo messaggio
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [whatsappMessages.length]);

  // Mutation per inviare messaggio
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      return apiRequest('/api/whatsapp/send', {
        method: 'POST',
        data: {
          clientId,
          message: messageText,
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Messaggio inviato",
        description: "Il messaggio WhatsApp è stato inviato con successo",
      });
      setMessage("");
      // Invalida la query per ricaricare i messaggi
      queryClient.invalidateQueries({ 
        queryKey: [`/api/clients/${clientId}/communications`] 
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare il messaggio WhatsApp",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      toast({
        title: "Messaggio vuoto",
        description: "Scrivi un messaggio prima di inviare",
        variant: "destructive",
      });
      return;
    }
    sendMessageMutation.mutate(trimmedMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-gray-50 rounded-lg">
      {/* Header chat */}
      <div className="bg-green-600 text-white px-4 py-3 rounded-t-lg flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <i className="fab fa-whatsapp text-2xl"></i>
        </div>
        <div>
          <h3 className="font-semibold">Chat WhatsApp</h3>
          <p className="text-xs text-green-100">
            {whatsappMessages.length} messaggio{whatsappMessages.length !== 1 ? 'i' : ''}
          </p>
        </div>
      </div>

      {/* Area messaggi */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ 
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'%23e5ddd5\'/%3E%3Cpath d=\'M20 0L0 20l20 20 20-20z\' fill=\'%23f0ede8\' fill-opacity=\'.1\'/%3E%3C/svg%3E")',
      }}>
        {whatsappMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <i className="fab fa-whatsapp text-6xl mb-4 opacity-20"></i>
            <p className="text-lg font-medium">Nessun messaggio WhatsApp</p>
            <p className="text-sm">Inizia una conversazione inviando un messaggio qui sotto</p>
          </div>
        ) : (
          whatsappMessages.map((comm) => {
            const isOutbound = comm.direction === "outbound";
            const messageDate = comm.createdAt ? new Date(comm.createdAt) : new Date();
            
            return (
              <div
                key={comm.id}
                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${comm.id}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 shadow-sm ${
                    isOutbound
                      ? 'bg-green-500 text-white rounded-br-none'
                      : 'bg-white text-gray-800 rounded-bl-none'
                  }`}
                >
                  {comm.subject && comm.subject !== comm.content && (
                    <p className={`font-semibold text-sm mb-1 ${isOutbound ? 'text-green-100' : 'text-gray-600'}`}>
                      {comm.subject}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">
                    {comm.content}
                  </p>
                  <div className={`text-xs mt-1 ${isOutbound ? 'text-green-100' : 'text-gray-500'} flex items-center gap-1 justify-end`}>
                    <span>
                      {format(messageDate, "HH:mm", { locale: it })}
                    </span>
                    {isOutbound && (
                      <i className="fas fa-check-double text-xs"></i>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer inline */}
      <Card className="m-4 p-3 bg-white border-gray-200">
        <div className="flex gap-2 items-end">
          <Textarea
            data-testid="input-whatsapp-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio..."
            className="flex-1 min-h-[44px] max-h-[120px] resize-none"
            disabled={sendMessageMutation.isPending}
          />
          <Button
            data-testid="button-send-whatsapp"
            onClick={handleSendMessage}
            disabled={sendMessageMutation.isPending || !message.trim()}
            className="bg-green-600 hover:bg-green-700 h-[44px] px-4"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Premi <kbd className="px-1 py-0.5 bg-gray-100 rounded border">Invio</kbd> per inviare, 
          <kbd className="px-1 py-0.5 bg-gray-100 rounded border mx-1">Shift+Invio</kbd> per andare a capo
        </p>
      </Card>
    </div>
  );
}
