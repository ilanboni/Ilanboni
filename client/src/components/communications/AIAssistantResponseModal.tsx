import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { type ClientWithDetails, type Communication } from "@shared/schema";

// Definizione dello schema per il form
const responseFormSchema = z.object({
  manualResponse: z.string(),
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
  conversationThread,
}: AIAssistantResponseModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"ai" | "manual">("ai");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form setup per la risposta manuale
  const form = useForm<ResponseFormValues>({
    resolver: zodResolver(responseFormSchema),
    defaultValues: {
      manualResponse: "",
    },
  });

  // Invia la risposta generata dall'IA
  const sendAIResponse = async () => {
    if (!client || !incomingMessage) {
      toast({
        title: "Errore",
        description: "Informazioni mancanti per inviare la risposta",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/whatsapp/test-direct-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: client.id,
          phoneNumber: client.phone,
          message: aiGeneratedResponse,
          responseToId: incomingMessage.id,
          threadName: conversationThread,
          relatedPropertyIds: detectedProperties.map(p => p.id),
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore nell'invio della risposta");
      }
      
      const result = await response.json();
      console.log("Risposta AI inviata:", result);
      
      toast({
        title: "Risposta inviata",
        description: "La risposta IA è stata inviata con successo",
      });
      
      // Invalida le query per aggiornare le comunicazioni
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/clients/${client.id}/communications`] 
      });
      
      // Chiudi il modal
      onClose();
    } catch (error: any) {
      console.error("Errore nell'invio della risposta IA:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare la risposta",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler per inviare la risposta manuale
  const onSubmitManualResponse = async (data: ResponseFormValues) => {
    if (!client || !incomingMessage || !data.manualResponse.trim()) {
      toast({
        title: "Errore",
        description: "Informazioni mancanti o risposta vuota",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/whatsapp/test-direct-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: client.id,
          phoneNumber: client.phone,
          message: data.manualResponse,
          responseToId: incomingMessage.id,
          threadName: conversationThread,
          relatedPropertyIds: detectedProperties.map(p => p.id),
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore nell'invio della risposta");
      }
      
      const result = await response.json();
      console.log("Risposta manuale inviata:", result);
      
      toast({
        title: "Risposta inviata",
        description: "La tua risposta è stata inviata con successo",
      });
      
      // Invalida le query per aggiornare le comunicazioni
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/clients/${client.id}/communications`] 
      });
      
      // Reset del form e chiusura modal
      form.reset();
      onClose();
    } catch (error: any) {
      console.error("Errore nell'invio della risposta manuale:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare la risposta",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nuovo messaggio
            <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
              {conversationThread}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {client ? (
              <>Messaggio ricevuto da {client.firstName} {client.lastName}</>
            ) : (
              <>Mittente sconosciuto</>
            )}
            {detectedProperties.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {detectedProperties.map((property) => (
                  <Badge key={property.id} variant="secondary">
                    {property.address}
                  </Badge>
                ))}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Messaggio ricevuto */}
          <div>
            <h4 className="font-medium text-sm mb-1">Messaggio ricevuto:</h4>
            <Card>
              <CardContent className="p-3 bg-gray-50">
                <p className="whitespace-pre-line">
                  {incomingMessage?.content || ""}
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Tabs per le risposte */}
          <Tabs defaultValue="ai" onValueChange={(v) => setActiveTab(v as "ai" | "manual")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ai">Risposta assistita IA</TabsTrigger>
              <TabsTrigger value="manual">Risposta personalizzata</TabsTrigger>
            </TabsList>
            
            <TabsContent value="ai" className="space-y-4 mt-4">
              <Card>
                <CardContent className="p-4 bg-blue-50">
                  <p className="whitespace-pre-line text-gray-800">
                    {aiGeneratedResponse}
                  </p>
                </CardContent>
              </Card>
              
              <Button 
                onClick={sendAIResponse} 
                disabled={isSubmitting}
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting && activeTab === "ai" ? (
                  <>
                    <span className="animate-spin mr-2">
                      <i className="fas fa-spinner"></i>
                    </span>
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <i className="fab fa-whatsapp"></i>
                    <span>Invia risposta IA</span>
                  </>
                )}
              </Button>
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-4 mt-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitManualResponse)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="manualResponse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>La tua risposta</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Scrivi la tua risposta qui..."
                            rows={5}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {isSubmitting && activeTab === "manual" ? (
                      <>
                        <span className="animate-spin mr-2">
                          <i className="fas fa-spinner"></i>
                        </span>
                        Invio in corso...
                      </>
                    ) : (
                      <>
                        <i className="fab fa-whatsapp"></i>
                        <span>Invia la tua risposta</span>
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}