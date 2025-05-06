import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  type Client,
  type InsertCommunication, 
  insertCommunicationSchema 
} from "@shared/schema";
import { z } from "zod";

interface WhatsAppFormData {
  clientId: number;
  message: string;
}

export default function WhatsAppSenderPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  
  // Fetch clients for dropdown
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  // Filter clients based on search term
  const filteredClients = clients?.filter(client => {
    if (!searchTerm) return true;
    
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });
  
  // Form validation schema
  const formSchema = z.object({
    clientId: z.number({
      required_error: "Seleziona un cliente",
    }),
    message: z.string({
      required_error: "Il messaggio è obbligatorio",
    }).min(3, {
      message: "Il messaggio deve contenere almeno 3 caratteri",
    }),
  });
  
  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: undefined,
      message: "",
    },
  });
  
  // Send WhatsApp message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: WhatsAppFormData) => {
      // First, create a communication record
      const communicationData: InsertCommunication = {
        clientId: data.clientId,
        type: "whatsapp",
        subject: "Messaggio WhatsApp",
        content: data.message,
        direction: "outbound",
        status: "completed", 
        createdBy: null,
        propertyId: null,
        needsFollowUp: false,
        followUpDate: null,
      };
      
      const response = await apiRequest("/api/communications", {
        method: "POST",
        data: communicationData,
      });
      
      return response;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      
      // Show success message
      toast({
        title: "Messaggio inviato",
        description: "Il messaggio WhatsApp è stato inviato con successo",
      });
      
      // Reset form
      form.reset();
      setSelectedClientId(null);
    },
    onError: (error: any) => {
      console.error("Error sending WhatsApp message:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'invio del messaggio WhatsApp",
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    sendMessageMutation.mutate(data);
  };
  
  // Handle client selection change
  const handleClientChange = (value: string) => {
    const clientId = parseInt(value);
    setSelectedClientId(clientId);
    form.setValue("clientId", clientId);
  };
  
  // Get selected client
  const selectedClient = clients?.find(client => client.id === selectedClientId);
  
  return (
    <>
      <Helmet>
        <title>Invia Messaggio WhatsApp | Gestionale Immobiliare</title>
        <meta name="description" content="Invia messaggi WhatsApp ai clienti direttamente dal sistema di gestione immobiliare" />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invia Messaggio WhatsApp</h1>
            <p className="text-gray-500 mt-1">
              Invia messaggi WhatsApp ai tuoi clienti direttamente dalla piattaforma
            </p>
          </div>
          <Button 
            variant="outline" 
            asChild
          >
            <Link href="/communications">
              <div className="px-2 py-1">
                <i className="fas fa-arrow-left mr-2"></i> Indietro
              </div>
            </Link>
          </Button>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Nuovo Messaggio WhatsApp</CardTitle>
                <CardDescription>
                  Invia messaggi direttamente via WhatsApp Business API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      {/* Client selection */}
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="clientId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cliente*</FormLabel>
                              
                              <div className="mb-2">
                                <Input
                                  placeholder="Cerca cliente per nome o cognome..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  className="mb-2"
                                />
                              </div>
                              
                              <Select
                                onValueChange={handleClientChange}
                                value={field.value?.toString()}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona un cliente" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-[300px]">
                                  {filteredClients?.map(client => (
                                    <SelectItem key={client.id} value={client.id.toString()}>
                                      {client.firstName} {client.lastName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Seleziona il cliente a cui inviare il messaggio
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Message content */}
                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Messaggio*</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Scrivi il messaggio che desideri inviare..." 
                                className="min-h-[200px] resize-y"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              Il messaggio verrà inviato tramite WhatsApp al numero del cliente selezionato
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setLocation("/communications")}
                      >
                        Annulla
                      </Button>
                      <Button 
                        type="submit"
                        disabled={sendMessageMutation.isPending || !selectedClientId}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {sendMessageMutation.isPending ? (
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
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
          
          {/* Sidebar with tips and recipient info */}
          <div>
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Informazioni Destinatario</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedClient ? (
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium block text-gray-500 text-sm">Nome</span>
                      <span>{selectedClient.firstName} {selectedClient.lastName}</span>
                    </div>
                    <div>
                      <span className="font-medium block text-gray-500 text-sm">Telefono</span>
                      <span>{selectedClient.phone || "Non disponibile"}</span>
                      {!selectedClient.phone && (
                        <p className="text-red-500 text-sm mt-1">
                          Attenzione: questo cliente non ha un numero di telefono registrato.
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="font-medium block text-gray-500 text-sm">Email</span>
                      <span>{selectedClient.email || "Non disponibile"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 py-4 text-center">
                    Seleziona un cliente per visualizzare le informazioni
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Modelli di messaggi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-3">
                    Clicca su un modello per inserirlo nel campo del messaggio:
                  </p>
                  
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left font-normal p-3 h-auto"
                      onClick={() => {
                        form.setValue("message", "Buongiorno, sono [Nome Agente] di Immobiliare XYZ. Volevo contattarla per discutere la sua ricerca immobiliare. Possiamo fissare un appuntamento in agenzia?");
                      }}
                    >
                      <div>
                        <p className="font-medium mb-1 text-primary-600">Primo contatto</p>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          Buongiorno, sono [Nome Agente] di Immobiliare XYZ. Volevo contattarla per discutere la sua ricerca immobiliare...
                        </p>
                      </div>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left font-normal p-3 h-auto"
                      onClick={() => {
                        form.setValue("message", "Salve, abbiamo appena inserito un immobile che potrebbe interessarle, in base ai criteri da lei indicati. Si tratta di [descrizione breve]. Posso inviarle maggiori informazioni?");
                      }}
                    >
                      <div>
                        <p className="font-medium mb-1 text-primary-600">Nuova proprietà</p>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          Salve, abbiamo appena inserito un immobile che potrebbe interessarle...
                        </p>
                      </div>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left font-normal p-3 h-auto"
                      onClick={() => {
                        form.setValue("message", "Gentile cliente, le confermo l'appuntamento per il giorno [DATA] alle [ORA] presso [LUOGO]. Mi contatti in caso di imprevisti. Cordiali saluti, [Nome Agente]");
                      }}
                    >
                      <div>
                        <p className="font-medium mb-1 text-primary-600">Conferma appuntamento</p>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          Gentile cliente, le confermo l'appuntamento per il giorno...
                        </p>
                      </div>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-left font-normal p-3 h-auto"
                      onClick={() => {
                        form.setValue("message", "Buongiorno, volevo informarla che il proprietario ha risposto alla sua offerta per l'immobile in [INDIRIZZO]. Possiamo parlarne quando preferisce. A presto, [Nome Agente]");
                      }}
                    >
                      <div>
                        <p className="font-medium mb-1 text-primary-600">Risposta offerta</p>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          Buongiorno, volevo informarla che il proprietario ha risposto alla sua offerta...
                        </p>
                      </div>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}