import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ClientType } from "@/types";
import { ClientWithDetails } from "@shared/schema";
import ClientCard from "@/components/clients/ClientCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Search, Filter } from "lucide-react";
import { Helmet } from "react-helmet";

export default function ClientsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // State for filtering
  const [clientTypeFilter, setClientTypeFilter] = useState<ClientType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  
  // State for dialog
  const [clientToView, setClientToView] = useState<ClientWithDetails | null>(null);
  
  // Fetch clients
  const { data: clients, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/clients', clientTypeFilter, searchQuery, sortOrder],
    queryFn: async () => {
      try {
        // Usa la vera API per ottenere i clienti
        const params = new URLSearchParams();
        if (clientTypeFilter !== "all") {
          params.append("type", clientTypeFilter);
        }
        if (searchQuery) {
          params.append("search", searchQuery);
        }
        
        const url = `/api/clients${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await apiRequest('GET', url);
        const data = await response.json();
        
        let clients = Array.isArray(data) ? data : [];
        
        // Ordina i risultati
        if (sortOrder === "newest") {
          clients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (sortOrder === "oldest") {
          clients.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        } else if (sortOrder === "name") {
          clients.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
        }
        
        return clients;
      } catch (error) {
        console.error("Errore nel recupero dei clienti:", error);
        return [];
      }
    }
  });
  
  // Handle client actions
  const handleEditClient = (client: ClientWithDetails) => {
    // Usa la route modify/ID che è più esplicita e ci permette di controllare meglio 
    navigate(`/clients/modify/${client.id}`);
  };
  
  const handleViewClient = (client: ClientWithDetails) => {
    setClientToView(client);
  };
  
  const handleDeleteClient = async (client: ClientWithDetails) => {
    try {
      // Chiama la vera API per eliminare il cliente
      const response = await apiRequest('DELETE', `/api/clients/${client.id}`);
      await response.json(); // Processa la risposta anche se non la utilizziamo
      
      toast({
        title: "Cliente eliminato",
        description: `${client.firstName} ${client.lastName} è stato eliminato con successo.`,
      });
      
      refetch();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del cliente.",
        variant: "destructive",
      });
    }
  };
  
  const handleSendWhatsApp = (client: ClientWithDetails) => {
    toast({
      title: "WhatsApp",
      description: `Invio messaggio WhatsApp a ${client.firstName} ${client.lastName}...`,
    });
    // This would integrate with WhatsApp API
  };
  
  // Create empty state component
  const EmptyState = () => (
    <div className="text-center py-10">
      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <i className="fas fa-users text-gray-400 text-xl"></i>
      </div>
      <h3 className="text-lg font-medium text-gray-900">Nessun cliente trovato</h3>
      <p className="mt-1 text-sm text-gray-500">
        {searchQuery 
          ? "Nessun cliente corrisponde ai criteri di ricerca." 
          : "Inizia aggiungendo un nuovo cliente."}
      </p>
      <div className="mt-6">
        <Button onClick={() => navigate("/clients/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Aggiungi Cliente
        </Button>
      </div>
    </div>
  );
  
  return (
    <>
      <Helmet>
        <title>Gestione Clienti | RealEstate CRM</title>
        <meta name="description" content="Gestisci i tuoi clienti compratori e venditori, visualizza dettagli e informazioni di contatto." />
      </Helmet>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Clienti</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestisci i tuoi clienti compratori e venditori
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => navigate("/clients/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Cliente
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Cerca cliente per nome, email o telefono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Tabs 
              value={clientTypeFilter} 
              onValueChange={(value) => setClientTypeFilter(value as ClientType | "all")}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">Tutti</TabsTrigger>
                <TabsTrigger value="buyer">Compratori</TabsTrigger>
                <TabsTrigger value="seller">Venditori</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Ordinamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Più recenti</SelectItem>
                <SelectItem value="oldest">Più vecchi</SelectItem>
                <SelectItem value="name">Nome (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Client List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex justify-between mb-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="flex justify-end mt-4">
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">
          Si è verificato un errore durante il caricamento dei clienti. Riprova più tardi.
        </div>
      ) : clients && clients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onView={handleViewClient}
              onEdit={handleEditClient}
              onDelete={handleDeleteClient}
              onSendWhatsApp={handleSendWhatsApp}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
      
      {/* Client View Dialog */}
      <Dialog open={!!clientToView} onOpenChange={() => setClientToView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Dettagli Cliente</DialogTitle>
          </DialogHeader>
          
          {clientToView && (
            <div className="mt-4">
              <ClientCard 
                client={clientToView}
                onView={() => {}}
                onEdit={handleEditClient}
                onDelete={handleDeleteClient}
                onSendWhatsApp={handleSendWhatsApp}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
