import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Phone, User, Calendar, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Schema per il form appuntamento rapido
const quickAppointmentSchema = z.object({
  salutation: z.string().min(1, "Seleziona un appellativo"),
  firstName: z.string().min(1, "Il nome è obbligatorio"),
  lastName: z.string().min(1, "Il cognome è obbligatorio"),
  phone: z.string().min(1, "Il numero di telefono è obbligatorio"),
  date: z.date({
    required_error: "La data è obbligatoria",
  }),
  time: z.string().min(1, "L'ora è obbligatoria"),
  address: z.string().min(1, "L'indirizzo è obbligatorio"),
});

type QuickAppointmentFormData = z.infer<typeof quickAppointmentSchema>;

interface CommunicationCallManagerProps {
  communication: any;
  property: any;
  onSuccess?: () => void;
}

export default function CommunicationCallManager({ 
  communication, 
  property, 
  onSuccess 
}: CommunicationCallManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [callOutcome, setCallOutcome] = useState("");
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);

  // Form per appuntamento rapido
  const appointmentForm = useForm<QuickAppointmentFormData>({
    resolver: zodResolver(quickAppointmentSchema),
    defaultValues: {
      salutation: "",
      firstName: "",
      lastName: "",
      phone: "",
      date: undefined,
      time: "",
      address: property?.address || "",
    },
  });

  // Mutation per registrare esito chiamata
  const recordCallMutation = useMutation({
    mutationFn: async (data: { outcome: string }) => {
      const response = await fetch(`/api/communications/${communication.id}/record-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to record call');
      return response.json();
    },
    onSuccess: () => {
      setCallOutcome("");
      setIsCallDialogOpen(false);
      onSuccess?.();
      toast({
        title: "Chiamata registrata",
        description: "L'esito della chiamata è stato salvato con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile registrare l'esito della chiamata.",
        variant: "destructive",
      });
    },
  });

  // Mutation per creare cliente con ricerca automatica
  const createClientWithSearchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/communications/${communication.id}/create-client-with-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
          propertyPrice: property.price,
          propertySize: property.size,
          propertyLocation: property.location,
        }),
      });
      if (!response.ok) throw new Error('Failed to create client with search');
      return response.json();
    },
    onSuccess: (data) => {
      onSuccess?.();
      toast({
        title: "Cliente creato",
        description: `Cliente ${data.client.firstName} ${data.client.lastName} creato con ricerca automatica (${data.searchCriteria.radius}m, max €${data.searchCriteria.maxPrice?.toLocaleString()}, min ${data.searchCriteria.minSize}mq).`,
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile creare il cliente con ricerca automatica.",
        variant: "destructive",
      });
    },
  });

  // Mutation per creare appuntamento rapido con cliente
  const createQuickAppointmentMutation = useMutation({
    mutationFn: async (data: QuickAppointmentFormData) => {
      const response = await fetch(`/api/communications/${communication.id}/create-quick-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          propertyId: property.id,
          propertyPrice: property.price,
          propertySize: property.size,
          propertyLocation: property.location,
        }),
      });
      if (!response.ok) throw new Error('Failed to create quick appointment');
      return response.json();
    },
    onSuccess: (data) => {
      setIsAppointmentDialogOpen(false);
      appointmentForm.reset();
      onSuccess?.();
      toast({
        title: "Appuntamento creato",
        description: `Cliente ${data.client.firstName} ${data.client.lastName} creato e appuntamento confermato per ${data.appointment.date} alle ${data.appointment.time}.`,
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile creare l'appuntamento.",
        variant: "destructive",
      });
    },
  });

  const handleRecordCall = () => {
    if (!callOutcome.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci l'esito della chiamata.",
        variant: "destructive",
      });
      return;
    }
    recordCallMutation.mutate({ outcome: callOutcome });
  };

  const handleCreateClient = () => {
    createClientWithSearchMutation.mutate();
  };

  const onAppointmentSubmit = (data: QuickAppointmentFormData) => {
    createQuickAppointmentMutation.mutate(data);
  };

  // Estrai informazioni dal contenuto della comunicazione
  const extractClientInfo = () => {
    const content = communication.content || "";
    const clientNameMatch = content.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    const emailMatch = content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    
    return {
      name: clientNameMatch ? clientNameMatch[1] : "Cliente",
      email: emailMatch ? emailMatch[1] : "",
    };
  };

  const clientInfo = extractClientInfo();

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Phone className="mr-2 h-5 w-5" />
          Gestione Chiamata
        </CardTitle>
        <CardDescription>
          Registra l'esito della chiamata e crea cliente o appuntamento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Informazioni cliente estratte */}
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="text-sm font-medium text-blue-900 mb-1">
            Informazioni estratte dalla comunicazione:
          </div>
          <div className="text-sm text-blue-700">
            <div><strong>Nome:</strong> {clientInfo.name}</div>
            {clientInfo.email && <div><strong>Email:</strong> {clientInfo.email}</div>}
            <div><strong>Immobile:</strong> {property?.address}</div>
          </div>
        </div>

        <Separator />

        {/* Registra esito chiamata */}
        <Dialog open={isCallDialogOpen} onOpenChange={setIsCallDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <MessageCircle className="mr-2 h-4 w-4" />
              Registra Esito Chiamata
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registra Esito Chiamata</DialogTitle>
              <DialogDescription>
                Inserisci i dettagli dell'esito della chiamata con {clientInfo.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="outcome">Esito della chiamata</Label>
                <Textarea
                  id="outcome"
                  placeholder="Descrivi l'esito della chiamata, interesse mostrato, prossimi passi..."
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsCallDialogOpen(false)}
              >
                Annulla
              </Button>
              <Button 
                onClick={handleRecordCall}
                disabled={recordCallMutation.isPending}
              >
                {recordCallMutation.isPending ? "Salvando..." : "Salva Esito"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Azioni rapide */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={handleCreateClient}
            disabled={createClientWithSearchMutation.isPending}
            className="w-full"
          >
            {createClientWithSearchMutation.isPending ? (
              "Creando..."
            ) : (
              <>
                <User className="mr-2 h-4 w-4" />
                Crea Cliente
              </>
            )}
          </Button>

          <Dialog open={isAppointmentDialogOpen} onOpenChange={setIsAppointmentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Calendar className="mr-2 h-4 w-4" />
                Crea Appuntamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Creazione Appuntamento Rapida</DialogTitle>
                <DialogDescription>
                  Crea cliente e appuntamento in un solo passaggio
                </DialogDescription>
              </DialogHeader>
              
              <Form {...appointmentForm}>
                <form onSubmit={appointmentForm.handleSubmit(onAppointmentSubmit)} className="space-y-4">
                  <FormField
                    control={appointmentForm.control}
                    name="salutation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appellativo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona appellativo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Egr. Dott.">Egr. Dott.</SelectItem>
                            <SelectItem value="Gent.ma Sig.ra">Gent.ma Sig.ra</SelectItem>
                            <SelectItem value="Gent.mo Sig.">Gent.mo Sig.</SelectItem>
                            <SelectItem value="Gentile Cliente">Gentile Cliente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={appointmentForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={appointmentForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cognome</FormLabel>
                          <FormControl>
                            <Input placeholder="Cognome" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={appointmentForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefono</FormLabel>
                        <FormControl>
                          <Input placeholder="+39 333 123 4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={appointmentForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
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
                                    format(field.value, "dd/MM/yyyy", { locale: it })
                                  ) : (
                                    <span>Seleziona data</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={appointmentForm.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ora</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={appointmentForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Indirizzo</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly className="bg-gray-50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAppointmentDialogOpen(false)}
                    >
                      Annulla
                    </Button>
                    <Button 
                      type="submit"
                      disabled={createQuickAppointmentMutation.isPending}
                    >
                      {createQuickAppointmentMutation.isPending ? "Creando..." : "Crea Appuntamento"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Info ricerca automatica */}
        <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
          <strong>Ricerca automatica:</strong> Raggio 600m • Prezzo max +10% (€{((property?.price || 0) * 1.1).toLocaleString()}) • Metratura min -10% ({Math.floor((property?.size || 0) * 0.9)}mq)
        </div>
      </CardContent>
    </Card>
  );
}