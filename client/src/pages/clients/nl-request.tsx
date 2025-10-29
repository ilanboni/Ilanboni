import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Search, Building2, Euro, Maximize2, MapPin, CheckCircle2, Home } from "lucide-react";

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  type: string;
}

interface Property {
  id: number;
  address: string;
  city: string;
  size: number;
  price: number;
  type: string;
  portal?: string;
  isMultiagency?: boolean;
}

interface NLRequestResult {
  ok: boolean;
  message: string;
  requestId: number;
  filters: any;
  matchingProperties: Property[];
}

export default function NaturalLanguageRequestPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [requestText, setRequestText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<NLRequestResult | null>(null);
  const { toast } = useToast();

  const { data: clients, isLoading: loadingClients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const buyerClients = clients?.filter(c => c.type === 'buyer') || [];

  const handleSubmit = async () => {
    if (!selectedClientId) {
      toast({
        title: "Cliente non selezionato",
        description: "Seleziona un cliente prima di procedere",
        variant: "destructive",
      });
      return;
    }

    if (!requestText.trim()) {
      toast({
        title: "Richiesta vuota",
        description: "Inserisci una descrizione della richiesta del cliente",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const response = await apiRequest(
        `/api/clients/${selectedClientId}/nl-request`,
        {
          method: "POST",
          data: { text: requestText },
        }
      );

      const data = await response.json() as NLRequestResult;
      setResult(data);
      
      toast({
        title: "✅ Richiesta elaborata!",
        description: `Trovati ${data.matchingProperties.length} immobili compatibili`,
      });
    } catch (error: any) {
      console.error("Error processing NL request:", error);
      toast({
        title: "Errore elaborazione",
        description: error.message || "Impossibile elaborare la richiesta",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setRequestText("");
    setResult(null);
    setSelectedClientId("");
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Helmet>
        <title>Nuova Richiesta Cliente - CRM</title>
      </Helmet>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-600" />
          Nuova Richiesta Cliente
        </h1>
        <p className="text-gray-600">
          Inserisci la richiesta del cliente in linguaggio naturale. L'AI elaborerà automaticamente i criteri di ricerca e troverà gli immobili compatibili.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dati Richiesta</CardTitle>
              <CardDescription>
                Seleziona il cliente e inserisci la sua richiesta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="client-select">Cliente Acquirente</Label>
                {loadingClients ? (
                  <Skeleton className="h-10 w-full mt-2" />
                ) : (
                  <Select
                    value={selectedClientId}
                    onValueChange={setSelectedClientId}
                    disabled={isProcessing}
                  >
                    <SelectTrigger id="client-select" className="mt-2" data-testid="select-client">
                      <SelectValue placeholder="Seleziona un cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {buyerClients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.firstName} {client.lastName} ({client.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label htmlFor="request-text">Descrizione Richiesta</Label>
                <Textarea
                  id="request-text"
                  placeholder="Es: Cerco appartamento di almeno 160 metri più terrazzo di almeno 30 metri. Deve essere un attico. Zona Pagano, Porta Romana, Wagner, Via Sardegna, Frua, Conciliazione."
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  disabled={isProcessing}
                  className="mt-2 min-h-[150px]"
                  data-testid="textarea-request"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Puoi includere: metratura, numero locali, zona, caratteristiche speciali, budget, ecc.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing || !selectedClientId || !requestText.trim()}
                  className="flex-1"
                  data-testid="button-process"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Elaborazione in corso...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Elabora Richiesta
                    </>
                  )}
                </Button>
                
                {result && (
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    data-testid="button-reset"
                  >
                    Nuova Richiesta
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  Criteri Estratti dall'AI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {result.filters.property_type && (
                    <div>
                      <span className="font-medium">Tipo:</span>{" "}
                      <Badge variant="secondary">{result.filters.property_type}</Badge>
                    </div>
                  )}
                  {result.filters.size_min && (
                    <div>
                      <span className="font-medium">Metratura minima:</span> {result.filters.size_min}mq
                    </div>
                  )}
                  {result.filters.budget_max && (
                    <div>
                      <span className="font-medium">Budget massimo:</span> €{result.filters.budget_max.toLocaleString()}
                    </div>
                  )}
                  {result.filters.rooms && (
                    <div>
                      <span className="font-medium">Locali:</span> {result.filters.rooms}
                    </div>
                  )}
                  {result.filters.bathrooms && (
                    <div>
                      <span className="font-medium">Bagni:</span> {result.filters.bathrooms}
                    </div>
                  )}
                  {result.filters.floor_min && (
                    <div>
                      <span className="font-medium">Piano minimo:</span> {result.filters.floor_min}
                    </div>
                  )}
                  {result.filters.zones && result.filters.zones.length > 0 && (
                    <div>
                      <span className="font-medium">Zone richieste:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.filters.zones.map((zone: string, idx: number) => (
                          <Badge key={idx} variant="outline">{zone}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.filters.features && result.filters.features.length > 0 && (
                    <div>
                      <span className="font-medium">Caratteristiche:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.filters.features.map((feature: string, idx: number) => (
                          <Badge key={idx} variant="outline">{feature}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          {result ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Immobili Compatibili ({result.matchingProperties.length})
                </CardTitle>
                <CardDescription>
                  Immobili che corrispondono ai criteri richiesti
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.matchingProperties.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun immobile trovato con questi criteri</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {result.matchingProperties.map((property) => (
                      <Card key={property.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-gray-500" />
                                {property.address}, {property.city}
                              </h3>
                              <div className="flex gap-2 items-center text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Maximize2 className="h-3 w-3" />
                                  {property.size}mq
                                </span>
                                <span className="flex items-center gap-1">
                                  <Euro className="h-3 w-3" />
                                  {property.price.toLocaleString()}
                                </span>
                              </div>
                            </div>
                            {property.isMultiagency && (
                              <Badge variant="destructive" className="text-xs">
                                Multi-agency
                              </Badge>
                            )}
                          </div>
                          
                          {property.portal && (
                            <Badge variant="outline" className="text-xs">
                              {property.portal}
                            </Badge>
                          )}
                          
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto mt-2 text-xs"
                            onClick={() => window.location.href = `/properties/${property.id}`}
                            data-testid={`link-property-${property.id}`}
                          >
                            Vedi dettagli →
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center py-12">
                <Sparkles className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-2">In attesa di elaborazione</p>
                <p className="text-sm text-gray-400">
                  Inserisci i dati e clicca "Elabora Richiesta"
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
