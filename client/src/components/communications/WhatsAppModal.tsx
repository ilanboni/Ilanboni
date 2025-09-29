import { useState, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Paperclip, X, FileText, Image } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
  caption: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function WhatsAppModal({ isOpen, onClose, client }: WhatsAppModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Stato per il file selezionato
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // Form setup
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
      caption: "",
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
      handleClose();
      
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
      handleClose();
      
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

  // Funzione per gestire la selezione del file
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Controlla il tipo di file
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo di file non supportato",
          description: "Sono supportati solo file PDF, JPG, JPEG e PNG",
          variant: "destructive",
        });
        return;
      }
      
      // Controlla la dimensione del file (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File troppo grande",
          description: "Il file deve essere massimo 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  // Funzione per rimuovere il file selezionato
  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Funzione per inviare il file
  const sendFile = async (caption?: string) => {
    if (!selectedFile || !client) {
      toast({
        title: "Errore",
        description: "Nessun file selezionato o cliente mancante",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploadingFile(true);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clientId', client.id.toString());
      if (caption) {
        formData.append('caption', caption);
      }

      const response = await fetch('/api/whatsapp/send-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nell'invio del file");
      }

      const result = await response.json();
      console.log("File inviato con successo:", result);

      toast({
        title: "File inviato",
        description: `${selectedFile.name} è stato inviato con successo`,
      });

      // Reset file e form
      removeSelectedFile();
      form.reset();
      handleClose();

      // Invalida le query per aggiornare la lista delle comunicazioni
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/clients/${client.id}/communications`] 
      });

    } catch (error: any) {
      console.error("Errore nell'invio del file:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare il file",
        variant: "destructive",
      });
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Funzione per aprire il selettore file
  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  // Funzione per ottenere l'icona del file
  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    } else if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  // Funzione per pulire lo stato quando si chiude la modal
  const handleClose = () => {
    removeSelectedFile();
    form.reset();
    setIsSubmitting(false);
    setIsUploadingFile(false);
    onClose();
  };
  
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
      handleClose();
      
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
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

            <Separator />

            {/* Sezione Upload File */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Allega File (Opzionale)</h4>
              
              {/* Input file nascosto */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                data-testid="file-input"
              />
              
              {/* Mostra file selezionato o pulsante selezione */}
              {selectedFile ? (
                <div className="p-3 border rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getFileIcon(selectedFile)}
                      <div>
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeSelectedFile}
                      data-testid="remove-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Campo didascalia per il file */}
                  <FormField
                    control={form.control}
                    name="caption"
                    render={({ field }) => (
                      <FormItem className="mt-3">
                        <FormLabel>Didascalia (Opzionale)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Aggiungi una didascalia al file..."
                            {...field}
                            data-testid="file-caption"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Pulsante per inviare file */}
                  <Button
                    type="button"
                    onClick={() => sendFile(form.getValues('caption'))}
                    disabled={isUploadingFile || !client}
                    className="w-full mt-3 bg-green-600 hover:bg-green-700"
                    data-testid="send-file"
                  >
                    {isUploadingFile ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Invio file in corso...
                      </>
                    ) : (
                      <>
                        <Paperclip className="h-4 w-4 mr-2" />
                        Invia File
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openFileSelector}
                  className="w-full"
                  data-testid="select-file"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Seleziona File (PDF, JPG, PNG)
                </Button>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
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