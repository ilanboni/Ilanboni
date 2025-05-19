import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Appointment, ClientWithDetails, PropertyWithDetails } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  Edit, 
  Trash, 
  MessageSquare,
  Phone,
  Home,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { formatTime, formatDate } from "@/lib/utils";
import { Helmet } from "react-helmet";
import { queryClient } from "@/lib/queryClient";
import AppointmentForm from "@/components/appointments/AppointmentForm";

export default function AppointmentsPage() {
  const { toast } = useToast();
  
  // State for filtering and view
  const [view, setView] = useState<"calendar" | "list">("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  
  // State for dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  // Fetch appointments, clients, properties
  const { data: appointments, isLoading, isError } = useQuery({
    queryKey: ['/api/appointments', statusFilter],
    queryFn: async () => {
      // This would be a real API call
      const response = await fetch('/api/appointments');
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }
      return await response.json();
    }
  });
  
  const { data: clients } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      // This would be a real API call
      const response = await fetch('/api/clients');
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      return await response.json();
    }
  });
  
  const { data: properties } = useQuery({
    queryKey: ['/api/properties'],
    queryFn: async () => {
      // This would be a real API call
      const response = await fetch('/api/properties');
      if (!response.ok) {
        throw new Error('Failed to fetch properties');
      }
      return await response.json();
    }
  });
  
  // Mutations for appointments
  const createAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/appointments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      setIsCreateOpen(false);
      toast({
        title: "Appuntamento creato",
        description: "L'appuntamento è stato creato con successo."
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione dell'appuntamento.",
        variant: "destructive"
      });
    }
  });
  
  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', `/api/appointments/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      setIsEditOpen(false);
      setSelectedAppointment(null);
      toast({
        title: "Appuntamento aggiornato",
        description: "L'appuntamento è stato aggiornato con successo."
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dell'appuntamento.",
        variant: "destructive"
      });
    }
  });
  
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      toast({
        title: "Appuntamento eliminato",
        description: "L'appuntamento è stato eliminato con successo."
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione dell'appuntamento.",
        variant: "destructive"
      });
    }
  });
  
  // Handle actions
  const handleCreateAppointment = (data: any) => {
    createAppointmentMutation.mutate(data);
  };
  
  const handleEditAppointment = (data: any) => {
    updateAppointmentMutation.mutate({
      ...data,
      id: selectedAppointment?.id
    });
  };
  
  const handleDeleteAppointment = (appointment: Appointment) => {
    if (confirm(`Sei sicuro di voler eliminare questo appuntamento?`)) {
      deleteAppointmentMutation.mutate(appointment.id);
    }
  };
  
  const handleOpenEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsEditOpen(true);
  };
  
  const handleSendReminder = async (appointment: Appointment) => {
    try {
      await apiRequest('POST', `/api/appointments/${appointment.id}/reminder`);
      toast({
        title: "Promemoria inviato",
        description: "Il promemoria è stato inviato al cliente."
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio del promemoria.",
        variant: "destructive"
      });
    }
  };
  
  // Format appointment type and status
  const getAppointmentTypeIcon = (type: string) => {
    return type === "visit" ? <Home className="h-4 w-4" /> : <Phone className="h-4 w-4" />;
  };
  
  const getAppointmentStatusIcon = (status: string) => {
    switch (status) {
      case "scheduled":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };
  
  const getAppointmentStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700">Programmato</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700">Completato</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-700">Annullato</Badge>;
      default:
        return null;
    }
  };
  
  const getAppointmentTypeBadge = (type: string) => {
    return type === "visit" 
      ? <Badge variant="outline" className="bg-blue-50 text-blue-700">Visita</Badge>
      : <Badge variant="outline" className="bg-purple-50 text-purple-700">Telefonata</Badge>;
  };
  
  // Create empty state component
  const EmptyState = () => (
    <div className="text-center py-10">
      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <CalendarIcon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900">Nessun appuntamento trovato</h3>
      <p className="mt-1 text-sm text-gray-500">
        {searchQuery 
          ? "Nessun appuntamento corrisponde ai criteri di ricerca." 
          : "Inizia aggiungendo un nuovo appuntamento."}
      </p>
      <div className="mt-6">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Appuntamento
        </Button>
      </div>
    </div>
  );
  
  return (
    <>
      <Helmet>
        <title>Gestione Appuntamenti | RealEstate CRM</title>
        <meta name="description" content="Gestisci gli appuntamenti con i clienti, programma visite e telefonate." />
      </Helmet>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Appuntamenti</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestisci le tue visite e telefonate con i clienti
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Appuntamento
          </Button>
        </div>
      </div>
      
      {/* Filters and View Toggle */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Cerca appuntamento per cliente, immobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Filter and View Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Tabs 
              value={statusFilter} 
              onValueChange={setStatusFilter}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">Tutti</TabsTrigger>
                <TabsTrigger value="scheduled">Programmati</TabsTrigger>
                <TabsTrigger value="completed">Completati</TabsTrigger>
                <TabsTrigger value="cancelled">Annullati</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Tabs 
              value={view} 
              onValueChange={(v) => setView(v as "calendar" | "list")}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list">Lista</TabsTrigger>
                <TabsTrigger value="calendar">Calendario</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>
      
      {/* Appointments List or Calendar View */}
      {isLoading ? (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center">
                <Skeleton className="h-12 w-12 rounded-full mr-4" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex space-x-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">
          Si è verificato un errore durante il caricamento degli appuntamenti. Riprova più tardi.
        </div>
      ) : appointments && appointments.length > 0 ? (
        view === "list" ? (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data e Ora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Immobile</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment: Appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell className="font-medium">
                      {formatDate(appointment.date)}<br />
                      <span className="text-sm text-gray-500">{formatTime(appointment.time)}</span>
                    </TableCell>
                    <TableCell>
                      {appointment.client ? (
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center mr-2">
                            <i className={`fas ${appointment.client.type === 'buyer' ? 'fa-user-tie' : 'fa-user'}`}></i>
                          </div>
                          <div>
                            {appointment.client.firstName} {appointment.client.lastName}
                            <div className="text-xs text-gray-500">
                              {appointment.client.type === 'buyer' ? 'Compratore' : 'Venditore'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Cliente non disponibile</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {appointment.property ? (
                        <div>
                          {appointment.property.address}
                          <div className="text-xs text-gray-500">
                            {appointment.property.size}m² - {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(appointment.property.price)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Immobile non disponibile</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getAppointmentTypeBadge(appointment.type)}
                    </TableCell>
                    <TableCell>
                      {getAppointmentStatusBadge(appointment.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleSendReminder(appointment)}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(appointment)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAppointment(appointment)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="mb-4 flex justify-center">
              <div className="inline-block bg-white rounded-lg shadow p-2">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => date && setSelectedMonth(date)}
                  className="rounded-md border"
                />
              </div>
            </div>
            
            <div className="mt-6 grid gap-4">
              {/* This would display appointments for the selected month/day */}
              <h3 className="font-medium text-gray-800">
                Appuntamenti per {selectedMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
              </h3>
              
              {appointments
                .filter((app: Appointment) => {
                  const appDate = new Date(app.date);
                  return (
                    appDate.getMonth() === selectedMonth.getMonth() && 
                    appDate.getFullYear() === selectedMonth.getFullYear()
                  );
                })
                .map((appointment: Appointment) => (
                  <div 
                    key={appointment.id} 
                    className="flex items-center p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-shrink-0 w-16 text-center">
                      <div className="text-lg font-bold">
                        {new Date(appointment.date).getDate()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTime(appointment.time)}
                      </div>
                    </div>
                    
                    <div className="ml-4 flex-grow">
                      <div className="flex items-center">
                        <span className="font-medium">
                          {appointment.client?.firstName} {appointment.client?.lastName}
                        </span>
                        <span className="mx-2">•</span>
                        <span className="text-gray-600">
                          {appointment.property?.address}
                        </span>
                      </div>
                      <div className="flex mt-1">
                        {getAppointmentTypeBadge(appointment.type)}
                        <span className="mx-1"></span>
                        {getAppointmentStatusBadge(appointment.status)}
                      </div>
                    </div>
                    
                    <div className="ml-auto flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleSendReminder(appointment)}>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(appointment)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAppointment(appointment)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )
      ) : (
        <EmptyState />
      )}
      
      {/* Create Appointment Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nuovo Appuntamento</DialogTitle>
          </DialogHeader>
          
          {clients && properties && (
            <AppointmentForm
              clients={clients as ClientWithDetails[]}
              properties={properties as PropertyWithDetails[]}
              onSubmit={handleCreateAppointment}
              onCancel={() => setIsCreateOpen(false)}
              isSubmitting={createAppointmentMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Edit Appointment Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Modifica Appuntamento</DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && clients && properties && (
            <AppointmentForm
              initialData={selectedAppointment}
              clients={clients as ClientWithDetails[]}
              properties={properties as PropertyWithDetails[]}
              onSubmit={handleEditAppointment}
              onCancel={() => setIsEditOpen(false)}
              isSubmitting={updateAppointmentMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
