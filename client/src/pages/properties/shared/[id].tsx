import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ArrowLeft, CalendarRange, Edit, ExternalLink, MapPin, Phone, Trash, User, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { InsertSharedProperty, SharedProperty } from "@shared/schema";
import { SharedPropertyForm } from "@/components/properties/SharedPropertyForm";
import { apiRequest } from "@/lib/queryClient";
import SharedPropertyTasks from "@/components/properties/SharedPropertyTasks";
import SharedPropertyMatchingBuyers from "@/components/properties/SharedPropertyMatchingBuyers";

function getStageColor(stage: string) {
  switch (stage) {
    case "address_found":
      return "bg-gray-200 text-gray-800";
    case "owner_found":
      return "bg-blue-200 text-blue-800";
    case "owner_contact_found":
      return "bg-indigo-200 text-indigo-800";
    case "owner_contacted":
      return "bg-violet-200 text-violet-800";
    case "result":
      return "bg-green-200 text-green-800";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

function getStageLabel(stage: string) {
  switch (stage) {
    case "address_found":
      return "Indirizzo trovato";
    case "owner_found":
      return "Proprietario trovato";
    case "owner_contact_found":
      return "Contatto del proprietario";
    case "owner_contacted":
      return "Proprietario contattato";
    case "result":
      return "Risultato";
    default:
      return stage;
  }
}

function formatDate(dateString: string | Date) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("it-IT", { 
    day: "numeric", 
    month: "long", 
    year: "numeric" 
  }).format(date);
}

export default function SharedPropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAcquireDialogOpen, setIsAcquireDialogOpen] = useState(false);
  
  // Fetch shared property details
  const { data: property, isLoading, isError, error } = useQuery({
    queryKey: ['/api/shared-properties', params.id],
    queryFn: async () => {
      const response = await fetch(`/api/shared-properties/${params.id}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei dettagli della proprietà condivisa');
      }
      return response.json() as Promise<SharedProperty>;
    }
  });
  
  // Fetch matching buyers if property has the matchBuyers flag
  const { data: matchingBuyers } = useQuery({
    queryKey: ['/api/shared-properties', params.id, 'matching-buyers'],
    queryFn: async () => {
      if (!property?.matchBuyers) return null;
      
      const response = await fetch(`/api/shared-properties/${params.id}/matching-buyers`);
      if (!response.ok) {
        console.error('Errore nel caricamento degli acquirenti compatibili');
        return null;
      }
      return response.json();
    },
    enabled: !!property?.matchBuyers
  });
  
  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: InsertSharedProperty) => {
      return apiRequest(`/api/shared-properties/${params.id}`, {
        method: 'PATCH',
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties', params.id] });
      toast({
        title: "Proprietà aggiornata",
        description: "La proprietà condivisa è stata aggiornata con successo.",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'aggiornamento della proprietà condivisa.",
      });
    }
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/shared-properties/${params.id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      toast({
        title: "Proprietà eliminata",
        description: "La proprietà condivisa è stata eliminata con successo.",
      });
      setLocation("/properties/shared");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'eliminazione della proprietà condivisa.",
      });
    }
  });
  
  // Acquire mutation
  const acquireMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/shared-properties/${params.id}/acquire`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: "Proprietà acquisita",
        description: "La proprietà è stata acquisita e trasferita al tuo portfolio.",
      });
      // Redirect to the new property
      setLocation(`/properties/${data.propertyId}`);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante l'acquisizione della proprietà.",
      });
    }
  });
  
  const handleUpdate = (data: InsertSharedProperty) => {
    updateMutation.mutate(data);
  };
  
  const handleDelete = () => {
    deleteMutation.mutate();
    setIsDeleteDialogOpen(false);
  };
  
  const handleAcquire = () => {
    acquireMutation.mutate();
    setIsAcquireDialogOpen(false);
  };
  
  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/properties/shared")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <Skeleton className="h-9 w-64" />
        </div>
        
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-3/4 mb-1" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isError || !property) {
    return (
      <div className="container py-8">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/properties/shared")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <h1 className="text-3xl font-bold">Dettagli Proprietà Condivisa</h1>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Si è verificato un errore nel caricamento dei dettagli della proprietà condivisa."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (isEditing) {
    return (
      <div className="container py-8">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(false)}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Indietro
          </Button>
          <h1 className="text-3xl font-bold">Modifica Proprietà Condivisa</h1>
        </div>
        
        <Card className="p-6">
          <SharedPropertyForm
            initialData={property}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isSubmitting={updateMutation.isPending}
          />
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLocation("/properties/shared")}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
        <h1 className="text-3xl font-bold">Dettagli Proprietà Condivisa</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <CardTitle className="text-2xl">{property.address}</CardTitle>
                  <CardDescription className="flex items-center mt-1">
                    <MapPin className="h-4 w-4 mr-1" />
                    {property.city}
                  </CardDescription>
                </div>
                <div className="flex gap-2 mt-2 sm:mt-0">
                  <Badge className={getStageColor(property.stage)}>
                    {getStageLabel(property.stage)}
                  </Badge>
                  {property.isAcquired && (
                    <Badge variant="success" className="bg-green-100 text-green-800">
                      Acquisito
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Dettagli Immobile</h3>
                  
                  <div className="space-y-3">
                    {property.size && property.price && (
                      <div className="flex justify-between border-b pb-2">
                        <Label>Dimensione / Prezzo</Label>
                        <span className="font-medium">{property.size} m² - {property.price.toLocaleString()} €</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between border-b pb-2">
                      <Label>Valutazione</Label>
                      <span className="font-medium">
                        {'★'.repeat(property.rating || 0)}
                        {'☆'.repeat(5 - (property.rating || 0))}
                      </span>
                    </div>
                    
                    <div className="flex justify-between border-b pb-2">
                      <Label>Data inserimento</Label>
                      <span className="font-medium">{formatDate(property.createdAt || new Date())}</span>
                    </div>
                    
                    <div className="flex justify-between border-b pb-2">
                      <Label>Ultimo aggiornamento</Label>
                      <span className="font-medium">{formatDate(property.updatedAt || new Date())}</span>
                    </div>
                    
                    {property.stageResult && (
                      <div className="flex flex-col border-b pb-2">
                        <Label className="mb-1">Risultato fase</Label>
                        <span className="font-medium">{property.stageResult}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Informazioni Proprietario</h3>
                  
                  <div className="space-y-3">
                    {property.ownerName ? (
                      <div className="flex justify-between border-b pb-2">
                        <Label>Nome proprietario</Label>
                        <span className="font-medium">{property.ownerName}</span>
                      </div>
                    ) : (
                      <div className="border-b pb-2 text-gray-500 text-sm">
                        Nessuna informazione sul proprietario disponibile
                      </div>
                    )}
                    
                    {property.ownerPhone && (
                      <div className="flex justify-between border-b pb-2">
                        <Label>Telefono proprietario</Label>
                        <span className="font-medium">{property.ownerPhone}</span>
                      </div>
                    )}
                    
                    {property.ownerEmail && (
                      <div className="flex justify-between border-b pb-2">
                        <Label>Email proprietario</Label>
                        <span className="font-medium">{property.ownerEmail}</span>
                      </div>
                    )}
                    
                    {property.ownerNotes && (
                      <div className="flex flex-col border-b pb-2">
                        <Label className="mb-1">Note proprietario</Label>
                        <span className="font-medium">{property.ownerNotes}</span>
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-3 mt-6">Link Agenzie</h3>
                  
                  <div className="space-y-3">
                    {property.agency1Link ? (
                      <div className="flex justify-between items-center border-b pb-2">
                        <Label>Agenzia 1</Label>
                        <a 
                          href={property.agency1Link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline flex items-center"
                        >
                          Apri link <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>
                      </div>
                    ) : (
                      <div className="border-b pb-2 text-gray-500 text-sm">
                        Nessun link per Agenzia 1
                      </div>
                    )}
                    
                    {property.agency2Link ? (
                      <div className="flex justify-between items-center border-b pb-2">
                        <Label>Agenzia 2</Label>
                        <a 
                          href={property.agency2Link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline flex items-center"
                        >
                          Apri link <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>
                      </div>
                    ) : (
                      <div className="border-b pb-2 text-gray-500 text-sm">
                        Nessun link per Agenzia 2
                      </div>
                    )}
                    
                    {property.agency3Link ? (
                      <div className="flex justify-between items-center border-b pb-2">
                        <Label>Agenzia 3</Label>
                        <a 
                          href={property.agency3Link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline flex items-center"
                        >
                          Apri link <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>
                      </div>
                    ) : (
                      <div className="border-b pb-2 text-gray-500 text-sm">
                        Nessun link per Agenzia 3
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Map will be added here in future */}
            </CardContent>
            
            <CardFooter className="flex justify-between border-t pt-6">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifica
                </Button>
                
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="text-red-600 hover:text-red-700">
                      <Trash className="h-4 w-4 mr-2" />
                      Elimina
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Conferma eliminazione</DialogTitle>
                      <DialogDescription>
                        Sei sicuro di voler eliminare questa proprietà condivisa? Questa azione non può essere annullata.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? "Eliminazione..." : "Elimina"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              {!property.isAcquired && (
                <Dialog open={isAcquireDialogOpen} onOpenChange={setIsAcquireDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Acquisici immobile
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Conferma acquisizione</DialogTitle>
                      <DialogDescription>
                        Acquisendo questa proprietà, verrà creata nel tuo portfolio di immobili. Vuoi procedere?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAcquireDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button onClick={handleAcquire} disabled={acquireMutation.isPending}>
                        {acquireMutation.isPending ? "Acquisizione..." : "Acquisisci"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardFooter>
          </Card>
        </div>
        
        <div>
          {property.matchBuyers && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Compratori Compatibili</CardTitle>
                <CardDescription>
                  Potenziali acquirenti interessati a questo tipo di immobile
                </CardDescription>
              </CardHeader>
              <CardContent>
                {matchingBuyers ? (
                  matchingBuyers.length > 0 ? (
                    <div className="space-y-4">
                      {matchingBuyers.map((buyer: any) => (
                        <div key={buyer.id} className="border rounded-md p-3 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center">
                              <User className="h-5 w-5 text-gray-400 mr-2" />
                              <div>
                                <p className="font-medium">{buyer.firstName} {buyer.lastName}</p>
                                <p className="text-sm text-gray-500">{buyer.email || buyer.phone}</p>
                              </div>
                            </div>
                            <Badge variant="outline">{buyer.urgent ? "Urgente" : "Standard"}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-6">
                      Nessun compratore compatibile trovato
                    </p>
                  )
                ) : (
                  <div className="space-y-3 py-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setLocation("/clients/type/buyer")}>
                  <User className="h-4 w-4 mr-2" />
                  Gestisci compratori
                </Button>
              </CardFooter>
            </Card>
          )}
          
          {/* Activity feed could be added here in the future */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Attività recenti</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 text-center py-6">
                Le attività recenti saranno mostrate qui
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}