import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ArrowLeft, CalendarRange, Edit, ExternalLink, MapPin, Phone, Trash, User, UserPlus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InsertSharedProperty, SharedProperty } from "@shared/schema";
import { SharedPropertyForm } from "@/components/properties/SharedPropertyForm";
import { SharedPropertySimpleForm } from "@/components/properties/SharedPropertySimpleForm";
import { apiRequest } from "@/lib/queryClient";
import SharedPropertyTasks from "@/components/properties/SharedPropertyTasks";
import SharedPropertyNotes from "@/components/properties/SharedPropertyNotes";
import SharedPropertyMatchingBuyers from "@/components/properties/SharedPropertyMatchingBuyers";
import PropertyInterestedClients from "@/components/properties/PropertyInterestedClients";
import PropertyPipeline from "@/components/properties/PropertyPipeline";
import PropertyInteractionsHistory from "@/components/properties/PropertyInteractionsHistory";
import PropertyActivitiesTab from "@/components/properties/PropertyActivitiesTab";
import PropertyAttachmentsTab from "@/components/properties/PropertyAttachmentsTab";

function getStageColor(stage: string) {
  switch (stage) {
    case "address_found":
      return "bg-gray-200 text-gray-800";
    case "owner_found":
      return "bg-blue-200 text-blue-800";
    case "owner_contact_found":
      return "bg-indigo-200 text-indigo-800";
    case "owner_contacted":
      return "bg-violet-200 text-violet-800";
    case "result":
      return "bg-green-200 text-green-800";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

function getStageLabel(stage: string) {
  switch (stage) {
    case "address_found":
      return "Indirizzo trovato";
    case "owner_found":
      return "Proprietario trovato";
    case "owner_contact_found":
      return "Contatto del proprietario";
    case "owner_contacted":
      return "Proprietario contattato";
    case "result":
      return "Risultato";
    default:
      return stage;
  }
}

function formatDate(dateString: string | Date) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("it-IT", { 
    day: "numeric", 
    month: "long", 
    year: "numeric" 
  }).format(date);
}

function isPrivateAgency(name: string, url: string): boolean {
  const lowerName = (name || '').toLowerCase();
  const lowerUrl = (url || '').toLowerCase();
  
  // Check for private indicators in name or URL
  return (
    lowerName.includes('privat') ||
    lowerName.includes('proprietario') ||
    lowerName.includes('owner') ||
    lowerUrl.includes('privat') ||
    lowerUrl.includes('proprietario')
  );
}

function getAgencyDisplayName(name: string): string {
  if (!name) return 'Agenzia';
  
  // Capitalize first letter
  const formatted = name.charAt(0).toUpperCase() + name.slice(1);
  
  // Return "Immobiliare.it" for immobiliare, "Idealista" for idealista, etc.
  if (formatted.toLowerCase() === 'immobiliare') return 'Immobiliare.it';
  if (formatted.toLowerCase() === 'idealista') return 'Idealista';
  
  return formatted;
}

export default function SharedPropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAcquireDialogOpen, setIsAcquireDialogOpen] = useState(false);
  const [isIgnoreDialogOpen, setIsIgnoreDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [sendMessage, setSendMessage] = useState("");
  const [selectedAgencyIndices, setSelectedAgencyIndices] = useState<number[]>([]);
  
  // Fetch shared property details
  const { data: property, isLoading, isError, error } = useQuery({
    queryKey: ['/api/shared-properties', params.id],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/shared-properties/${params.id}`);
        if (!response.ok) {
          throw new Error('Errore nel caricamento dei dettagli della proprietà condivisa');
        }
        return response.json() as Promise<SharedProperty>;
      } catch (error) {
        console.error(`Errore nel caricamento della proprietà condivisa ID ${params.id}:`, error);
        throw error;
      }
    },
    retry: 1,
    retryDelay: 1000
  });
  
  // Fetch matching buyers if property has the matchBuyers flag
  const { data: matchingBuyers } = useQuery({
    queryKey: ['/api/shared-properties', params.id, 'matching-buyers'],
    queryFn: async () => {
      if (!property?.matchBuyers) return null;
      
      const response = await fetch(`/api/shared-properties/${params.id}/matching-buyers`);
      if (!response.ok) {
        console.error('Errore nel caricamento degli acquirenti compatibili');
        return null;
      }
      return response.json();
    },
    enabled: !!property?.matchBuyers
  });
  
  // Fetch agency links via optimized batch endpoint
  const { data: agencyLinks = [], isLoading: isLoadingLinks } = useQuery({
    queryKey: ['/api/shared-properties', params.id, 'agency-links'],
    queryFn: async () => {
      // Build agencies array from old fields if new field is empty (backward compatibility)
      let agenciesArray = property?.agencies;
      
      if (!agenciesArray || !Array.isArray(agenciesArray) || agenciesArray.length === 0) {
        // Fallback to old agency fields
        agenciesArray = [];
        if (property?.agency1Name || property?.agency1Link) {
          agenciesArray.push({
            name: property.agency1Name || '',
            link: property.agency1Link || '',
            sourcePropertyId: null
          });
        }
        if (property?.agency2Name || property?.agency2Link) {
          agenciesArray.push({
            name: property.agency2Name || '',
            link: property.agency2Link || '',
            sourcePropertyId: null
          });
        }
        if (property?.agency3Name || property?.agency3Link) {
          agenciesArray.push({
            name: property.agency3Name || '',
            link: property.agency3Link || '',
            sourcePropertyId: null
          });
        }
      }
      
      if (agenciesArray.length === 0) {
        return [];
      }
      
      console.log('[AGENCY-LINKS] Fetching links for', agenciesArray.length, 'agencies');
      
      try {
        // Use batch endpoint to fetch all URLs in one request
        const response = await fetch(`/api/shared-properties/${params.id}/agency-links`);
        if (!response.ok) {
          console.log('[AGENCY-LINKS] Batch fetch failed, falling back to agencies data');
          // Fallback: use data from agencies field
          return agenciesArray.map((agency: any) => ({
            ...agency,
            url: agency.link || '',
            isPrivate: isPrivateAgency(agency.name, agency.link || '')
          }));
        }
        const links = await response.json();
        console.log('[AGENCY-LINKS] Fetched', links.length, 'agency links');
        return links;
      } catch (error) {
        console.error('[AGENCY-LINKS] Error fetching agency links:', error);
        // Fallback to agencies data
        return agenciesArray.map((agency: any) => ({
          ...agency,
          url: agency.link || '',
          isPrivate: isPrivateAgency(agency.name, agency.link || '')
        }));
      }
    },
    enabled: !!property,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: InsertSharedProperty) => {
      console.log("Dati da inviare all'API:", data);
      return apiRequest(`/api/shared-properties/${params.id}`, {
        method: 'PATCH',
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties', params.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties', params.id, 'agency-links'] });
      toast({
        title: "Proprietà aggiornata",
        description: "La proprietà condivisa è stata aggiornata con successo.",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'aggiornamento della proprietà condivisa.",
      });
    }
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/shared-properties/${params.id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      toast({
        title: "Proprietà eliminata",
        description: "La proprietà condivisa è stata eliminata con successo.",
      });
      setLocation("/properties/shared");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'eliminazione della proprietà condivisa.",
      });
    }
  });
  
  // Acquire mutation
  const acquireMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/shared-properties/${params.id}/acquire`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: "Proprietà acquisita",
        description: "La proprietà è stata acquisita e trasferita al tuo portfolio.",
      });
      // Redirect to the new property
      setLocation(`/properties/${data.propertyId}`);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'acquisizione della proprietà.",
      });
    }
  });
  
  // Ignore mutation
  const ignoreMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/shared-properties/${params.id}/ignore`, {
        method: 'PATCH'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      toast({
        title: "Proprietà ignorata",
        description: "Questa proprietà non verrà più mostrata e non verrà riproposta nei prossimi scraping.",
      });
      setLocation("/properties/shared");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'operazione.",
      });
    }
  });

  // Send to client mutation
  const sendToClientMutation = useMutation({
    mutationFn: async ({ 
      clientId, 
      message, 
      agencyLinks 
    }: { 
      clientId: number; 
      message: string; 
      agencyLinks: Array<{name: string; url: string}>;
    }) => {
      return apiRequest(`/api/shared-properties/${params.id}/send-to-client`, {
        method: 'POST',
        data: { 
          clientId, 
          message,
          agencyLinks,
          messageType: 'whatsapp'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties', params.id] });
      toast({
        title: "Messaggio WhatsApp inviato!",
        description: "L'immobile è stato inviato al cliente via WhatsApp.",
      });
      setIsSendDialogOpen(false);
      setSelectedClientId(null);
      setSendMessage("");
      setSelectedAgencyIndices([]);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'invio dell'immobile.",
      });
    }
  });

  // Fetch all buyers for sending property
  const TEST_PHONE_NUMBER = '393407992052'; // Ilan Boni - solo numero di test autorizzato
  
  const { data: buyersForSend = [] } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await fetch('/api/clients?type=buyer');
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei clienti');
      }
      const allBuyers = await response.json();
      
      // SAFETY FILTER: Only show test client (Ilan Boni)
      const testBuyers = allBuyers.filter((buyer: any) => buyer.phone === TEST_PHONE_NUMBER);
      
      if (testBuyers.length === 0) {
        console.warn('[SEND-DIALOG] Nessun cliente di test trovato con numero:', TEST_PHONE_NUMBER);
      }
      
      return testBuyers;
    },
    enabled: isSendDialogOpen // Only fetch when dialog is open
  });
  
  const handleUpdate = (data: InsertSharedProperty) => {
    console.log("Dati completi da inviare per modifica:", data);

    // Pulisce i dati per inviare solo i campi validi del schema InsertSharedProperty
    const {
      // Rimuovi campi che non sono parte del schema di inserimento
      id,
      createdAt,
      updatedAt,
      tasks,
      communications,
      lastActivity,
      matchingBuyers,
      ...cleanData
    } = data as any;

    // Assicuriamoci che i campi agency siano correttamente definiti
    const dataToSend = {
      ...cleanData,
      floor: cleanData.floor || "",
      agency1Name: cleanData.agency1Name || "",
      agency1Link: cleanData.agency1Link || "",
      agency2Name: cleanData.agency2Name || "",
      agency2Link: cleanData.agency2Link || "",
      agency3Name: cleanData.agency3Name || "",
      agency3Link: cleanData.agency3Link || ""
    };
    
    console.log("Dati da inviare all'API:", dataToSend);
    console.log("API Request:", `/api/shared-properties/${params.id}`, { method: 'PATCH', data: dataToSend });
    updateMutation.mutate(dataToSend);
  };
  
  const handleDelete = () => {
    deleteMutation.mutate();
    setIsDeleteDialogOpen(false);
  };
  
  const handleAcquire = () => {
    acquireMutation.mutate();
    setIsAcquireDialogOpen(false);
  };
  
  const handleIgnore = () => {
    ignoreMutation.mutate();
    setIsIgnoreDialogOpen(false);
  };

  const handleSendToClient = () => {
    if (!selectedClientId) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Seleziona un cliente prima di inviare l'immobile.",
      });
      return;
    }
    
    if (!sendMessage.trim()) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Scrivi un messaggio da inviare al cliente.",
      });
      return;
    }
    
    if (selectedAgencyIndices.length === 0) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Seleziona almeno un annuncio da inviare.",
      });
      return;
    }
    
    // Build selected agency links
    const selectedLinks = selectedAgencyIndices.map(index => ({
      name: agencyLinks[index].name,
      url: agencyLinks[index].url
    }));
    
    sendToClientMutation.mutate({ 
      clientId: selectedClientId, 
      message: sendMessage,
      agencyLinks: selectedLinks
    });
  };
  
  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/properties/shared")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <Skeleton className="h-9 w-64" />
        </div>
        
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-3/4 mb-1" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isError || !property) {
    return (
      <div className="container py-8">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/properties/shared")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <h1 className="text-3xl font-bold">Dettagli Proprietà Condivisa</h1>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Si è verificato un errore nel caricamento dei dettagli della proprietà condivisa."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (isEditing) {
    return (
      <div className="container py-8">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(false)}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <h1 className="text-3xl font-bold">Modifica Proprietà Condivisa</h1>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          
          // Creiamo una copia dei dati della proprietà
          const updatedProperty = {...property};
          
          // Aggiungiamo i valori aggiornati dai campi del form
          updatedProperty.agency1Name = (document.getElementById('agency1Name') as HTMLInputElement).value;
          updatedProperty.agency1Link = (document.getElementById('agency1Link') as HTMLInputElement).value;
          updatedProperty.agency2Name = (document.getElementById('agency2Name') as HTMLInputElement).value;
          updatedProperty.agency2Link = (document.getElementById('agency2Link') as HTMLInputElement).value;
          updatedProperty.agency3Name = (document.getElementById('agency3Name') as HTMLInputElement).value;
          updatedProperty.agency3Link = (document.getElementById('agency3Link') as HTMLInputElement).value;
          updatedProperty.floor = (document.getElementById('floor') as HTMLInputElement).value;
          
          console.log("Dati aggiornati prima dell'invio:", updatedProperty);
          
          // Inviamo i dati aggiornati
          handleUpdate(updatedProperty);
        }} className="space-y-6">
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">Modifica dati agenzie</h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="floor" className="block text-sm font-medium mb-1">Piano dell'appartamento</label>
                  <input 
                    id="floor"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={property.floor || ""}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agency1Name" className="block text-sm font-medium mb-1">Nome agenzia 1</label>
                  <input 
                    id="agency1Name"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={property.agency1Name || ""}
                  />
                </div>
                <div>
                  <label htmlFor="agency1Link" className="block text-sm font-medium mb-1">Link agenzia 1</label>
                  <input 
                    id="agency1Link"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={property.agency1Link || ""}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agency2Name" className="block text-sm font-medium mb-1">Nome agenzia 2</label>
                  <input 
                    id="agency2Name"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={property.agency2Name || ""}
                  />
                </div>
                <div>
                  <label htmlFor="agency2Link" className="block text-sm font-medium mb-1">Link agenzia 2</label>
                  <input 
                    id="agency2Link"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={property.agency2Link || ""}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agency3Name" className="block text-sm font-medium mb-1">Nome agenzia 3</label>
                  <input 
                    id="agency3Name"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={property.agency3Name || ""}
                  />
                </div>
                <div>
                  <label htmlFor="agency3Link" className="block text-sm font-medium mb-1">Link agenzia 3</label>
                  <input 
                    id="agency3Link"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={property.agency3Link || ""}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-4 mt-6">
              <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvataggio..." : "Salva modifiche"}
              </Button>
            </div>
          </Card>
        </form>
      </div>
    );
  }
  
  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLocation("/properties/shared")}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
        <h1 className="text-3xl font-bold">Dettagli Proprietà Condivisa</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <CardTitle className="text-2xl">{property.address}</CardTitle>
                  <CardDescription className="flex items-center mt-1">
                    <MapPin className="h-4 w-4 mr-1" />
                    {property.city}
                  </CardDescription>
                </div>
                <div className="flex gap-2 mt-2 sm:mt-0">
                  <Badge className={getStageColor(property.stage)}>
                    {getStageLabel(property.stage)}
                  </Badge>
                  {property.isAcquired && (
                    <Badge variant="success" className="bg-green-100 text-green-800">
                      Acquisito
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Dettagli Immobile</h3>
                  
                  <div className="space-y-3">
                    {property.size && property.price && (
                      <div className="flex justify-between border-b pb-2">
                        <Label>Dimensione / Prezzo</Label>
                        <span className="font-medium">{property.size} m² - {property.price.toLocaleString()} €</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between border-b pb-2">
                      <Label>Valutazione</Label>
                      <span className="font-medium">
                        {'★'.repeat(property.rating || 0)}
                        {'☆'.repeat(5 - (property.rating || 0))}
                      </span>
                    </div>
                    
                    <div className="flex justify-between border-b pb-2">
                      <Label>Data inserimento</Label>
                      <span className="font-medium">{formatDate(property.createdAt || new Date())}</span>
                    </div>
                    
                    <div className="flex justify-between border-b pb-2">
                      <Label>Ultimo aggiornamento</Label>
                      <span className="font-medium">{formatDate(property.updatedAt || new Date())}</span>
                    </div>
                    
                    {property.stageResult && (
                      <div className="flex flex-col border-b pb-2">
                        <Label className="mb-1">Risultato fase</Label>
                        <span className="font-medium">{property.stageResult}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Informazioni Proprietario</h3>
                  
                  <div className="space-y-3">
                    {property.ownerName ? (
                      <div className="flex justify-between border-b pb-2">
                        <Label>Nome proprietario</Label>
                        <span className="font-medium">{property.ownerName}</span>
                      </div>
                    ) : (
                      <div className="border-b pb-2 text-gray-500 text-sm">
                        Nessuna informazione sul proprietario disponibile
                      </div>
                    )}
                    
                    {property.ownerPhone && (
                      <div className="flex justify-between border-b pb-2">
                        <Label>Telefono proprietario</Label>
                        <span className="font-medium">{property.ownerPhone}</span>
                      </div>
                    )}
                    
                    {property.ownerEmail && (
                      <div className="flex justify-between border-b pb-2">
                        <Label>Email proprietario</Label>
                        <span className="font-medium">{property.ownerEmail}</span>
                      </div>
                    )}
                    
                    {property.ownerNotes && (
                      <div className="flex flex-col border-b pb-2">
                        <Label className="mb-1">Note proprietario</Label>
                        <span className="font-medium">{property.ownerNotes}</span>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-3 mt-6">Annunci ({agencyLinks.length})</h3>
                  
                  <div className="space-y-2">
                    {agencyLinks.length > 0 ? (
                      agencyLinks.map((agency: any, index: number) => (
                        <div 
                          key={index} 
                          className={`flex justify-between items-center p-3 rounded-lg border ${
                            agency.isPrivate 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-white border-gray-200'
                          }`}
                          data-testid={`agency-link-${index}`}
                        >
                          <div className="flex items-center gap-2">
                            {agency.isPrivate && (
                              <Badge className="bg-green-600 text-white">
                                Privato
                              </Badge>
                            )}
                            <div>
                              <Label className="block font-medium">
                                {agency.isPrivate ? 'Privato' : getAgencyDisplayName(agency.name)}
                              </Label>
                              <span className="text-xs text-gray-500">
                                Annuncio #{agency.sourcePropertyId}
                              </span>
                            </div>
                          </div>
                          {agency.url ? (
                            <a 
                              href={agency.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 text-sm font-medium"
                              data-testid={`agency-link-button-${index}`}
                            >
                              Vedi Annuncio
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">Link non disponibile</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="border p-3 rounded-lg text-gray-500 text-sm text-center">
                        Nessun annuncio disponibile
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Map will be added here in future */}
            </CardContent>
            
            <CardFooter className="flex justify-between border-t pt-6">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifica
                </Button>
                
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="text-red-600 hover:text-red-700">
                      <Trash className="h-4 w-4 mr-2" />
                      Elimina
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Conferma eliminazione</DialogTitle>
                      <DialogDescription>
                        Sei sicuro di voler eliminare questa proprietà condivisa? Questa azione non può essere annullata.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={isIgnoreDialogOpen} onOpenChange={setIsIgnoreDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="text-orange-600 hover:text-orange-700" data-testid="button-ignore-property">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Annulla multiproprietà
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Annulla multiproprietà</DialogTitle>
                      <DialogDescription>
                        Questa proprietà verrà contrassegnata come "non interessante" e non apparirà più nei prossimi scraping automatici. Sei sicuro di voler procedere?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsIgnoreDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button variant="default" onClick={handleIgnore} disabled={ignoreMutation.isPending}>
                        {ignoreMutation.isPending ? "Elaborazione..." : "Conferma"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="flex gap-2">
                {!property.isAcquired && (
                  <Dialog open={isAcquireDialogOpen} onOpenChange={setIsAcquireDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Acquisici immobile
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Conferma acquisizione</DialogTitle>
                        <DialogDescription>
                          Acquisendo questa proprietà, verrà creata nel tuo portfolio di immobili. Vuoi procedere?
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAcquireDialogOpen(false)}>
                          Annulla
                        </Button>
                        <Button onClick={handleAcquire} disabled={acquireMutation.isPending}>
                          {acquireMutation.isPending ? "Acquisizione..." : "Acquisisci"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                <Dialog open={isSendDialogOpen} onOpenChange={(open) => {
                  setIsSendDialogOpen(open);
                  if (!open) {
                    setSelectedClientId(null);
                    setSendMessage("");
                    setSelectedAgencyIndices([]);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="default" data-testid="button-send-to-client">
                      <Send className="h-4 w-4 mr-2" />
                      Invia a Cliente
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Invia immobile via WhatsApp</DialogTitle>
                      <DialogDescription>
                        Personalizza il messaggio e scegli quali annunci inviare al cliente.
                      </DialogDescription>
                    </DialogHeader>
                    
                    {/* Safety Warning */}
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertTitle className="text-yellow-800">Modalità Test</AlertTitle>
                      <AlertDescription className="text-yellow-700">
                        Per sicurezza, i messaggi WhatsApp possono essere inviati solo al numero di test: <strong>393407992052</strong> (Ilan Boni)
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-5 py-4">
                      {/* Client Selection */}
                      <div className="space-y-2">
                        <Label htmlFor="client-select">Cliente *</Label>
                        <Select
                          value={selectedClientId?.toString() || ""}
                          onValueChange={(value) => setSelectedClientId(parseInt(value))}
                        >
                          <SelectTrigger id="client-select" data-testid="select-client">
                            <SelectValue placeholder="Seleziona un cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {buyersForSend && buyersForSend.length > 0 ? (
                              buyersForSend.map((buyer: any) => (
                                <SelectItem 
                                  key={buyer.id} 
                                  value={buyer.id.toString()}
                                  data-testid={`client-option-${buyer.id}`}
                                >
                                  {buyer.firstName} {buyer.lastName}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-clients" disabled>
                                Nessun cliente trovato
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Agency Selection */}
                      <div className="space-y-2">
                        <Label>Annunci da inviare *</Label>
                        <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
                          {agencyLinks.map((link, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`agency-${index}`}
                                checked={selectedAgencyIndices.includes(index)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAgencyIndices([...selectedAgencyIndices, index]);
                                  } else {
                                    setSelectedAgencyIndices(selectedAgencyIndices.filter(i => i !== index));
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                data-testid={`checkbox-agency-${index}`}
                              />
                              <label htmlFor={`agency-${index}`} className="text-sm flex-1 cursor-pointer">
                                <span className="font-medium">{link.name}</span>
                                {link.isPrivate && (
                                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                    Privato
                                  </span>
                                )}
                              </label>
                            </div>
                          ))}
                          {agencyLinks.length === 0 && (
                            <p className="text-sm text-gray-500">Nessun annuncio disponibile</p>
                          )}
                        </div>
                      </div>

                      {/* Message */}
                      <div className="space-y-2">
                        <Label htmlFor="send-message">Messaggio WhatsApp *</Label>
                        <Textarea
                          id="send-message"
                          placeholder="Es: Ciao! Ho trovato questo immobile che potrebbe interessarti..."
                          value={sendMessage}
                          onChange={(e) => setSendMessage(e.target.value)}
                          rows={4}
                          className="resize-none"
                          data-testid="textarea-send-message"
                        />
                        <p className="text-xs text-gray-500">
                          I link degli annunci verranno aggiunti automaticamente alla fine del messaggio
                        </p>
                      </div>

                      {/* Preview */}
                      {sendMessage.trim() && selectedAgencyIndices.length > 0 && (
                        <div className="space-y-2">
                          <Label>Anteprima messaggio</Label>
                          <div className="border rounded-lg p-3 bg-green-50 text-sm whitespace-pre-wrap">
                            {sendMessage}
                            
                            {selectedAgencyIndices.map((index, i) => (
                              <div key={i} className="mt-2">
                                <strong>{agencyLinks[index].name}:</strong> {agencyLinks[index].url}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setIsSendDialogOpen(false);
                          setSelectedClientId(null);
                          setSendMessage("");
                          setSelectedAgencyIndices([]);
                        }}
                      >
                        Annulla
                      </Button>
                      <Button 
                        onClick={handleSendToClient} 
                        disabled={
                          sendToClientMutation.isPending || 
                          !selectedClientId || 
                          !sendMessage.trim() ||
                          selectedAgencyIndices.length === 0
                        }
                        data-testid="button-confirm-send"
                      >
                        {sendToClientMutation.isPending ? "Invio..." : "Invia WhatsApp"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardFooter>
          </Card>
        </div>
        
        <div>
          {/* Schede per le diverse funzionalità */}
          <Tabs defaultValue="activities" className="w-full mb-6">
            <ScrollArea className="w-full mb-4">
              <TabsList className="inline-flex w-max min-w-full h-auto p-1 gap-1">
                <TabsTrigger value="activities" className="min-w-[140px] whitespace-nowrap" aria-label="Attività di acquisizione proprietà">
                  Attività Acquisizione
                </TabsTrigger>
                <TabsTrigger value="attachments" className="min-w-[120px] whitespace-nowrap" aria-label="Documenti della proprietà">
                  Documenti
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="min-w-[100px] whitespace-nowrap" aria-label="Pipeline di acquisizione">
                  Pipeline
                </TabsTrigger>
                <TabsTrigger value="matching" className="min-w-[140px] whitespace-nowrap" aria-label="Clienti potenzialmente interessati">
                  Potenziali interessati
                </TabsTrigger>
                <TabsTrigger value="tasks" className="min-w-[100px] whitespace-nowrap" aria-label="Attività generali">
                  Attività
                </TabsTrigger>
                <TabsTrigger value="notes" className="min-w-[80px] whitespace-nowrap" aria-label="Note sulla proprietà">
                  Note
                </TabsTrigger>
                <TabsTrigger value="interested-clients" className="min-w-[140px] whitespace-nowrap" aria-label="Clienti interessati alla proprietà">
                  Clienti Interessati
                </TabsTrigger>
                <TabsTrigger value="interactions" className="min-w-[140px] whitespace-nowrap" aria-label="Cronologia delle azioni">
                  Cronologia Azioni
                </TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" className="h-2.5" />
            </ScrollArea>
            
            <TabsContent value="activities">
              <PropertyActivitiesTab sharedPropertyId={property.id} />
            </TabsContent>

            <TabsContent value="attachments">
              <PropertyAttachmentsTab sharedPropertyId={property.id} />
            </TabsContent>

            <TabsContent value="pipeline">
              <PropertyPipeline propertyId={property.id} />
            </TabsContent>

            <TabsContent value="matching">
              <SharedPropertyMatchingBuyers 
                sharedPropertyId={property.id} 
                isAcquired={property.isAcquired}
              />
            </TabsContent>
            
            <TabsContent value="tasks">
              <SharedPropertyTasks sharedPropertyId={property.id} />
            </TabsContent>

            <TabsContent value="notes">
              <SharedPropertyNotes sharedPropertyId={property.id} />
            </TabsContent>

            <TabsContent value="interested-clients">
              <PropertyInterestedClients propertyId={property.id} />
            </TabsContent>

            <TabsContent value="interactions">
              <PropertyInteractionsHistory propertyId={property.id} days={30} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}