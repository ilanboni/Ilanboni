import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  insertCommunicationSchema, 
  type Communication,
  type InsertCommunication,
  type Client,
  type Property
} from "@shared/schema";
import { z } from "zod";

export default function EditCommunicationPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  
  // Fetch communication details
  const { data: communication, isLoading: isLoadingCommunication } = useQuery<Communication>({
    queryKey: ["/api/communications", id],
    enabled: !isNaN(id),
  });
  
  // Fetch clients for dropdown
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });
  
  // Fetch properties for dropdown
  const { data: properties } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });
  
  // Form validation schema with additional rules
  const formSchema = insertCommunicationSchema.extend({
    clientId: z.number({
      required_error: "Seleziona un cliente",
    }),
    type: z.string({
      required_error: "Seleziona un tipo di comunicazione",
    }),
    subject: z.string({
      required_error: "L'oggetto è obbligatorio",
    }).min(3, {
      message: "L'oggetto deve contenere almeno 3 caratteri",
    }),
    direction: z.string({
      required_error: "Seleziona la direzione della comunicazione",
    }),
  });
  
  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: undefined,
      type: undefined,
      subject: "",
      content: "",
      direction: undefined, 
      status: "new",
      propertyId: null,
      createdBy: null,
      needsFollowUp: false,
      followUpDate: null,
    },
  });
  
  // Update form with communication data when loaded
  useEffect(() => {
    if (communication) {
      form.reset({
        clientId: communication.clientId,
        type: communication.type,
        subject: communication.subject,
        content: communication.content || "",
        direction: communication.direction,
        status: communication.status || "new",
        propertyId: communication.propertyId,
        createdBy: communication.createdBy,
        needsFollowUp: communication.needsFollowUp || false,
        followUpDate: communication.followUpDate,
      });
      
      setSelectedClientId(communication.clientId);
      setSelectedPropertyId(communication.propertyId);
    }
  }, [communication, form]);
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: InsertCommunication) => {
      return apiRequest(`/api/communications/${id}`, {
        method: "PATCH",
        data,
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications", id] });
      
      // Show success message
      toast({
        title: "Comunicazione aggiornata",
        description: "La comunicazione è stata aggiornata con successo",
      });
      
      // Redirect to communication details
      setLocation(`/communications/${id}`);
    },
    onError: (error: any) => {
      console.error("Error updating communication:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'aggiornamento della comunicazione",
        variant: "destructive",
      });
    },
  });
  
  // Form submission handler
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updateMutation.mutate(data);
  };
  
  // Handle client selection change
  const handleClientChange = (value: string) => {
    const clientId = parseInt(value);
    setSelectedClientId(clientId);
    form.setValue("clientId", clientId);
  };
  
  // Handle property selection change
  const handlePropertyChange = (value: string) => {
    if (value === "none") {
      setSelectedPropertyId(null);
      form.setValue("propertyId", null);
    } else {
      const propertyId = parseInt(value);
      setSelectedPropertyId(propertyId);
      form.setValue("propertyId", propertyId);
    }
  };
  
  // Handle loading state
  if (isNaN(id) || (isLoadingCommunication && !communication)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="text-6xl text-gray-300 mb-4">
          {isLoadingCommunication ? (
            <i className="fas fa-spinner animate-spin"></i>
          ) : (
            <i className="fas fa-search"></i>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-gray-700 mb-4">
          {isLoadingCommunication ? "Caricamento in corso..." : "Comunicazione non trovata"}
        </h1>
        <p className="text-gray-500 mb-6">
          {isLoadingCommunication
            ? "Attendere mentre carichiamo i dati."
            : "La comunicazione che stai cercando non esiste o è stata rimossa."
          }
        </p>
        <Button asChild>
          <Link href="/communications">
            <div className="px-2 py-1">
              <i className="fas fa-arrow-left mr-2"></i> Torna alle comunicazioni
            </div>
          </Link>
        </Button>
      </div>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>Modifica Comunicazione | Gestionale Immobiliare</title>
        <meta name="description" content="Modifica una comunicazione con un cliente" />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Modifica Comunicazione</h1>
            <p className="text-gray-500 mt-1">
              Modifica i dettagli della comunicazione
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setLocation(`/communications/${id}`)}
            className="gap-2"
          >
            <i className="fas fa-times"></i>
            <span>Annulla</span>
          </Button>
        </div>
        
        <Separator />
        
        <Card>
          <CardHeader>
            <CardTitle>Dettagli Comunicazione</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Client selection */}
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente*</FormLabel>
                        <Select
                          onValueChange={handleClientChange}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona un cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients?.map(client => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.firstName} {client.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Seleziona il cliente associato a questa comunicazione
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Communication type */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo di comunicazione*</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona il tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="phone">Telefono</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="meeting">Incontro</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Direction */}
                  <FormField
                    control={form.control}
                    name="direction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Direzione*</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona la direzione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="inbound">
                              <span className="flex items-center">
                                <i className="fas fa-arrow-down text-green-600 mr-2"></i>
                                In entrata (dal cliente)
                              </span>
                            </SelectItem>
                            <SelectItem value="outbound">
                              <span className="flex items-center">
                                <i className="fas fa-arrow-up text-blue-600 mr-2"></i>
                                In uscita (verso il cliente)
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Indica se la comunicazione è in entrata (dal cliente) o in uscita (verso il cliente)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Status */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stato</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || "new"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona lo stato" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">Nuovo</SelectItem>
                            <SelectItem value="ongoing">In corso</SelectItem>
                            <SelectItem value="completed">Completato</SelectItem>
                            <SelectItem value="pending">In attesa</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Subject and Content */}
                <div className="grid grid-cols-1 gap-6">
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Oggetto*</FormLabel>
                        <FormControl>
                          <Input placeholder="Inserisci l'oggetto" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contenuto</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Inserisci il contenuto della comunicazione" 
                            className="min-h-[150px] resize-y"
                            {...field} 
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Property selection */}
                <div className="grid grid-cols-1 gap-6">
                  <FormItem>
                    <FormLabel>Immobile correlato (opzionale)</FormLabel>
                    <Select
                      onValueChange={handlePropertyChange}
                      value={selectedPropertyId?.toString() || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un immobile (opzionale)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nessun immobile</SelectItem>
                        {properties?.map(property => (
                          <SelectItem key={property.id} value={property.id.toString()}>
                            {property.address}, {property.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Se la comunicazione riguarda un immobile specifico, selezionalo qui
                    </FormDescription>
                  </FormItem>
                </div>
                
                {/* Follow-up section */}
                <div className="border border-gray-200 rounded-md p-4 space-y-4 bg-gray-50">
                  <h3 className="font-medium">Impostazioni follow-up</h3>
                  
                  <FormField
                    control={form.control}
                    name="needsFollowUp"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Richiede follow-up</FormLabel>
                          <FormDescription>
                            Seleziona se questa comunicazione richiede un follow-up
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("needsFollowUp") && (
                    <FormField
                      control={form.control}
                      name="followUpDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data di follow-up</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              value={field.value || ""}
                              onChange={field.onChange} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setLocation(`/communications/${id}`)}
                  >
                    Annulla
                  </Button>
                  <Button 
                    type="submit"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">
                          <i className="fas fa-spinner"></i>
                        </span>
                        Salvataggio...
                      </>
                    ) : (
                      <>Salva modifiche</>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}