import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Communication } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Appointment form schema
const appointmentFormSchema = z.object({
  salutation: z.string().min(1, "Appellativo richiesto"),
  lastName: z.string().min(1, "Cognome richiesto"),
  phone: z.string().min(1, "Numero di telefono richiesto"),
  date: z.date({
    required_error: "Data richiesta",
  }),
  time: z.string().min(1, "Ora richiesta"),
  address: z.string().min(1, "Indirizzo richiesto"),
});

type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

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
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Extract contact information from communication using backend API
  useEffect(() => {
    if (communication && isOpen) {
      setIsExtracting(true);
      fetch(`/api/communications/${communication.id}/extract-contact`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setExtractedData(data.extractedData);
          } else {
            setExtractedData({ firstName: "", lastName: "", phone: "", type: "buyer", hasProperty: false });
          }
        })
        .catch(error => {
          console.error('Error extracting contact data:', error);
          setExtractedData({ firstName: "", lastName: "", phone: "", type: "buyer", hasProperty: false });
        })
        .finally(() => {
          setIsExtracting(false);
        });
    }
  }, [communication, isOpen]);

  const contactInfo = extractedData ? {
    hasName: !!(extractedData.firstName || extractedData.lastName),
    name: extractedData.firstName || "",
    lastName: extractedData.lastName || "",
    phone: extractedData.phone || ""
  } : { hasName: false, name: "", lastName: "", phone: "" };
  
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
      lastName: "",
      phone: "",
      date: undefined,
      time: "",
      address: "",
    },
  });

  // Update form values when extracted data is available
  useEffect(() => {
    if (extractedData) {
      form.setValue("lastName", extractedData.lastName || "");
      form.setValue("phone", extractedData.phone || "");
    }
  }, [extractedData, form]);

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
          <DialogDescription>
            {isExtracting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Estrazione dati contatto in corso...
              </div>
            )}
          </DialogDescription>
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

export default function CommunicationsPage() {
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterManagementStatus, setFilterManagementStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showCreateAppointmentDialog, setShowCreateAppointmentDialog] = useState(false);
  const [appointmentCommunication, setAppointmentCommunication] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch all communications
  const { data: communications, isLoading } = useQuery<Communication[]>({
    queryKey: ["/api/communications"],
  });
  
  // Fetch all clients for name display
  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  // Mutation for updating management status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest(`/api/communications/${id}/management-status`, {
        method: "PATCH",
        data: { status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      toast({
        title: "Stato aggiornato",
        description: "Lo stato di gestione è stato aggiornato con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Errore durante l'aggiornamento dello stato.",
        variant: "destructive",
      });
    },
  });

  // State for client creation dialog
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [selectedCommunicationForClient, setSelectedCommunicationForClient] = useState<any>(null);

  // Mutation for creating client from communication
  const createClientMutation = useMutation({
    mutationFn: async (communicationId: number) => {
      return apiRequest(`/api/communications/${communicationId}/create-client`, {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setClientDialogOpen(false);
      setSelectedCommunicationForClient(null);
      toast({
        title: "Cliente creato",
        description: data.message || "Cliente creato con successo dalla comunicazione.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Errore durante la creazione del cliente.",
        variant: "destructive",
      });
    },
  });
  
  // Function to get client name by id and detect unknown numbers
  const getClientName = (clientId: number | null, subject?: string) => {
    const client = clients?.find((c: any) => c.id === clientId);
    
    // Verifica se è un messaggio da numero non registrato
    if (subject && subject.includes("da numero non registrato")) {
      // Estrae il numero di telefono dal soggetto, se presente
      const phoneMatch = subject.match(/\(([^)]+)\)/);
      const phoneNumber = phoneMatch ? phoneMatch[1] : "";
      
      return (
        <div className="flex flex-col">
          <span>{client ? `${client.firstName} ${client.lastName}` : `Cliente #${clientId}`}</span>
          <span className="text-xs font-medium text-orange-600 bg-orange-50 rounded px-1.5 py-0.5 inline-block mt-1">
            <i className="fas fa-exclamation-circle mr-1"></i> 
            Numero non registrato: {phoneNumber}
          </span>
        </div>
      );
    }
    
    return client ? `${client.firstName} ${client.lastName}` : `Cliente #${clientId}`;
  };
  // Apply filters and search to communications
  const filteredCommunications = communications?.filter((comm) => {
    // Filter by type
    if (filterType && filterType !== "all" && comm.type !== filterType) return false;
    
    // Filter by status
    if (filterStatus && filterStatus !== "all" && comm.status !== filterStatus) return false;
    
    // Filter by management status
    if (filterManagementStatus && filterManagementStatus !== "all") {
      const commStatus = (comm as any).managementStatus || "to_manage";
      if (commStatus !== filterManagementStatus) return false;
    }
    
    // Search in subject or content
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSubject = comm.subject.toLowerCase().includes(query);
      const matchesContent = comm.content?.toLowerCase().includes(query) || false;
      
      if (!matchesSubject && !matchesContent) return false;
    }
    
    return true;
  });
  
  // Get communication type badge color
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
  
  // Get status badge color
  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case "new":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Nuovo</Badge>;
      case "ongoing":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In corso</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completato</Badge>;
      case "pending":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">In attesa</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  // Get direction icon
  const getDirectionIcon = (direction: string) => {
    return direction === "inbound" 
      ? <span className="text-green-600"><i className="fas fa-arrow-down"></i></span>
      : <span className="text-blue-600"><i className="fas fa-arrow-up"></i></span>;
  };

  // Handle appointment creation
  const handleCreateAppointment = (communication: any) => {
    setAppointmentCommunication(communication);
    setShowCreateAppointmentDialog(true);
  };

  // Get management status badge
  const getManagementStatusBadge = (status: string | null | undefined) => {
    if (!status) status = "to_manage";
    
    switch (status) {
      case "to_manage":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Da gestire</Badge>;
      case "managed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Gestita</Badge>;
      case "client_created":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Cliente creato</Badge>;
      case "appointment_created":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Appuntamento creato</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  return (
    <>
      <Helmet>
        <title>Comunicazioni | Gestionale Immobiliare</title>
        <meta name="description" content="Gestisci le comunicazioni con i clienti nel sistema di gestione immobiliare" />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Comunicazioni</h1>
            <p className="text-gray-500 mt-1">
              Gestisci e traccia tutte le comunicazioni con i clienti
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/communications/whatsapp">
              <Button variant="outline" className="gap-2 border-green-600 text-green-600 hover:bg-green-50">
                <i className="fab fa-whatsapp"></i>
                <span>Invia WhatsApp</span>
              </Button>
            </Link>
            <Link href="/communications/new">
              <Button className="gap-2">
                <i className="fas fa-plus"></i>
                <span>Nuova Comunicazione</span>
              </Button>
            </Link>
          </div>
        </div>
        
        <Separator />
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Filtri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="w-full md:w-64">
                <Input
                  placeholder="Cerca per oggetto o contenuto"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="w-full md:w-48">
                <Select
                  value={filterType}
                  onValueChange={setFilterType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo comunicazione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i tipi</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Telefono</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="meeting">Incontro</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full md:w-48">
                <Select
                  value={filterStatus}
                  onValueChange={setFilterStatus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli stati</SelectItem>
                    <SelectItem value="new">Nuovo</SelectItem>
                    <SelectItem value="ongoing">In corso</SelectItem>
                    <SelectItem value="completed">Completato</SelectItem>
                    <SelectItem value="pending">In attesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-48">
                <Select
                  value={filterManagementStatus}
                  onValueChange={setFilterManagementStatus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Gestione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le gestioni</SelectItem>
                    <SelectItem value="to_manage">Da gestire</SelectItem>
                    <SelectItem value="managed">Gestita</SelectItem>
                    <SelectItem value="client_created">Cliente creato</SelectItem>
                    <SelectItem value="appointment_created">Appuntamento creato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(filterType || filterStatus || filterManagementStatus || searchQuery) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilterType("");
                    setFilterStatus("");
                    setFilterManagementStatus("");
                    setSearchQuery("");
                  }}
                  className="ml-auto"
                >
                  <i className="fas fa-times mr-2"></i>
                  Cancella filtri
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Elenco comunicazioni</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : filteredCommunications?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-5xl mb-4">
                  <i className="fas fa-inbox"></i>
                </div>
                <h3 className="text-lg font-medium mb-2">Nessuna comunicazione trovata</h3>
                <p>
                  {searchQuery || filterType || filterStatus
                    ? "Prova a modificare i filtri di ricerca"
                    : "Inizia aggiungendo una nuova comunicazione"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Dir.</TableHead>
                      <TableHead className="w-32">Tipo</TableHead>
                      <TableHead className="w-48">Data</TableHead>
                      <TableHead className="w-56">Cliente</TableHead>
                      <TableHead className="w-48">Oggetto</TableHead>
                      <TableHead>Contenuto</TableHead>
                      <TableHead className="w-32">Stato</TableHead>
                      <TableHead className="w-36">Gestione</TableHead>
                      <TableHead className="w-24">Follow-up</TableHead>
                      <TableHead className="w-20 text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommunications?.map((comm) => (
                      <TableRow key={comm.id}>
                        <TableCell>{getDirectionIcon(comm.direction)}</TableCell>
                        <TableCell>{getTypeBadge(comm.type)}</TableCell>
                        <TableCell className="text-sm">
                          {comm.createdAt ? formatDistanceToNow(new Date(comm.createdAt), {
                            addSuffix: true,
                            locale: it,
                          }) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Link href={`/clients/${comm.clientId}`}>
                            <div className="text-primary-700 hover:underline cursor-pointer">
                              {getClientName(comm.clientId || null, comm.subject)}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/communications/${comm.id}`}>
                            <div className="hover:text-primary-700 cursor-pointer">
                              {comm.subject}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm text-gray-600">
                          {comm.content || ""}
                        </TableCell>
                        <TableCell>{comm.status === "pending" ? <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">In attesa</Badge> : getStatusBadge(comm.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                {getManagementStatusBadge((comm as any).managementStatus)}
                                <i className="fas fa-chevron-down text-xs"></i>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: comm.id, status: "to_manage" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                <i className="fas fa-clock mr-2 text-orange-600"></i>
                                Da gestire
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: comm.id, status: "managed" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                <i className="fas fa-check mr-2 text-green-600"></i>
                                Gestita
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedCommunicationForClient(comm);
                                  setClientDialogOpen(true);
                                }}
                                disabled={!comm.propertyId}
                              >
                                <i className="fas fa-user-plus mr-2 text-blue-600"></i>
                                Crea cliente
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleCreateAppointment(comm)}
                                disabled={false}
                              >
                                <i className="fas fa-calendar-plus mr-2 text-purple-600"></i>
                                Crea appuntamento
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          {comm.needsFollowUp === true && (
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
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/communications/${comm.id}/edit`}>
                                <i className="fas fa-edit"></i>
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
      </div>

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
          toast({
            title: "Successo",
            description: "Appuntamento creato con successo e conferma inviata via WhatsApp",
          });
        }}
      />

      {/* Create Client Dialog */}
      <CreateClientDialog 
        isOpen={clientDialogOpen}
        onClose={() => {
          setClientDialogOpen(false);
          setSelectedCommunicationForClient(null);
        }}
        communication={selectedCommunicationForClient}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
          setClientDialogOpen(false);
          setSelectedCommunicationForClient(null);
          toast({
            title: "Cliente creato",
            description: "Cliente creato con successo dalla comunicazione",
          });
        }}
      />
    </>
  );
}

// Create Client Dialog Component
function CreateClientDialog({ 
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
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch extracted contact information when dialog opens
  useEffect(() => {
    if (isOpen && communication) {
      setIsLoading(true);
      fetch(`/api/communications/${communication.id}/extract-contact`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setExtractedData(data.extractedData);
          }
        })
        .catch(error => {
          console.error('Error extracting contact info:', error);
          toast({
            title: "Errore",
            description: "Impossibile estrarre le informazioni di contatto.",
            variant: "destructive",
          });
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, communication, toast]);

  const handleCreateClient = async () => {
    if (!communication) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/communications/${communication.id}/create-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error('Failed to create client');
      }
      
      const result = await response.json();
      onSuccess();
      toast({
        title: "Cliente creato",
        description: result.message || "Cliente creato con successo dalla comunicazione.",
      });
    } catch (error) {
      console.error('Error creating client:', error);
      toast({
        title: "Errore",
        description: "Errore durante la creazione del cliente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crea Cliente da Comunicazione</DialogTitle>
          <DialogDescription>
            Verifica le informazioni estratte prima di creare il cliente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : extractedData ? (
          <div className="space-y-6">
            {/* Extracted Information Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-sm text-gray-700 mb-3">Informazioni Estratte:</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Nome</label>
                  <p className="text-sm">{extractedData.firstName || "Non specificato"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Cognome</label>
                  <p className="text-sm">{extractedData.lastName || "Non specificato"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Telefono</label>
                  <p className="text-sm">{extractedData.phone || "Non specificato"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Tipo Cliente</label>
                  <p className="text-sm">Compratore</p>
                </div>
              </div>
            </div>

            {/* Communication Details */}
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm text-gray-700 mb-3">Dettagli Comunicazione:</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-500">Oggetto</label>
                  <p className="text-sm">{communication.subject}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Contenuto (anteprima)</label>
                  <p className="text-sm text-gray-600 max-h-20 overflow-y-auto">
                    {communication.content?.substring(0, 200)}
                    {communication.content?.length > 200 && "..."}
                  </p>
                </div>
              </div>
            </div>

            {/* Property Connection Status */}
            {extractedData.hasProperty ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <i className="fas fa-check-circle"></i>
                Cliente verrà collegato all'immobile associato alla comunicazione
              </div>
            ) : (
              <div className="flex items-center gap-2 text-orange-600 text-sm">
                <i className="fas fa-exclamation-triangle"></i>
                Comunicazione non associata a un immobile specifico
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nessuna informazione disponibile per l'estrazione
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annulla
          </Button>
          <Button 
            onClick={handleCreateClient} 
            disabled={isLoading || !extractedData?.hasProperty}
            className="gap-2"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Crea Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}