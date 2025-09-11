import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
// import { AdvancedCallForm } from "./AdvancedCallForm"; // DISABILITATO per loop infinito

interface Task {
  id: number;
  type: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  propertyInterest: string | null;
  notes: string | null;
  clientId: number | null;
  createdAt: string;
}

interface TaskManagerProps {
  showTitle?: boolean;
  filter?: "all" | "generic_call";
}

export function TaskManager({ showTitle = true, filter = "all" }: TaskManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createTaskForm, setCreateTaskForm] = useState({
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    propertyInterest: "",
    notes: ""
  });
  const [clientForm, setClientForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    minSize: "",
    maxPrice: "",
    urgency: "3",
    searchNotes: ""
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query per recuperare i task
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: [`/api/tasks${filter !== "all" ? `?type=${filter}` : ""}`],
  });

  // Mutation per creare task
  const createTaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks/generic-call", {
      method: "POST",
      data: data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowCreateDialog(false);
      setCreateTaskForm({
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        propertyInterest: "",
        notes: ""
      });
      toast({
        title: "Task creato con successo",
        description: "Il task è stato aggiunto alla lista delle chiamate da richiamare.",
      });
    },
    onError: (error) => {
      console.error("Errore creazione task:", error);
      toast({
        title: "Errore",
        description: "Non è stato possibile creare il task.",
        variant: "destructive",
      });
    },
  });

  // Mutation per aggiornare task
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest(`/api/tasks/${id}`, {
        method: "PUT",
        data: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task aggiornato",
        description: "Lo stato del task è stato modificato.",
      });
    },
  });

  // Mutation per creare cliente da task
  const createClientMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: number; data: any }) => {
      const response = await apiRequest(`/api/tasks/${taskId}/create-client`, {
        method: "POST",
        data: data,
      });
      return await response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowClientDialog(false);
      setSelectedTask(null);
      setClientForm({
        firstName: "",
        lastName: "",
        email: "",
        minSize: "",
        maxPrice: "",
        urgency: "3",
        searchNotes: ""
      });
      toast({
        title: "Cliente creato con successo",
        description: `Cliente ${result.client?.firstName || ''} ${result.client?.lastName || ''} creato dal task.`,
      });
    },
    onError: (error) => {
      console.error("Errore creazione cliente:", error);
      toast({
        title: "Errore",
        description: "Non è stato possibile creare il cliente.",
        variant: "destructive",
      });
    },
  });

  const handleCreateTask = () => {
    if (!createTaskForm.contactName && !createTaskForm.contactPhone) {
      toast({
        title: "Errore",
        description: "Inserisci almeno il nome o il telefono del contatto.",
        variant: "destructive",
      });
      return;
    }

    createTaskMutation.mutate(createTaskForm);
  };

  const handleCreateClient = () => {
    if (!selectedTask) return;

    const data = {
      ...clientForm,
      minSize: clientForm.minSize ? parseInt(clientForm.minSize) : null,
      maxPrice: clientForm.maxPrice ? parseInt(clientForm.maxPrice) : null,
      urgency: parseInt(clientForm.urgency),
    };

    createClientMutation.mutate({ taskId: selectedTask.id, data });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50">Da completare</Badge>;
      case "completed":
        return <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-50">Completato</Badge>;
      case "cancelled":
        return <Badge variant="secondary" className="bg-gray-50 text-gray-700 hover:bg-gray-50">Annullato</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "generic_call":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Chiamata Generica</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy", { locale: it });
    } catch {
      return "N/D";
    }
  };

  // Questi hook devono essere chiamati PRIMA di qualsiasi return condizionale
  const pendingTasks = Array.isArray(tasks) ? tasks.filter((task: Task) => task.status === "pending") : [];

  // Raggruppa i task per cliente
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, {
      clientKey: string;
      clientName: string;
      clientId: number | null;
      tasks: Task[];
      totalTasks: number;
    }>();

    pendingTasks.forEach((task: Task) => {
      // Crea una chiave per il raggruppamento
      let clientKey: string;
      let clientName: string;
      
      if (task.clientId) {
        clientKey = `client_${task.clientId}`;
        clientName = task.contactName || `Cliente ID ${task.clientId}`;
      } else if (task.contactName) {
        clientKey = `contact_${task.contactName.toLowerCase().replace(/\s+/g, '_')}`;
        clientName = task.contactName;
      } else {
        clientKey = `unknown_${task.id}`;
        clientName = 'Cliente Sconosciuto';
      }

      if (!groups.has(clientKey)) {
        groups.set(clientKey, {
          clientKey,
          clientName,
          clientId: task.clientId,
          tasks: [],
          totalTasks: 0
        });
      }

      const group = groups.get(clientKey)!;
      group.tasks.push(task);
      group.totalTasks = group.tasks.length;
    });

    return Array.from(groups.values()).sort((a, b) => b.totalTasks - a.totalTasks);
  }, [pendingTasks]);

  // Stato per gestire l'espansione dei gruppi
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (clientKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientKey)) {
        newSet.delete(clientKey);
      } else {
        newSet.add(clientKey);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle>Task da Completare</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin text-3xl text-gray-300">
              <i className="fas fa-spinner"></i>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Task da Completare</CardTitle>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowAdvancedForm(true)}
            >
              <i className="fas fa-phone mr-2"></i>
              Form Avanzato
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <i className="fas fa-plus mr-2"></i>
                  Chiamata Rapida
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nuova Chiamata da Richiamare</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="contactName" className="text-right">Nome</Label>
                  <Input
                    id="contactName"
                    className="col-span-3"
                    value={createTaskForm.contactName}
                    onChange={(e) => setCreateTaskForm(prev => ({ ...prev, contactName: e.target.value }))}
                    placeholder="Nome del contatto"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="contactPhone" className="text-right">Telefono</Label>
                  <Input
                    id="contactPhone"
                    className="col-span-3"
                    value={createTaskForm.contactPhone}
                    onChange={(e) => setCreateTaskForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="Numero di telefono"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="contactEmail" className="text-right">Email</Label>
                  <Input
                    id="contactEmail"
                    className="col-span-3"
                    value={createTaskForm.contactEmail}
                    onChange={(e) => setCreateTaskForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="Email del contatto"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="propertyInterest" className="text-right">Interesse</Label>
                  <Input
                    id="propertyInterest"
                    className="col-span-3"
                    value={createTaskForm.propertyInterest}
                    onChange={(e) => setCreateTaskForm(prev => ({ ...prev, propertyInterest: e.target.value }))}
                    placeholder="Tipo immobile di interesse"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="notes" className="text-right">Note</Label>
                  <Textarea
                    id="notes"
                    className="col-span-3"
                    value={createTaskForm.notes}
                    onChange={(e) => setCreateTaskForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Note aggiuntive..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Annulla
                </Button>
                <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending}>
                  {createTaskMutation.isPending && <i className="fas fa-spinner animate-spin mr-2"></i>}
                  Crea Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
      )}
      
      <CardContent>
        {/* Statistiche raggruppamento */}
        {groupedTasks.length > 0 && (
          <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-700">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {groupedTasks.length === 1 ? 
                    '1 cliente con task da gestire' :
                    `${groupedTasks.length} clienti con task da gestire`
                  }
                </span>
              </div>
              <div className="text-sm text-blue-600">
                {pendingTasks.length} task totali
              </div>
            </div>
          </div>
        )}

        {groupedTasks.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <div className="text-5xl mb-4 text-gray-300">
              <i className="fas fa-tasks"></i>
            </div>
            <p className="text-lg font-medium">Nessun task da completare</p>
            <p className="mt-1">Tutti i task sono stati completati.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTasks.map((group) => (
              <div key={group.clientKey} className="border rounded-lg">
                {/* Header del gruppo cliente */}
                <div 
                  className="p-4 bg-gray-50 cursor-pointer flex items-center justify-between hover:bg-gray-100 transition-colors"
                  onClick={() => toggleGroup(group.clientKey)}
                >
                  <div className="flex items-center gap-3">
                    {expandedGroups.has(group.clientKey) ? 
                      <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    }
                    <Users className="h-5 w-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-lg">{group.clientName}</h3>
                      <p className="text-sm text-gray-600">
                        {group.totalTasks === 1 ? 
                          '1 comunicazione da gestire' : 
                          `${group.totalTasks} comunicazioni da gestire`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className={`${group.totalTasks > 3 ? 'bg-red-50 text-red-700' : group.totalTasks > 1 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}
                    >
                      {group.totalTasks} task
                    </Badge>
                  </div>
                </div>
                
                {/* Contenuto espandibile del gruppo */}
                {expandedGroups.has(group.clientKey) && (
                  <div className="divide-y">
                    {group.tasks.map((task: Task) => (
                      <div key={task.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getTypeBadge(task.type)}
                            {getStatusBadge(task.status)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(task.dueDate)}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {task.contactPhone && (
                            <div>
                              <span className="font-medium text-gray-700">Telefono:</span>
                              <span className="ml-1">{task.contactPhone}</span>
                            </div>
                          )}
                          {task.contactEmail && (
                            <div>
                              <span className="font-medium text-gray-700">Email:</span>
                              <span className="ml-1">{task.contactEmail}</span>
                            </div>
                          )}
                          {task.propertyInterest && (
                            <div>
                              <span className="font-medium text-gray-700">Interesse:</span>
                              <span className="ml-1">{task.propertyInterest}</span>
                            </div>
                          )}
                        </div>
                        
                        {task.notes && (
                          <div className="text-sm">
                            <span className="font-medium text-gray-700">Note:</span>
                            <p className="mt-1 text-gray-600">{task.notes}</p>
                          </div>
                        )}
                        
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedTask(task);
                              setClientForm(prev => ({
                                ...prev,
                                firstName: task.contactName?.split(' ')[0] || "",
                                lastName: task.contactName?.split(' ').slice(1).join(' ') || "",
                                email: task.contactEmail || "",
                              }));
                              setShowClientDialog(true);
                            }}
                          >
                            <i className="fas fa-user-plus mr-2"></i>
                            Crea Cliente
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: "completed" } })}
                            disabled={updateTaskMutation.isPending}
                          >
                            {updateTaskMutation.isPending && <i className="fas fa-spinner animate-spin mr-2"></i>}
                            <i className="fas fa-check mr-2"></i>
                            Completa
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    {/* Azioni rapide per tutto il gruppo */}
                    <div className="p-4 bg-gray-50 border-t">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            group.tasks.forEach(task => {
                              updateTaskMutation.mutate({ id: task.id, data: { status: "completed" } });
                            });
                          }}
                          disabled={updateTaskMutation.isPending}
                          className="text-green-700 border-green-200 hover:bg-green-50"
                        >
                          <i className="fas fa-check-double mr-2"></i>
                          Completa Tutti ({group.totalTasks})
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog per creare cliente */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crea Cliente da Task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  value={clientForm.firstName}
                  onChange={(e) => setClientForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Nome"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Cognome</Label>
                <Input
                  id="lastName"
                  value={clientForm.lastName}
                  onChange={(e) => setClientForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Cognome"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="clientEmail">Email</Label>
              <Input
                id="clientEmail"
                value={clientForm.email}
                onChange={(e) => setClientForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email del cliente"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minSize">Dimensione min (mq)</Label>
                <Input
                  id="minSize"
                  type="number"
                  value={clientForm.minSize}
                  onChange={(e) => setClientForm(prev => ({ ...prev, minSize: e.target.value }))}
                  placeholder="60"
                />
              </div>
              <div>
                <Label htmlFor="maxPrice">Prezzo max (€)</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  value={clientForm.maxPrice}
                  onChange={(e) => setClientForm(prev => ({ ...prev, maxPrice: e.target.value }))}
                  placeholder="300000"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="urgency">Urgenza</Label>
              <Select value={clientForm.urgency} onValueChange={(value) => setClientForm(prev => ({ ...prev, urgency: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Molto bassa</SelectItem>
                  <SelectItem value="2">2 - Bassa</SelectItem>
                  <SelectItem value="3">3 - Media</SelectItem>
                  <SelectItem value="4">4 - Alta</SelectItem>
                  <SelectItem value="5">5 - Molto alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="searchNotes">Note ricerca</Label>
              <Textarea
                id="searchNotes"
                value={clientForm.searchNotes}
                onChange={(e) => setClientForm(prev => ({ ...prev, searchNotes: e.target.value }))}
                placeholder="Note sulle preferenze del cliente..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClientDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateClient} disabled={createClientMutation.isPending}>
              {createClientMutation.isPending && <i className="fas fa-spinner animate-spin mr-2"></i>}
              Crea Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced Call Form - DISABILITATO: richiede riscrittura completa per risolvere loop infinito React */}
      {/* <AdvancedCallForm 
        open={showAdvancedForm} 
        onOpenChange={setShowAdvancedForm}
      /> */}
    </Card>
  );
}