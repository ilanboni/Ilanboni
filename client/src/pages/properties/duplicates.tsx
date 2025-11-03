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
import { SharedPropertyCard } from "@/components/properties/SharedPropertyCard";

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

interface SharedProperty {
  id: number;
  address: string;
  city?: string | null;
  size?: number | null;
  price?: number | null;
  type?: string | null;
  floor?: string | null;
  rating?: number | null;
  stage?: string | null;
  stageResult?: string | null;
  isAcquired?: boolean | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  ownerNotes?: string | null;
  agencies?: any[] | null;
  agency1Name?: string | null;
  agency1Link?: string | null;
  agency2Name?: string | null;
  agency2Link?: string | null;
  agency3Name?: string | null;
  agency3Link?: string | null;
}

export default function PropertyDuplicatesPage() {
  const { toast } = useToast();
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);

  // Query per ottenere shared properties (proprietà multi-agency dal DB)
  const { data: sharedProperties, isLoading } = useQuery<SharedProperty[]>({
    queryKey: ['/api/shared-properties']
  });

  // Mutation per scraping nuove proprietà
  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/apify/scrape-full-city', {
        method: 'POST'
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Scraping completato",
        description: `${data.imported} immobili importati su ${data.totalFetched} totali. Avvio deduplicazione...`
      });
      // Dopo lo scraping, avvia automaticamente la deduplicazione
      scanMutation.mutate();
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore scraping",
        description: error.message || "Impossibile scaricare le proprietà",
        variant: "destructive"
      });
    }
  });

  // Mutation per scansione manuale (solo deduplicazione)
  const scanMutation = useMutation({
    mutationFn: async () => {
      const token = import.meta.env.VITE_REPLIT_API_TOKEN;
      if (!token) {
        throw new Error('Token di autenticazione non configurato');
      }
      
      const response = await fetch('/api/run/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
        title: "✅ Deduplicazione completata",
        description: `Trovati ${data.clustersFound} cluster di duplicati. ${data.multiagencyProperties} proprietà multi-agency identificate.`
      });
      // Invalida cache per aggiornare lista
      queryClient.invalidateQueries({ queryKey: ['/api/deduplication/results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/shared-properties-ranking'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore deduplicazione",
        description: error.message || "Impossibile completare la deduplicazione",
        variant: "destructive"
      });
    }
  });

  const handleScrapeAndScan = () => {
    scrapeMutation.mutate();
  };

  const handleScan = () => {
    scanMutation.mutate();
  };

  // Handler per cambio stage
  const handleStageChange = async (propertyId: number, newStage: string) => {
    try {
      await apiRequest(`/api/shared-properties/${propertyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: newStage })
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      toast({
        title: "✅ Stage aggiornato",
        description: "Lo stage della proprietà è stato aggiornato con successo"
      });
    } catch (error) {
      toast({
        title: "❌ Errore",
        description: "Impossibile aggiornare lo stage",
        variant: "destructive"
      });
    }
  };

  // Handler per acquisizione
  const handleAcquire = async (propertyId: number) => {
    try {
      await apiRequest(`/api/shared-properties/${propertyId}/acquire`, {
        method: 'POST'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      toast({
        title: "🎉 Immobile Acquisito!",
        description: "L'immobile è stato acquisito e il matching con i clienti è stato avviato"
      });
    } catch (error) {
      toast({
        title: "❌ Errore",
        description: "Impossibile acquisire l'immobile",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Duplicati Multi-Agency | RealEstate CRM</title>
        <meta name="description" content="Visualizza e gestisci immobili duplicati gestiti da più agenzie" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-gray-900">
              Duplicati Multi-Agency
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Identifica immobili gestiti da più agenzie o da privati e agenzie
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleScrapeAndScan}
              disabled={scrapeMutation.isPending || scanMutation.isPending}
              data-testid="button-scrape-and-scan"
              className="bg-green-600 hover:bg-green-700"
            >
              {scrapeMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Scaricamento...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 mr-2" />
                  Scarica Nuove Proprietà
                </>
              )}
            </Button>
            <Button
              onClick={handleScan}
              disabled={scanMutation.isPending || scrapeMutation.isPending}
              data-testid="button-scan-now"
              variant="outline"
            >
              {scanMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deduplicazione...
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4 mr-2" />
                  Solo Deduplicazione
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Alert informativo */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>
                <strong className="text-green-600">📥 Scarica Nuove Proprietà:</strong> Scarica immobili da Immobiliare.it per tutta Milano (~2-3 minuti) e poi esegue automaticamente la deduplicazione.
              </p>
              <p>
                <strong>🔄 Solo Deduplicazione:</strong> Analizza solo gli immobili già nel database (~2 secondi) identificando duplicati basandosi su: 
                <strong> indirizzo</strong>, 
                <strong> prezzo (±10%)</strong>, 
                <strong> superficie (±15%)</strong>, 
                e <strong>GPS (300m)</strong>.
              </p>
            </div>
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
            ) : sharedProperties && sharedProperties.length > 0 ? (
              <div className="space-y-3">
                {sharedProperties.map((property) => (
                  <SharedPropertyCard
                    key={property.id}
                    property={property}
                    onStageChange={handleStageChange}
                    onAcquire={handleAcquire}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">Nessuna proprietà multi-agency trovata</p>
                <p className="text-sm mt-1">
                  Clicca "Scansiona Ora" per avviare l'analisi di deduplicazione e creare schede automaticamente
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
