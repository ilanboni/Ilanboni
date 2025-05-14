import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card";
import { CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { TabsContent } from "@/components/ui/tabs";
import { TabsList } from "@/components/ui/tabs";
import { TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertCircle, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2 
} from "lucide-react";
import { Task, InsertTask } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface SharedPropertyTasksProps {
  sharedPropertyId: number;
}

export default function SharedPropertyTasks({ sharedPropertyId }: SharedPropertyTasksProps) {
  const { toast } = useToast();
  const [isAddingTask, setIsAddingTask] = useState(false);
  
  // Fetch tasks
  const { 
    data: tasks, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/shared-properties', sharedPropertyId, 'tasks'],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/shared-properties/${sharedPropertyId}/tasks`);
        if (!response.ok) {
          throw new Error("Errore nel caricamento dei task");
        }
        return response.json() as Promise<Task[]>;
      } catch (error) {
        console.error("Errore nel caricamento dei task:", error);
        throw error;
      }
    }
  });

  // Complete task mutation
  const completeMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'completed' }),
      }).then(res => {
        if (!res.ok) throw new Error("Errore nell'aggiornamento del task");
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties', sharedPropertyId, 'tasks'] });
      toast({
        title: "Task completato",
        description: "Il task è stato contrassegnato come completato con successo.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'aggiornamento del task.",
      });
    }
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      }).then(res => {
        if (!res.ok) throw new Error("Errore nell'eliminazione del task");
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties', sharedPropertyId, 'tasks'] });
      toast({
        title: "Task eliminato",
        description: "Il task è stato eliminato con successo.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'eliminazione del task.",
      });
    }
  });

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: async (taskData: InsertTask) => {
      return fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      }).then(res => {
        if (!res.ok) throw new Error("Errore nell'aggiunta del task");
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties', sharedPropertyId, 'tasks'] });
      setIsAddingTask(false);
      toast({
        title: "Task aggiunto",
        description: "Il nuovo task è stato aggiunto con successo.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'aggiunta del task.",
      });
    }
  });

  // Handle mark task as complete
  const handleCompleteTask = (taskId: number) => {
    completeMutation.mutate(taskId);
  };

  // Handle delete task
  const handleDeleteTask = (taskId: number) => {
    if (confirm("Sei sicuro di voler eliminare questo task?")) {
      deleteMutation.mutate(taskId);
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Task</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6 border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Task</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Si è verificato un errore nel caricamento dei task.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingTasks = tasks?.filter(task => task.status === 'pending') || [];
  const completedTasks = tasks?.filter(task => task.status === 'completed') || [];

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return format(date, "d MMMM yyyy", { locale: it });
  };

  const getTaskStatusBadge = (dueDate: Date, status: string) => {
    const today = new Date();
    const taskDate = new Date(dueDate);
    
    if (status === 'completed') {
      return <Badge className="bg-green-100 text-green-800">Completato</Badge>;
    }
    
    if (taskDate < today) {
      return <Badge className="bg-red-100 text-red-800">In ritardo</Badge>;
    }
    
    const diffTime = Math.abs(taskDate.getTime() - today.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 3) {
      return <Badge className="bg-amber-100 text-amber-800">Imminente</Badge>;
    }
    
    return <Badge className="bg-blue-100 text-blue-800">Pianificato</Badge>;
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'followUp':
        return <Clock className="h-4 w-4 text-primary-600" />;
      case 'call':
        return <Phone className="h-4 w-4 text-primary-600" />;
      default:
        return <Calendar className="h-4 w-4 text-primary-600" />;
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xl">Task</CardTitle>
        <Button 
          size="sm" 
          onClick={() => setIsAddingTask(!isAddingTask)}
          variant={isAddingTask ? "outline" : "default"}
        >
          {isAddingTask ? "Annulla" : <><Plus className="h-4 w-4 mr-1" /> Nuovo Task</>}
        </Button>
      </CardHeader>
      <CardContent>
        {isAddingTask ? (
          <div className="p-4 border rounded-md shadow-sm mb-4">
            <h3 className="font-medium mb-2">Nuovo Task</h3>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const taskData: InsertTask = {
                  type: formData.get('type') as string,
                  title: formData.get('title') as string,
                  description: formData.get('description') as string,
                  sharedPropertyId,
                  dueDate: new Date(formData.get('dueDate') as string),
                  status: 'pending',
                  assignedTo: null,
                };
                addTaskMutation.mutate(taskData);
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="type" className="block text-sm font-medium mb-1">Tipo</label>
                <select 
                  id="type" 
                  name="type"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="followUp">Follow-up</option>
                  <option value="call">Chiamata</option>
                  <option value="meeting">Appuntamento</option>
                  <option value="other">Altro</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-1">Titolo</label>
                <input 
                  type="text" 
                  id="title" 
                  name="title"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1">Descrizione</label>
                <textarea 
                  id="description" 
                  name="description"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                />
              </div>
              
              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium mb-1">Data scadenza</label>
                <input 
                  type="date" 
                  id="dueDate" 
                  name="dueDate"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddingTask(false)}
                >
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  disabled={addTaskMutation.isPending}
                >
                  {addTaskMutation.isPending ? "Salvataggio..." : "Salva Task"}
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pending">
              Da fare ({pendingTasks.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completati ({completedTasks.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending">
            {pendingTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Nessun task in programma</p>
                <p className="text-sm mt-1">Crea un nuovo task per questa proprietà condivisa</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="border rounded-md p-3 flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {getTaskTypeIcon(task.type)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{task.title}</h4>
                          {getTaskStatusBadge(task.dueDate, task.status)}
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Scadenza: {formatDate(task.dueDate)}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 w-7 p-0" 
                        onClick={() => handleCompleteTask(task.id)}
                        title="Segna come completato"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 w-7 p-0 text-red-600" 
                        onClick={() => handleDeleteTask(task.id)}
                        title="Elimina task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="completed">
            {completedTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Nessun task completato</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <div key={task.id} className="border rounded-md p-3 flex justify-between items-start bg-gray-50">
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {getTaskTypeIcon(task.type)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-600 line-through">{task.title}</h4>
                          <Badge className="bg-green-100 text-green-800">Completato</Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-500 mt-1 line-through">{task.description}</p>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Completato il: {task.updatedAt ? formatDate(task.updatedAt) : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 w-7 p-0 text-red-600" 
                      onClick={() => handleDeleteTask(task.id)}
                      title="Elimina task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Importa l'icona del telefono che mancava dalla dichiarazione sopra
import { Phone } from "lucide-react";