import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Property {
  id: number;
  title: string;
  address: string;
  price: number;
  size: number;
  propertyType: string;
  immobiliareItId?: string;
}

interface AdvancedCallFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
  };
}

export function AdvancedCallForm({ open, onOpenChange, initialData }: AdvancedCallFormProps) {
  const [step, setStep] = useState<"details" | "action">("details");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    propertyId: "",
    propertySearch: "",
    notes: "",
    propertyInterest: "",
  });
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [propertySearchResults, setPropertySearchResults] = useState<Property[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query per recuperare tutte le proprietà
  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: () => apiRequest("/api/properties", { method: "GET" }),
    enabled: open,
  });

  // Effect per inizializzare i dati se forniti
  useEffect(() => {
    if (initialData && open) {
      const nameParts = initialData.contactName?.split(" ") || ["", ""];
      setFormData(prev => ({
        ...prev,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        phone: initialData.contactPhone || "",
        email: initialData.contactEmail || "",
      }));
    }
  }, [initialData, open]);

  // Filtro proprietà in base alla ricerca
  useEffect(() => {
    if (formData.propertySearch && Array.isArray(properties) && properties.length > 0) {
      const filtered = properties.filter((property: Property) =>
        property.title.toLowerCase().includes(formData.propertySearch.toLowerCase()) ||
        property.address.toLowerCase().includes(formData.propertySearch.toLowerCase()) ||
        property.immobiliareItId?.includes(formData.propertySearch)
      );
      setPropertySearchResults(filtered.slice(0, 5)); // Limita a 5 risultati
    } else {
      setPropertySearchResults([]);
    }
  }, [formData.propertySearch, properties]);

  // Mutation per creare task chiamata
  const createTaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/tasks/generic-call", {
      method: "POST",
      data: data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      handleClose();
      toast({
        title: "Chiamata registrata",
        description: "I dettagli della chiamata sono stati salvati come task.",
      });
    },
  });

  // Mutation per creare cliente direttamente
  const createClientMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/clients", {
      method: "POST",
      data: data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      handleClose();
      toast({
        title: "Cliente creato",
        description: "Il nuovo cliente è stato aggiunto al sistema.",
      });
    },
  });

  // Mutation per creare appuntamento
  const createAppointmentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/virtual-assistant/create-task", {
      method: "POST",
      data: data,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      handleClose();
      toast({
        title: "Appuntamento programmato",
        description: "L'appuntamento è stato creato e aggiunto al calendario.",
      });
    },
  });

  const handleClose = () => {
    setStep("details");
    setFormData({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      propertyId: "",
      propertySearch: "",
      notes: "",
      propertyInterest: "",
    });
    setSelectedProperty(null);
    setPropertySearchResults([]);
    onOpenChange(false);
  };

  const handleContinue = () => {
    if (!formData.firstName || !formData.lastName) {
      toast({
        title: "Campi obbligatori",
        description: "Nome e cognome sono obbligatori.",
        variant: "destructive",
      });
      return;
    }
    setStep("action");
  };

  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property);
    setFormData(prev => ({
      ...prev,
      propertyId: property.id.toString(),
      propertySearch: property.title,
    }));
    setPropertySearchResults([]);
  };

  const handleSaveAsTask = () => {
    const taskData = {
      contactName: `${formData.firstName} ${formData.lastName}`,
      contactPhone: formData.phone,
      contactEmail: formData.email,
      propertyInterest: selectedProperty ? selectedProperty.title : formData.propertyInterest,
      notes: formData.notes,
    };
    createTaskMutation.mutate(taskData);
  };

  const handleCreateClient = () => {
    const clientData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      type: "buyer",
      status: "active",
      source: "phone_call",
      notes: formData.notes,
      propertyInterest: selectedProperty ? selectedProperty.title : formData.propertyInterest,
    };
    createClientMutation.mutate(clientData);
  };

  const handleScheduleAppointment = () => {
    const appointmentData = {
      title: `Appuntamento con ${formData.firstName} ${formData.lastName}`,
      description: `Visita immobile: ${selectedProperty ? selectedProperty.title : formData.propertyInterest}\n\nNote: ${formData.notes}`,
      clientId: null, // Verrà creato dopo il cliente
      propertyId: selectedProperty?.id || null,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Domani
      priority: 8,
      type: "appointment",
      status: "pending"
    };
    createAppointmentMutation.mutate(appointmentData);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "details" ? "Dettagli Chiamata" : "Azioni Disponibili"}
          </DialogTitle>
        </DialogHeader>

        {step === "details" && (
          <div className="space-y-6">
            {/* Dati contatto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informazioni Contatto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Nome *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Nome del chiamante"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Cognome *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Cognome del chiamante"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Telefono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+39 335 1234567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@esempio.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ricerca immobile */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Immobile di Interesse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="propertySearch">Cerca Immobile</Label>
                  <Input
                    id="propertySearch"
                    value={formData.propertySearch}
                    onChange={(e) => setFormData(prev => ({ ...prev, propertySearch: e.target.value }))}
                    placeholder="Cerca per titolo, indirizzo o ID immobiliare.it..."
                  />
                </div>

                {/* Risultati ricerca */}
                {propertySearchResults.length > 0 && (
                  <div className="space-y-2">
                    <Label>Risultati Ricerca:</Label>
                    {propertySearchResults.map((property) => (
                      <Card 
                        key={property.id} 
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleSelectProperty(property)}
                      >
                        <CardContent className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{property.title}</h4>
                              <p className="text-sm text-gray-600">{property.address}</p>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline">{property.propertyType}</Badge>
                                <Badge variant="outline">{property.size}m²</Badge>
                                {property.immobiliareItId && (
                                  <Badge variant="outline">ID: {property.immobiliareItId}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-blue-600">{formatPrice(property.price)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Immobile selezionato */}
                {selectedProperty && (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <i className="fas fa-check-circle text-green-600"></i>
                        <span className="font-medium text-green-800">Immobile Selezionato</span>
                      </div>
                      <h4 className="font-medium">{selectedProperty.title}</h4>
                      <p className="text-sm text-gray-600">{selectedProperty.address}</p>
                      <p className="font-bold text-blue-600">{formatPrice(selectedProperty.price)}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Interesse generico */}
                {!selectedProperty && (
                  <div>
                    <Label htmlFor="propertyInterest">Oppure descrivi l'interesse</Label>
                    <Input
                      id="propertyInterest"
                      value={formData.propertyInterest}
                      onChange={(e) => setFormData(prev => ({ ...prev, propertyInterest: e.target.value }))}
                      placeholder="es. Appartamento 3 locali zona centro, budget 200k"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Note */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Note Chiamata</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Dettagli della conversazione, richieste specifiche, disponibilità..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {step === "action" && (
          <div className="space-y-4">
            {/* Riepilogo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Riepilogo Chiamata</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Cliente:</strong> {formData.firstName} {formData.lastName}</p>
                  {formData.phone && <p><strong>Telefono:</strong> {formData.phone}</p>}
                  {formData.email && <p><strong>Email:</strong> {formData.email}</p>}
                  <p><strong>Interesse:</strong> {selectedProperty ? selectedProperty.title : formData.propertyInterest}</p>
                  {formData.notes && <p><strong>Note:</strong> {formData.notes}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Azioni disponibili */}
            <div className="grid gap-4">
              <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-tasks text-blue-600"></i>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Salva come Task</h4>
                      <p className="text-sm text-gray-600">Registra la chiamata per richiamare in seguito</p>
                    </div>
                    <Button onClick={handleSaveAsTask} disabled={createTaskMutation.isPending}>
                      {createTaskMutation.isPending ? "Salvando..." : "Salva Task"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-user-plus text-green-600"></i>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Crea Cliente</h4>
                      <p className="text-sm text-gray-600">Aggiungi immediatamente come nuovo cliente</p>
                    </div>
                    <Button onClick={handleCreateClient} disabled={createClientMutation.isPending}>
                      {createClientMutation.isPending ? "Creando..." : "Crea Cliente"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-calendar-plus text-purple-600"></i>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Fissa Appuntamento</h4>
                      <p className="text-sm text-gray-600">Programma subito una visita o incontro</p>
                    </div>
                    <Button onClick={handleScheduleAppointment} disabled={createAppointmentMutation.isPending}>
                      {createAppointmentMutation.isPending ? "Programmando..." : "Fissa Appuntamento"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button variant="outline" onClick={handleClose}>
              Annulla
            </Button>
            <div className="flex gap-2">
              {step === "action" && (
                <Button variant="outline" onClick={() => setStep("details")}>
                  Indietro
                </Button>
              )}
              {step === "details" && (
                <Button onClick={handleContinue}>
                  Continua
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}