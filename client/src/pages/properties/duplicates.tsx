import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Scan, 
  Building2, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Clock,
  TrendingUp
} from "lucide-react";
import { Helmet } from "react-helmet";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ScanResult {
  ok: boolean;
  totalProperties: number;
  clustersFound: number;
  multiagencyProperties: number;
  exclusiveProperties: number;
  propertiesUpdated: number;
  sharedPropertiesCreated: number;
  timestamp: string;
}

interface PropertyCluster {
  id: number;
  address: string;
  city: string;
  size: number;
  price: number;
  agencies: string[];
  isMultiagency: boolean;
  duplicateCount: number;
}

export default function PropertyDuplicatesPage() {
  const { toast } = useToast();
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);

  // Query per ottenere proprietà multi-agency
  const { data: multiAgencyProperties, isLoading } = useQuery<PropertyCluster[]>({
    queryKey: ['/api/deduplication/results']
  });

  // Mutation per scansione manuale
  const scanMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/run/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Errore sconosciuto' }));
        throw new Error(error.message || 'Errore durante la scansione');
      }
      return response.json() as Promise<ScanResult>;
    },
    onSuccess: (data) => {
      setLastScanResult({
        ...data,
        timestamp: new Date().toISOString()
      });
      toast({
        title: "✅ Scansione completata",
        description: `Trovati ${data.clustersFound} cluster di duplicati. ${data.multiagencyProperties} proprietà multi-agency identificate.`
      });
      // Invalida cache per aggiornare lista
      queryClient.invalidateQueries({ queryKey: ['/api/deduplication/results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/shared-properties-ranking'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore scansione",
        description: error.message || "Impossibile completare la scansione",
        variant: "destructive"
      });
    }
  });

  const handleScan = () => {
    scanMutation.mutate();
  };

  return (
    <>
      <Helmet>
        <title>Duplicati Multi-Agency | RealEstate CRM</title>
        <meta name="description" content="Visualizza e gestisci immobili duplicati gestiti da più agenzie" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">
              Duplicati Multi-Agency
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Identifica immobili gestiti da più agenzie o da privati e agenzie
            </p>
          </div>
          <Button
            onClick={handleScan}
            disabled={scanMutation.isPending}
            data-testid="button-scan-now"
            className="mt-4 md:mt-0"
          >
            {scanMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Scansione in corso...
              </>
            ) : (
              <>
                <Scan className="h-4 w-4 mr-2" />
                Scansiona Ora
              </>
            )}
          </Button>
        </div>

        {/* Alert informativo */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            La scansione analizza tutti gli immobili nel database e identifica duplicati basandosi su: 
            <strong> indirizzo (similarità &gt;75%)</strong>, 
            <strong> prezzo (scarto &lt;5-10%)</strong>, 
            <strong> superficie (±5-10mq)</strong>, 
            e <strong>hash immagini</strong>.
          </AlertDescription>
        </Alert>

        {/* Risultati ultima scansione */}
        {lastScanResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-600" />
                Risultati Ultima Scansione
              </CardTitle>
              <CardDescription className="flex items-center text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(lastScanResult.timestamp).toLocaleString('it-IT')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard
                  label="Proprietà Analizzate"
                  value={lastScanResult.totalProperties}
                  icon={<Building2 className="h-4 w-4" />}
                />
                <StatCard
                  label="Cluster Trovati"
                  value={lastScanResult.clustersFound}
                  icon={<TrendingUp className="h-4 w-4" />}
                  highlight
                />
                <StatCard
                  label="Multi-Agency"
                  value={lastScanResult.multiagencyProperties}
                  icon={<Users className="h-4 w-4" />}
                  highlight
                />
                <StatCard
                  label="Esclusive"
                  value={lastScanResult.exclusiveProperties}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <StatCard
                  label="Aggiornate"
                  value={lastScanResult.propertiesUpdated}
                  icon={<RefreshCw className="h-4 w-4" />}
                />
                <StatCard
                  label="Schede Create"
                  value={lastScanResult.sharedPropertiesCreated}
                  icon={<Building2 className="h-4 w-4" />}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista proprietà multi-agency */}
        <Card>
          <CardHeader>
            <CardTitle>Proprietà Multi-Agency Identificate</CardTitle>
            <CardDescription>
              Immobili gestiti da più agenzie o da privati e agenzie
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSkeleton />
            ) : multiAgencyProperties && multiAgencyProperties.length > 0 ? (
              <div className="space-y-3">
                {multiAgencyProperties.map((property) => (
                  <div
                    key={property.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    data-testid={`property-duplicate-${property.id}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {property.address}
                        </h3>
                        <p className="text-sm text-gray-600">{property.city}</p>
                      </div>
                      <Badge variant="default" className="bg-orange-100 text-orange-800">
                        <Users className="h-3 w-3 mr-1" />
                        Multi-Agency
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Superficie:</span>
                        <span className="ml-1 font-medium">{property.size} m²</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Prezzo:</span>
                        <span className="ml-1 font-medium">
                          {property.price.toLocaleString('it-IT')} €
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Duplicati:</span>
                        <span className="ml-1 font-medium">{property.duplicateCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Agenzie:</span>
                        <span className="ml-1 font-medium">{property.agencies.length}</span>
                      </div>
                    </div>

                    {property.agencies.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {property.agencies.map((agency, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {agency}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">Nessun duplicato trovato</p>
                <p className="text-sm mt-1">
                  Clicca "Scansiona Ora" per avviare l'analisi di deduplicazione
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Componente StatCard per metriche
function StatCard({ 
  label, 
  value, 
  icon, 
  highlight = false 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode; 
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-semibold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

// Skeleton loader
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-4 gap-3 mt-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
