import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { ClientWithDetails, Communication } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

// Schema per la validazione dei form
const responseFormSchema = z.object({
  response: z.string().min(2, {
    message: "La risposta deve contenere almeno 2 caratteri",
  }),
});

type ResponseFormValues = z.infer<typeof responseFormSchema>;

interface AIAssistantResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientWithDetails | null;
  incomingMessage: Communication | null;
  aiGeneratedResponse: string;
  detectedProperties: { id: number; address: string }[];
  conversationThread: string;
}

export function AIAssistantResponseModal({
  isOpen,
  onClose,
  client,
  incomingMessage,
  aiGeneratedResponse,
  detectedProperties,
  conversationThread
}: AIAssistantResponseModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("ai");
  const { toast } = useToast();

  // Form per risposta manuale
  const manualForm = useForm<ResponseFormValues>({
    resolver: zodResolver(responseFormSchema),
    defaultValues: {
      response: "",
    },
  });

  // Form per risposta IA
  const aiForm = useForm<ResponseFormValues>({
    resolver: zodResolver(responseFormSchema),
    defaultValues: {
      response: aiGeneratedResponse,
    },
  });

  const onSubmitAIResponse = async (data: ResponseFormValues) => {
    if (!client || !incomingMessage) return;
    
    setIsLoading(true);
    try {
      const payload = {
        phone: client.phone,
        message: data.response,
        clientId: client.id,
        responseToId: incomingMessage.id
      };
      
      await apiRequest("/api/whatsapp/send", "POST", payload);

      toast({
        title: "Risposta inviata con successo",
        description: "Il messaggio è stato inviato al cliente.",
      });

      // Invalida le query per aggiornare i dati
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      if (client.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/clients', client.id, 'communications'] });
      }
      
      onClose();
    } catch (error) {
      console.error("Errore nell'invio della risposta:", error);
      toast({
        title: "Errore nell'invio della risposta",
        description: "Si è verificato un problema durante l'invio del messaggio.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitManualResponse = async (data: ResponseFormValues) => {
    if (!client || !incomingMessage) return;
    
    setIsLoading(true);
    try {
      await apiRequest("/api/whatsapp/send", "POST", {
        phone: client.phone,
        message: data.response,
        clientId: client.id,
        responseToId: incomingMessage.id
      });

      toast({
        title: "Risposta inviata con successo",
        description: "Il messaggio è stato inviato al cliente.",
      });

      // Invalida le query per aggiornare i dati
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      if (client.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/clients', client.id, 'communications'] });
      }
      
      onClose();
    } catch (error) {
      console.error("Errore nell'invio della risposta:", error);
      toast({
        title: "Errore nell'invio della risposta",
        description: "Si è verificato un problema durante l'invio del messaggio.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Aggiorna il form AI quando cambia la risposta generata
  React.useEffect(() => {
    if (aiGeneratedResponse) {
      aiForm.setValue("response", aiGeneratedResponse);
    }
  }, [aiGeneratedResponse, aiForm]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Risposta Assistita</DialogTitle>
          <DialogDescription>
            Un nuovo messaggio è stato ricevuto da{" "}
            <span className="font-medium">
              {client ? `${client.firstName} ${client.lastName}` : "cliente sconosciuto"}
            </span>
            {conversationThread && (
              <>
                {" "}
                riguardo <span className="font-medium">{conversationThread}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Messaggio in arrivo */}
          <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
            <div className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
              Messaggio ricevuto:
            </div>
            <div className="text-sm">{incomingMessage?.content}</div>
          </div>

          {/* Proprietà rilevate (se presenti) */}
          {detectedProperties.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Proprietà rilevate nel messaggio:</div>
              <div className="flex flex-wrap gap-2">
                {detectedProperties.map((property) => (
                  <Badge key={property.id} variant="outline">
                    {property.address}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tabs per scegliere tra risposta AI e manuale */}
          <Tabs defaultValue="ai" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ai">Risposta AI</TabsTrigger>
              <TabsTrigger value="manual">Risposta Manuale</TabsTrigger>
            </TabsList>
            
            {/* Tab Risposta AI */}
            <TabsContent value="ai">
              <Form {...aiForm}>
                <form onSubmit={aiForm.handleSubmit(onSubmitAIResponse)} className="space-y-4">
                  <FormField
                    control={aiForm.control}
                    name="response"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Risposta generata dall'assistente virtuale</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="La risposta generata apparirà qui..."
                            className="min-h-[140px]"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                      Annulla
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Invio in corso..." : "Invia Risposta AI"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
            
            {/* Tab Risposta Manuale */}
            <TabsContent value="manual">
              <Form {...manualForm}>
                <form onSubmit={manualForm.handleSubmit(onSubmitManualResponse)} className="space-y-4">
                  <FormField
                    control={manualForm.control}
                    name="response"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>La tua risposta personalizzata</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Scrivi la tua risposta personalizzata qui..."
                            className="min-h-[140px]"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                      Annulla
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Invio in corso..." : "Invia Risposta Manuale"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}