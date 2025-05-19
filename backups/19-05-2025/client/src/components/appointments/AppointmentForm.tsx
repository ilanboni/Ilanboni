import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, Clock } from "lucide-react";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Appointment, ClientWithDetails, PropertyWithDetails } from "@/types";
import { cn, getTodayDateString, getCurrentTimeString } from "@/lib/utils";

// Schema for appointment form
const appointmentFormSchema = z.object({
  clientId: z.number({
    required_error: "Seleziona un cliente",
  }),
  propertyId: z.number({
    required_error: "Seleziona un immobile",
  }),
  date: z.date({
    required_error: "Seleziona una data per l'appuntamento",
  }),
  time: z.string().min(1, "Inserisci un orario valido"),
  type: z.enum(["visit", "call"], {
    required_error: "Seleziona il tipo di appuntamento",
  }),
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
  feedback: z.string().optional(),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface AppointmentFormProps {
  initialData?: Appointment;
  clients: ClientWithDetails[];
  properties: PropertyWithDetails[];
  onSubmit: (data: AppointmentFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function AppointmentForm({
  initialData,
  clients,
  properties,
  onSubmit,
  onCancel,
  isSubmitting = false
}: AppointmentFormProps) {
  // Initialize form with default values or data from existing appointment
  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: initialData ? {
      clientId: initialData.clientId,
      propertyId: initialData.propertyId,
      date: new Date(initialData.date),
      time: initialData.time,
      type: initialData.type as "visit" | "call",
      status: initialData.status as "scheduled" | "completed" | "cancelled",
      feedback: initialData.feedback || "",
      notes: initialData.notes || ""
    } : {
      clientId: undefined,
      propertyId: undefined,
      date: new Date(),
      time: getCurrentTimeString(),
      type: "visit",
      status: "scheduled",
      feedback: "",
      notes: ""
    }
  });
  
  // Handle form submission
  const handleFormSubmit = (data: AppointmentFormValues) => {
    onSubmit(data);
  };
  
  // Get client name for display
  const getClientName = (clientId: number): string => {
    const client = clients.find((c) => c.id === clientId);
    return client 
      ? `${client.firstName} ${client.lastName}` 
      : "Cliente sconosciuto";
  };
  
  // Get property name for display
  const getPropertyName = (propertyId: number): string => {
    const property = properties.find((p) => p.id === propertyId);
    return property 
      ? `${property.address}, ${property.city}` 
      : "Immobile sconosciuto";
  };
  
  // Format appointment type for display
  const formatAppointmentType = (type: string): string => {
    return type === "visit" ? "Visita" : "Telefonata";
  };
  
  // Format appointment status for display
  const formatAppointmentStatus = (status: string): string => {
    switch (status) {
      case "scheduled": return "Programmato";
      case "completed": return "Completato";
      case "cancelled": return "Annullato";
      default: return status;
    }
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem 
                          key={client.id} 
                          value={client.id.toString()}
                        >
                          {client.firstName} {client.lastName} 
                          ({client.type === "buyer" ? "Compratore" : "Venditore"})
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
              name="propertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Immobile</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un immobile" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {properties.map((property) => (
                        <SelectItem 
                          key={property.id} 
                          value={property.id.toString()}
                        >
                          {property.address}, {property.city} ({property.size}m²)
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
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
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
                        placeholder="HH:MM"
                        type="time"
                        {...field}
                      />
                    </FormControl>
                    <div className="absolute right-3 top-2.5 opacity-50">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo di Appuntamento</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="visit">Visita</SelectItem>
                      <SelectItem value="call">Telefonata</SelectItem>
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
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona stato" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="scheduled">Programmato</SelectItem>
                      <SelectItem value="completed">Completato</SelectItem>
                      <SelectItem value="cancelled">Annullato</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="feedback"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Feedback</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Inserisci il feedback del cliente dopo l'appuntamento..."
                    className="resize-none h-24"
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
                    placeholder="Inserisci eventuali note aggiuntive..."
                    className="resize-none h-24"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-4">
            <Button 
              variant="outline" 
              type="button" 
              onClick={onCancel}
            >
              Annulla
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "Salvataggio in corso..." : "Salva Appuntamento"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
