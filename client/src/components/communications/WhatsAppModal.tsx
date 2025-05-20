import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type ClientWithDetails } from "@shared/schema";
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

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientWithDetails | null;
}

// Form validation schema
const formSchema = z.object({
  message: z.string({
    required_error: "Il messaggio è obbligatorio",
  }).min(3, {
    message: "Il messaggio deve contenere almeno 3 caratteri",
  }),
});

type FormData = z.infer<typeof formSchema>;

export function WhatsAppModal({ isOpen, onClose, client }: WhatsAppModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form setup
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });
  
  // Send WhatsApp message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!client) throw new Error("Nessun cliente selezionato");
      
      return apiRequest(
        'POST',
        '/api/whatsapp/send',
        {
          clientId: client.id,
          message: data.message,
        }
      );
    },
    onSuccess: () => {
      toast({
        title: "Messaggio inviato",
        description: "Il messaggio WhatsApp è stato inviato con successo",
      });
      
      // Reset form and close modal
      form.reset();
      onClose();
      
      // Invalidate communications queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      if (client) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/clients/${client.id}/communications`] 
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare il messaggio WhatsApp",
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = async (data: FormData) => {
    console.log("Invio messaggio WhatsApp:", data, "a cliente:", client);
    
    if (!client) {
      toast({
        title: "Errore",
        description: "Nessun cliente selezionato",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Invece di usare la mutation, facciamo una chiamata diretta all'API UltraMsg
      console.log("Tentativo di invio diretto del messaggio...");
      // Non possiamo modificare direttamente form.formState.isSubmitting
      const setSubmitting = form.formState.isSubmitting;
      
      const response = await fetch('/api/whatsapp/test-direct-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: client.id,
          phoneNumber: client.phone,
          message: data.message
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore nell'invio del messaggio");
      }
      
      const result = await response.json();
      console.log("Risposta invio diretto:", result);
      
      // Simuliamo il comportamento della mutation di successo
      toast({
        title: "Messaggio inviato",
        description: "Il messaggio WhatsApp è stato inviato con successo",
      });
      
      // Reset form e chiudi modale
      form.reset();
      onClose();
      
      // Invalida le query per aggiornare la lista delle comunicazioni
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/clients/${client.id}/communications`] 
      });
      
    } catch (error: any) {
      console.error("Errore nell'invio del messaggio:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare il messaggio WhatsApp",
        variant: "destructive",
      });
    }
  };

  // Stato locale per l'invio in corso
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modifichiamo onSubmit per utilizzare lo stato locale
  const onSubmitModified = async (data: FormData) => {
    console.log("Invio messaggio WhatsApp:", data, "a cliente:", client);
    
    if (!client) {
      toast({
        title: "Errore",
        description: "Nessun cliente selezionato",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Impostiamo lo stato di invio in corso
      setIsSubmitting(true);
      
      // Chiamata diretta all'API UltraMsg
      console.log("Tentativo di invio diretto del messaggio...");
      
      const response = await fetch('/api/whatsapp/test-direct-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: client.id,
          phoneNumber: client.phone,
          message: data.message
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore nell'invio del messaggio");
      }
      
      const result = await response.json();
      console.log("Risposta invio diretto:", result);
      
      // Notifica di successo
      toast({
        title: "Messaggio inviato",
        description: "Il messaggio WhatsApp è stato inviato con successo",
      });
      
      // Reset form e chiudi modale
      form.reset();
      onClose();
      
      // Invalida le query per aggiornare la lista delle comunicazioni
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/clients/${client.id}/communications`] 
      });
      
    } catch (error: any) {
      console.error("Errore nell'invio del messaggio:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare il messaggio WhatsApp",
        variant: "destructive",
      });
    } finally {
      // Resetta lo stato di invio
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invia messaggio WhatsApp</DialogTitle>
          <DialogDescription>
            {client ? (
              <>Invia un messaggio WhatsApp a {client.salutation} {client.firstName} {client.lastName}</>
            ) : (
              <>Seleziona un cliente per inviare un messaggio WhatsApp</>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitModified)} className="space-y-4">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Messaggio</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Scrivi il tuo messaggio qui..."
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Annulla
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting || !client}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">
                      <i className="fas fa-spinner"></i>
                    </span>
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <i className="fab fa-whatsapp"></i>
                    <span>Invia Messaggio</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}