import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { Loader2, SendIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import PropertyEditDialog from "@/components/properties/PropertyEditDialog";
import MapLocationSelector from "@/components/maps/MapLocationSelector";
import MapPreview from "@/components/maps/MapPreview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BuyersToNotifyList from "@/components/properties/BuyersToNotifyList";
import NotifiedBuyersList from "@/components/properties/NotifiedBuyersList";
import { 
  type PropertyWithDetails,
  type Communication,
  type Appointment,
  type Task,
  type ClientWithDetails,
  type Client
} from "@shared/schema";

// Form schema per la validazione
const formSchema = z.object({
  type: z.string(),
  address: z.string().min(3, "L'indirizzo deve essere di almeno 3 caratteri"),
  city: z.string().min(2, "La città deve essere di almeno 2 caratteri"),
  size: z.coerce.number().min(1, "La dimensione deve essere maggiore di 0"),
  price: z.coerce.number().min(1, "Il prezzo deve essere maggiore di 0"),
  bedrooms: z.coerce.number().optional().nullable(),
  bathrooms: z.coerce.number().optional().nullable(),
  yearBuilt: z.coerce.number().optional().nullable(),
  energyClass: z.string().optional().nullable(),
  status: z.string(),
  description: z.string().optional().nullable(),
  // Aggiungiamo altri campi presenti nel modello PropertyWithDetails
  isShared: z.boolean().optional().default(false),
  isOwned: z.boolean().optional().default(true),
  externalLink: z.string().optional().nullable(),
  location: z.any().optional().nullable(),
});

// Appointment form schema
const appointmentFormSchema = z.object({
  salutation: z.string().min(1, "Seleziona un appellativo"),
  lastName: z.string().min(1, "Il cognome è obbligatorio"),
  phone: z.string().min(1, "Il numero di telefono è obbligatorio"),
  date: z.date({
    required_error: "La data è obbligatoria",
  }),
  time: z.string().min(1, "L'ora è obbligatoria"),
  address: z.string().min(1, "L'indirizzo è obbligatorio"),
});

type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [_, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showCreateAppointmentDialog, setShowCreateAppointmentDialog] = useState(false);
  const [appointmentCommunication, setAppointmentCommunication] = useState<any>(null);
  console.log("PropertyDetailPage - ID:", id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Handle appointment creation
  const handleCreateAppointment = (communication: any) => {
    setAppointmentCommunication(communication);
    setShowCreateAppointmentDialog(true);
  };
  
  // Set up form with zodResolver
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "",
      address: "",
      city: "",
      size: 0,
      price: 0,
      bedrooms: null,
      bathrooms: null,
      yearBuilt: null,
      energyClass: null,
      status: "available",
      description: "",
      isShared: false,
      isOwned: true,
      externalLink: "",
      location: null,
    },
  });
  
  // Mutation per aggiornare l'immobile
  const updatePropertyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore durante l'aggiornamento dell'immobile");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalida la query per aggiornare i dati
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", id] });
      
      // Mostra un messaggio di successo
      toast({
        title: "Immobile aggiornato",
        description: "L'immobile è stato aggiornato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'aggiornamento dell'immobile",
        variant: "destructive",
      });
    },
  });
  
  // Fetch property details with key tied to ID to ensure refresh on ID change
  const { data: property, isLoading: isPropertyLoading } = useQuery<PropertyWithDetails>({
    queryKey: [`property-${id}`, id],
    queryFn: async () => {
      console.log("Caricamento proprietà ID:", id);
      
      const response = await fetch(`/api/properties/${id}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log("Dati proprietà caricati:", data);
      
      // Verifica dei dati
      if (!data || !data.id) {
        console.error("Dati della proprietà non validi:", data);
        throw new Error('Dati della proprietà non validi');
      }
      
      // Ritorna l'immobile direttamente, non un array
      return data;
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 0, // Forza il refetch quando cambia l'ID
    enabled: !isNaN(id) && id > 0
  });
  
  // Aggiornamento dei valori del form quando property viene caricato
  useEffect(() => {
    if (property) {
      form.reset({
        type: property.type || "",
        address: property.address || "",
        city: property.city || "",
        size: property.size || 0,
        price: property.price || 0,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        yearBuilt: property.yearBuilt,
        energyClass: property.energyClass || null,
        status: property.status || "available",
        description: property.description || "",
        isShared: property.isShared || false,
        isOwned: property.isOwned || true,
        externalLink: property.externalLink || "",
        location: property.location || null,
      });
      
      // Log per il debug
      console.log("Form reset with values:", {
        ...property,
        location: property.location
      });
      
      // Forza l'aggiornamento della query dei buyers
      queryClient.invalidateQueries({ queryKey: ['/api/properties', id, 'buyers-with-notification-status'] });
    }
  }, [property, form, id, queryClient]);
  
  // Fetch property communications with the same dynamic key approach
  const { data: communications, isLoading: isCommunicationsLoading } = useQuery<Communication[]>({
    queryKey: [`property-${id}-communications`, id],
    queryFn: async () => {
      console.log("Caricamento comunicazioni per immobile ID:", id);
      
      const response = await fetch(`/api/properties/${id}/communications`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log("Comunicazioni caricate:", data);
      return data;
    },
    staleTime: 0,
    enabled: !isNaN(id) && id > 0,
  });
  
  // Fetch clients data for displaying in communications
  const { data: clientsData } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: !isNaN(id),
  });
  
  // Create a map of client names by ID for quick lookup
  const clientNamesById = useMemo(() => {
    const map: Record<number, string> = {};
    if (clientsData) {
      clientsData.forEach(client => {
        map[client.id] = `${client.firstName} ${client.lastName}`;
      });
    }
    return map;
  }, [clientsData]);
  
  // Fetch property appointments
  const { data: appointments, isLoading: isAppointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/properties", id, "appointments"],
    enabled: !isNaN(id),
  });
  
  // Fetch property tasks
  const { data: tasks, isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/properties", id, "tasks"],
    enabled: !isNaN(id),
  });
  
  // Fetch matching buyers
  const { data: matchingBuyers, isLoading: isMatchingBuyersLoading } = useQuery<Client[]>({
    queryKey: ["/api/properties", id, "matching-buyers"],
    enabled: !isNaN(id),
  });
  
  // Fetch buyers with notification status
  const { data: buyersWithStatus, isLoading: isBuyersWithStatusLoading } = useQuery<any[]>({
    queryKey: ["/api/properties", id, "buyers-with-notification-status"],
    queryFn: async () => {
      console.log("Esecuzione queryFn personalizzata");
      const response = await fetch(`/api/properties/${id}/buyers-with-notification-status`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log("API diretta buyers-with-notification-status:", data);
      return data;
    },
    enabled: !isNaN(id),
  });
  
  // Fetch notified buyers
  const { data: notifiedBuyers, isLoading: isNotifiedBuyersLoading } = useQuery<any[]>({
    queryKey: ["/api/properties", id, "notified-buyers"],
    enabled: !isNaN(id),
  });
  
  // Carichiamo i dati dei buyer direttamente
  const [manualBuyersWithStatus, setManualBuyersWithStatus] = useState<any[]>([]);
  const [manualBuyersLoading, setManualBuyersLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Carica i buyer direttamente con fetch
  useEffect(() => {
    if (!isNaN(id)) {
      setManualBuyersLoading(true);
      fetch(`/api/properties/${id}/buyers-with-notification-status`)
        .then(response => response.json())
        .then(data => {
          console.log("Dati API caricati direttamente:", data);
          setManualBuyersWithStatus(data);
          setManualBuyersLoading(false);
          
          // Conta i buyer da notificare (senza cambiare tab automaticamente)
          const buyersToNotify = data.filter(b => !b.notificationStatus?.notified);
          console.log("Clienti da notificare (caricamento diretto):", buyersToNotify.length);
          
          // Cambia tab solo se esplicitamente richiesto tramite URL
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('tab') === 'notify') {
            console.log("Cambio tab a buyersToNotify (richiesto da URL)");
            setActiveTab("buyersToNotify");
          }
        })
        .catch(error => {
          console.error("Errore nel caricamento diretto:", error);
          setManualBuyersLoading(false);
        });
    }
  }, [id, activeTab]);
  
  // Loading state
  if (isPropertyLoading || isNaN(id)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="text-6xl text-gray-300 mb-4">
          {isPropertyLoading ? (
            <i className="fas fa-spinner animate-spin"></i>
          ) : (
            <i className="fas fa-search"></i>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-gray-700 mb-4">
          {isPropertyLoading ? "Caricamento in corso..." : "Immobile non trovato"}
        </h1>
        <p className="text-gray-500 mb-6">
          {isPropertyLoading
            ? "Attendere mentre carichiamo i dati dell'immobile."
            : "L'immobile che stai cercando non esiste o è stato rimosso."
          }
        </p>
        <Button asChild>
          <Link href="/properties">
            <div className="px-2 py-1">
              <i className="fas fa-arrow-left mr-2"></i> Torna agli immobili
            </div>
          </Link>
        </Button>
      </div>
    );
  }
  
  // Format price
  const formatPrice = (price: number) => {
    return `€${price.toLocaleString()}`;
  };
  
  // Format property type
  const formatPropertyType = (type: string) => {
    switch (type) {
      case "apartment":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Appartamento</Badge>;
      case "house":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Casa</Badge>;
      case "villa":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Villa</Badge>;
      case "land":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Terreno</Badge>;
      case "commercial":
        return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Commerciale</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };
  
  // Format property status
  const formatPropertyStatus = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case "available":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Disponibile</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In trattativa</Badge>;
      case "sold":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Venduto</Badge>;
      case "reserved":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Riservato</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy");
    } catch (e) {
      return dateString;
    }
  };
  
  // Format communication type
  const getCommunicationTypeBadge = (type: string) => {
    switch (type) {
      case "email":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Email</Badge>;
      case "phone":
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Telefono</Badge>;
      case "whatsapp":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">WhatsApp</Badge>;
      case "meeting":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Incontro</Badge>;
      case "sms":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50">SMS</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };
  
  // Format direction indicator
  const getDirectionIcon = (direction: string) => {
    if (direction === "inbound") {
      return <span className="text-green-600"><i className="fas fa-arrow-down"></i></span>;
    } else {
      return <span className="text-blue-600"><i className="fas fa-arrow-up"></i></span>;
    }
  };
  
  // Format appointment status
  const getAppointmentStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Programmato</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completato</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Annullato</Badge>;
      case "postponed":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Posticipato</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  // Format task status
  const getTaskStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In attesa</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In corso</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completato</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Annullato</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  // Format task priority
  const getTaskTypeBadge = (type: string) => {
    switch (type) {
      case "call":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Chiamata</Badge>;
      case "email":
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Email</Badge>;
      case "visit":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Visita</Badge>;
      case "document":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 hover:bg-amber-50">Documento</Badge>;
      case "follow_up":
        return <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">Follow-up</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };
  
  // Formatta l'indirizzo per la visualizzazione
  const renderAddress = () => {
    if (!property) return "";
    
    console.log("Rendering address:", property.address);
    
    return property.address;
  };
  
  // Form submission handler
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    updatePropertyMutation.mutate(data);
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6 pb-16">
      <Helmet>
        <title>{property ? `${property.address} - ${property.city}` : "Dettaglio immobile"}</title>
      </Helmet>
      
      <div className="flex items-center justify-between">
        <div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/properties">
              <i className="fas fa-arrow-left mr-2"></i> Immobili
            </Link>
          </Button>
          <h1 className="text-3xl font-bold mt-2">
            {renderAddress()}
            {property?.isShared && (
              <Badge className="ml-2 bg-purple-100 text-purple-800">Condiviso</Badge>
            )}
            {!property?.isOwned && (
              <Badge className="ml-2 bg-yellow-100 text-yellow-800">Non proprietario</Badge>
            )}
          </h1>
          <div className="text-gray-500 mt-1">{property?.city}</div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsEditDialogOpen(true)}
            variant="outline"
          >
            <i className="fas fa-edit mr-2"></i> Modifica
          </Button>
        </div>
      </div>
      
      {property && (
        <PropertyEditDialog 
          open={isEditDialogOpen} 
          onOpenChange={setIsEditDialogOpen} 
          property={property}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/properties", id] });
          }}
        />
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-7 mb-4">
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="communications">Comunicazioni</TabsTrigger>
          <TabsTrigger value="appointments">Appuntamenti</TabsTrigger>
          <TabsTrigger value="tasks">Compiti</TabsTrigger>
          <TabsTrigger value="photos">Foto</TabsTrigger>
          <TabsTrigger value="buyersToNotify">Da inviare a</TabsTrigger>
          <TabsTrigger value="notifiedBuyers">Inviato a</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Property details card */}
              <Card>
                <CardHeader>
                  <CardTitle>Dettagli immobile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Tipo</div>
                      <div>{formatPropertyType(property?.type || "")}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Prezzo</div>
                      <div className="text-lg font-semibold">{formatPrice(property?.price || 0)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Superficie</div>
                      <div>{property?.size} m²</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Stanze da letto</div>
                      <div>{property?.bedrooms || "N/D"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Bagni</div>
                      <div>{property?.bathrooms || "N/D"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Anno di costruzione</div>
                      <div>{property?.yearBuilt || "N/D"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Classe energetica</div>
                      <div>{property?.energyClass || "N/D"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">Stato</div>
                      <div>{formatPropertyStatus(property?.status)}</div>
                    </div>
                    {property?.externalLink && (
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Link esterno</div>
                        <a href={property.externalLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          <i className="fas fa-external-link-alt mr-1"></i> Visualizza
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Descrizione</div>
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {property?.description || "Nessuna descrizione disponibile."}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Latest communications */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>Ultime comunicazioni</CardTitle>
                  <Button variant="ghost" size="sm" className="text-primary" asChild>
                    <Link href={`#`} onClick={() => setActiveTab("communications")}>
                      Vedi tutto
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {isCommunicationsLoading ? (
                    <div className="py-10 text-center text-gray-500">
                      <div className="text-3xl mb-2 text-gray-300 animate-spin">
                        <i className="fas fa-spinner"></i>
                      </div>
                      <p>Caricamento comunicazioni...</p>
                    </div>
                  ) : communications && communications.length > 0 ? (
                    <div className="space-y-4">
                      {communications.slice(0, 3).map((comm) => (
                        <div key={comm.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-md">
                          <div className="flex-shrink-0 mt-0.5">
                            {getDirectionIcon(comm.direction)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {comm.clientName || "Sistema"}
                                </span>
                                {getCommunicationTypeBadge(comm.type)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatDate(comm.createdAt?.toString() || "")}
                              </div>
                            </div>
                            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap line-clamp-2">{comm.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-gray-500">
                      <div className="text-5xl mb-4 text-gray-300">
                        <i className="fas fa-comments"></i>
                      </div>
                      <p className="text-lg font-medium">Nessuna comunicazione</p>
                      <p className="mt-1">Non ci sono comunicazioni registrate per questo immobile.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Location and Sidebar Information */}
            <div className="space-y-6">
              {/* Map card */}
              <Card>
                <CardHeader>
                  <CardTitle>Posizione</CardTitle>
                </CardHeader>
                <CardContent>
                  {property && property.location && (
                    <div className="h-[300px] rounded-md overflow-hidden border">
                      <MapPreview 
                        lat={property.location.lat}
                        lng={property.location.lng}
                        zoom={15}
                        markerTitle={property.address}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Matching buyers card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>Acquirenti potenziali</CardTitle>
                  <Button variant="ghost" size="sm" className="text-primary" asChild>
                    <Link href={`#`} onClick={() => setActiveTab("buyersToNotify")}>
                      Vedi tutto
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {isMatchingBuyersLoading ? (
                    <div className="py-10 text-center text-gray-500">
                      <div className="text-3xl mb-2 text-gray-300 animate-spin">
                        <i className="fas fa-spinner"></i>
                      </div>
                      <p>Caricamento acquirenti...</p>
                    </div>
                  ) : matchingBuyers && matchingBuyers.length > 0 ? (
                    <div className="space-y-3">
                      {matchingBuyers.slice(0, 5).map((buyer) => (
                        <div key={buyer.id} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link href={`/clients/${buyer.id}`} className="font-medium hover:underline">
                                {buyer.firstName} {buyer.lastName}
                              </Link>
                              {buyer.isFriend && (
                                <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">Amico</Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 text-sm">
                            {buyer.phone && (
                              <div className="flex items-center">
                                <i className="fas fa-phone text-gray-400 mr-1 w-4"></i>
                                <span>{buyer.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {matchingBuyers.length > 5 && (
                        <div className="text-center pt-2">
                          <Button variant="ghost" size="sm" onClick={() => setActiveTab("buyersToNotify")}>
                            Vedi altri {matchingBuyers.length - 5} acquirenti
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-gray-500">
                      <div className="text-5xl mb-4 text-gray-300">
                        <i className="fas fa-user-friends"></i>
                      </div>
                      <p className="text-lg font-medium">Nessun acquirente</p>
                      <p className="mt-1">Non ci sono acquirenti abbinati a questo immobile.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Communications Tab */}
        <TabsContent value="communications">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Comunicazioni</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <i className="fas fa-plus mr-2"></i> Aggiungi
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Aggiungi comunicazione</DialogTitle>
                    <DialogDescription>
                      Registra una nuova comunicazione per questo immobile.
                    </DialogDescription>
                  </DialogHeader>
                  {/* Dialog content */}
                  <div className="py-4">
                    <div className="text-center text-gray-500">
                      <i className="fas fa-comment-alt text-3xl mb-2"></i>
                      <p>Form comunicazione (non implementato)</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Annulla</Button>
                    <Button>Salva</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isCommunicationsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin text-3xl text-gray-300">
                    <i className="fas fa-spinner"></i>
                  </div>
                </div>
              ) : communications && communications.length > 0 ? (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Oggetto</TableHead>
                        <TableHead>Gestione</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TooltipProvider>
                        {communications.map((comm) => (
                          <PropertyCommunicationRow 
                            key={comm.id} 
                            communication={comm}
                            clientName={comm.direction === "inbound" && comm.clientId ? 
                              clientNamesById[comm.clientId] || `Cliente #${comm.clientId}` : 
                              "Sistema"}
                            onStatusUpdate={(communication?: any) => {
                              // If communication is passed, handle appointment creation
                              if (communication) {
                                handleCreateAppointment(communication);
                              } else {
                                // Invalidate both communications queries to sync both views
                                queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
                                queryClient.invalidateQueries({ queryKey: ["/api/properties", id, "communications"] });
                              }
                            }}
                          />
                        ))}
                      </TooltipProvider>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-10 text-center text-gray-500">
                  <div className="text-5xl mb-4 text-gray-300">
                    <i className="fas fa-comments"></i>
                  </div>
                  <p className="text-lg font-medium">Nessuna comunicazione</p>
                  <p className="mt-1">Non ci sono comunicazioni registrate per questo immobile.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Appointments Tab */}
        <TabsContent value="appointments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Appuntamenti</CardTitle>
              <Button>
                <i className="fas fa-plus mr-2"></i> Aggiungi
              </Button>
            </CardHeader>
            <CardContent>
              {isAppointmentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin text-3xl text-gray-300">
                    <i className="fas fa-spinner"></i>
                  </div>
                </div>
              ) : appointments && appointments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((appointment) => (
                      <TableRow key={appointment.id}>
                        <TableCell>
                          <div className="font-medium">
                            {formatDate(appointment.date?.toString() || "")}
                          </div>
                          <div className="text-sm text-gray-500">
                            {appointment.time || "N/D"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {appointment.clientName || "N/D"}
                        </TableCell>
                        <TableCell>
                          {appointment.type || "N/D"}
                        </TableCell>
                        <TableCell>
                          {getAppointmentStatusBadge(appointment.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <i className="fas fa-ellipsis-h"></i>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-10 text-center text-gray-500">
                  <div className="text-5xl mb-4 text-gray-300">
                    <i className="fas fa-calendar"></i>
                  </div>
                  <p className="text-lg font-medium">Nessun appuntamento</p>
                  <p className="mt-1">Non ci sono appuntamenti programmati per questo immobile.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Compiti</CardTitle>
              <Button>
                <i className="fas fa-plus mr-2"></i> Aggiungi
              </Button>
            </CardHeader>
            <CardContent>
              {isTasksLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin text-3xl text-gray-300">
                    <i className="fas fa-spinner"></i>
                  </div>
                </div>
              ) : tasks && tasks.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titolo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div className="font-medium">{task.title}</div>
                          <div className="text-sm text-gray-500 truncate max-w-md">{task.description}</div>
                        </TableCell>
                        <TableCell>
                          {getTaskTypeBadge(task.type || "")}
                        </TableCell>
                        <TableCell>
                          {formatDate(task.dueDate?.toString() || "")}
                        </TableCell>
                        <TableCell>
                          {getTaskStatusBadge(task.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <i className="fas fa-ellipsis-h"></i>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-10 text-center text-gray-500">
                  <div className="text-5xl mb-4 text-gray-300">
                    <i className="fas fa-tasks"></i>
                  </div>
                  <p className="text-lg font-medium">Nessun compito</p>
                  <p className="mt-1">Non ci sono compiti associati a questo immobile.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Photos Tab */}
        <TabsContent value="photos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Foto</CardTitle>
              <Button>
                <i className="fas fa-plus mr-2"></i> Aggiungi
              </Button>
            </CardHeader>
            <CardContent>
              <div className="py-10 text-center text-gray-500">
                <div className="text-5xl mb-4 text-gray-300">
                  <i className="fas fa-images"></i>
                </div>
                <p className="text-lg font-medium">Nessuna foto</p>
                <p className="mt-1">Non ci sono foto caricate per questo immobile.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Buyers to Notify Tab */}
        <TabsContent value="buyersToNotify">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Clienti da notificare</CardTitle>
            </CardHeader>
            <CardContent>
              <BuyersToNotifyList propertyId={id} onTabChange={setActiveTab} />
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Notified Buyers Tab */}
        <TabsContent value="notifiedBuyers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Clienti notificati</CardTitle>
            </CardHeader>
            <CardContent>
              <NotifiedBuyersList propertyId={id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Appointment Dialog */}
      <CreateAppointmentDialog 
        isOpen={showCreateAppointmentDialog}
        onClose={() => {
          setShowCreateAppointmentDialog(false);
          setAppointmentCommunication(null);
        }}
        communication={appointmentCommunication}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/properties", id, "communications"] });
          toast({
            title: "Successo",
            description: "Appuntamento creato con successo e conferma inviata via WhatsApp",
          });
        }}
      />
    </div>
  );
}

// Property Communication Row Component with Management Status
interface PropertyCommunicationRowProps {
  communication: any;
  clientName: string;
  onStatusUpdate: (communication?: any) => void;
}

function PropertyCommunicationRow({ communication, clientName, onStatusUpdate }: PropertyCommunicationRowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update management status mutation
  const updateManagementStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/communications/${id}/management-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managementStatus: status }),
      });
      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    },
    onSuccess: () => {
      onStatusUpdate();
      toast({
        title: "Stato aggiornato",
        description: "Lo stato di gestione è stato aggiornato con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato di gestione.",
        variant: "destructive",
      });
    },
  });

  // Create client from communication mutation
  const createClientMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/communications/${id}/create-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to create client');
      return response.json();
    },
    onSuccess: (data) => {
      onStatusUpdate();
      toast({
        title: "Cliente creato",
        description: `Cliente ${data.client.firstName} ${data.client.lastName} creato con successo.`,
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile creare il cliente dalla comunicazione.",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "client_created") {
      createClientMutation.mutate(communication.id);
    } else if (newStatus === "appointment_created") {
      // Trigger appointment creation dialog
      onStatusUpdate(communication); // Pass communication to parent component
    } else {
      updateManagementStatusMutation.mutate({
        id: communication.id,
        status: newStatus,
      });
    }
  };

  // Get management status badge
  const getManagementStatusBadge = (status: string | null) => {
    const currentStatus = status || "to_manage";
    
    switch (currentStatus) {
      case "to_manage":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 hover:bg-orange-50">Da gestire</Badge>;
      case "managed":
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Gestita</Badge>;
      case "client_created":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Cliente creato</Badge>;
      case "appointment_created":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Appuntamento creato</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 hover:bg-gray-50">Sconosciuto</Badge>;
    }
  };

  // Get communication type badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "email":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Email</Badge>;
      case "phone":
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Telefono</Badge>;
      case "whatsapp":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">WhatsApp</Badge>;
      case "meeting":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Incontro</Badge>;
      case "sms":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50">SMS</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/D";
    try {
      const date = parseISO(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: it });
    } catch {
      return "N/D";
    }
  };

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">
          {formatDate(communication.createdAt?.toString() || "")}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">
          {clientName}
        </div>
      </TableCell>
      <TableCell>
        {getTypeBadge(communication.type)}
      </TableCell>
      <TableCell>
        <div className="max-w-xs truncate">
          {communication.subject || "Senza oggetto"}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {getManagementStatusBadge((communication as any).managementStatus)}
          <Select
            value={(communication as any).managementStatus || "to_manage"}
            onValueChange={handleStatusChange}
            disabled={updateManagementStatusMutation.isPending || createClientMutation.isPending}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="to_manage">Da gestire</SelectItem>
              <SelectItem value="managed">Gestita</SelectItem>
              <SelectItem value="client_created">Crea cliente</SelectItem>
              <SelectItem value="appointment_created">Crea appuntamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm">
                <i className="fas fa-eye text-gray-500"></i>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Visualizza dettagli</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Create Appointment Dialog Component
function CreateAppointmentDialog({ 
  isOpen, 
  onClose, 
  communication, 
  onSuccess 
}: {
  isOpen: boolean;
  onClose: () => void;
  communication: any;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  
  // Extract contact information from communication
  const extractContactInfo = (comm: any) => {
    if (!comm) return { hasName: false, name: "", lastName: "", phone: "" };
    
    // Extract phone number and normalize it (remove +)
    let phone = "";
    // Look for phone numbers in different formats
    const phonePatterns = [
      /\+39\s*(\d{9,10})/g,  // +39 followed by 9-10 digits
      /\+(\d{11,15})/g,      // + followed by 11-15 digits
      /(\d{10,15})/g         // 10-15 digits
    ];
    
    const content = comm.content || "";
    const subject = comm.subject || "";
    const fullText = subject + " " + content;
    
    for (const pattern of phonePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        let foundPhone = match[1] || match[0];
        // Normalize phone number (remove + and ensure it starts with country code)
        foundPhone = foundPhone.replace(/\+/g, "").replace(/\s/g, "");
        if (foundPhone.length >= 10) {
          phone = foundPhone.startsWith("39") ? foundPhone : "39" + foundPhone;
          break;
        }
      }
    }
    
    // Try to extract name from subject or content
    let hasName = false;
    let name = "";
    let lastName = "";
    
    // Enhanced patterns for name extraction
    const namePatterns = [
      // For phone call notifications: "Telefonata ricevuta dal numero +39 340 7992 052"
      /Telefonata ricevuta dal numero\s+\+?[\d\s]+.*?$/i,
      // General patterns for names after phone numbers
      /(?:dal numero|da)\s+\+?[\d\s]+\s+([A-Za-z\s]+)$/i,
      /(?:Cliente|Sig\.?|Dott\.?|Prof\.?)\s+([A-Za-z\s]+)/i,
      // Look for names in the content
      /(?:Nome|Cognome):\s*([A-Za-z\s]+)/i,
      // Extract from email signatures or contact info
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
    ];
    
    // For phone call notifications, extract any name that might be in the content
    if (subject.includes("Telefonata ricevuta")) {
      // First, look for structured NOME/COGNOME format
      const nomeMatch = content.match(/\n\s*([A-Z][A-Z\s]+)\s*\n\s*NOME/);
      const cognomeMatch = content.match(/\n\s*([A-Z][A-Z\s]+)\s*\n\s*COGNOME/);
      
      if (nomeMatch && cognomeMatch) {
        hasName = true;
        name = nomeMatch[1].trim();
        lastName = cognomeMatch[1].trim();
      } else if (cognomeMatch) {
        hasName = true;
        lastName = cognomeMatch[1].trim();
      } else if (nomeMatch) {
        hasName = true;
        lastName = nomeMatch[1].trim();
      } else {
        // Enhanced fallback: Look for names in various formats
        const fullText = subject + " " + content;
        
        // Look for "Ilan Boni" pattern in signatures
        const signatureMatch = fullText.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\s*-\s*Cavour/i);
        if (signatureMatch) {
          hasName = true;
          name = signatureMatch[1];
          lastName = signatureMatch[2];
        } else {
          // Look for any capitalized words that might be names in the content
          const nameMatches = content.match(/\b[A-Z][a-z]{2,}\b/g);
          if (nameMatches && nameMatches.length > 0) {
            // Filter out common words
            const commonWords = ["Gentile", "Cavour", "Immobiliare", "Milano", "Telefono", "Giorno", "Ora", "Non", "Contatto", "Cliente", "Nome", "Cognome", "Email", "Data", "Note", "Appartamento", "Vendita", "Tipologia", "Link", "Image", "Dettagli", "Vedi", "Tutti", "Ricordiamo", "Questa"];
            const filteredNames = nameMatches.filter((word: any) => 
              !commonWords.includes(word) && 
              word.length > 2 && 
              !word.match(/^\d/) &&
              !word.match(/^(Abruzzi|Viale|Milano|Immobiliare|Facebook|Twitter)$/)
            );
            
            if (filteredNames.length > 0) {
              hasName = true;
              lastName = filteredNames[0]; // Take the first potential name
            }
          }
        }
      }
    } else {
      // Try other patterns for different types of communications
      for (const pattern of namePatterns) {
        const nameMatch = fullText.match(pattern);
        if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 0) {
          const fullName = nameMatch[1].trim();
          const nameParts = fullName.split(/\s+/);
          if (nameParts.length >= 2) {
            hasName = true;
            name = nameParts[0];
            lastName = nameParts.slice(1).join(" ");
          } else if (nameParts.length === 1 && nameParts[0].length > 2) {
            hasName = true;
            lastName = nameParts[0];
          }
          break;
        }
      }
    }
    
    return { hasName, name, lastName, phone };
  };

  const contactInfo = extractContactInfo(communication);
  
  // Get property address
  const getPropertyAddress = async (propertyId: number) => {
    try {
      const response = await fetch(`/api/properties/${propertyId}`);
      const property = await response.json();
      return property.address || "";
    } catch (error) {
      return "";
    }
  };

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      salutation: "",
      lastName: contactInfo.lastName,
      phone: contactInfo.phone,
      date: undefined,
      time: "",
      address: "",
    },
  });

  // Load property address when dialog opens
  useEffect(() => {
    if (isOpen && communication?.propertyId) {
      getPropertyAddress(communication.propertyId).then(address => {
        form.setValue("address", address);
      });
    }
  }, [isOpen, communication, form]);

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      // Create appointment
      const appointmentData = {
        propertyId: communication.propertyId,
        date: data.date.toISOString(),
        time: data.time,
        clientName: `${data.salutation} ${data.lastName}`,
        clientPhone: data.phone,
        address: data.address,
        status: "scheduled",
        notes: `Appuntamento creato dalla comunicazione ID: ${communication.id}`,
      };

      const appointment = await apiRequest("/api/calendar/events", {
        method: "POST",
        data: appointmentData,
      });

      // Send WhatsApp confirmation
      const confirmationMessage = `${data.salutation} ${data.lastName}, le confermo appuntamento di ${format(data.date, "dd/MM/yyyy")} ore ${data.time}, in ${data.address}. La ringrazio. Ilan Boni - Cavour Immobiliare`;
      
      await apiRequest("/api/whatsapp/send-direct", {
        method: "POST",
        data: {
          phone: data.phone,
          message: confirmationMessage,
        },
      });

      // Update communication status to appointment_created
      await apiRequest(`/api/communications/${communication.id}`, {
        method: "PATCH",
        data: {
          managementStatus: "appointment_created",
        },
      });

      return appointment;
    },
    onSuccess: () => {
      onSuccess();
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la creazione dell'appuntamento",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AppointmentFormData) => {
    createAppointmentMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crea Appuntamento</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="salutation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Appellativo</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona appellativo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="egr">Egregio</SelectItem>
                        <SelectItem value="egr_sig">Egregio Signor</SelectItem>
                        <SelectItem value="egr_sig_ra">Egregia Signora</SelectItem>
                        <SelectItem value="egr_dott">Egregio Dott.</SelectItem>
                        <SelectItem value="egr_dott_ssa">Egregia Dott.ssa</SelectItem>
                        <SelectItem value="caro">Caro</SelectItem>
                        <SelectItem value="cara">Cara</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!contactInfo.hasName && (
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cognome</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Inserisci cognome" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {contactInfo.hasName && (
              <div className="text-sm text-gray-600">
                <strong>Cognome:</strong> {contactInfo.lastName}
              </div>
            )}

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numero di telefono</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="bg-gray-50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: it })
                          ) : (
                            <span>Seleziona data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ora</FormLabel>
                  <FormControl>
                    <Input {...field} type="time" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Indirizzo</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="bg-gray-50" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button type="submit" disabled={createAppointmentMutation.isPending}>
                {createAppointmentMutation.isPending ? "Creazione..." : "Crea Appuntamento"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}