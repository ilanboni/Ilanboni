import { useState } from "react";
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

export default function CommunicationsPage() {
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterManagementStatus, setFilterManagementStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
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
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" },
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
  const getClientName = (clientId: number, subject?: string) => {
    const client = clients?.find(c => c.id === clientId);
    
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
              
              {(filterType || filterStatus || searchQuery) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilterType("");
                    setFilterStatus("");
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
                          {formatDistanceToNow(new Date(comm.createdAt), {
                            addSuffix: true,
                            locale: it,
                          })}
                        </TableCell>
                        <TableCell>
                          <Link href={`/clients/${comm.clientId}`}>
                            <div className="text-primary-700 hover:underline cursor-pointer">
                              {getClientName(comm.clientId, comm.subject)}
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
                                onClick={() => createClientMutation.mutate(comm.id)}
                                disabled={createClientMutation.isPending || !comm.propertyId}
                              >
                                <i className="fas fa-user-plus mr-2 text-blue-600"></i>
                                Crea cliente
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
    </>
  );
}