import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { format } from "date-fns";
import { safeFormatDate } from "@/lib/utils";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  type Communication,
  type Client,
  type Property
} from "@shared/schema";

export default function CommunicationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Fetch communication details with debugging
  const { data: communication, isLoading, isError, error } = useQuery<Communication>({
    queryKey: [`/api/communications/${id}`],
    enabled: !isNaN(id),
    onSuccess: (data) => {
      console.log("Communication data loaded successfully:", data);
    },
    onError: (err) => {
      console.error("Error loading communication:", err);
    }
  });
  
  // Fetch client details
  const { data: client } = useQuery<Client>({
    queryKey: [`/api/clients/${communication?.clientId}`],
    enabled: !!communication?.clientId,
    onSuccess: (data) => {
      console.log("Client data loaded successfully:", data);
    },
    onError: (err) => {
      console.error("Error loading client:", err);
    }
  });
  
  // Fetch property details if available
  const { data: property } = useQuery<Property>({
    queryKey: [`/api/properties/${communication?.propertyId}`],
    enabled: !!communication?.propertyId,
    onSuccess: (data) => {
      console.log("Property data loaded successfully:", data);
    },
    onError: (err) => {
      console.error("Error loading property:", err);
    }
  });
  
  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/communications/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      
      // Show success message
      toast({
        title: "Comunicazione eliminata",
        description: "La comunicazione è stata eliminata con successo",
      });
      
      // Redirect to communications list
      setLocation("/communications");
    },
    onError: (error: any) => {
      console.error("Error deleting communication:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'eliminazione della comunicazione",
        variant: "destructive",
      });
    },
  });
  
  // Get type badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "email":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Email</Badge>;
      case "phone":
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Telefono</Badge>;
      case "whatsapp":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">WhatsApp</Badge>;
      case "meeting":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Incontro</Badge>;
      case "sms":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50">SMS</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };
  
  // Get status badge
  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case "new":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Nuovo</Badge>;
      case "ongoing":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In corso</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completato</Badge>;
      case "pending":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">In attesa</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  // Get direction indicator
  const getDirectionIndicator = (direction: string) => {
    if (direction === "inbound") {
      return (
        <div className="flex items-center text-green-600">
          <i className="fas fa-arrow-down mr-1.5"></i>
          <span>In entrata (dal cliente)</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-blue-600">
          <i className="fas fa-arrow-up mr-1.5"></i>
          <span>In uscita (verso il cliente)</span>
        </div>
      );
    }
  };
  
  // Loading state or error state
  if (isNaN(id) || isLoading || isError || !communication) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="text-6xl text-gray-300 mb-4">
          {isLoading ? (
            <i className="fas fa-spinner animate-spin"></i>
          ) : isError ? (
            <i className="fas fa-exclamation-triangle"></i>
          ) : (
            <i className="fas fa-search"></i>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-gray-700 mb-4">
          {isLoading ? "Caricamento in corso..." : 
           isError ? "Errore durante il caricamento" : 
           "Comunicazione non trovata"}
        </h1>
        <p className="text-gray-500 mb-6">
          {isLoading
            ? "Attendere mentre carichiamo i dati."
            : isError
            ? `Si è verificato un errore durante il caricamento dei dati: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
            : "La comunicazione che stai cercando non esiste o è stata rimossa."
          }
        </p>
        <div>
          {isError && (
            <pre className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded overflow-auto max-w-full">
              {JSON.stringify(error, null, 2)}
            </pre>
          )}
        </div>
        <Button asChild>
          <Link href="/communications">
            <div className="px-2 py-1">
              <i className="fas fa-arrow-left mr-2"></i> Torna alle comunicazioni
            </div>
          </Link>
        </Button>
      </div>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>{communication?.subject || "Dettaglio comunicazione"} | Gestionale Immobiliare</title>
        <meta name="description" content="Visualizza i dettagli della comunicazione nel sistema di gestione immobiliare" />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              Dettaglio Comunicazione
              <span className="ml-3">
                {communication && getTypeBadge(communication.type)}
              </span>
              <span className="ml-2">
                {communication?.status && getStatusBadge(communication.status)}
              </span>
            </h1>
            <p className="text-gray-500 mt-1">
              {communication?.createdAt ? 
                (() => {
                  try {
                    return formatDistanceToNow(new Date(communication.createdAt), {
                      addSuffix: true,
                      locale: it,
                    });
                  } catch (e) {
                    console.error("Errore formatDistanceToNow:", e);
                    return "Data non disponibile";
                  }
                })() : "Data non disponibile"
              }
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              asChild
            >
              <Link href="/communications">
                <div className="px-2 py-1">
                  <i className="fas fa-arrow-left mr-2"></i> Indietro
                </div>
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              asChild
              className="gap-2"
            >
              <Link href={`/communications/${id}/edit`}>
                <i className="fas fa-edit"></i>
                <span>Modifica</span>
              </Link>
            </Button>
            
            <Button 
              variant="destructive" 
              onClick={() => setIsDeleteDialogOpen(true)}
              className="gap-2"
            >
              <i className="fas fa-trash"></i>
              <span>Elimina</span>
            </Button>
          </div>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{communication?.subject}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {communication?.direction && (
                    <div className="mb-4 font-medium">
                      {getDirectionIndicator(communication.direction)}
                    </div>
                  )}
                  
                  <pre className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded overflow-auto max-w-full">
                    Debug comunicazione: {JSON.stringify(communication, null, 2)}
                  </pre>
                  
                  {communication?.content ? (
                    <div className="whitespace-pre-line text-gray-700 border p-4 rounded-md bg-white">
                      <strong>Contenuto del messaggio:</strong><br />
                      {communication.content}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Nessun contenuto disponibile</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Follow-up Info */}
            {communication?.needsFollowUp && (
              <Card className="mt-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-red-600 flex items-center">
                    <i className="fas fa-exclamation-circle mr-2"></i>
                    Follow-up richiesto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <span className="mr-2 font-medium">Data prevista:</span>
                    {communication.followUpDate ? (
                      <span>
                        {(() => {
                          try {
                            return format(new Date(communication.followUpDate), "dd/MM/yyyy");
                          } catch (e) {
                            console.error("Errore formattazione data:", e);
                            return "Data non valida";
                          }
                        })()}
                      </span>
                    ) : (
                      <span className="text-gray-500 italic">Data non specificata</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Sidebar with details */}
          <div>
            {/* Client Info */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Informazioni Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {client ? (
                    <>
                      <div>
                        <span className="font-medium block text-gray-500 text-sm">Nome</span>
                        <span>{client.firstName} {client.lastName}</span>
                      </div>
                      <div>
                        <span className="font-medium block text-gray-500 text-sm">Email</span>
                        <span>{client.email || "Non disponibile"}</span>
                      </div>
                      <div>
                        <span className="font-medium block text-gray-500 text-sm">Telefono</span>
                        <span>{client.phone || "Non disponibile"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500 italic py-2">
                      Caricamento informazioni cliente...
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-0 pb-3">
                {client && (
                  <Link href={`/clients/${client.id}`}>
                    <Button variant="link" className="p-0 h-auto">
                      Vai alla scheda cliente
                      <i className="fas fa-arrow-right ml-2"></i>
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
            
            {/* Property Info if available */}
            {communication?.propertyId && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Immobile Correlato</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {property ? (
                      <>
                        <div>
                          <span className="font-medium block text-gray-500 text-sm">Indirizzo</span>
                          <span>{property.address}</span>
                        </div>
                        <div>
                          <span className="font-medium block text-gray-500 text-sm">Città</span>
                          <span>{property.city}</span>
                        </div>
                        <div>
                          <span className="font-medium block text-gray-500 text-sm">Tipologia</span>
                          <span>{property.type}</span>
                        </div>
                        <div>
                          <span className="font-medium block text-gray-500 text-sm">Prezzo</span>
                          <span>€ {property.price.toLocaleString()}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-500 italic py-2">
                        Caricamento informazioni immobile...
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0 pb-3">
                  {property && (
                    <Link href={`/properties/${property.id}`}>
                      <Button variant="link" className="p-0 h-auto">
                        Vai alla scheda immobile
                        <i className="fas fa-arrow-right ml-2"></i>
                      </Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questa comunicazione?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. La comunicazione sarà eliminata
              permanentemente dal sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">
                    <i className="fas fa-spinner"></i>
                  </span>
                  Eliminazione...
                </>
              ) : (
                <>Elimina</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}