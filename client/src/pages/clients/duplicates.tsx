import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Users, Phone, MessageCircle, Calendar, AlertTriangle, Merge } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface DuplicateClient {
  id: number;
  type: string;
  salutation: string;
  firstName: string;
  lastName: string;
  isFriend: boolean;
  email: string;
  phone: string;
  religion: string | null;
  birthday: string | null;
  contractType: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  communicationsCount: number;
  lastCommunication: string | null;
}

interface DuplicateGroup {
  phone: string;
  clients: DuplicateClient[];
  totalCommunications: number;
  duplicateCount: number;
}

interface DuplicatesResponse {
  duplicateGroupsCount: number;
  totalDuplicateClients: number;
  duplicateGroups: DuplicateGroup[];
}

export default function ClientDuplicatesPage() {
  const [selectedClients, setSelectedClients] = useState<{[groupPhone: string]: number[]}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: duplicatesData, isLoading } = useQuery<DuplicatesResponse>({
    queryKey: ["/api/clients/duplicates"],
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ primaryClientId, duplicateClientIds }: { primaryClientId: number; duplicateClientIds: number[] }) => {
      return await apiRequest(`/api/clients/merge-duplicates`, {
        method: "POST",
        data: { primaryClientId, duplicateClientIds },
      });
    },
    onSuccess: () => {
      toast({
        title: "Clienti unificati con successo",
        description: "I clienti duplicati sono stati unificati e le loro comunicazioni consolidate.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      setSelectedClients({});
    },
    onError: (error: any) => {
      toast({
        title: "Errore nell'unificazione",
        description: error?.message || "Si è verificato un errore durante l'unificazione dei clienti.",
        variant: "destructive",
      });
    },
  });

  const handleClientSelection = (groupPhone: string, clientId: number, checked: boolean) => {
    setSelectedClients(prev => {
      const groupSelections = prev[groupPhone] || [];
      if (checked) {
        return { ...prev, [groupPhone]: [...groupSelections, clientId] };
      } else {
        return { ...prev, [groupPhone]: groupSelections.filter(id => id !== clientId) };
      }
    });
  };

  const handleMergeGroup = async (group: DuplicateGroup) => {
    const selectedIds = selectedClients[group.phone] || [];
    
    if (selectedIds.length < 2) {
      toast({
        title: "Selezione insufficiente",
        description: "Seleziona almeno 2 clienti da unificare.",
        variant: "destructive",
      });
      return;
    }

    // Il primo selezionato diventa il primario
    const [primaryClientId, ...duplicateClientIds] = selectedIds;
    
    await mergeMutation.mutateAsync({ primaryClientId, duplicateClientIds });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Mai";
    return new Date(dateString).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getClientDisplayName = (client: DuplicateClient) => {
    return `${client.firstName} ${client.lastName}`.trim() || `Cliente ${client.id}`;
  };

  const getInterestLevel = (totalCommunications: number) => {
    if (totalCommunications >= 30) return { label: "Molto Alto", color: "bg-red-500" };
    if (totalCommunications >= 15) return { label: "Alto", color: "bg-orange-500" };
    if (totalCommunications >= 5) return { label: "Medio", color: "bg-yellow-500" };
    return { label: "Basso", color: "bg-green-500" };
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Gestione Clienti Duplicati</h1>
        </div>
        <div className="text-center py-8">Caricamento duplicati...</div>
      </div>
    );
  }

  if (!duplicatesData || duplicatesData.duplicateGroupsCount === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Gestione Clienti Duplicati</h1>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessun duplicato trovato</h3>
            <p className="text-muted-foreground mb-4">
              Tutti i clienti hanno numeri di telefono unici.
            </p>
            <Button asChild>
              <Link href="/clients">Torna ai Clienti</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Gestione Clienti Duplicati</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/clients">Torna ai Clienti</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{duplicatesData.duplicateGroupsCount}</div>
                <div className="text-sm text-muted-foreground">Gruppi Duplicati</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{duplicatesData.totalDuplicateClients}</div>
                <div className="text-sm text-muted-foreground">Clienti Totali</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">
                  {duplicatesData.duplicateGroups.reduce((sum, group) => sum + group.totalCommunications, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Comunicazioni Totali</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {duplicatesData.duplicateGroups.map((group) => {
          const selectedIds = selectedClients[group.phone] || [];
          const interestLevel = getInterestLevel(group.totalCommunications);
          
          return (
            <Card key={group.phone} className="border-l-4 border-l-orange-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-lg">{group.phone}</CardTitle>
                      <CardDescription>
                        {group.duplicateCount} clienti duplicati
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className={`${interestLevel.color} text-white`}>
                      Interesse: {interestLevel.label}
                    </Badge>
                    <Badge variant="secondary">
                      {group.totalCommunications} comunicazioni
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3 mb-4">
                  {group.clients.map((client) => (
                    <div key={client.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                      <Checkbox
                        id={`client-${client.id}`}
                        checked={selectedIds.includes(client.id)}
                        onCheckedChange={(checked) => handleClientSelection(group.phone, client.id, checked as boolean)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{getClientDisplayName(client)}</div>
                            <div className="text-sm text-muted-foreground">
                              {client.salutation} • {client.type} • ID: {client.id}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{client.communicationsCount} comunicazioni</div>
                            <div className="text-xs text-muted-foreground">
                              Ultima: {formatDate(client.lastCommunication)}
                            </div>
                          </div>
                        </div>
                        {client.notes && (
                          <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {client.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedIds.length > 0 && (
                      <>
                        {selectedIds.length} clienti selezionati
                        {selectedIds.length >= 2 && (
                          <span className="text-blue-600 ml-2">
                            • Il primo selezionato diventerà il cliente principale
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    onClick={() => handleMergeGroup(group)}
                    disabled={selectedIds.length < 2 || mergeMutation.isPending}
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Merge className="h-4 w-4" />
                    <span>
                      {mergeMutation.isPending ? "Unificando..." : "Unifica Selezionati"}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}