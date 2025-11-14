import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { MapPin, Building, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WhatsAppModal } from "@/components/communications/WhatsAppModal";
import { WhatsAppChatView } from "@/components/communications/WhatsAppChatView";
import { useClientPreferences } from "@/hooks/useClientPreferences";
import { MapContainer, TileLayer, Polygon, Circle, Marker } from "react-leaflet";
import { AIAssistantResponseModal } from "@/components/communications/AIAssistantResponseModal";
import { useToast } from "@/hooks/use-toast";
import PreferenceDetails from "@/components/clients/PreferenceDetails";
import SentPropertiesHistory from "@/components/clients/SentPropertiesHistory";
import PropertyAssociationModal from "@/components/clients/PropertyAssociationModal";
import ClientMatchesToday from "@/components/clients/ClientMatchesToday";
import ClientInteractionsHistory from "@/components/clients/ClientInteractionsHistory";
import NLPreferencesInput from "@/components/clients/NLPreferencesInput";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { ActivityTimeline } from "@/components/tasks/ActivityTimeline";
import { AddPropertyToClientDialog } from "@/components/properties/AddPropertyToClientDialog";
import { CreateAppointmentDialog } from "@/components/appointments/CreateAppointmentDialog";
import { 
  type ClientWithDetails, 
  type Communication,
  type Appointment,
  type Task
} from "@shared/schema";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [_, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isAIResponseModalOpen, setIsAIResponseModalOpen] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [propertyBeingNotified, setPropertyBeingNotified] = useState<number | null>(null);
  const [incomingMessage, setIncomingMessage] = useState<Communication | null>(null);
  const [aiGeneratedResponse, setAiGeneratedResponse] = useState("");
  const [detectedProperties, setDetectedProperties] = useState<{ id: number; address: string }[]>([]);
  const [conversationThread, setConversationThread] = useState("");
  const [communicationsView, setCommunicationsView] = useState<"chat" | "table">("chat");
  const [scrapingJobId, setScrapingJobId] = useState<number | null>(null);
  const [showScrapingAlert, setShowScrapingAlert] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Start scraping mutation
  const scrapingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/apify/scrape-for-buyer/${id}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore durante lo scraping');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setScrapingJobId(data.jobId);
      setShowScrapingAlert(true);
      toast({
        title: "Scraping avviato",
        description: data.message || "Lo scraping è stato avviato con successo. Ci vorranno circa 2-3 minuti.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Poll scraping job status
  const { data: scrapingJob } = useQuery({
    queryKey: [`/api/scraping-jobs/${scrapingJobId}`],
    enabled: scrapingJobId !== null,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      // Poll every 3 seconds while running, stop when completed/failed
      return data?.status === 'running' || data?.status === 'queued' ? 3000 : false;
    },
  });

  // Handle job completion
  useEffect(() => {
    if (scrapingJob?.status === 'completed') {
      setScrapingJobId(null);
      setShowScrapingAlert(false);
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${id}/matching-properties`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${id}/saved-scraped-properties`]
      });
      toast({
        title: "Scraping completato",
        description: `Trovati ${scrapingJob.results?.totalFetched || 0} annunci, ${scrapingJob.results?.imported || 0} importati. Controlla la sezione 'Immobili da inviare'.`,
      });
    } else if (scrapingJob?.status === 'failed') {
      setScrapingJobId(null);
      setShowScrapingAlert(false);
      toast({
        title: "Scraping fallito",
        description: scrapingJob.results?.error || "Errore durante lo scraping",
        variant: "destructive",
      });
    }
  }, [scrapingJob?.status]);
  
  // Fetch client details
  const { data: client, isLoading: isClientLoading } = useQuery<ClientWithDetails>({
    queryKey: [`/api/clients/${id}`],
    enabled: !isNaN(id),
  });
  
  // Fetch client communications
  const { data: communications, isLoading: isCommunicationsLoading } = useQuery<Communication[]>({
    queryKey: [`/api/clients/${id}/communications`],
    enabled: !isNaN(id),
  });
  
  // Fetch client appointments
  const { data: appointments, isLoading: isAppointmentsLoading } = useQuery<Appointment[]>({
    queryKey: [`/api/clients/${id}/appointments`],
    enabled: !isNaN(id),
  });
  
  // Fetch client tasks
  const { data: tasks, isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: [`/api/clients/${id}/tasks`],
    enabled: !isNaN(id),
  });
  
  // Fetch client preferences (per il poligono di ricerca)
  const { data: preferences, isLoading: isPreferencesLoading } = useQuery({
    queryKey: [`/api/clients/${id}/preferences`],
    enabled: !isNaN(id) && client?.type === "buyer",
  });
  
  // Fetch matching properties (per client compratori)
  const { data: matchingProperties, isLoading: isMatchingPropertiesLoading } = useQuery({
    queryKey: [`/api/clients/${id}/matching-properties`],
    enabled: !isNaN(id) && client?.type === "buyer",
  });
  
  // Fetch matching properties with notification status (per client compratori)
  const { data: propertiesWithNotifications, isLoading: isPropertiesWithNotificationsLoading, refetch: refetchPropertiesWithNotifications } = useQuery({
    queryKey: [`/api/clients/${id}/properties-with-notification-status`],
    enabled: !isNaN(id) && client?.type === "buyer",
    queryFn: async () => {
      // Non mostrare immobili già inviati (con showSent=false)
      const response = await fetch(`/api/clients/${id}/properties-with-notification-status?showSent=false`);
      if (!response.ok) {
        if (response.status === 400) {
          return []; // Il cliente non è un compratore
        }
        throw new Error('Errore nel caricamento degli immobili con stato di notifica');
      }
      return response.json();
    }
  });
  
  // Fetch SAVED scraped properties (FAST - from database)
  const { data: savedScrapedProperties, isLoading: isSavedScrapedPropertiesLoading, refetch: refetchSavedScrapedProperties } = useQuery({
    queryKey: [`/api/clients/${id}/saved-scraped-properties`],
    enabled: !isNaN(id) && client?.type === "buyer" && client?.buyer?.rating && client.buyer.rating >= 4,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/saved-scraped-properties`);
      if (!response.ok) {
        if (response.status === 400) {
          return [];
        }
        throw new Error('Errore nel caricamento degli immobili salvati');
      }
      return response.json();
    }
  });

  // Fetch scraped properties (SLOW - scraping) - manual only, click "Aggiorna"
  const { data: scrapedProperties, isLoading: isScrapedPropertiesLoading, refetch: refetchScrapedProperties } = useQuery({
    queryKey: [`/api/clients/${id}/scraped-properties`],
    enabled: false, // Disabled: scraping starts only when user clicks "Aggiorna"
    staleTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/scraped-properties`);
      if (!response.ok) {
        if (response.status === 400) {
          return [];
        }
        throw new Error('Errore nel caricamento degli immobili scrapati');
      }
      return response.json();
    }
  });
  
  // Fetch properties sent to client
  const { data: sentProperties, isLoading: isSentPropertiesLoading } = useQuery({
    queryKey: [`/api/clients/${id}/sent-properties`],
    enabled: !isNaN(id),
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/sent-properties`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento degli immobili inviati');
      }
      return response.json();
    }
  });

  const [isCompetitorModalOpen, setIsCompetitorModalOpen] = useState(false);

  // Fetch all competitor properties (only for buyers with rating >= 4)
  const { data: allCompetitorProperties, isLoading: isAllCompetitorPropertiesLoading } = useQuery({
    queryKey: [`/api/clients/${id}/all-competitor-properties`],
    enabled: isCompetitorModalOpen && !isNaN(id) && client?.type === "buyer" && (client?.buyer?.rating || 0) >= 4,
  });
  
  // Loading state
  if (isClientLoading || isNaN(id)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="text-6xl text-gray-300 mb-4">
          {isClientLoading ? (
            <i className="fas fa-spinner animate-spin"></i>
          ) : (
            <i className="fas fa-search"></i>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-gray-700 mb-4">
          {isClientLoading ? "Caricamento in corso..." : "Cliente non trovato"}
        </h1>
        <p className="text-gray-500 mb-6">
          {isClientLoading
            ? "Attendere mentre carichiamo i dati del cliente."
            : "Il cliente che stai cercando non esiste o è stato rimosso."
          }
        </p>
        <Button asChild>
          <Link href="/clients">
            <div className="px-2 py-1">
              <i className="fas fa-arrow-left mr-2"></i> Torna ai clienti
            </div>
          </Link>
        </Button>
      </div>
    );
  }
  
  // Get name initials for avatar
  const getInitials = (firstName: string | null | undefined, lastName: string | null | undefined) => {
    const firstInitial = firstName && firstName.length > 0 ? firstName.charAt(0) : '';
    const lastInitial = lastName && lastName.length > 0 ? lastName.charAt(0) : '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };
  
  // Format client type
  const formatClientType = (type: string) => {
    switch (type) {
      case "buyer":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Acquirente</Badge>;
      case "seller":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Venditore</Badge>;
      case "both":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Acquirente/Venditore</Badge>;
      default:
        return <Badge>{type}</Badge>;
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
      return (
        <div className="flex items-center text-green-600">
          <i className="fas fa-arrow-down mr-1"></i>
          <span className="text-xs font-medium">Ricevuto</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-blue-600">
          <i className="fas fa-arrow-up mr-1"></i>
          <span className="text-xs font-medium">Inviato</span>
        </div>
      );
    }
  };
  
  // Invia una notifica di immobile al cliente
  const handleSendPropertyNotification = async (propertyId: number) => {
    // Se c'è già un'operazione in corso, non procedere
    if (isSendingNotification) return;
    
    try {
      setIsSendingNotification(true);
      setPropertyBeingNotified(propertyId);
      
      // Chiama l'API per inviare la notifica
      const response = await fetch(`/api/clients/${id}/send-property/${propertyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Errore durante l'invio della notifica");
      }
      
      // Aggiorna i dati delle proprietà con notifiche
      await refetchPropertiesWithNotifications();
      
      // Notifica all'utente
      toast({
        title: "Notifica inviata",
        description: "L'immobile è stato inviato con successo al cliente",
        variant: "success"
      });
    } catch (error: any) {
      console.error("Errore nell'invio della notifica:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'invio della notifica",
        variant: "destructive"
      });
    } finally {
      setIsSendingNotification(false);
      setPropertyBeingNotified(null);
    }
  };
  
  // Toggle favorite status for a shared property
  const handleToggleFavorite = async (propertyId: number, currentFavoriteStatus: boolean) => {
    try {
      const response = await fetch(`/api/shared-properties/${propertyId}/favorite`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isFavorite: !currentFavoriteStatus })
      });
      
      if (!response.ok) {
        throw new Error("Errore durante l'aggiornamento dei preferiti");
      }
      
      // Refetch saved scraped properties to show updated favorite status
      await refetchSavedScrapedProperties();
      
      toast({
        title: currentFavoriteStatus ? "Rimosso dai preferiti" : "Aggiunto ai preferiti",
        description: "Le preferenze sono state aggiornate",
      });
    } catch (error: any) {
      console.error("Errore nel toggle dei preferiti:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'aggiornamento",
        variant: "destructive"
      });
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
  
  // Rimuoviamo completamente le funzioni di gestione automatica dei messaggi
  // e utilizzeremo un approccio più semplice per testare l'AI Assistant
  
  return (
    <>
      <Helmet>
        <title>
          {client ? `${client.firstName} ${client.lastName}` : "Dettaglio Cliente"} | Gestionale Immobiliare
        </title>
        <meta 
          name="description" 
          content={`Visualizza i dettagli, le comunicazioni e gli appuntamenti di ${client?.firstName} ${client?.lastName}`} 
        />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-14 w-14 border-2 border-primary-100">
              <AvatarFallback className="bg-primary-50 text-primary-700 text-lg">
                {client && getInitials(client.firstName, client.lastName)}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {client?.firstName} {client?.lastName}
              </h1>
              <div className="flex items-center mt-1 space-x-2">
                {formatClientType(client?.type || "")}
                {client?.isFriend && (
                  <Badge variant="outline" className="border-blue-300 text-blue-500">
                    Amico
                  </Badge>
                )}
                {client?.type === 'buyer' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="ml-2 bg-gradient-to-r from-green-100 to-blue-100 border-primary-300"
                    onClick={() => setLocation(`/clients/${id}/search`)}
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    Area di Ricerca
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              asChild
            >
              <Link to="/clients">
                <div className="px-2 py-1">
                  <i className="fas fa-arrow-left mr-2"></i> Indietro
                </div>
              </Link>
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                // Invalida tutte le cache correlate per forzare il refresh completo
                queryClient.invalidateQueries({
                  queryKey: [`/api/clients/${id}/matching-properties`]
                });
                queryClient.invalidateQueries({
                  queryKey: [`/api/clients/${id}/scraped-properties`]
                });
                queryClient.invalidateQueries({
                  queryKey: [`/api/clients/${id}/properties-with-notification-status`]
                });
                // Forza il refetch immediato
                queryClient.refetchQueries({
                  queryKey: [`/api/clients/${id}/matching-properties`]
                });
                
                toast({
                  title: "Cache svuotata",
                  description: "Tutti i dati degli immobili sono stati ricaricati dal server.",
                });
              }}
              className="gap-2"
            >
              <i className="fas fa-sync-alt"></i>
              <span>Svuota cache</span>
            </Button>
            
            {client?.type === 'buyer' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline"
                      onClick={() => scrapingMutation.mutate()}
                      disabled={scrapingMutation.isPending || scrapingJobId !== null}
                      className="gap-2 border-orange-600 text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                      data-testid="button-scraping-mirato"
                    >
                      {(scrapingMutation.isPending || scrapingJobId !== null) ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          <span>In corso...</span>
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          <span>Scraping Mirato</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cerca nuovi immobili sui portali usando i criteri AI di questo buyer</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <Button 
              variant="outline"
              asChild
              className="gap-2"
            >
              <Link to={`/clients/edit/${id}`}>
                <i className="fas fa-edit"></i>
                <span>Modifica</span>
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
              onClick={() => setIsWhatsAppModalOpen(true)}
            >
              <i className="fab fa-whatsapp"></i>
              <span>WhatsApp</span>
            </Button>
            
            {client && (
              <>
                <PropertyAssociationModal 
                  client={{
                    id: client.id,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    type: client.type
                  }}
                  trigger={
                    <Button 
                      variant="outline" 
                      className="gap-2 border-purple-600 text-purple-600 hover:bg-purple-50"
                    >
                      <Building className="h-4 w-4" />
                      <span>Associa Proprietà</span>
                    </Button>
                  }
                />
                <AddPropertyToClientDialog 
                  clientId={client.id}
                  clientName={`${client.firstName} ${client.lastName}`}
                />
              </>
            )}

            <Button
              variant="outline"
              className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50"
              onClick={() => {
                if (communications && communications.length > 0) {
                  // Troviamo l'ultimo messaggio in arrivo
                  const inboundMessages = communications.filter(msg => msg.direction === "inbound");
                  
                  if (inboundMessages.length > 0) {
                    // Ordina per data (più recenti prima)
                    const latestMessage = [...inboundMessages].sort((a, b) => {
                      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                      return dateB.getTime() - dateA.getTime();
                    })[0];
                    
                    // Imposta il messaggio
                    setIncomingMessage(latestMessage);
                    
                    // Chiama l'API per generare la risposta AI
                    toast({
                      title: "Elaborazione in corso",
                      description: "Sto analizzando il messaggio del cliente...",
                    });
                    
                    fetch("/api/ai-assistant/analyze", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        messageId: latestMessage.id,
                        clientId: client?.id
                      })
                    })
                    .then(response => {
                      if (!response.ok) {
                        throw new Error("Errore nella chiamata API");
                      }
                      return response.json();
                    })
                    .then(data => {
                      console.log("Risposta AI ricevuta:", data);
                      
                      // Imposta i dati ricevuti
                      setAiGeneratedResponse(data.aiResponse || "");
                      setDetectedProperties(data.detectedProperties || []);
                      setConversationThread(data.threadName || "");
                      
                      // Apri il modal
                      setIsAIResponseModalOpen(true);
                    })
                    .catch(error => {
                      console.error("Errore durante l'analisi:", error);
                      toast({
                        title: "Errore",
                        description: "Non è stato possibile generare una risposta AI",
                        variant: "destructive"
                      });
                    });
                  } else {
                    toast({
                      title: "Nessun messaggio in arrivo",
                      description: "Non ci sono messaggi in arrivo da analizzare",
                    });
                  }
                } else {
                  toast({
                    title: "Nessun messaggio",
                    description: "Non ci sono messaggi da analizzare",
                  });
                }
              }}
            >
              <i className="fas fa-robot"></i>
              <span>Test AI Assistant</span>
            </Button>
          </div>
        </div>
        
        {showScrapingAlert && scrapingJob && (
          <Alert className="bg-orange-50 border-orange-200">
            <Search className="h-4 w-4 text-orange-600" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <strong>
                  {scrapingJob.status === 'queued' && 'Scraping in coda...'}
                  {scrapingJob.status === 'running' && 'Scraping in corso...'}
                </strong>
                <p className="text-sm mt-1">
                  Lo scraping dei portali può richiedere 2-3 minuti. Riceverai una notifica al termine.
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowScrapingAlert(false)}
                className="hover:bg-orange-100"
              >
                ✕
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="w-auto inline-flex md:grid md:w-full md:grid-cols-4 lg:grid-cols-10 min-w-full md:min-w-0">
              <TabsTrigger value="overview" className="whitespace-nowrap flex-shrink-0">Panoramica</TabsTrigger>
              <TabsTrigger value="communications" className="whitespace-nowrap flex-shrink-0">Comunicazioni</TabsTrigger>
              <TabsTrigger value="appointments" className="whitespace-nowrap flex-shrink-0">Appuntamenti</TabsTrigger>
              <TabsTrigger value="tasks" className="whitespace-nowrap flex-shrink-0">Note e Attività</TabsTrigger>
              {client?.type === 'buyer' && (
                <>
                  <TabsTrigger value="preferences" className="whitespace-nowrap flex-shrink-0">Preferenze</TabsTrigger>
                  <TabsTrigger value="matching-properties" className="whitespace-nowrap flex-shrink-0">Immobili compatibili</TabsTrigger>
                  <TabsTrigger value="matching-shared" className="whitespace-nowrap flex-shrink-0">Possibili immobili</TabsTrigger>
                  <TabsTrigger value="properties-notification-status" className="whitespace-nowrap flex-shrink-0">Immobili da inviare</TabsTrigger>
                </>
              )}
              <TabsTrigger value="sent-properties" className="whitespace-nowrap flex-shrink-0">Immobili inviati</TabsTrigger>
              <TabsTrigger value="matches-today" className="whitespace-nowrap flex-shrink-0">Match Oggi</TabsTrigger>
              <TabsTrigger value="interactions-history" className="whitespace-nowrap flex-shrink-0">Cronologia Invii</TabsTrigger>
            </TabsList>
          </div>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Informazioni Personali</CardTitle>
                  <CardDescription>Dettagli anagrafici e di contatto</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
                    <p>{client?.email || "Non specificata"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Telefono</h3>
                    <p>{client?.phone || "Non specificato"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Data di nascita</h3>
                    <p>{client?.birthday ? formatDate(client.birthday) : "Non specificata"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Religione</h3>
                    <p>{client?.religion || "Non specificata"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Tipo di contratto</h3>
                    <p>{client?.contractType || "Non specificato"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Cliente dal</h3>
                    <p>{client?.createdAt ? formatDate(client.createdAt.toString()) : "Data non disponibile"}</p>
                  </div>
                </CardContent>
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
                        {client?.lastCommunication ? (
                          formatDistanceToNow(new Date(client.lastCommunication.createdAt), { 
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
                
                {/* Interest Information */}
                {client?.buyer && (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Interessi Acquisto</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Budget massimo</span>
                          <span>{client.buyer.maxPrice ? `€${client.buyer.maxPrice.toLocaleString()}` : "Non specificato"}</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Dimensione min.</span>
                          <span>{client.buyer.minSize ? `${client.buyer.minSize}m²` : "Non specificata"}</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Urgenza</span>
                          <span>{client.buyer.urgency ? `${client.buyer.urgency}/5` : "Non specificata"}</span>
                        </div>
                        {client.buyer.rating && (
                          <div>
                            <span className="text-sm font-medium text-gray-500 block mb-1">Rating</span>
                            <span className="flex text-yellow-400">
                              {Array.from({ length: client.buyer.rating }, (_, i) => (
                                <i key={i} className="fas fa-star"></i>
                              ))}
                              {Array.from({ length: 5 - (client.buyer.rating || 0) }, (_, i) => (
                                <i key={i} className="far fa-star"></i>
                              ))}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* Search Area Map */}
                    {client.buyer.searchArea && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Area di Ricerca</CardTitle>
                          <CardDescription>
                            Zona geografica di interesse per l'acquisto
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="h-64 w-full rounded-lg overflow-hidden border">
                            <MapContainer
                              style={{ height: "100%", width: "100%" }}
                              center={(() => {
                                // Center map on search area if available
                                try {
                                  let searchAreaData;
                                  if (typeof client.buyer.searchArea === 'string') {
                                    searchAreaData = JSON.parse(client.buyer.searchArea);
                                  } else {
                                    searchAreaData = client.buyer.searchArea;
                                  }
                                  
                                  if (searchAreaData?.center && 
                                      typeof searchAreaData.center === 'object' && 
                                      searchAreaData.center.lat && 
                                      searchAreaData.center.lng) {
                                    return [searchAreaData.center.lat, searchAreaData.center.lng];
                                  }
                                } catch (error) {
                                  console.error("Error parsing search area for map center:", error);
                                }
                                return [45.464, 9.19]; // Default Milano
                              })()}
                              zoom={14}
                              scrollWheelZoom={false}
                            >
                              <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                              />
                              {(() => {
                                try {
                                  console.log("Dati area di ricerca:", JSON.stringify(client.buyer.searchArea));
                                  console.log("Tipo di searchArea:", typeof client.buyer.searchArea);
                                  
                                  let searchAreaData;
                                  if (typeof client.buyer.searchArea === 'string') {
                                    searchAreaData = JSON.parse(client.buyer.searchArea);
                                  } else {
                                    searchAreaData = client.buyer.searchArea;
                                  }
                                  
                                  // Check for circular search area format (center + radius)
                                  if (searchAreaData?.center && searchAreaData?.radius) {
                                    console.log("Rendering circular search area:", searchAreaData);
                                    
                                    // Validate that center has lat/lng coordinates
                                    if (typeof searchAreaData.center === 'object' && 
                                        searchAreaData.center.lat && 
                                        searchAreaData.center.lng &&
                                        typeof searchAreaData.center.lat === 'number' &&
                                        typeof searchAreaData.center.lng === 'number') {
                                      return (
                                        <>
                                          <Circle
                                            center={[searchAreaData.center.lat, searchAreaData.center.lng]}
                                            radius={searchAreaData.radius}
                                            pathOptions={{
                                              color: "#3b82f6",
                                              fillColor: "#3b82f6",
                                              fillOpacity: 0.2,
                                              weight: 2
                                            }}
                                          />
                                          <Marker position={[searchAreaData.center.lat, searchAreaData.center.lng]} />
                                        </>
                                      );
                                    } else {
                                      // Center is invalid (string address instead of coordinates)
                                      console.warn("Invalid center data - expected lat/lng coordinates but got:", searchAreaData.center);
                                      return null; // Don't render anything to avoid map errors
                                    }
                                  }
                                  
                                  // Check for polygon GeoJSON format
                                  if (searchAreaData?.geometry?.coordinates?.[0]) {
                                    // Converti coordinate da [lng, lat] a [lat, lng] per Leaflet
                                    const coordinates = searchAreaData.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]);
                                    console.log("Coordinate estratte:", coordinates);
                                    
                                    return (
                                      <Polygon
                                        positions={coordinates}
                                        pathOptions={{
                                          color: "#3b82f6",
                                          fillColor: "#3b82f6",
                                          fillOpacity: 0.2,
                                          weight: 2
                                        }}
                                      />
                                    );
                                  }
                                } catch (error) {
                                  console.error("Errore nel parsing dell'area di ricerca:", error);
                                }
                                return null;
                              })()}
                            </MapContainer>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  </>
                )}
                
                {/* Seller Information */}
                {client?.seller && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Informazioni Venditore</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {client.seller.propertyId && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Immobile ID</span>
                          <Link href={`/properties/${client.seller.propertyId}`}>
                            <span className="text-primary-600 hover:text-primary-700 hover:underline">
                              #{client.seller.propertyId}
                            </span>
                          </Link>
                        </div>
                      )}
                      {client.seller.rating && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Rating</span>
                          <span className="flex text-yellow-400">
                            {Array.from({ length: client.seller.rating }, (_, i) => (
                              <i key={i} className="fas fa-star"></i>
                            ))}
                            {Array.from({ length: 5 - (client.seller.rating || 0) }, (_, i) => (
                              <i key={i} className="far fa-star"></i>
                            ))}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
            
            {client?.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Note</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-line text-gray-700">
                    {client.notes}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Communications Tab */}
          <TabsContent value="communications" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-4">
                  <CardTitle>Comunicazioni</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={communicationsView === "chat" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCommunicationsView("chat")}
                      className="gap-2"
                      data-testid="button-chat-view"
                    >
                      <i className="fab fa-whatsapp"></i>
                      Chat WhatsApp
                    </Button>
                    <Button
                      variant={communicationsView === "table" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCommunicationsView("table")}
                      className="gap-2"
                      data-testid="button-table-view"
                    >
                      <i className="fas fa-list"></i>
                      Tutte
                    </Button>
                  </div>
                </div>
                {communicationsView === "table" && (
                  <Button 
                    variant="default"
                    className="gap-2"
                    asChild
                  >
                    <Link href={`/communications/new?clientId=${id}`}>
                      <i className="fas fa-plus"></i>
                      <span>Nuova Comunicazione</span>
                    </Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isCommunicationsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : communicationsView === "chat" ? (
                  <WhatsAppChatView 
                    clientId={id} 
                    communications={communications || []} 
                  />
                ) : !communications || communications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-comments"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessuna comunicazione</h3>
                    <p>
                      Non ci sono comunicazioni registrate per questo cliente.
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
                          <TableHead>Oggetto</TableHead>
                          <TableHead className="w-48">Immobile</TableHead>
                          <TableHead className="w-32">Stato</TableHead>
                          <TableHead className="w-24">Follow-up</TableHead>
                          <TableHead className="w-20 text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {communications.map((comm) => (
                          <TableRow key={comm.id}>
                            <TableCell>{getDirectionIcon(comm.direction)}</TableCell>
                            <TableCell>{getCommunicationTypeBadge(comm.type)}</TableCell>
                            <TableCell className="text-sm">
                              {(() => {
                                try {
                                  return comm.createdAt ? format(new Date(comm.createdAt), "dd/MM/yy HH:mm", {
                                    locale: it,
                                  }) : "Data non disponibile";
                                } catch (e) {
                                  console.error("Errore formattazione data:", e);
                                  return "Data non disponibile";
                                }
                              })()}
                            </TableCell>
                            <TableCell className="font-medium">
                              <Link href={`/communications/${comm.id}`}>
                                <div className="hover:text-primary-700 cursor-pointer">
                                  <div>{comm.subject}</div>
                                  {comm.type === "whatsapp" && (
                                    <div className="text-sm text-gray-500 mt-1 line-clamp-1">
                                      {comm.content}
                                    </div>
                                  )}
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell>
                              {(comm as any).property ? (
                                <Link href={`/properties/${(comm as any).property.id}`}>
                                  <div className="hover:text-primary-700 cursor-pointer">
                                    <div className="font-medium text-sm">{(comm as any).property.address}</div>
                                    <div className="text-xs text-gray-500">
                                      €{(comm as any).property.price?.toLocaleString()} • {(comm as any).property.size} m²
                                    </div>
                                  </div>
                                </Link>
                              ) : (
                                <span className="text-gray-400 text-sm">Nessun immobile</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {comm.status && (
                                <Badge
                                  className={`${
                                    comm.status === "completed"
                                      ? "bg-green-100 text-green-800"
                                      : comm.status === "pending"
                                      ? "bg-orange-100 text-orange-800"
                                      : comm.status === "ongoing"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {comm.status === "completed"
                                    ? "Completata"
                                    : comm.status === "pending"
                                    ? "In attesa"
                                    : comm.status === "ongoing"
                                    ? "In corso"
                                    : "Nuova"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {comm.needsFollowUp && (
                                <Badge variant="outline" className="bg-red-50 text-red-700">
                                  Richiesto
                                </Badge>
                              )}
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
                <CreateAppointmentDialog
                  clientId={id}
                  clientName={`${client.firstName} ${client.lastName}`}
                  clientPhone={client.phone}
                />
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
                      Non ci sono appuntamenti programmati per questo cliente.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48">Data</TableHead>
                          <TableHead className="w-36">Ora</TableHead>
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
                                      <div className="max-w-[300px] truncate cursor-help">
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
          
          {/* Preferences Tab - Solo per acquirenti */}
          <TabsContent value="preferences" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Preferenze di Ricerca</CardTitle>
                  <CardDescription>Criteri di ricerca dell'acquirente</CardDescription>
                </div>
                <Button 
                  variant="outline"
                  className="gap-2"
                  asChild
                >
                  <Link href={`/clients/${id}/search`}>
                    <i className="fas fa-edit"></i>
                    <span>Modifica</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isPreferencesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !preferences ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-map-marker-alt"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessuna preferenza</h3>
                    <p>
                      Non sono state definite preferenze di ricerca per questo cliente.
                    </p>
                    <Button 
                      variant="default"
                      className="mt-4 gap-2"
                      asChild
                    >
                      <Link href={`/clients/${id}/search`}>
                        <i className="fas fa-plus"></i>
                        <span>Imposta preferenze</span>
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Dettagli preferenze */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Budget</h3>
                        <p>
                          {preferences.minPrice && preferences.maxPrice
                            ? `${preferences.minPrice.toLocaleString('it-IT')} € - ${preferences.maxPrice.toLocaleString('it-IT')} €`
                            : preferences.maxPrice
                            ? `Fino a ${preferences.maxPrice.toLocaleString('it-IT')} €`
                            : "Non specificato"}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Superficie</h3>
                        <p>
                          {preferences.minSize && preferences.maxSize
                            ? `${preferences.minSize} m² - ${preferences.maxSize} m²`
                            : preferences.minSize
                            ? `Minimo ${preferences.minSize} m²`
                            : "Non specificata"}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Locali</h3>
                        <p>
                          {preferences.minRooms
                            ? `Minimo ${preferences.minRooms} ${preferences.minRooms === 1 ? 'locale' : 'locali'}`
                            : "Non specificati"}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Tipologia</h3>
                        <p>{preferences.propertyType || "Qualsiasi"}</p>
                      </div>
                    </div>
                    <div className="bg-gray-100 p-4 rounded-md text-center">
                      <h3 className="text-sm font-medium mb-2">Area di ricerca</h3>
                      {preferences.searchArea ? (
                        <div className="font-medium text-green-700">
                          <i className="fas fa-map-marked-alt mr-2"></i>
                          Poligono di ricerca definito
                        </div>
                      ) : (
                        <div className="text-gray-500">Nessuna area di ricerca definita</div>
                      )}
                    </div>
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
                <div className="flex gap-2">
                  <CreateTaskDialog 
                    clientId={id} 
                    clientName={`${client?.firstName || ''} ${client?.lastName || ''}`.trim()}
                  />
                  <Button 
                    variant="outline"
                    className="gap-2"
                    asChild
                  >
                    <Link href="/tasks">
                      <i className="fas fa-tasks"></i>
                      <span>Tutte le Attività</span>
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ActivityTimeline clientId={id} />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Immobili Compatibili Tab */}
          {/* Preferenze Tab */}
          <TabsContent value="preferences" className="space-y-6 mt-6">
            {client?.type === 'buyer' && (
              <NLPreferencesInput clientId={id} />
            )}
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Preferenze di Ricerca</CardTitle>
                  <CardDescription>Criteri di ricerca dell'acquirente</CardDescription>
                </div>
                <Button 
                  variant="outline"
                  className="gap-2"
                  asChild
                >
                  <Link href={`/clients/${id}/search`}>
                    <i className="fas fa-edit"></i>
                    <span>Modifica</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isPreferencesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !preferences ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-map-marker-alt"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessuna preferenza</h3>
                    <p>
                      Non sono state definite preferenze di ricerca per questo cliente.
                    </p>
                    <Button 
                      variant="default"
                      className="mt-4 gap-2"
                      asChild
                    >
                      <Link href={`/clients/${id}/search`}>
                        <i className="fas fa-plus"></i>
                        <span>Imposta preferenze</span>
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Dettagli preferenze */}
                    <PreferenceDetails preferences={preferences} />
                    
                    {/* Visualizzazione area di ricerca su mappa */}
                    <div className="bg-gray-100 p-4 rounded-md">
                      <h3 className="text-md font-medium mb-3">Area di Ricerca</h3>
                      
                      {preferences.searchArea ? (
                        <div>
                          {/* Mappa con area di ricerca */}
                          <div className="h-64 rounded-md overflow-hidden border border-gray-300">
                            {(() => {
                              // Calcola automaticamente il centro della mappa in base all'area
                              console.log("Dati area di ricerca:", JSON.stringify(preferences.searchArea));
                              let mapCenter = [45.4642, 9.1900]; // Milano default
                              let zoomLevel = 12;
                              
                              // Estrae le coordinate dal GeoJSON
                              let coordinates = [];
                              try {
                                // Gestisce sia il caso in cui searchArea sia già un oggetto JSON
                                // sia il caso in cui è una stringa JSON
                                let searchAreaObj = preferences.searchArea;
                                if (typeof preferences.searchArea === 'string') {
                                  searchAreaObj = JSON.parse(preferences.searchArea);
                                }
                                
                                console.log("Tipo di searchArea:", typeof searchAreaObj);
                                
                                // Estrae le coordinate in base al formato
                                if (searchAreaObj?.type === 'Feature' && 
                                    searchAreaObj?.geometry?.type === 'Polygon') {
                                  // Formato GeoJSON completo
                                  coordinates = searchAreaObj.geometry.coordinates[0];
                                  
                                  // Le coordinate in GeoJSON sono [lng, lat], dobbiamo invertirle per Leaflet che usa [lat, lng]
                                  coordinates = coordinates.map(coord => [coord[1], coord[0]]);
                                } else if (Array.isArray(searchAreaObj)) {
                                  // Formato semplice array di punti
                                  coordinates = searchAreaObj;
                                }
                                
                                console.log("Coordinate estratte:", coordinates);
                                
                                if (coordinates.length > 0) {
                                  // Calcola il centro come media dei punti
                                  const lats = coordinates.map(point => point[0]);
                                  const lngs = coordinates.map(point => point[1]);
                                  
                                  const avgLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
                                  const avgLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;
                                  
                                  mapCenter = [avgLat, avgLng];
                                  
                                  // Calcola zoom in base all'estensione dell'area
                                  const minLat = Math.min(...lats);
                                  const maxLat = Math.max(...lats);
                                  const minLng = Math.min(...lngs);
                                  const maxLng = Math.max(...lngs);
                                  
                                  // Se l'area è molto piccola, aumenta lo zoom
                                  const latDiff = maxLat - minLat;
                                  const lngDiff = maxLng - minLng;
                                  
                                  if (latDiff < 0.01 && lngDiff < 0.01) {
                                    zoomLevel = 15;
                                  } else if (latDiff < 0.05 && lngDiff < 0.05) {
                                    zoomLevel = 13;
                                  }
                                }
                              } catch (error) {
                                console.error("Errore parsing dati area:", error);
                              }
                              
                              return (
                                <MapContainer 
                                  center={mapCenter as [number, number]} 
                                  zoom={zoomLevel} 
                                  className="h-full w-full"
                                >
                                  <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                  />
                                  
                                  {/* Visualizza il poligono dell'area di ricerca */}
                                  {coordinates.length > 0 && (
                                    <Polygon 
                                      positions={coordinates}
                                      pathOptions={{ 
                                        color: 'blue',
                                        fillColor: 'rgba(0, 0, 255, 0.2)',
                                        fillOpacity: 0.4
                                      }}
                                    />
                                  )}
                                </MapContainer>
                              );
                            })()}
                          </div>
                          
                          <div className="mt-2 flex justify-center">
                            <Button 
                              variant="outline" 
                              size="sm"
                              asChild
                              className="text-xs"
                            >
                              <Link href={`/clients/${id}/search`}>
                                <i className="fas fa-edit mr-1"></i>
                                Modifica Area
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-gray-500 text-center mb-3">
                            Nessuna area di ricerca definita
                          </div>
                          <div className="flex justify-center">
                            <Button 
                              variant="default" 
                              size="sm"
                              asChild
                            >
                              <Link href={`/clients/${id}/search`}>
                                <i className="fas fa-map-marker-alt mr-1"></i>
                                Definisci Area
                              </Link>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="matching-properties" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Immobili Compatibili</CardTitle>
                  <CardDescription>Immobili che corrispondono alle preferenze del cliente</CardDescription>
                </div>
                <Button 
                  variant="outline"
                  className="gap-2"
                  asChild
                >
                  <Link href={`/clients/${id}/search`}>
                    <i className="fas fa-search"></i>
                    <span>Ricerca Avanzata</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isMatchingPropertiesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !matchingProperties || matchingProperties.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-home"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessun immobile compatibile</h3>
                    <p>
                      Non ci sono immobili che corrispondono alle preferenze del cliente.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {matchingProperties.map((property) => (
                      <Card key={property.id} className="overflow-hidden">
                        <div className="aspect-video relative bg-gray-100">
                          {property.images && property.images.length > 0 ? (
                            <img 
                              src={property.images[0]} 
                              alt={property.title} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              <i className="fas fa-home text-4xl"></i>
                            </div>
                          )}
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-primary-900/80 text-white">
                              € {property.price?.toLocaleString() || "N/D"}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg line-clamp-1">
                                <Link href={`/properties/${property.id}`} className="hover:text-primary-600">
                                  {property.title}
                                </Link>
                              </h3>
                              <p className="text-sm text-gray-600 line-clamp-1">{property.address}</p>
                            </div>
                            <Badge variant={property.status === "available" ? "success" : "outline"}>
                              {property.status === "available" ? "Disponibile" : property.status}
                            </Badge>
                          </div>
                          
                          <div className="flex justify-between mt-3 text-sm">
                            <div>
                              <span className="font-medium">{property.size} m²</span>
                              <span className="mx-1">•</span>
                              <span>{property.bedrooms || 0} cam.</span>
                              <span className="mx-1">•</span>
                              <span>{property.bathrooms || 0} bagni</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex justify-between">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              asChild
                            >
                              <Link href={`/properties/${property.id}`}>
                                <i className="fas fa-info-circle mr-1"></i> Dettagli
                              </Link>
                            </Button>
                            
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="text-xs"
                              asChild
                            >
                              <Link href={`/communications/whatsapp?clientId=${id}&propertyId=${property.id}`}>
                                <i className="fab fa-whatsapp mr-1"></i> Invia
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Possibili Immobili (Scraping Portali) Tab */}
          <TabsContent value="matching-shared" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Possibili Immobili</CardTitle>
                  <CardDescription>
                    {client?.buyer?.rating && client.buyer.rating >= 4
                      ? "Immobili trovati tramite Casafari API (Rating 4-5)" 
                      : "Immobili online (Immobiliare.it, Idealista) che corrispondono alle richieste del cliente"
                    }
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {client?.buyer?.rating && client.buyer.rating >= 4 && (
                    <Button 
                      onClick={async () => {
                        await refetchScrapedProperties();
                        await refetchSavedScrapedProperties();
                      }} 
                      disabled={isScrapedPropertiesLoading}
                      data-testid="button-refresh-scraped-properties"
                    >
                      {isScrapedPropertiesLoading ? (
                        <><i className="fas fa-spinner animate-spin mr-2"></i>Ricerca...</>
                      ) : (
                        <><i className="fas fa-sync mr-2"></i>Aggiorna</>
                      )}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {client?.buyer?.rating && client.buyer.rating < 4 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-star-half-alt"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Rating non sufficiente</h3>
                    <p>
                      Questa funzionalità è disponibile solo per clienti con rating 4 o 5.<br />
                      Rating attuale: {client?.buyer?.rating || 'N/A'}
                    </p>
                  </div>
                ) : isScrapedPropertiesLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                    <p className="text-gray-500">Ricerca immobili in corso...</p>
                  </div>
                ) : isSavedScrapedPropertiesLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                    <p className="text-gray-500">Caricamento immobili salvati...</p>
                  </div>
                ) : !savedScrapedProperties || savedScrapedProperties.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-search"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessun immobile salvato</h3>
                    <p>
                      Non ci sono immobili salvati nel database.<br />
                      Clicca "Aggiorna" per avviare lo scraping e trovare nuovi immobili.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Legenda colori */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        <i className="fas fa-info-circle mr-1"></i> Legenda Colori
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-red-50 border border-red-200 rounded"></div>
                          <span className="text-gray-700">Una sola agenzia</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-yellow-50 border border-yellow-200 rounded"></div>
                          <span className="text-gray-700">Più agenzie</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-50 border border-green-200 rounded"></div>
                          <span className="text-gray-700">Privato (con o senza agenzie)</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {savedScrapedProperties.map((property, idx) => {
                      const bgColor = property.classification === 'single-agency' ? 'bg-red-50' :
                                     property.classification === 'multiagency' ? 'bg-yellow-50' :
                                     property.classification === 'private' ? 'bg-green-50' :
                                     '';
                      return (
                      <Card key={`${property.portalSource}-${property.externalId}-${idx}`} className={`overflow-hidden ${bgColor}`} data-testid={`card-property-${idx}`}>
                        <div className="aspect-video relative bg-gray-100">
                          {property.imageUrls && property.imageUrls.length > 0 ? (
                            <img 
                              src={property.imageUrls[0]} 
                              alt={property.title} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              <i className="fas fa-building text-4xl"></i>
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 bg-white/80 hover:bg-white rounded-full"
                              onClick={() => handleToggleFavorite(property.id, property.isFavorite || false)}
                              data-testid={`button-favorite-${idx}`}
                            >
                              <i className={`${property.isFavorite ? 'fas' : 'far'} fa-heart text-red-500`}></i>
                            </Button>
                          </div>
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-primary-900/80 text-white">
                              € {property.price?.toLocaleString() || "N/D"}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg line-clamp-1">
                                <Link href={`/properties/shared/${property.id}`} className="hover:text-primary-600">
                                  {property.title}
                                </Link>
                              </h3>
                              <p className="text-sm text-gray-600 line-clamp-1">{property.address}</p>
                            </div>
                            <Badge variant="outline" className={
                              property.stage === "identified" ? "border-blue-400 text-blue-600" :
                              property.stage === "contacted" ? "border-amber-400 text-amber-600" :
                              property.stage === "visited" ? "border-green-400 text-green-600" :
                              property.stage === "negotiating" ? "border-purple-400 text-purple-600" :
                              "border-gray-400 text-gray-600"
                            }>
                              {property.stage === "identified" ? "Identificato" :
                               property.stage === "contacted" ? "Contattato" :
                               property.stage === "visited" ? "Visitato" :
                               property.stage === "negotiating" ? "In Trattativa" :
                               property.stage}
                            </Badge>
                          </div>
                          
                          <div className="flex justify-between mt-3 text-sm">
                            <div>
                              <span className="font-medium">{property.size} m²</span>
                              {property.bedrooms && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span>{property.bedrooms} cam.</span>
                                </>
                              )}
                              {property.bathrooms && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span>{property.bathrooms} bagni</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Multi-agency: show all agency links */}
                          {property.agencyVariants && property.agencyVariants.length > 1 ? (
                            <div className="mt-4">
                              <p className="text-xs font-semibold text-gray-700 mb-2">
                                <i className="fas fa-building mr-1"></i> 
                                Disponibile presso {property.agencyVariants.length} {property.agencyVariants.length === 1 ? 'agenzia' : 'agenzie'}:
                              </p>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {property.agencyVariants.map((variant, vIdx) => (
                                  <a
                                    key={`${variant.portalSource}-${variant.externalId}-${vIdx}`}
                                    href={variant.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between text-xs p-2 bg-white/50 hover:bg-white rounded border border-gray-200 hover:border-primary-300 transition-colors"
                                  >
                                    <span className="font-medium text-gray-900 truncate flex-1">
                                      {variant.agencyName}
                                    </span>
                                    <span className="text-gray-500 ml-2">
                                      <i className="fas fa-external-link-alt"></i>
                                    </span>
                                  </a>
                                ))}
                              </div>
                              <div className="mt-3 flex justify-between gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs flex-1"
                                  asChild
                                >
                                  <Link href={`/properties/shared/${property.id}`}>
                                    <i className="fas fa-info-circle mr-1"></i> Dettagli
                                  </Link>
                                </Button>
                                
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  className="text-xs flex-1"
                                  asChild
                                >
                                  <Link href={`/communications/whatsapp?clientId=${id}&sharedPropertyId=${property.id}`}>
                                    <i className="fab fa-whatsapp mr-1"></i> Invia
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 flex justify-between">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-xs"
                                asChild
                              >
                                <Link href={`/properties/shared/${property.id}`}>
                                  <i className="fas fa-info-circle mr-1"></i> Dettagli
                                </Link>
                              </Button>
                              
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="text-xs"
                                asChild
                              >
                                <Link href={`/communications/whatsapp?clientId=${id}&sharedPropertyId=${property.id}`}>
                                  <i className="fab fa-whatsapp mr-1"></i> Invia
                                </Link>
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      )
                    })}
                  </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Immobili da Inviare (Properties with Notification Status) Tab */}
          <TabsContent value="properties-notification-status" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Immobili da Inviare</CardTitle>
                  <CardDescription>
                    Immobili compatibili con il cliente e stato delle notifiche
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {isPropertiesWithNotificationsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !propertiesWithNotifications || propertiesWithNotifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-home"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessun immobile compatibile</h3>
                    <p>
                      Non ci sono immobili che corrispondono alle preferenze del cliente.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Immobile</TableHead>
                          <TableHead>Dettagli</TableHead>
                          <TableHead>Stato invio</TableHead>
                          <TableHead>Data invio</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {propertiesWithNotifications.map((property) => (
                          <TableRow key={property.id}>
                            <TableCell className="font-medium">
                              <Link href={`/properties/${property.id}`} className="text-primary-600 hover:underline">
                                {property.address}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{property.city}</span>
                                <span className="text-sm text-gray-500">{property.size} m² - €{property.price?.toLocaleString()}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {property.notificationStatus?.notified ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  <i className="fas fa-check mr-1"></i> Inviato
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                  <i className="fas fa-clock mr-1"></i> Non inviato
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {property.notificationStatus?.sentAt ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span>
                                        {format(new Date(property.notificationStatus.sentAt), "dd/MM/yyyy")}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{format(new Date(property.notificationStatus.sentAt), "dd/MM/yyyy HH:mm")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant={property.notificationStatus?.notified ? "outline" : "default"}
                                  className={property.notificationStatus?.notified ? "gap-1 border-green-600 text-green-600" : "gap-1"}
                                  onClick={() => handleSendPropertyNotification(property.id)}
                                  disabled={isSendingNotification && propertyBeingNotified === property.id}
                                >
                                  {isSendingNotification && propertyBeingNotified === property.id ? (
                                    <>
                                      <i className="fas fa-spinner animate-spin"></i>
                                      <span>Invio...</span>
                                    </>
                                  ) : property.notificationStatus?.notified ? (
                                    <>
                                      <i className="fas fa-paper-plane"></i>
                                      <span>Invia di nuovo</span>
                                    </>
                                  ) : (
                                    <>
                                      <i className="fas fa-paper-plane"></i>
                                      <span>Invia Notifica</span>
                                    </>
                                  )}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-slate-800"
                                  asChild
                                >
                                  <Link href={`/properties/${property.id}`}>
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
          
          {/* Immobili Inviati Tab */}
          <TabsContent value="sent-properties" className="space-y-6 mt-6">
            <SentPropertiesHistory clientId={id} />
          </TabsContent>

          {/* Matches Today Tab */}
          <TabsContent value="matches-today" className="space-y-6 mt-6">
            <ClientMatchesToday clientId={id} />
          </TabsContent>

          {/* Interactions History Tab */}
          <TabsContent value="interactions-history" className="space-y-6 mt-6">
            <ClientInteractionsHistory clientId={id} days={30} />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* WhatsApp Modal */}
      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen} 
        onClose={() => setIsWhatsAppModalOpen(false)} 
        client={client}
      />
      
      {/* AI Assistant Response Modal */}
      <AIAssistantResponseModal
        isOpen={isAIResponseModalOpen}
        onClose={() => setIsAIResponseModalOpen(false)}
        client={client}
        incomingMessage={incomingMessage}
        aiGeneratedResponse={aiGeneratedResponse}
        detectedProperties={detectedProperties}
        conversationThread={conversationThread}
      />

      {/* All Competitor Properties Modal */}
      <Dialog open={isCompetitorModalOpen} onOpenChange={setIsCompetitorModalOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tutti gli Immobili dei Concorrenti in Target</DialogTitle>
            <DialogDescription>
              Immobili che corrispondono alle preferenze del cliente (rating {client?.buyer?.rating}/5)
            </DialogDescription>
          </DialogHeader>
          
          {isAllCompetitorPropertiesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : !allCompetitorProperties || allCompetitorProperties.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">
                <i className="fas fa-search"></i>
              </div>
              <h3 className="text-lg font-medium mb-2">Nessun immobile trovato</h3>
              <p>Non sono stati trovati immobili dei concorrenti che corrispondono alle preferenze del cliente.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                  <span>Privato</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                  <span>Duplicato (Multi-Agency)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                  <span>Singolo Agency</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allCompetitorProperties.map((property: any) => (
                  <Card 
                    key={property.id} 
                    className={`overflow-hidden ${
                      property.isPrivate ? 'bg-green-50 border-green-200' :
                      property.isDuplicate ? 'bg-yellow-50 border-yellow-200' :
                      property.isSingleAgency ? 'bg-red-50 border-red-200' :
                      ''
                    }`}
                    data-testid={`card-competitor-property-${property.id}`}
                  >
                    <div className="aspect-video relative bg-gray-100">
                      {property.images && property.images.length > 0 ? (
                        <img 
                          src={property.images[0]} 
                          alt={property.address} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <i className="fas fa-building text-4xl"></i>
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-primary-900/80 text-white">
                          € {property.price?.toLocaleString() || "N/D"}
                        </Badge>
                      </div>
                      <div className="absolute top-2 left-2">
                        {property.isPrivate && (
                          <Badge className="bg-green-600 text-white">
                            <i className="fas fa-user mr-1"></i>Privato
                          </Badge>
                        )}
                        {property.isDuplicate && (
                          <Badge className="bg-yellow-600 text-white">
                            <i className="fas fa-copy mr-1"></i>Duplicato
                          </Badge>
                        )}
                        {property.isSingleAgency && (
                          <Badge className="bg-red-600 text-white">
                            <i className="fas fa-store mr-1"></i>Agency
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg line-clamp-1">
                            {property.address}
                          </h3>
                          <p className="text-sm text-gray-600">{property.city}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between mt-3 text-sm text-gray-700">
                        <div>
                          <span className="font-medium">{property.size} m²</span>
                          {property.bedrooms && (
                            <>
                              <span className="mx-1">•</span>
                              <span>{property.bedrooms} cam.</span>
                            </>
                          )}
                          {property.bathrooms && (
                            <>
                              <span className="mx-1">•</span>
                              <span>{property.bathrooms} bagni</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {property.source && (
                        <div className="mt-3 text-xs text-gray-500">
                          Fonte: {property.source}
                        </div>
                      )}
                      
                      <div className="mt-4 flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 text-xs"
                          asChild
                        >
                          {property.url && (property.url.startsWith('http://') || property.url.startsWith('https://')) ? (
                            <a href={property.url} target="_blank" rel="noopener noreferrer">
                              <i className="fas fa-info-circle mr-1"></i> Dettagli
                            </a>
                          ) : (
                            <Link href={property.url || `/properties/${property.id}`}>
                              <i className="fas fa-info-circle mr-1"></i> Dettagli
                            </Link>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}