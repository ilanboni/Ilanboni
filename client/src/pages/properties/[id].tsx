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

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [_, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  console.log("PropertyDetailPage - ID:", id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
  
  // Fetch property details
  const { data: propertyData, isLoading: isPropertyLoading } = useQuery<PropertyWithDetails[]>({
    queryKey: ["/api/properties", id],
    queryFn: async ({ queryKey }) => {
      // Estrai l'ID dal queryKey
      const propertyId = queryKey[1];
      console.log("Caricamento proprietà ID:", propertyId);
      
      const response = await fetch(`/api/properties/${propertyId}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      console.log("Dati proprietà caricati:", data);
      return data;
    },
    enabled: !isNaN(id)
  });
  
  // Estrai la prima proprietà dall'array
  const property = propertyData && propertyData.length > 0 ? propertyData[0] : null;
  
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
  
  // Fetch property communications
  const { data: communications, isLoading: isCommunicationsLoading } = useQuery<Communication[]>({
    queryKey: ["/api/properties", id, "communications"],
    enabled: !isNaN(id),
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
          
          // Se ci sono buyer da notificare, cambia tab
          const buyersToNotify = data.filter(b => !b.notificationStatus?.notified);
          console.log("Clienti da notificare (caricamento diretto):", buyersToNotify.length);
          if (buyersToNotify.length > 0) {
            const urlParams = new URLSearchParams(window.location.search);
            if (activeTab === "overview" || urlParams.get('tab') === 'notify') {
              console.log("Cambio tab a buyersToNotify (diretto)");
              setActiveTab("buyersToNotify");
            }
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
                  {communications.map((comm) => (
                    <div key={comm.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-md">
                      <div className="flex-shrink-0 mt-0.5">
                        {getDirectionIcon(comm.direction)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {comm.direction === "inbound" && comm.clientId ? 
                                clientNamesById[comm.clientId] || `Cliente #${comm.clientId}` : 
                                "Sistema"}
                            </span>
                            {getCommunicationTypeBadge(comm.type)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(comm.createdAt?.toString() || "")}
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{comm.content}</p>
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
    </div>
  );
}