import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Communication, ClientWithDetails, Property } from "@shared/schema";

export default function CommunicationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [_, setLocation] = useLocation();
  
  // Fetch communication details
  const { data: communication, isLoading } = useQuery<Communication>({
    queryKey: ["/api/communications", id],
    enabled: !isNaN(id),
  });
  
  // Fetch client details if clientId is available
  const { data: client } = useQuery<ClientWithDetails>({
    queryKey: ["/api/clients", communication?.clientId],
    enabled: !!communication?.clientId,
  });
  
  // Fetch property details if propertyId is available
  const { data: property } = useQuery<Property>({
    queryKey: ["/api/properties", communication?.propertyId],
    enabled: !!communication?.propertyId,
  });

  // Handle invalid id or loading state
  if (isNaN(id) || (isLoading && !communication)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="text-6xl text-gray-300 mb-4">
          <i className="fas fa-search"></i>
        </div>
        <h1 className="text-2xl font-semibold text-gray-700 mb-4">
          {isLoading ? "Caricamento in corso..." : "Comunicazione non trovata"}
        </h1>
        <p className="text-gray-500 mb-6">
          {isLoading
            ? "Attendere mentre carichiamo i dati."
            : "La comunicazione che stai cercando non esiste o è stata rimossa."
          }
        </p>
        <Button asChild>
          <Link href="/communications">
            <i className="fas fa-arrow-left mr-2"></i> Torna alle comunicazioni
          </Link>
        </Button>
      </div>
    );
  }
  
  // Get communication type badge color
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
  
  // Get status badge color
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
  
  // Get direction icon and text
  const getDirectionDisplay = (direction: string) => {
    return direction === "inbound" 
      ? <span className="flex items-center"><i className="fas fa-arrow-down text-green-600 mr-2"></i> In entrata</span>
      : <span className="flex items-center"><i className="fas fa-arrow-up text-blue-600 mr-2"></i> In uscita</span>;
  };
  
  return (
    <>
      <Helmet>
        <title>{communication?.subject || "Dettaglio comunicazione"} | Gestionale Immobiliare</title>
        <meta name="description" content={`Dettagli della comunicazione: ${communication?.subject}`} />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="icon" asChild>
              <Link href="/communications">
                <i className="fas fa-arrow-left"></i>
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{communication?.subject}</h1>
              <div className="flex items-center mt-1 text-sm text-gray-500 space-x-2">
                <span>{format(new Date(communication?.createdAt || new Date()), "PPP", { locale: it })}</span>
                <span>•</span>
                <span>ID: {communication?.id}</span>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              className="gap-1"
              onClick={() => setLocation(`/communications/${id}/edit`)}
            >
              <i className="fas fa-edit"></i>
              <span>Modifica</span>
            </Button>
          </div>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Dettagli comunicazione</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Tipo</h3>
                    <div className="flex items-center text-base">
                      {getTypeBadge(communication?.type || "")}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Direzione</h3>
                    <div className="flex items-center text-base">
                      {getDirectionDisplay(communication?.direction || "")}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Stato</h3>
                    <div className="flex items-center text-base">
                      {getStatusBadge(communication?.status)}
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contenuto</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                    {communication?.content ? (
                      <div className="whitespace-pre-wrap">{communication.content}</div>
                    ) : (
                      <p className="text-gray-400 italic">Nessun contenuto</p>
                    )}
                  </div>
                </div>
                
                {communication?.needsFollowUp && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start space-x-3">
                    <div className="text-red-500 mt-1">
                      <i className="fas fa-exclamation-circle"></i>
                    </div>
                    <div>
                      <h3 className="font-medium text-red-800">Richiede follow-up</h3>
                      {communication?.followUpDate && (
                        <p className="text-red-700 text-sm mt-1">
                          Data follow-up: {format(new Date(communication.followUpDate), "PPP", { locale: it })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Side panel */}
          <div>
            <div className="space-y-6">
              {/* Client info */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gray-50 pb-3">
                  <CardTitle className="text-base">
                    <i className="fas fa-user mr-2"></i> Informazioni Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {client ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                          <i className="fas fa-user"></i>
                        </div>
                        <div>
                          <h3 className="font-medium">{client.firstName} {client.lastName}</h3>
                          <p className="text-sm text-gray-500">{client.type === "buyer" ? "Acquirente" : "Venditore"}</p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        {client.email && (
                          <div className="flex items-center">
                            <i className="fas fa-envelope w-5 text-gray-400"></i>
                            <span className="ml-2">{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center">
                            <i className="fas fa-phone-alt w-5 text-gray-400"></i>
                            <span className="ml-2">{client.phone}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-center pt-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/clients/${client.id}`}>
                            <div className="px-2 py-1">
                              Vedi profilo completo
                            </div>
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-gray-500">
                      <p className="text-sm">
                        {communication?.clientId 
                          ? "Caricamento informazioni cliente..." 
                          : "Nessun cliente associato"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Property info (if related to a property) */}
              {(communication?.propertyId || property) && (
                <Card className="overflow-hidden">
                  <CardHeader className="bg-gray-50 pb-3">
                    <CardTitle className="text-base">
                      <i className="fas fa-home mr-2"></i> Immobile Correlato
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {property ? (
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-medium">{property.address}</h3>
                          <p className="text-sm text-gray-500">{property.city}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Prezzo:</span>{" "}
                            <span className="font-semibold">€{property.price.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Dimensione:</span>{" "}
                            <span className="font-semibold">{property.size} m²</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-center pt-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/properties/${property.id}`}>
                              <div className="px-2 py-1">
                                Vedi dettagli immobile
                              </div>
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-gray-500">
                        <p className="text-sm">Caricamento dettagli immobile...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}