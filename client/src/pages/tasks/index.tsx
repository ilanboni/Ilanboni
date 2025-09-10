import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Task, ClientWithDetails } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Search, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCcw,
  Phone,
  MessageSquare
} from "lucide-react";
import { formatDate, getDaysUntil } from "@/lib/utils";
import { Helmet } from "react-helmet";
import { queryClient } from "@/lib/queryClient";

export default function TasksPage() {
  const { toast } = useToast();
  
  // State for filtering
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("call_response");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch tasks
  const { data: tasks, isLoading, isError } = useQuery({
    queryKey: ['/api/tasks', statusFilter, typeFilter, searchQuery],
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);
      if (searchQuery) params.append('search', searchQuery);
      
      const url = `/api/tasks${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      return await response.json();
    }
  });
  
  // Mutations for tasks
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest('PATCH', `/api/tasks/${taskId}/complete`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: "Task completato",
        description: "Il task è stato segnato come completato."
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento del task.",
        variant: "destructive"
      });
    }
  });
  
  const postponeTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      // Postpone by 1 day
      return await apiRequest('PATCH', `/api/tasks/${taskId}/postpone`, { days: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: "Task posticipato",
        description: "La scadenza del task è stata posticipata di 1 giorno."
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il posticipo del task.",
        variant: "destructive"
      });
    }
  });
  
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest('DELETE', `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: "Task eliminato",
        description: "Il task è stato eliminato con successo."
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del task.",
        variant: "destructive"
      });
    }
  });
  
  // Handle task actions
  const handleCompleteTask = (taskId: number) => {
    completeTaskMutation.mutate(taskId);
  };
  
  const handlePostponeTask = (taskId: number) => {
    postponeTaskMutation.mutate(taskId);
  };
  
  const handleDeleteTask = (taskId: number) => {
    if (confirm("Sei sicuro di voler eliminare questo task?")) {
      deleteTaskMutation.mutate(taskId);
    }
  };
  
  const handleContactClient = async (task: Task) => {
    try {
      // This would be a real API call to contact the client
      await apiRequest('POST', `/api/clients/${task.clientId}/contact`, { 
        method: task.type === 'followUp' ? 'phone' : 'whatsapp',
        taskId: task.id
      });
      
      toast({
        title: "Cliente contattato",
        description: `Hai ${task.type === 'followUp' ? 'chiamato' : 'inviato un messaggio a'} il cliente con successo.`
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il contatto del cliente.",
        variant: "destructive"
      });
    }
  };
  
  // Helper functions for task UI
  const getTaskIcon = (type: string) => {
    switch (type) {
      case "followUp":
        return <Clock className="h-8 w-8 text-amber-500" />;
      case "noResponse":
        return <AlertTriangle className="h-8 w-8 text-red-500" />;
      case "birthday":
        return <Calendar className="h-8 w-8 text-green-500" />;
      case "call_response":
        return <MessageSquare className="h-8 w-8 text-blue-500" />;
      case "generic_call":
        return <Phone className="h-8 w-8 text-purple-500" />;
      default:
        return <Clock className="h-8 w-8 text-gray-400" />;
    }
  };
  
  const getTaskTypeName = (type: string): string => {
    switch (type) {
      case "followUp":
        return "Follow-up";
      case "noResponse":
        return "Mancata risposta";
      case "birthday":
        return "Compleanno cliente";
      case "call_response":
        return "Comunicazione ricevuta";
      case "generic_call":
        return "Chiamata generica";
      default:
        return type;
    }
  };
  
  const getTaskUrgencyColor = (dueDate: string): string => {
    const daysLeft = getDaysUntil(dueDate);
    if (daysLeft < 0) return "text-red-600";
    if (daysLeft === 0) return "text-amber-600";
    if (daysLeft <= 2) return "text-amber-500";
    return "text-gray-600";
  };
  
  const getTimeRelative = (dueDate: string): string => {
    const daysLeft = getDaysUntil(dueDate);
    if (daysLeft < 0) return `In ritardo di ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'giorno' : 'giorni'}`;
    if (daysLeft === 0) return "Oggi";
    if (daysLeft === 1) return "Domani";
    return `Tra ${daysLeft} giorni`;
  };
  
  // Create empty state component
  const EmptyState = () => (
    <div className="text-center py-10">
      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <CheckCircle className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900">Nessun task trovato</h3>
      <p className="mt-1 text-sm text-gray-500">
        {statusFilter === "completed" 
          ? "Non ci sono task completati." 
          : searchQuery 
            ? "Nessun task corrisponde ai criteri di ricerca." 
            : "Non ci sono task da completare al momento."}
      </p>
      <div className="mt-6">
        <Button onClick={() => setStatusFilter("pending")}>
          Visualizza tutti i task
        </Button>
      </div>
    </div>
  );
  
  return (
    <>
      <Helmet>
        <title>Task e Alert | RealEstate CRM</title>
        <meta name="description" content="Gestisci task, promemoria e alert per le tue attività immobiliari." />
      </Helmet>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Task e Alert</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestisci le tue attività, promemoria e follow-up
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Task
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
              placeholder="Cerca task per titolo, cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Tabs 
              value={statusFilter} 
              onValueChange={setStatusFilter}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending">Da fare</TabsTrigger>
                <TabsTrigger value="completed">Completati</TabsTrigger>
                <TabsTrigger value="all">Tutti</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo di task" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="followUp">Follow-up</SelectItem>
                <SelectItem value="noResponse">Mancata risposta</SelectItem>
                <SelectItem value="birthday">Compleanno</SelectItem>
                <SelectItem value="call_response">Comunicazioni ricevute</SelectItem>
                <SelectItem value="generic_call">Chiamate generiche</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Task List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <div className="flex items-center">
                  <Skeleton className="h-8 w-8 rounded-full mr-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">
          Si è verificato un errore durante il caricamento dei task. Riprova più tardi.
        </div>
      ) : tasks && tasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task: Task) => (
            <Card key={task.id} className={
              task.status === "completed" ? "bg-gray-50" : ""
            }>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-medium">
                      {task.title}
                    </CardTitle>
                    <CardDescription>
                      {getTaskTypeName(task.type)}
                    </CardDescription>
                  </div>
                  <div className="flex-shrink-0">
                    {getTaskIcon(task.type)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm text-gray-600 mb-3">
                  {task.description}
                </p>
                
                <div className="flex items-center mt-2">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  <span className={`text-sm ${getTaskUrgencyColor(task.dueDate)}`}>
                    {formatDate(task.dueDate)} ({getTimeRelative(task.dueDate)})
                  </span>
                </div>
                
                {task.client && (
                  <div className="flex items-center mt-3 p-2 bg-gray-50 rounded-md">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center mr-2">
                      <i className={`fas ${task.client.type === 'buyer' ? 'fa-user-tie' : 'fa-user'}`}></i>
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {task.client.firstName} {task.client.lastName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {task.client.phone}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                {task.status !== "completed" ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handlePostponeTask(task.id)}
                    >
                      <RefreshCcw className="mr-1 h-3 w-3" /> Posticipa
                    </Button>
                    <div className="flex space-x-2">
                      {task.type === "followUp" && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleContactClient(task)}
                          className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        >
                          <Phone className="mr-1 h-3 w-3" /> Chiama
                        </Button>
                      )}
                      
                      {task.type === "noResponse" && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleContactClient(task)}
                          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        >
                          <MessageSquare className="mr-1 h-3 w-3" /> WhatsApp
                        </Button>
                      )}
                      
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => handleCompleteTask(task.id)}
                      >
                        <CheckCircle className="mr-1 h-3 w-3" /> Completato
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-500">
                      Completato
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-red-600"
                    >
                      Elimina
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </>
  );
}
