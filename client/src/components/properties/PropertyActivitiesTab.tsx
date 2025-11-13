import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Phone, MapPin, Mail, FileText, Handshake, Edit, Trash, Check, Circle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPropertyActivitySchema } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  useSharedPropertyActivities,
  useCreatePropertyActivity,
  useUpdatePropertyActivity,
  useDeletePropertyActivity
} from "@/hooks/useSharedPropertyActivities";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

const activityFormSchema = z.object({
  type: z.string(),
  title: z.string().min(1, "Il titolo è obbligatorio"),
  description: z.string().optional(),
  activityDate: z.string(),
  status: z.string().default("pending"),
  completedAt: z.string().optional()
});

type ActivityFormData = z.infer<typeof activityFormSchema>;

const activityTypes = [
  { value: "phone_call", label: "Chiamata", icon: Phone },
  { value: "site_visit", label: "Visita immobile", icon: MapPin },
  { value: "email_sent", label: "Email inviata", icon: Mail },
  { value: "document_request", label: "Richiesta documenti", icon: FileText },
  { value: "negotiation", label: "Negoziazione", icon: Handshake },
  { value: "custom", label: "Altro", icon: Circle }
];

interface PropertyActivitiesTabProps {
  sharedPropertyId: number;
}

export default function PropertyActivitiesTab({ sharedPropertyId }: PropertyActivitiesTabProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<number | null>(null);

  const { data: activities, isLoading } = useSharedPropertyActivities(sharedPropertyId);
  const createMutation = useCreatePropertyActivity(sharedPropertyId);
  const updateMutation = useUpdatePropertyActivity(sharedPropertyId);
  const deleteMutation = useDeletePropertyActivity(sharedPropertyId);

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: "phone_call",
      title: "",
      description: "",
      activityDate: new Date().toISOString().slice(0, 16),
      status: "pending"
    }
  });

  const onSubmit = async (data: ActivityFormData) => {
    try {
      // Convert form data to InsertPropertyActivity format
      const payload = {
        type: data.type,
        title: data.title,
        description: data.description || null,
        activityDate: new Date(data.activityDate),
        status: data.status,
        completedAt: data.completedAt ? new Date(data.completedAt) : null
      };

      if (editingActivity) {
        await updateMutation.mutateAsync({
          id: editingActivity,
          data: payload
        });
        toast({ description: "Attività aggiornata con successo" });
        setEditingActivity(null);
      } else {
        await createMutation.mutateAsync(payload);
        toast({ description: "Attività creata con successo" });
      }
      setIsCreateDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Errore durante il salvataggio dell'attività"
      });
    }
  };

  const handleDelete = async (activityId: number) => {
    if (!confirm("Sei sicuro di voler eliminare questa attività?")) return;
    
    try {
      await deleteMutation.mutateAsync(activityId);
      toast({ description: "Attività eliminata con successo" });
    } catch (error) {
      toast({
        variant: "destructive",
        description: "Errore durante l'eliminazione dell'attività"
      });
    }
  };

  const handleEdit = (activity: any) => {
    setEditingActivity(activity.id);
    form.reset({
      type: activity.type,
      title: activity.title,
      description: activity.description || "",
      activityDate: new Date(activity.activityDate).toISOString().slice(0, 16),
      status: activity.status,
      completedAt: activity.completedAt ? new Date(activity.completedAt).toISOString().slice(0, 16) : undefined
    });
    setIsCreateDialogOpen(true);
  };

  const getActivityIcon = (type: string) => {
    const activityType = activityTypes.find(t => t.value === type);
    if (!activityType) return Circle;
    return activityType.icon;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Cronologia Attività</h3>
          <p className="text-sm text-gray-500">
            Traccia tutte le azioni svolte per acquisire questa proprietà
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setEditingActivity(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-activity">
              <Plus className="h-4 w-4 mr-2" />
              Nuova Attività
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingActivity ? "Modifica Attività" : "Nuova Attività"}
              </DialogTitle>
              <DialogDescription>
                Registra un'attività svolta per questa proprietà
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo Attività</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-activity-type">
                            <SelectValue placeholder="Seleziona tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activityTypes.map(type => (
                            <SelectItem key={type.value} value={type.value} data-testid={`option-activity-type-${type.value}`}>
                              <div className="flex items-center gap-2">
                                <type.icon className="h-4 w-4" />
                                {type.label}
                              </div>
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
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titolo</FormLabel>
                      <FormControl>
                        <Input placeholder="es. Chiamata al proprietario" {...field} data-testid="input-activity-title" />
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
                          placeholder="Dettagli dell'attività..." 
                          className="min-h-[100px]"
                          {...field}
                          data-testid="textarea-activity-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="activityDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data/Ora Attività</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-activity-date" />
                        </FormControl>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-activity-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending" data-testid="option-status-pending">In attesa</SelectItem>
                            <SelectItem value="completed" data-testid="option-status-completed">Completata</SelectItem>
                            <SelectItem value="cancelled" data-testid="option-status-cancelled">Annullata</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setEditingActivity(null);
                      form.reset();
                    }}
                    data-testid="button-cancel-activity"
                  >
                    Annulla
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-activity">
                    {(createMutation.isPending || updateMutation.isPending) ? "Salvataggio..." : "Salva"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!activities || activities.length === 0 ? (
        <Alert>
          <AlertDescription>
            Nessuna attività registrata. Clicca "Nuova Attività" per iniziare a tracciare il tuo lavoro.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {activities.map((activity, index) => {
            const Icon = getActivityIcon(activity.type);
            const isCompleted = activity.status === 'completed';
            const typeLabel = activityTypes.find(t => t.value === activity.type)?.label || activity.type;

            return (
              <Card key={activity.id} data-testid={`activity-${activity.id}`}>
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    {/* Timeline indicator */}
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </div>
                      {index < activities.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-200 mt-2" style={{ minHeight: '20px' }} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium" data-testid={`activity-title-${activity.id}`}>{activity.title}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {typeLabel}
                            </Badge>
                            <Badge variant={isCompleted ? "default" : "outline"} className="text-xs">
                              {activity.status === 'completed' ? 'Completata' : 
                               activity.status === 'cancelled' ? 'Annullata' : 'In attesa'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {format(new Date(activity.activityDate), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                          </p>
                          {activity.description && (
                            <p className="text-sm mt-2" data-testid={`activity-description-${activity.id}`}>
                              {activity.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(activity)}
                            data-testid={`button-edit-activity-${activity.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(activity.id)}
                            data-testid={`button-delete-activity-${activity.id}`}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
