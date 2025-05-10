import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
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
import { 
  type PropertyWithDetails,
  type Communication,
  type Appointment,
  type Task,
  type ClientWithDetails
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
  floor: z.coerce.number().optional().nullable(),
  yearBuilt: z.coerce.number().optional().nullable(),
  energyClass: z.string().optional().nullable(),
  hasGarage: z.boolean().optional().nullable(),
  hasGarden: z.boolean().optional().nullable(),
  status: z.string(),
  notes: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
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
      floor: null,
      yearBuilt: null,
      energyClass: null,
      hasGarage: false,
      hasGarden: false,
      status: "available",
      notes: "",
      description: "",
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
  const { data: property, isLoading: isPropertyLoading } = useQuery<PropertyWithDetails>({
    queryKey: ["/api/properties", id],
    enabled: !isNaN(id),
    onSuccess: (data) => {
      console.log("Property data loaded:", JSON.stringify(data, null, 2));
    }
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
        floor: null, // Non presente nello schema
        yearBuilt: property.yearBuilt,
        energyClass: property.energyClass || null,
        hasGarage: false, // Non presente nello schema
        hasGarden: false, // Non presente nello schema
        status: property.status || "available",
        notes: "", // Non presente nello schema
        description: property.description || "",
      });
    }
  }, [property, form]);
  
  // Fetch property communications
  const { data: communications, isLoading: isCommunicationsLoading } = useQuery<Communication[]>({
    queryKey: ["/api/properties", id, "communications"],
    enabled: !isNaN(id),
  });
  
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
  
  return (
    <>
      <Helmet>
        <title>
          {property ? `${property.address} | ${property.city}` : "Dettaglio Immobile"} | Gestionale Immobiliare
        </title>
        <meta 
          name="description" 
          content={`Visualizza i dettagli, le comunicazioni e gli appuntamenti dell'immobile in ${property?.address}, ${property?.city}`} 
        />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {console.log("Rendering address:", property?.address)}
              {property?.address || "Indirizzo non specificato"}
            </h1>
            <div className="flex items-center mt-1 space-x-2">
              {property?.city ? (
                <>
                  <span className="text-gray-500">{property.city}</span>
                  <span className="text-gray-300">•</span>
                </>
              ) : null}
              {formatPropertyType(property?.type || "")}
              <span className="text-gray-300">•</span>
              {formatPropertyStatus(property?.status)}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              asChild
            >
              <Link href="/properties">
                <div className="px-2 py-1">
                  <i className="fas fa-arrow-left mr-2"></i> Indietro
                </div>
              </Link>
            </Button>
            
            <Button 
              variant="outline"
              className="gap-2"
              onClick={() => setIsEditDialogOpen(true)}
            >
              <i className="fas fa-edit"></i>
              <span>Modifica</span>
            </Button>
            
            {property && (
              <PropertyEditDialog
                open={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
                property={property as any}
                onSuccess={() => {
                  // Ricarica i dati dell'immobile
                  queryClient.invalidateQueries({ queryKey: ["/api/properties", id] });
                }}
              />
            )}
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="communications">
              Comunicazioni
              {communications && communications.length > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-200">{communications.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="appointments">
              Appuntamenti
              {appointments && appointments.length > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-200">{appointments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Task
              {tasks && tasks.length > 0 && (
                <Badge className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-200">{tasks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="photos">Foto</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Dettagli Immobile</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Indirizzo</h3>
                        <p className="mt-1 font-medium">{property?.address || "Non specificato"}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Città</h3>
                        <p className="mt-1">{property?.city || "Non specificata"}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Tipologia</h3>
                        <p className="mt-1">{formatPropertyType(property?.type || "")}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Stato</h3>
                        <p className="mt-1">{formatPropertyStatus(property?.status || "available")}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Prezzo</h3>
                        <p className="mt-1 font-semibold text-xl text-blue-600">{formatPrice(property?.price || 0)}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Superficie</h3>
                        <p className="mt-1">{property?.size ? `${property.size} m²` : "Non specificata"}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Locali</h3>
                        <p className="mt-1">{property?.bedrooms ?? "Non specificati"}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Bagni</h3>
                        <p className="mt-1">{property?.bathrooms ?? "Non specificati"}</p>
                      </div>
                      
                      {property?.floor !== null && property?.floor !== undefined && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Piano</h3>
                          <p className="mt-1">{property.floor}</p>
                        </div>
                      )}
                      
                      {property?.yearBuilt && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Anno di costruzione</h3>
                          <p className="mt-1">{property.yearBuilt}</p>
                        </div>
                      )}
                      
                      {property?.energyClass && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Classe energetica</h3>
                          <p className="mt-1">{property.energyClass}</p>
                        </div>
                      )}
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Garage</h3>
                        <p className="mt-1">{property?.hasGarage === true ? "Sì" : (property?.hasGarage === false ? "No" : "Non specificato")}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Giardino</h3>
                        <p className="mt-1">{property?.hasGarden === true ? "Sì" : (property?.hasGarden === false ? "No" : "Non specificato")}</p>
                      </div>
                    </div>
                    
                    {property?.description && (
                      <div className="mt-6">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Descrizione</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{property.description}</p>
                      </div>
                    )}
                    
                    {property?.notes && (
                      <div className="mt-6">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Note</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{property.notes}</p>
                      </div>
                    )}
                    
                    {property?.externalLink && (
                      <div className="mt-6">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Link esterno</h3>
                        <a 
                          href={property.externalLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {property.externalLink}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Mappa */}
                <Card>
                  <CardHeader>
                    <CardTitle>Posizione</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full rounded-md">
                      {isPropertyLoading ? (
                        <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                          <div className="text-gray-600">Caricamento in corso...</div>
                        </div>
                      ) : (
                        <>
                          {!property?.location && (
                            <div className="absolute top-0 left-0 right-0 bg-white bg-opacity-80 z-[500] p-2 text-center text-sm">
                              Posizione non specificata - Visualizzazione di Milano
                            </div>
                          )}
                          <MapLocationSelector 
                            value={property?.location} 
                            onChange={() => {}}
                            readOnly={true}
                            className="h-full"
                          />
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="space-y-6">
                {/* Attività recenti */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Attività recenti</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    {(isCommunicationsLoading || isAppointmentsLoading || isTasksLoading) ? (
                      <div className="py-4 flex justify-center">
                        <div className="animate-spin">
                          <i className="fas fa-spinner text-xl text-gray-400"></i>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(communications || []).length === 0 && 
                          (appointments || []).length === 0 && 
                          (tasks || []).length === 0 && (
                          <div className="py-2 text-center text-gray-500">
                            <p>Nessuna attività recente</p>
                          </div>
                        )}
                        
                        {/* Comunicazioni recenti */}
                        {communications && communications.slice(0, 3).map((comm) => (
                          <div key={comm.id} className="flex items-center space-x-3">
                            <div className="rounded-full bg-blue-50 p-2">
                              <i className="fas fa-comment text-blue-500"></i>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">
                                  {comm.clientName || "Cliente"}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {getCommunicationTypeBadge(comm.type || "")}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(comm.createdAt || "")}
                              </p>
                            </div>
                          </div>
                        ))}
                        
                        {/* Appuntamenti recenti */}
                        {appointments && appointments.slice(0, 3).map((apt) => (
                          <div key={apt.id} className="flex items-center space-x-3">
                            <div className="rounded-full bg-purple-50 p-2">
                              <i className="fas fa-calendar text-purple-500"></i>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">
                                  {apt.title || "Appuntamento"}
                                </span>
                                <span className="text-xs">
                                  {getAppointmentStatusBadge(apt.status || "")}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(apt.date || "")}
                              </p>
                            </div>
                          </div>
                        ))}
                        
                        {/* Task recenti */}
                        {tasks && tasks.slice(0, 3).map((task) => (
                          <div key={task.id} className="flex items-center space-x-3">
                            <div className="rounded-full bg-amber-50 p-2">
                              <i className="fas fa-tasks text-amber-500"></i>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">
                                  {task.title || "Task"}
                                </span>
                                <span className="text-xs">
                                  {getTaskStatusBadge(task.status || "")}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(task.dueDate || "")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Documenti - parte da sviluppare */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Documenti</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="py-6 text-center text-gray-500">
                      <p>Nessun documento disponibile</p>
                    </div>
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
                <Button variant="outline">
                  <i className="fas fa-plus mr-2"></i>
                  Aggiungi comunicazione
                </Button>
              </CardHeader>
              <CardContent>
                {isCommunicationsLoading ? (
                  <div className="py-10 flex justify-center">
                    <div className="animate-spin">
                      <i className="fas fa-spinner text-2xl text-gray-400"></i>
                    </div>
                  </div>
                ) : communications && communications.length === 0 ? (
                  <div className="py-10 text-center text-gray-500">
                    <div className="text-5xl mb-4 text-gray-300">
                      <i className="fas fa-comment-slash"></i>
                    </div>
                    <p className="text-lg font-medium">Nessuna comunicazione</p>
                    <p className="mt-1">Non ci sono comunicazioni registrate per questo immobile.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Direzione</TableHead>
                        <TableHead>Contenuto</TableHead>
                        <TableHead>Follow-up</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {communications && communications.map((comm) => (
                        <TableRow key={comm.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(comm.createdAt || "")}
                          </TableCell>
                          <TableCell>{comm.clientName || "N/D"}</TableCell>
                          <TableCell>
                            {getCommunicationTypeBadge(comm.type || "")}
                          </TableCell>
                          <TableCell>
                            {getDirectionIcon(comm.direction || "outbound")}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate">
                              {comm.content || ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            {comm.needsFollowUp && (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                Richiesto
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon">
                              <i className="fas fa-ellipsis-v"></i>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Appointments Tab */}
          <TabsContent value="appointments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Appuntamenti</CardTitle>
                <Button variant="outline">
                  <i className="fas fa-plus mr-2"></i>
                  Aggiungi appuntamento
                </Button>
              </CardHeader>
              <CardContent>
                {isAppointmentsLoading ? (
                  <div className="py-10 flex justify-center">
                    <div className="animate-spin">
                      <i className="fas fa-spinner text-2xl text-gray-400"></i>
                    </div>
                  </div>
                ) : appointments && appointments.length === 0 ? (
                  <div className="py-10 text-center text-gray-500">
                    <div className="text-5xl mb-4 text-gray-300">
                      <i className="fas fa-calendar-times"></i>
                    </div>
                    <p className="text-lg font-medium">Nessun appuntamento</p>
                    <p className="mt-1">Non ci sono appuntamenti programmati per questo immobile.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Ora</TableHead>
                        <TableHead>Titolo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments && appointments.map((apt) => (
                        <TableRow key={apt.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(apt.date || "")}
                          </TableCell>
                          <TableCell>{apt.time || "N/D"}</TableCell>
                          <TableCell>{apt.title || "N/D"}</TableCell>
                          <TableCell>{apt.clientName || "N/D"}</TableCell>
                          <TableCell>
                            {getAppointmentStatusBadge(apt.status || "")}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate">
                              {apt.notes || ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon">
                              <i className="fas fa-ellipsis-v"></i>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Task</CardTitle>
                <Button variant="outline">
                  <i className="fas fa-plus mr-2"></i>
                  Aggiungi task
                </Button>
              </CardHeader>
              <CardContent>
                {isTasksLoading ? (
                  <div className="py-10 flex justify-center">
                    <div className="animate-spin">
                      <i className="fas fa-spinner text-2xl text-gray-400"></i>
                    </div>
                  </div>
                ) : tasks && tasks.length === 0 ? (
                  <div className="py-10 text-center text-gray-500">
                    <div className="text-5xl mb-4 text-gray-300">
                      <i className="fas fa-clipboard-list"></i>
                    </div>
                    <p className="text-lg font-medium">Nessun task</p>
                    <p className="mt-1">Non ci sono task programmati per questo immobile.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scadenza</TableHead>
                        <TableHead>Titolo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Assegnato a</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks && tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(task.dueDate || "")}
                          </TableCell>
                          <TableCell>{task.title || "N/D"}</TableCell>
                          <TableCell>
                            {getTaskTypeBadge(task.type || "")}
                          </TableCell>
                          <TableCell>{task.assignedTo || "N/D"}</TableCell>
                          <TableCell>{task.clientName || "N/D"}</TableCell>
                          <TableCell>
                            {getTaskStatusBadge(task.status || "")}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon">
                              <i className="fas fa-ellipsis-v"></i>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Photos Tab */}
          <TabsContent value="photos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Foto</CardTitle>
                <Button variant="outline">
                  <i className="fas fa-upload mr-2"></i>
                  Carica foto
                </Button>
              </CardHeader>
              <CardContent>
                <div className="py-10 text-center text-gray-500">
                  <div className="text-5xl mb-4 text-gray-300">
                    <i className="fas fa-image"></i>
                  </div>
                  <p className="text-lg font-medium">Nessuna foto</p>
                  <p className="mt-1">Non ci sono foto caricate per questo immobile.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}