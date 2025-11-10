import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  ArrowLeft, 
  Calendar, 
  Phone, 
  Users, 
  Mail, 
  Home, 
  FileText, 
  Search,
  MoreHorizontal,
  Save,
  Trash2,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertTaskSchema, type TaskWithClient } from "@shared/schema";

const taskTypeConfig = {
  followUp: { label: "Follow-up", icon: Calendar, color: "bg-blue-500" },
  call: { label: "Chiamata", icon: Phone, color: "bg-green-500" },
  meeting: { label: "Incontro", icon: Users, color: "bg-purple-500" },
  email: { label: "Email", icon: Mail, color: "bg-orange-500" },
  viewing: { label: "Visita immobile", icon: Home, color: "bg-indigo-500" },
  document: { label: "Documenti", icon: FileText, color: "bg-gray-500" },
  search: { label: "Ricerca", icon: Search, color: "bg-yellow-500" },
  other: { label: "Altro", icon: MoreHorizontal, color: "bg-slate-500" },
};

const editTaskFormSchema = insertTaskSchema
  .pick({
    type: true,
    title: true,
    description: true,
    dueDate: true,
    priority: true,
    status: true,
    notes: true
  })
  .extend({
    type: z.string().min(1, "Tipo obbligatorio"),
    title: z.string().min(1, "Titolo obbligatorio"),
    description: z.string().optional(),
    dueDate: z.string().min(1, "Data di scadenza obbligatoria"),
    priority: z.coerce.number().min(1).max(3),
    status: z.string(),
    notes: z.string().optional()
  });

type EditTaskFormData = z.infer<typeof editTaskFormSchema>;

const taskStages = [
  { id: "pending", label: "Da Fare", color: "bg-gray-200 text-gray-800" },
  { id: "open", label: "In Corso", color: "bg-blue-200 text-blue-800" },
  { id: "completed", label: "Completata", color: "bg-green-200 text-green-800" },
  { id: "cancelled", label: "Annullata", color: "bg-red-200 text-red-800" }
];

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: task, isLoading, isError } = useQuery<TaskWithClient>({
    queryKey: [`/api/tasks/${params.id}`],
  });

  const form = useForm<EditTaskFormData>({
    resolver: zodResolver(editTaskFormSchema),
    values: task ? {
      type: task.type,
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate,
      priority: task.priority || 2,
      status: task.status,
      notes: task.notes || ""
    } : undefined
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditTaskFormData) => {
      return await apiRequest(`/api/tasks/${params.id}`, {
        method: "PUT",
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${params.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (task?.clientId) {
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${task.clientId}/tasks`] });
      }
      toast({
        title: "Attività aggiornata",
        description: "Le modifiche sono state salvate con successo.",
      });
    },
    onError: (error) => {
      console.error("Errore aggiornamento attività:", error);
      toast({
        title: "Errore",
        description: "Non è stato possibile aggiornare l'attività.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/tasks/${params.id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (task?.clientId) {
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${task.clientId}/tasks`] });
      }
      toast({
        title: "Attività eliminata",
        description: "L'attività è stata eliminata con successo.",
      });
      setLocation("/tasks");
    },
    onError: (error) => {
      console.error("Errore eliminazione attività:", error);
      toast({
        title: "Errore",
        description: "Non è stato possibile eliminare l'attività.",
        variant: "destructive",
      });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/tasks/${params.id}`, {
        method: "PUT",
        data: { status: "completed" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${params.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (task?.clientId) {
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${task.clientId}/tasks`] });
      }
      toast({
        title: "Attività completata",
        description: "L'attività è stata contrassegnata come completata.",
      });
    },
  });

  const onSubmit = (data: EditTaskFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            Impossibile caricare i dettagli dell'attività. L'attività potrebbe non esistere.
          </AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => setLocation("/tasks")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna alle Attività
        </Button>
      </div>
    );
  }

  const typeConfig = taskTypeConfig[task.type as keyof typeof taskTypeConfig] || taskTypeConfig.other;
  const TypeIcon = typeConfig.icon;
  const currentStageIndex = taskStages.findIndex(s => s.id === task.status);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setLocation("/tasks")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{task.title}</h1>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
              <Badge variant="outline" className={typeConfig.color}>
                <TypeIcon className="h-3 w-3 mr-1" />
                {typeConfig.label}
              </Badge>
              {task.clientFirstName && (
                <span className="text-sm">
                  per {task.clientFirstName} {task.clientLastName}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {task.status !== "completed" && (
            <Button 
              variant="default" 
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => completeTaskMutation.mutate()}
              disabled={completeTaskMutation.isPending}
              data-testid="button-complete-task"
            >
              <CheckCircle2 className="h-4 w-4" />
              Completa Attività
            </Button>
          )}
          <Button 
            variant="destructive" 
            className="gap-2"
            onClick={() => {
              if (confirm("Sei sicuro di voler eliminare questa attività?")) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-task"
          >
            <Trash2 className="h-4 w-4" />
            Elimina
          </Button>
        </div>
      </div>

      {/* Pipeline visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Stato Attività</CardTitle>
          <CardDescription>Traccia il progresso dell'attività attraverso le varie fasi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {taskStages.map((stage, index) => (
              <div key={stage.id} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div 
                    className={`
                      w-full py-3 px-4 rounded-lg text-center font-medium transition-all
                      ${index <= currentStageIndex ? stage.color : "bg-gray-100 text-gray-400"}
                      ${index === currentStageIndex ? "ring-2 ring-offset-2 ring-primary" : ""}
                    `}
                  >
                    {stage.label}
                  </div>
                </div>
                {index < taskStages.length - 1 && (
                  <div 
                    className={`
                      w-8 h-1 mx-2
                      ${index < currentStageIndex ? "bg-green-500" : "bg-gray-200"}
                    `}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>Dettagli Attività</CardTitle>
          <CardDescription>Modifica i dettagli dell'attività</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="followUp">Follow-up</SelectItem>
                          <SelectItem value="call">Chiamata</SelectItem>
                          <SelectItem value="meeting">Incontro</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="viewing">Visita immobile</SelectItem>
                          <SelectItem value="document">Documenti</SelectItem>
                          <SelectItem value="search">Ricerca</SelectItem>
                          <SelectItem value="other">Altro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stato</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taskStages.map(stage => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data di Scadenza *</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          data-testid="input-task-duedate"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priorità</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-priority">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">Bassa</SelectItem>
                          <SelectItem value="2">Media</SelectItem>
                          <SelectItem value="3">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titolo *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Titolo dell'attività"
                        data-testid="input-task-title"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descrizione dettagliata dell'attività..."
                        rows={4}
                        data-testid="textarea-task-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Note aggiuntive, link, dettagli..."
                        rows={3}
                        data-testid="textarea-task-notes"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation("/tasks")}
                >
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  data-testid="button-save-task"
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Salva Modifiche
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Additional info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informazioni Aggiuntive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Data Creazione</p>
              <p className="text-sm">
                {task.createdAt && format(new Date(task.createdAt), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Data Scadenza</p>
              <p className="text-sm">
                {format(new Date(task.dueDate), "d MMMM yyyy", { locale: it })}
              </p>
            </div>
            {task.clientId && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cliente</p>
                <Link href={`/clients/${task.clientId}`}>
                  <Button variant="link" className="h-auto p-0 text-sm">
                    {task.clientFirstName} {task.clientLastName}
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {task.contactName && (
          <Card>
            <CardHeader>
              <CardTitle>Contatto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.contactName && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nome</p>
                  <p className="text-sm">{task.contactName}</p>
                </div>
              )}
              {task.contactPhone && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Telefono</p>
                  <p className="text-sm">{task.contactPhone}</p>
                </div>
              )}
              {task.contactEmail && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-sm">{task.contactEmail}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
