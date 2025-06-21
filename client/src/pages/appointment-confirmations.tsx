import { useState } from "react";
import { Helmet } from "react-helmet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Trash2, MessageSquare, Clock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type AppointmentConfirmation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function AppointmentConfirmationsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("manual");
  const [formData, setFormData] = useState({
    salutation: "",
    lastName: "",
    phone: "",
    appointmentDate: "",
    address: "viale Abruzzi 78"
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch appointment confirmations
  const { data: confirmations, isLoading } = useQuery<AppointmentConfirmation[]>({
    queryKey: ["/api/appointment-confirmations"],
  });

  // Fetch clients for the dropdown
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
  });

  // Handle client selection
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId && clientId !== "manual" && Array.isArray(clients)) {
      const selectedClient = clients.find((client: any) => client.id.toString() === clientId);
      if (selectedClient) {
        setFormData(prev => ({
          ...prev,
          lastName: selectedClient.lastName,
          phone: selectedClient.phone,
          salutation: selectedClient.salutation || ""
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        lastName: "",
        phone: "",
        salutation: ""
      }));
    }
  };

  // Create new confirmation mutation
  const createConfirmationMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("/api/appointment-confirmations", {
      method: "POST",
      data: data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-confirmations"] });
      setIsDialogOpen(false);
      setSelectedClientId("manual");
      setFormData({ salutation: "", lastName: "", phone: "", appointmentDate: "", address: "viale Abruzzi 78" });
      toast({
        title: "Conferma aggiunta",
        description: "La conferma appuntamento è stata aggiunta con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella creazione della conferma",
        variant: "destructive",
      });
    },
  });

  // Send confirmation mutation
  const sendConfirmationMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/appointment-confirmations/${id}/send`, {
      method: "PATCH",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-confirmations"] });
      toast({
        title: "Conferma inviata",
        description: "La conferma appuntamento è stata inviata tramite WhatsApp",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'invio della conferma",
        variant: "destructive",
      });
    },
  });

  // Delete confirmation mutation
  const deleteConfirmationMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/appointment-confirmations/${id}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-confirmations"] });
      toast({
        title: "Conferma eliminata",
        description: "La conferma appuntamento è stata eliminata",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione della conferma",
        variant: "destructive",
      });
    },
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/appointment-confirmations/${id}/create-client`, {
      method: "POST",
    }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointment-confirmations"] });
      toast({
        title: "Cliente creato",
        description: `Cliente ${data.client.lastName} creato con successo con ${data.tasks.length} task associati`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella creazione del cliente",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.salutation || !formData.lastName || !formData.phone || !formData.appointmentDate) {
      toast({
        title: "Errore",
        description: "Tutti i campi sono obbligatori",
        variant: "destructive",
      });
      return;
    }
    createConfirmationMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSendConfirmation = (id: number) => {
    sendConfirmationMutation.mutate(id);
  };

  const handleDeleteConfirmation = (id: number) => {
    if (window.confirm("Sei sicuro di voler eliminare questa conferma?")) {
      deleteConfirmationMutation.mutate(id);
    }
  };

  const formatDate = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return format(date, "dd/MM/yyyy HH:mm", { locale: it });
    } catch {
      return typeof dateString === 'string' ? dateString : dateString.toString();
    }
  };

  const getSalutationLabel = (salutation: string) => {
    const salutations: Record<string, string> = {
      "egr_dott": "Egr. Dott.",
      "gentma_sigra": "Gent.ma Sig.ra",
      "egr_avvto": "Egr. Avv.to",
      "caro": "Caro",
      "cara": "Cara",
      "ciao": "Ciao"
    };
    return salutations[salutation] || salutation;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-2xl text-gray-400 mb-4">
            <Clock className="animate-spin mx-auto" size={48} />
          </div>
          <p className="text-gray-600">Caricamento conferme appuntamenti...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Conferme Appuntamenti | Gestionale Immobiliare</title>
        <meta name="description" content="Gestisci le conferme appuntamenti e inviale automaticamente tramite WhatsApp" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Conferme Appuntamenti</h1>
            <p className="text-gray-600 mt-2">
              Gestisci e invia conferme appuntamenti tramite WhatsApp automatico
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuova Conferma
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Nuova Conferma Appuntamento</DialogTitle>
                <DialogDescription>
                  Compila i dati per creare una nuova conferma appuntamento
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Cliente</Label>
                  <Select value={selectedClientId} onValueChange={handleClientSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cliente (opzionale)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Inserimento manuale</SelectItem>
                      {Array.isArray(clients) && clients.map((client: any) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.salutation ? getSalutationLabel(client.salutation) : ''} {client.firstName} {client.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salutation">Intestazione</Label>
                  <Select value={formData.salutation} onValueChange={(value) => handleInputChange("salutation", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona intestazione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="egr_dott">Egr. Dott.</SelectItem>
                      <SelectItem value="gentma_sigra">Gent.ma Sig.ra</SelectItem>
                      <SelectItem value="egr_avvto">Egr. Avv.to</SelectItem>
                      <SelectItem value="caro">Caro</SelectItem>
                      <SelectItem value="cara">Cara</SelectItem>
                      <SelectItem value="ciao">Ciao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Cognome</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    placeholder="Inserisci cognome"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Numero di telefono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="Inserisci numero di telefono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appointmentDate">Data e ora appuntamento</Label>
                  <Input
                    id="appointmentDate"
                    value={formData.appointmentDate}
                    onChange={(e) => handleInputChange("appointmentDate", e.target.value)}
                    placeholder="es. lunedì 10 giugno alle ore 15:00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Indirizzo appuntamento</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    placeholder="Inserisci indirizzo dell'appuntamento"
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createConfirmationMutation.isPending}>
                    {createConfirmationMutation.isPending ? "Creazione..." : "Crea Conferma"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-5 w-5" />
              Elenco Conferme Appuntamenti
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!confirmations || confirmations.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nessuna conferma appuntamento
                </h3>
                <p className="text-gray-600 mb-4">
                  Inizia creando la tua prima conferma appuntamento
                </p>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Crea Prima Conferma
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Intestazione</TableHead>
                    <TableHead>Cognome</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Data e Ora</TableHead>
                    <TableHead>Indirizzo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmations.map((confirmation) => (
                    <TableRow key={confirmation.id}>
                      <TableCell>{getSalutationLabel(confirmation.salutation)}</TableCell>
                      <TableCell className="font-medium">{confirmation.lastName}</TableCell>
                      <TableCell>{confirmation.phone}</TableCell>
                      <TableCell>{confirmation.appointmentDate}</TableCell>
                      <TableCell>{confirmation.address}</TableCell>
                      <TableCell>
                        {confirmation.sent ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            Inviato {confirmation.sentAt && formatDate(confirmation.sentAt)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
                            Da inviare
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!confirmation.sent && (
                            <Button
                              size="sm"
                              onClick={() => handleSendConfirmation(confirmation.id)}
                              disabled={sendConfirmationMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Invia
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => createClientMutation.mutate(confirmation.id)}
                            disabled={createClientMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            {createClientMutation.isPending ? "Creando..." : "Crea cliente"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteConfirmation(confirmation.id)}
                            disabled={deleteConfirmationMutation.isPending}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Messaggio di Conferma</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-700 italic">
              "[Intestazione] [Cognome], le confermo appuntamento di [Data e Ora], in viale Abruzzi 78. La ringrazio. Ilan Boni - Cavour Immobiliare"
            </p>
            <p className="text-sm text-blue-600 mt-2">
              Questo messaggio verrà inviato automaticamente tramite WhatsApp quando clicchi "Invia"
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}