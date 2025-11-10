import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertTaskSchema } from "@shared/schema";
import { Plus } from "lucide-react";

interface CreateTaskDialogProps {
  clientId: number;
  clientName?: string;
}

// Create form schema by picking only needed fields, then extending with validation
const createTaskFormSchema = insertTaskSchema
  .pick({
    type: true,
    title: true,
    description: true,
    dueDate: true,
    priority: true,
    clientId: true,
    status: true
  })
  .extend({
    type: z.string().min(1, "Tipo obbligatorio"),
    title: z.string().min(1, "Titolo obbligatorio"),
    description: z.string().optional(),
    dueDate: z.string().min(1, "Data di scadenza obbligatoria"),
    priority: z.coerce.number().min(1).max(3).default(2),
    clientId: z.number(),
    status: z.string().default("pending")
  });

type CreateTaskFormData = z.infer<typeof createTaskFormSchema>;

export function CreateTaskDialog({ clientId, clientName }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get today's date in local timezone for default dueDate
  const getTodayLocalDateString = () => {
    const today = new Date();
    return format(today, 'yyyy-MM-dd');
  };

  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: {
      type: "followUp",
      title: "",
      description: "",
      dueDate: getTodayLocalDateString(),
      priority: 2,
      clientId,
      status: "pending"
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: CreateTaskFormData) => {
      return await apiRequest("/api/tasks", {
        method: "POST",
        data: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      form.reset();
      setOpen(false);
      toast({
        title: "Attività creata",
        description: "L'attività è stata aggiunta con successo.",
      });
    },
    onError: (error) => {
      console.error("Errore creazione attività:", error);
      toast({
        title: "Errore",
        description: "Non è stato possibile creare l'attività.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateTaskFormData) => {
    createTaskMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default"
          className="gap-2"
          data-testid="button-new-task"
        >
          <Plus className="h-4 w-4" />
          <span>Nuova Attività</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Nuova Attività {clientName ? `per ${clientName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-task-type">
                        <SelectValue placeholder="Seleziona tipo" />
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titolo *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Es: Richiamare per appuntamento"
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
                      placeholder="Note aggiuntive..."
                      rows={3}
                      data-testid="textarea-task-description"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scadenza *</FormLabel>
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
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-task-priority">
                          <SelectValue placeholder="Priorità" />
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

            <DialogFooter>
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel-task"
              >
                Annulla
              </Button>
              <Button 
                type="submit"
                disabled={createTaskMutation.isPending}
                data-testid="button-create-task"
              >
                {createTaskMutation.isPending && <i className="fas fa-spinner animate-spin mr-2"></i>}
                Crea Attività
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
