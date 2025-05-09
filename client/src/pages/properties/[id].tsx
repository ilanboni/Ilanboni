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
        floor: property.floor,
        yearBuilt: property.yearBuilt,
        energyClass: property.energyClass || null,
        hasGarage: property.hasGarage || false,
        hasGarden: property.hasGarden || false,
        status: property.status || "available",
        notes: property.notes || "",
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
            <h1 className="text-3xl font-bold tracking-tight">{property?.address}</h1>
            <div className="flex items-center mt-1 space-x-2">
              <span className="text-gray-500">{property?.city}</span>
              <span className="text-gray-300">•</span>
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
            
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    console.log("Edit dialog button clicked");
                  }}
                >
                  <i className="fas fa-edit"></i>
                  <span>Modifica</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Modifica Immobile</DialogTitle>
                  <DialogDescription>
                    Aggiorna i dettagli dell'immobile. Clicca su Salva una volta completato.
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(values => updatePropertyMutation.mutate(values))} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Property Type */}
                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipologia*</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona tipologia" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="apartment">Appartamento</SelectItem>
                                <SelectItem value="house">Casa</SelectItem>
                                <SelectItem value="villa">Villa</SelectItem>
                                <SelectItem value="office">Ufficio</SelectItem>
                                <SelectItem value="commercial">Commerciale</SelectItem>
                                <SelectItem value="land">Terreno</SelectItem>
                              </SelectContent>
                            </Select>
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
                            <FormLabel>Stato*</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona stato" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="available">Disponibile</SelectItem>
                                <SelectItem value="sold">Venduto</SelectItem>
                                <SelectItem value="rented">Affittato</SelectItem>
                                <SelectItem value="pending">In trattativa</SelectItem>
                                <SelectItem value="inactive">Non disponibile</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Address */}
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Indirizzo*</FormLabel>
                          <FormControl>
                            <Input placeholder="Via/Piazza e numero civico" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* City */}
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Città*</FormLabel>
                          <FormControl>
                            <Input placeholder="Città" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Size */}
                      <FormField
                        control={form.control}
                        name="size"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Dimensione (mq)*</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Price */}
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prezzo (€)*</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="1000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Bedrooms */}
                      <FormField
                        control={form.control}
                        name="bedrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Locali</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                step="1" 
                                value={field.value !== null ? field.value : ""} 
                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Bathrooms */}
                      <FormField
                        control={form.control}
                        name="bathrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bagni</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                step="1" 
                                value={field.value !== null ? field.value : ""} 
                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Floor */}
                      <FormField
                        control={form.control}
                        name="floor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Piano</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="-1" 
                                step="1" 
                                value={field.value !== null ? field.value : ""} 
                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Year Built */}
                      <FormField
                        control={form.control}
                        name="yearBuilt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Anno di costruzione</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="1800" 
                                max={new Date().getFullYear()} 
                                step="1" 
                                value={field.value !== null ? field.value : ""} 
                                onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Energy Class */}
                      <FormField
                        control={form.control}
                        name="energyClass"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Classe energetica</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona classe energetica" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Non specificata</SelectItem>
                                <SelectItem value="A4">A4</SelectItem>
                                <SelectItem value="A3">A3</SelectItem>
                                <SelectItem value="A2">A2</SelectItem>
                                <SelectItem value="A1">A1</SelectItem>
                                <SelectItem value="A">A</SelectItem>
                                <SelectItem value="B">B</SelectItem>
                                <SelectItem value="C">C</SelectItem>
                                <SelectItem value="D">D</SelectItem>
                                <SelectItem value="E">E</SelectItem>
                                <SelectItem value="F">F</SelectItem>
                                <SelectItem value="G">G</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Has Garage */}
                      <FormField
                        control={form.control}
                        name="hasGarage"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Box auto/Garage</FormLabel>
                              <FormDescription>
                                Presenza di box auto o garage
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      {/* Has Garden */}
                      <FormField
                        control={form.control}
                        name="hasGarden"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Giardino</FormLabel>
                              <FormDescription>
                                Presenza di giardino
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrizione</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Descrizione dell'immobile"
                              className="min-h-[120px]"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Notes */}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note interne</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Note interne (visibili solo all'agenzia)"
                              className="min-h-[80px]"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button 
                          type="button" 
                          variant="outline"
                        >
                          Annulla
                        </Button>
                      </DialogClose>
                      <Button 
                        type="submit" 
                        disabled={updatePropertyMutation.isPending}
                      >
                        {updatePropertyMutation.isPending ? (
                          <>
                            <span className="animate-spin mr-2">
                              <i className="fas fa-spinner"></i>
                            </span>
                            Aggiornamento in corso...
                          </>
                        ) : (
                          <>Salva Modifiche</>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 md:w-[600px]">
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="communications">Comunicazioni</TabsTrigger>
            <TabsTrigger value="appointments">Appuntamenti</TabsTrigger>
            <TabsTrigger value="tasks">Note e Attività</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {isEditing ? (
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Modifica Immobile</CardTitle>
                  <CardDescription>Aggiorna i dettagli dell'immobile</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(values => updatePropertyMutation.mutate(values))} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Property Type */}
                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipologia*</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona tipologia" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="apartment">Appartamento</SelectItem>
                                  <SelectItem value="house">Casa</SelectItem>
                                  <SelectItem value="villa">Villa</SelectItem>
                                  <SelectItem value="office">Ufficio</SelectItem>
                                  <SelectItem value="commercial">Commerciale</SelectItem>
                                  <SelectItem value="land">Terreno</SelectItem>
                                </SelectContent>
                              </Select>
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
                              <FormLabel>Stato*</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona stato" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="available">Disponibile</SelectItem>
                                  <SelectItem value="sold">Venduto</SelectItem>
                                  <SelectItem value="rented">Affittato</SelectItem>
                                  <SelectItem value="pending">In trattativa</SelectItem>
                                  <SelectItem value="inactive">Non disponibile</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Address */}
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Indirizzo*</FormLabel>
                            <FormControl>
                              <Input placeholder="Via/Piazza e numero civico" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* City */}
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Città*</FormLabel>
                            <FormControl>
                              <Input placeholder="Città" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Size */}
                        <FormField
                          control={form.control}
                          name="size"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dimensione (mq)*</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" step="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Price */}
                        <FormField
                          control={form.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prezzo (€)*</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" step="1000" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Bedrooms */}
                        <FormField
                          control={form.control}
                          name="bedrooms"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Locali</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  step="1" 
                                  value={field.value !== null ? field.value : ""} 
                                  onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Bathrooms */}
                        <FormField
                          control={form.control}
                          name="bathrooms"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bagni</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  step="1" 
                                  value={field.value !== null ? field.value : ""} 
                                  onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Floor */}
                        <FormField
                          control={form.control}
                          name="floor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Piano</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="-1" 
                                  step="1" 
                                  value={field.value !== null ? field.value : ""} 
                                  onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Year Built */}
                        <FormField
                          control={form.control}
                          name="yearBuilt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Anno di costruzione</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1800" 
                                  max={new Date().getFullYear()} 
                                  step="1" 
                                  value={field.value !== null ? field.value : ""} 
                                  onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Energy Class */}
                        <FormField
                          control={form.control}
                          name="energyClass"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Classe energetica</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || ""}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona classe" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="">-</SelectItem>
                                  <SelectItem value="A4">A4</SelectItem>
                                  <SelectItem value="A3">A3</SelectItem>
                                  <SelectItem value="A2">A2</SelectItem>
                                  <SelectItem value="A1">A1</SelectItem>
                                  <SelectItem value="B">B</SelectItem>
                                  <SelectItem value="C">C</SelectItem>
                                  <SelectItem value="D">D</SelectItem>
                                  <SelectItem value="E">E</SelectItem>
                                  <SelectItem value="F">F</SelectItem>
                                  <SelectItem value="G">G</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="flex gap-4">
                        {/* Has Garage */}
                        <FormField
                          control={form.control}
                          name="hasGarage"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value === true}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                Garage/Posto auto
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        
                        {/* Has Garden */}
                        <FormField
                          control={form.control}
                          name="hasGarden"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value === true}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                Giardino
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {/* Description */}
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrizione</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Inserisci una descrizione dettagliata dell'immobile..."
                                rows={6}
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Notes */}
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Note interne</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Aggiungi note private sull'immobile (non visibili ai clienti)..."
                                rows={3}
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsEditing(false)}
                        >
                          Annulla
                        </Button>
                        <Button
                          type="submit"
                          disabled={updatePropertyMutation.isPending}
                        >
                          {updatePropertyMutation.isPending ? (
                            <>
                              <span className="animate-spin mr-2">
                                <i className="fas fa-spinner"></i>
                              </span>
                              Aggiornamento in corso...
                            </>
                          ) : (
                            <>Salva Modifiche</>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle>Dettagli Immobile</CardTitle>
                      <CardDescription>Caratteristiche e specifiche</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Prezzo</h3>
                        <p className="text-lg font-medium">{formatPrice(property?.price || 0)}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Superficie</h3>
                        <p>{property?.size} m²</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Camere da letto</h3>
                        <p>{property?.bedrooms || "Non specificate"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Bagni</h3>
                        <p>{property?.bathrooms || "Non specificati"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Anno di costruzione</h3>
                        <p>{property?.yearBuilt || "Non specificato"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Energia</h3>
                        <p>{property?.energyClass || "Non specificata"}</p>
                      </div>
                      <div className="md:col-span-2">
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Inserito il</h3>
                        <p>{property?.createdAt ? formatDate(property.createdAt.toString()) : "Data non disponibile"}</p>
                      </div>
                    </CardContent>
                    
                    {property?.description && (
                      <>
                        <Separator className="my-2" />
                        <CardContent>
                          <h3 className="text-sm font-medium text-gray-500 mb-2">Descrizione</h3>
                          <div className="text-gray-700 whitespace-pre-line">
                            {property.description}
                          </div>
                        </CardContent>
                      </>
                    )}
                  </Card>
                  
                  <div className="space-y-6">
                    {/* Statistics Card */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Statistiche</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Comunicazioni</span>
                          <Badge variant="secondary">{communications?.length || 0}</Badge>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Appuntamenti</span>
                          <Badge variant="secondary">{appointments?.length || 0}</Badge>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Note e attività</span>
                          <Badge variant="secondary">{tasks?.length || 0}</Badge>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Ultima comunicazione</span>
                          <span className="text-sm">
                            {property?.lastCommunication ? (
                              formatDistanceToNow(new Date(property.lastCommunication.createdAt), { 
                                addSuffix: true,
                                locale: it 
                              })
                            ) : (
                              "Nessuna"
                            )}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Shared Property Info */}
                    {property?.sharedDetails && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Condivisione</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <span className="text-sm font-medium text-gray-500 block mb-1">Stato</span>
                            <Badge 
                              className={property.sharedDetails.isAcquired 
                                ? "bg-green-100 text-green-800" 
                                : "bg-yellow-100 text-yellow-800"}
                            >
                              {property.sharedDetails.isAcquired ? "Acquisito" : "Non acquisito"}
                            </Badge>
                          </div>
                          {property.sharedDetails.agencyName && (
                            <div>
                              <span className="text-sm font-medium text-gray-500 block mb-1">Agenzia</span>
                              <span>{property.sharedDetails.agencyName}</span>
                            </div>
                          )}
                          {property.sharedDetails.contactPerson && (
                            <div>
                              <span className="text-sm font-medium text-gray-500 block mb-1">Persona di contatto</span>
                              <span>{property.sharedDetails.contactPerson}</span>
                            </div>
                          )}
                          {property.sharedDetails.contactPhone && (
                            <div>
                              <span className="text-sm font-medium text-gray-500 block mb-1">Telefono contatto</span>
                              <span>{property.sharedDetails.contactPhone}</span>
                            </div>
                          )}
                          {property.sharedDetails.contactEmail && (
                            <div>
                              <span className="text-sm font-medium text-gray-500 block mb-1">Email contatto</span>
                              <span>{property.sharedDetails.contactEmail}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* External Link */}
                    {property?.externalLink && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Link Esterno</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <a 
                            href={property.externalLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 hover:underline flex items-center"
                          >
                            <i className="fas fa-external-link-alt mr-2"></i> 
                            Visualizza annuncio esterno
                          </a>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
                
                {/* Interested Clients */}
                {property?.interestedClients && property.interestedClients.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Clienti Interessati</CardTitle>
                  <CardDescription>Clienti potenzialmente interessati a questo immobile</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48">Cliente</TableHead>
                          <TableHead className="w-36">Tipo</TableHead>
                          <TableHead>Budget</TableHead>
                          <TableHead>Requisiti</TableHead>
                          <TableHead className="w-32">Rating</TableHead>
                          <TableHead className="w-20 text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {property.interestedClients.map((client) => (
                          <TableRow key={client.id}>
                            <TableCell className="font-medium">
                              {client.firstName} {client.lastName}
                            </TableCell>
                            <TableCell>
                              {client.type === "buyer" 
                                ? <Badge className="bg-blue-100 text-blue-800">Acquirente</Badge>
                                : client.type === "seller"
                                ? <Badge className="bg-amber-100 text-amber-800">Venditore</Badge>
                                : <Badge className="bg-purple-100 text-purple-800">Entrambi</Badge>
                              }
                            </TableCell>
                            <TableCell>
                              {client.buyer?.maxPrice 
                                ? formatPrice(client.buyer.maxPrice)
                                : "Non specificato"
                              }
                            </TableCell>
                            <TableCell>
                              {client.buyer?.searchNotes 
                                ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="max-w-[200px] truncate cursor-help">
                                          {client.buyer.searchNotes}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm">
                                        <p className="text-sm">{client.buyer.searchNotes}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )
                                : "Nessun requisito specificato"
                              }
                            </TableCell>
                            <TableCell>
                              {client.buyer?.rating ? (
                                <div className="flex text-yellow-500">
                                  {Array.from({ length: client.buyer.rating }, (_, i) => (
                                    <i key={i} className="fas fa-star"></i>
                                  ))}
                                </div>
                              ) : "N/D"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" asChild>
                                  <Link href={`/clients/${client.id}`}>
                                    <i className="fas fa-eye"></i>
                                  </Link>
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  asChild
                                >
                                  <Link href={`/communications/whatsapp?clientId=${client.id}`}>
                                    <i className="fab fa-whatsapp text-green-600"></i>
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
                </>
            )}
          </TabsContent>
          
          {/* Communications Tab */}
          <TabsContent value="communications" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Comunicazioni</CardTitle>
                <Button 
                  variant="default"
                  className="gap-2"
                  asChild
                >
                  <Link href={`/communications/new?propertyId=${id}`}>
                    <i className="fas fa-plus"></i>
                    <span>Nuova Comunicazione</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isCommunicationsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !communications || communications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-comments"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessuna comunicazione</h3>
                    <p>
                      Non ci sono comunicazioni registrate per questo immobile.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="w-32">Tipo</TableHead>
                          <TableHead className="w-48">Data</TableHead>
                          <TableHead className="w-48">Cliente</TableHead>
                          <TableHead>Oggetto</TableHead>
                          <TableHead className="w-20 text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {communications.map((comm) => (
                          <TableRow key={comm.id}>
                            <TableCell>{getDirectionIcon(comm.direction)}</TableCell>
                            <TableCell>{getCommunicationTypeBadge(comm.type)}</TableCell>
                            <TableCell className="text-sm">
                              {formatDistanceToNow(new Date(comm.createdAt), {
                                addSuffix: true,
                                locale: it,
                              })}
                            </TableCell>
                            <TableCell>
                              <Link href={`/clients/${comm.clientId}`}>
                                <div className="text-primary-600 hover:underline">
                                  Cliente #{comm.clientId}
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell className="font-medium">
                              <Link href={`/communications/${comm.id}`}>
                                <div className="hover:text-primary-600 cursor-pointer">
                                  {comm.subject}
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" asChild>
                                  <Link href={`/communications/${comm.id}`}>
                                    <i className="fas fa-eye"></i>
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Appuntamenti</CardTitle>
                <Button 
                  variant="default"
                  className="gap-2"
                  asChild
                >
                  <Link href={`/appointments/new?propertyId=${id}`}>
                    <i className="fas fa-plus"></i>
                    <span>Nuovo Appuntamento</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isAppointmentsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !appointments || appointments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-calendar"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessun appuntamento</h3>
                    <p>
                      Non ci sono appuntamenti programmati per questo immobile.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48">Data</TableHead>
                          <TableHead className="w-36">Ora</TableHead>
                          <TableHead className="w-48">Cliente</TableHead>
                          <TableHead className="w-40">Tipo</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead className="w-32">Stato</TableHead>
                          <TableHead className="w-20 text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointments.map((appointment) => (
                          <TableRow key={appointment.id}>
                            <TableCell>{formatDate(appointment.date)}</TableCell>
                            <TableCell>{appointment.time}</TableCell>
                            <TableCell>
                              <Link href={`/clients/${appointment.clientId}`}>
                                <div className="text-primary-600 hover:underline">
                                  Cliente #{appointment.clientId}
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-gray-700">
                                {appointment.type === "visit"
                                  ? "Visita immobile"
                                  : appointment.type === "meeting"
                                  ? "Incontro in agenzia"
                                  : appointment.type === "call"
                                  ? "Chiamata telefonica"
                                  : appointment.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {appointment.notes ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="max-w-[200px] truncate cursor-help">
                                        {appointment.notes}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                      <p className="text-sm">{appointment.notes}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>{getAppointmentStatusBadge(appointment.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" asChild>
                                  <Link href={`/appointments/${appointment.id}`}>
                                    <i className="fas fa-eye"></i>
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Note e Attività</CardTitle>
                <Button 
                  variant="default"
                  className="gap-2"
                  asChild
                >
                  <Link href={`/tasks/new?propertyId=${id}`}>
                    <i className="fas fa-plus"></i>
                    <span>Nuova Attività</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isTasksLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !tasks || tasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-clipboard-list"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessuna nota o attività</h3>
                    <p>
                      Non ci sono note o attività registrate per questo immobile.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48">Data</TableHead>
                          <TableHead className="w-48">Scadenza</TableHead>
                          <TableHead className="w-40">Tipo</TableHead>
                          <TableHead>Titolo</TableHead>
                          <TableHead className="w-32">Stato</TableHead>
                          <TableHead className="w-20 text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              {formatDistanceToNow(new Date(task.createdAt), {
                                addSuffix: true,
                                locale: it,
                              })}
                            </TableCell>
                            <TableCell>{formatDate(task.dueDate)}</TableCell>
                            <TableCell>{getTaskTypeBadge(task.type)}</TableCell>
                            <TableCell className="font-medium">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="max-w-[200px] truncate cursor-help">
                                      {task.title}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <p className="font-medium">{task.title}</p>
                                    {task.description && (
                                      <p className="text-sm mt-1">{task.description}</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>{getTaskStatusBadge(task.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" asChild>
                                  <Link href={`/tasks/${task.id}`}>
                                    <i className="fas fa-eye"></i>
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}