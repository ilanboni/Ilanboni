import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, Clock, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn, getTodayDateString, getCurrentTimeString } from "@/lib/utils";

// Schema for appointment creation
const appointmentFormSchema = z.object({
  title: z.string().min(1, "Il titolo è obbligatorio"),
  date: z.date({
    required_error: "Seleziona una data",
  }),
  time: z.string().min(1, "Inserisci un orario"),
  location: z.string().optional(),
  notes: z.string().optional(),
  clientId: z.number(),
});

type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

interface CreateAppointmentDialogProps {
  clientId: number;
  clientName: string;
  clientPhone?: string;
}

export function CreateAppointmentDialog({
  clientId,
  clientName,
  clientPhone,
}: CreateAppointmentDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Pre-compile title with client name and phone
  const defaultTitle = clientPhone 
    ? `${clientName} - ${clientPhone}`
    : clientName;

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      title: defaultTitle,
      date: new Date(),
      time: getCurrentTimeString(),
      location: "",
      notes: "",
      clientId,
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      // Combine date and time into a single datetime
      const dateTime = new Date(data.date);
      const [hours, minutes] = data.time.split(':');
      dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Calculate end time (30 minutes later)
      const endDateTime = new Date(dateTime.getTime() + 30 * 60 * 1000);

      return await apiRequest("/api/appointments", {
        method: "POST",
        data: {
          title: data.title,
          description: data.notes || "",
          startDate: dateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          location: data.location || "",
          clientId: data.clientId,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          String(query.queryKey[0]).startsWith("/api/appointments") ||
          String(query.queryKey[0]).startsWith("/api/clients")
      });
      form.reset({
        title: defaultTitle,
        date: new Date(),
        time: getCurrentTimeString(),
        location: "",
        notes: "",
        clientId,
      });
      setOpen(false);
      toast({
        title: "Appuntamento creato",
        description: "L'appuntamento è stato sincronizzato con Google Calendar con promemoria a 1 giorno e 2 ore prima.",
      });
    },
    onError: (error) => {
      console.error("Errore creazione appuntamento:", error);
      toast({
        title: "Errore",
        description: "Non è stato possibile creare l'appuntamento.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AppointmentFormData) => {
    createAppointmentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2" data-testid="button-new-appointment">
          <Plus className="h-4 w-4" />
          <span>Nuovo Appuntamento</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Appuntamento</DialogTitle>
          <DialogDescription>
            Crea un appuntamento per {clientName}. L'evento verrà sincronizzato automaticamente con Google Calendar con promemoria push 1 giorno prima e 2 ore prima.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titolo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Nome Cliente - Telefono"
                      data-testid="input-appointment-title"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-select-date"
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: it })
                            ) : (
                              <span>Seleziona data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orario</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="time"
                          data-testid="input-appointment-time"
                          {...field}
                        />
                      </FormControl>
                      <div className="absolute right-3 top-2.5 opacity-50 pointer-events-none">
                        <Clock className="h-4 w-4" />
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Luogo (opzionale)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="es. Via Roma 123, Milano"
                      data-testid="input-appointment-location"
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
                  <FormLabel>Note (opzionale)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Aggiungi note per l'appuntamento..."
                      className="resize-none h-20"
                      data-testid="textarea-appointment-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-appointment"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={createAppointmentMutation.isPending}
                data-testid="button-submit-appointment"
              >
                {createAppointmentMutation.isPending
                  ? "Creazione..."
                  : "Crea Appuntamento"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
