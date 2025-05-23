import { useState } from "react";
import { Helmet } from "react-helmet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Bell, CheckCircle, Calendar, Clock, MessageSquare, HomeIcon, Loader2, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MessageResponseModal from "@/components/assistente/MessageResponseModal";

// Define interfaces for type safety
interface PropertyReference {
  propertyId: number;
  confidence: number;
}

interface TaskSuggestion {
  title: string;
  description: string;
  dueDate: Date;
  priority: number;
  clientId?: number;
  propertyId?: number;
}

export default function AssistentePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/virtual-assistant/dashboard'],
    enabled: true,
    refetchInterval: 60000, // Aggiorna ogni minuto
  });

  console.log("Dashboard data:", dashboardData);

  // Mutation per analizzare un messaggio
  const { mutate: analyzeMessage } = useMutation({
    mutationFn: async (communicationId: number) => {
      return await apiRequest(`/api/virtual-assistant/analyze-message/${communicationId}`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      if (data?.propertyReferences?.length > 0) {
        const highConfidenceRefs = data.propertyReferences.filter((ref: PropertyReference) => ref.confidence > 0.7);
        
        if (highConfidenceRefs.length > 0) {
          toast({
            title: "Immobile trovato nel messaggio",
            description: `Abbiamo collegato automaticamente il messaggio all'immobile ID: ${highConfidenceRefs[0].propertyId}`,
          });
        } else {
          toast({
            title: "Analisi completata",
            description: "Non sono stati trovati riferimenti chiari a immobili nel messaggio",
          });
        }
      } else {
        toast({
          title: "Analisi completata",
          description: "Nessun riferimento a immobili trovato nel messaggio",
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/virtual-assistant/dashboard'] });
    },
    onError: () => {
      toast({
        title: "Errore nell'analisi",
        description: "Si è verificato un errore durante l'analisi del messaggio",
        variant: "destructive",
      });
    },
  });

  // Mutation per suggerire task
  const { mutate: suggestTasks } = useMutation({
    mutationFn: async (communicationId: number) => {
      return await apiRequest(`/api/virtual-assistant/suggest-tasks/${communicationId}`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      if (data?.suggestedTasks?.length > 0) {
        toast({
          title: `${data.suggestedTasks.length} task suggeriti`,
          description: "L'assistente virtuale ha suggerito alcuni task in base alla comunicazione",
        });
        // Crea automaticamente tutti i task suggeriti
        data.suggestedTasks.forEach((task: TaskSuggestion) => {
          createTask(task);
        });
      } else {
        toast({
          title: "Nessun task suggerito",
          description: "L'assistente non ha trovato attività da suggerire per questa comunicazione",
        });
      }
    },
    onError: () => {
      toast({
        title: "Errore nella generazione dei suggerimenti",
        description: "Si è verificato un errore durante la generazione dei suggerimenti",
        variant: "destructive",
      });
    },
  });

  // Mutation per creare un task
  const { mutate: createTask } = useMutation({
    mutationFn: async (taskData: any) => {
      return await apiRequest('/api/virtual-assistant/create-task', {
        method: 'POST',
        body: taskData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/virtual-assistant/dashboard'] });
    },
    onError: () => {
      toast({
        title: "Errore nella creazione del task",
        description: "Si è verificato un errore durante la creazione del task",
        variant: "destructive",
      });
    },
  });

  // Funzione per aprire il modal di risposta
  const handleOpenResponseModal = (message: any) => {
    setSelectedMessage(message);
    setIsResponseModalOpen(true);
  };

  // Funzione per chiudere il modal di risposta
  const handleCloseResponseModal = () => {
    setSelectedMessage(null);
    setIsResponseModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Caricamento assistente virtuale...</p>
        </div>
      </div>
    );
  }

  // Prepara i dati dai risultati dell'API
  let upcomingTasks = [];
  let unansweredMessages = [];
  
  try {
    if (dashboardData?.upcomingTasks?.rows) {
      upcomingTasks = dashboardData.upcomingTasks.rows;
    }
    
    if (dashboardData?.unansweredMessages?.rows) {
      unansweredMessages = dashboardData.unansweredMessages.rows;
    }
    
    console.log("Processed data:", { upcomingTasks, unansweredMessages });
  } catch (error) {
    console.error("Error processing dashboard data:", error);
  }

  return (
    <>
      <Helmet>
        <title>Assistente Virtuale | Gestionale Immobiliare</title>
      </Helmet>

      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assistente Virtuale</h1>
            <p className="text-muted-foreground">
              La tua segretaria virtuale che ti aiuta a gestire comunicazioni e attività
            </p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="messages">Messaggi da Rispondere</TabsTrigger>
            <TabsTrigger value="tasks">Attività Imminenti</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Messaggi Senza Risposta</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{unansweredMessages.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {unansweredMessages.length === 0 ? "Tutti i messaggi hanno ricevuto risposta" : "Messaggi che richiedono risposta"}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Task Imminenti</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{upcomingTasks.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {upcomingTasks.length === 0 ? "Nessun task imminente" : "Task in scadenza nei prossimi 3 giorni"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Proprietà Menzionate</CardTitle>
                  <HomeIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Analisi AI</div>
                  <p className="text-xs text-muted-foreground">
                    Identificazione automatica degli immobili menzionati
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assistenza IA</CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Attivo</div>
                  <p className="text-xs text-muted-foreground">
                    L'assistente sta monitorando attivamente le comunicazioni
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Messaggi da Rispondere */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Messaggi Da Rispondere</CardTitle>
                  <CardDescription>Comunicazioni recenti senza risposta</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto">
                  {unansweredMessages.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="mx-auto h-8 w-8 mb-2" />
                      <p>Nessun messaggio in attesa</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {unansweredMessages.map((item: any) => (
                        <div key={item.id} className="flex items-start gap-4 rounded-md border p-4">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {item.clientFirstName?.[0]}{item.clientLastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                {item.clientFirstName} {item.clientLastName}
                              </p>
                              <Badge variant="outline">
                                {item.createdAt ? format(new Date(item.createdAt), "dd/MM/yy HH:mm", { locale: it }) : "Data non disponibile"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.content}
                            </p>
                            <div className="flex gap-2 pt-2">
                              <Button variant="outline" size="sm" onClick={() => analyzeMessage(item.id)}>
                                Analizza
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => suggestTasks(item.id)}>
                                Suggerisci Task
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Task Imminenti */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Task Imminenti</CardTitle>
                  <CardDescription>Attività da completare nei prossimi giorni</CardDescription>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto">
                  {upcomingTasks.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="mx-auto h-8 w-8 mb-2" />
                      <p>Nessun task imminente</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {upcomingTasks.map((task: any) => (
                        <div key={task.id} className="flex items-start gap-4 rounded-md border p-4">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center 
                            ${task.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-600' 
                              : task.status === 'completed' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'}`
                          }>
                            <Calendar className="h-6 w-6" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                {task.title}
                              </p>
                              <Badge variant={
                                task.due_date && new Date(task.due_date) < new Date() 
                                  ? "destructive" 
                                  : "outline"
                              }>
                                Scadenza: {task.due_date 
                                  ? format(new Date(task.due_date), "d MMM", { locale: it })
                                  : "Non specificata"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sezione Messaggi */}
          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Messaggi in Attesa di Risposta</CardTitle>
                <CardDescription>
                  Comunicazioni dai clienti che non hanno ancora ricevuto una risposta
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[600px] overflow-y-auto">
                {unansweredMessages.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="mx-auto h-12 w-12 mb-3" />
                    <p className="text-lg">Nessun messaggio in attesa di risposta</p>
                    <p className="text-sm text-muted-foreground">Hai risposto a tutte le comunicazioni recenti</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {unansweredMessages.map((item: any) => (
                      <div key={item.id} className="flex flex-col gap-4 rounded-md border p-6">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback>
                              {item.clientFirstName?.[0]}{item.clientLastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-lg font-medium">
                                  {item.clientFirstName} {item.clientLastName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Cliente
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge className="mb-1" variant="outline">
                                  {item.createdAt 
                                    ? format(new Date(item.createdAt), "dd/MM/yy", { locale: it })
                                    : "Data non disponibile"}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  {item.createdAt 
                                    ? format(new Date(item.createdAt), "HH:mm", { locale: it })
                                    : ""}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-3">
                          <p className="text-sm">
                            {item.content}
                          </p>
                          <div className="flex justify-end">
                            <Button onClick={() => handleOpenResponseModal(item)}>
                              <Reply className="mr-2 h-4 w-4" />
                              Rispondi
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sezione Task */}
          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Task Imminenti</CardTitle>
                <CardDescription>
                  Attività in scadenza che richiedono attenzione
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-[600px] overflow-y-auto">
                {upcomingTasks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="mx-auto h-12 w-12 mb-3" />
                    <p className="text-lg">Nessun task imminente</p>
                    <p className="text-sm text-muted-foreground">Non ci sono attività in scadenza nei prossimi giorni</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {upcomingTasks.map((task: any) => (
                      <div key={task.id} className="rounded-md border p-6">
                        <div className="flex items-start gap-4">
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center 
                            ${task.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-600' 
                              : task.status === 'completed' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'}`
                          }>
                            <Calendar className="h-8 w-8" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold">{task.title}</h3>
                              <Badge variant={
                                task.due_date && new Date(task.due_date) < new Date() 
                                  ? "destructive" 
                                  : "outline"
                              }>
                                Scadenza: {task.due_date 
                                  ? format(new Date(task.due_date), "PPP", { locale: it })
                                  : "Non specificata"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm">{task.description}</p>
                            <div className="mt-4 flex items-center gap-4">
                              {task.client_id && (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback>C</AvatarFallback>
                                  </Avatar>
                                  <p className="text-sm">Cliente ID: {task.client_id}</p>
                                </div>
                              )}
                              {task.property_id && (
                                <Badge variant="outline">Immobile ID: {task.property_id}</Badge>
                              )}
                            </div>
                            <div className="mt-4 flex justify-end">
                              <Button variant="outline" size="sm">
                                Segna come completato
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal per le risposte ai messaggi */}
      <MessageResponseModal
        isOpen={isResponseModalOpen}
        onClose={handleCloseResponseModal}
        message={selectedMessage}
      />
    </>
  );
}