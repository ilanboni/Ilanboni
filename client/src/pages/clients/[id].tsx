import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
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
import { WhatsAppModal } from "@/components/communications/WhatsAppModal";
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
  
  // Fetch matching properties (per client compratori)
  const { data: matchingProperties, isLoading: isMatchingPropertiesLoading } = useQuery({
    queryKey: [`/api/clients/${id}/matching-properties`],
    enabled: !isNaN(id) && client?.type === "buyer",
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/matching-properties`);
      if (!response.ok) {
        if (response.status === 400) {
          return []; // Il cliente non è un compratore
        }
        throw new Error('Errore nel caricamento degli immobili compatibili');
      }
      return response.json();
    }
  });
  
  // Fetch matching shared properties
  const { data: matchingSharedProperties, isLoading: isMatchingSharedPropertiesLoading } = useQuery({
    queryKey: [`/api/clients/${id}/matching-shared-properties`],
    enabled: !isNaN(id) && client?.type === "buyer",
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/matching-shared-properties`);
      if (!response.ok) {
        if (response.status === 400) {
          return []; // Il cliente non è un compratore
        }
        throw new Error('Errore nel caricamento delle proprietà condivise compatibili');
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
                {client?.salutation} {client?.firstName} {client?.lastName}
              </h1>
              <div className="flex items-center mt-1 space-x-2">
                {formatClientType(client?.type || "")}
                {client?.isFriend && (
                  <Badge variant="outline" className="border-blue-300 text-blue-500">
                    Amico
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              asChild
            >
              <Link href="/clients">
                <div className="px-2 py-1">
                  <i className="fas fa-arrow-left mr-2"></i> Indietro
                </div>
              </Link>
            </Button>
            
            <Button 
              variant="outline"
              asChild
              className="gap-2"
            >
              <Link href={`/clients/${id}/edit`}>
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
          </div>
        </div>
        
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-7 md:w-[960px]">
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="communications">Comunicazioni</TabsTrigger>
            <TabsTrigger value="appointments">Appuntamenti</TabsTrigger>
            <TabsTrigger value="tasks">Note e Attività</TabsTrigger>
            {client?.type === 'buyer' && (
              <>
                <TabsTrigger value="matching-properties">Immobili compatibili</TabsTrigger>
                <TabsTrigger value="matching-shared">Possibili immobili</TabsTrigger>
              </>
            )}
            <TabsTrigger value="sent-properties">Immobili inviati</TabsTrigger>
          </TabsList>
          
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
                <CardTitle>Comunicazioni</CardTitle>
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
                              {formatDistanceToNow(new Date(comm.createdAt), {
                                addSuffix: true,
                                locale: it,
                              })}
                            </TableCell>
                            <TableCell className="font-medium">
                              <Link href={`/communications/${comm.id}`}>
                                <div className="hover:text-primary-700 cursor-pointer">
                                  {comm.subject}
                                </div>
                              </Link>
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
                <Button 
                  variant="default"
                  className="gap-2"
                  asChild
                >
                  <Link href={`/appointments/new?clientId=${id}`}>
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
                  <Link href={`/tasks/new?clientId=${id}`}>
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
                      Non ci sono note o attività registrate per questo cliente.
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
                                    <div className="max-w-[300px] truncate cursor-help">
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
          
          {/* Immobili Compatibili Tab */}
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
          
          {/* Possibili Immobili (Proprietà Condivise) Tab */}
          <TabsContent value="matching-shared" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Possibili Immobili</CardTitle>
                  <CardDescription>Proprietà condivise che potrebbero interessare il cliente</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {isMatchingSharedPropertiesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !matchingSharedProperties || matchingSharedProperties.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-building"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessuna proprietà condivisa</h3>
                    <p>
                      Non ci sono proprietà condivise compatibili con le preferenze del cliente.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {matchingSharedProperties.map((property) => (
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
                              <i className="fas fa-building text-4xl"></i>
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
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Immobili Inviati Tab */}
          <TabsContent value="sent-properties" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Immobili Inviati</CardTitle>
                  <CardDescription>Immobili presentati al cliente in precedenza</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {isSentPropertiesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !sentProperties || sentProperties.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-paper-plane"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessun immobile inviato</h3>
                    <p>
                      Non ci sono immobili inviati a questo cliente.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sentProperties.map((property) => (
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
                                <i className="fab fa-whatsapp mr-1"></i> Invia di nuovo
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
        </Tabs>
      </div>
      
      {/* WhatsApp Modal */}
      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen} 
        onClose={() => setIsWhatsAppModalOpen(false)} 
        client={client}
      />
    </>
  );
}