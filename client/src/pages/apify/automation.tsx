import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, Database, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function ApifyAutomation() {
  const [testing, setTesting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [scrapeResult, setScrapeResult] = useState<any>(null);
  const { toast } = useToast();

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/apify/test');
      const data = await response.json();
      setTestResult(data);
      
      if (data.success) {
        toast({
          title: '✅ Connessione riuscita',
          description: 'Apify è configurato correttamente'
        });
      } else {
        toast({
          title: '❌ Errore connessione',
          description: data.error || 'Verifica la configurazione APIFY_API_TOKEN',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: '❌ Errore',
        description: 'Impossibile connettersi al server',
        variant: 'destructive'
      });
      setTestResult({ success: false, error: String(error) });
    } finally {
      setTesting(false);
    }
  };

  const startScraping = async () => {
    setScraping(true);
    setScrapeResult(null);
    
    toast({
      title: '🚀 Scraping avviato',
      description: 'Questo processo potrebbe richiedere diversi minuti...'
    });
    
    try {
      const data = await apiRequest('/api/apify/scrape-milano', {
        method: 'POST'
      });
      
      setScrapeResult(data);
      
      toast({
        title: '✅ Scraping completato',
        description: `${data.imported} immobili importati su ${data.totalFetched} totali`
      });
    } catch (error) {
      toast({
        title: '❌ Errore scraping',
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
        variant: 'destructive'
      });
      setScrapeResult({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Automazione Scraping Milano</h1>
        <p className="text-muted-foreground">
          Sistema automatizzato di acquisizione immobili da Immobiliare.it usando Playwright (solo Milano, entro 5 km dal Duomo)
        </p>
      </div>

      {/* Scraping Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Scraping Automatico Milano
          </CardTitle>
          <CardDescription>
            Importa immobili da Immobiliare.it usando Playwright (solo Milano, entro 5 km dal Duomo)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• 📍 Solo Milano (raggio 5 km dal Duomo)</p>
            <p>• 🔍 Ricerca multipla: 8 zone di Milano</p>
            <p>• 📥 Import automatico con Playwright</p>
            <p>• 🔄 Deduplicazione multi-agency</p>
            <p>• 🏢 Identificazione proprietà pluricondivise</p>
            <p>• 🆓 Completamente gratuito (no costi API)</p>
          </div>
          
          <Button 
            onClick={startScraping} 
            disabled={scraping}
            className="w-full"
            variant="default"
            size="lg"
            data-testid="button-start-scraping"
          >
            {scraping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {scraping ? 'Scraping in corso...' : 'Avvia Scraping Milano'}
          </Button>
          
          {scraping && (
            <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-900">
                ⏳ Scraping in corso... Questo processo può richiedere 5-10 minuti per scansionare tutte le zone di Milano.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Card */}
      {scrapeResult && (
        <Card>
          <CardHeader>
            <CardTitle>Risultati Scraping</CardTitle>
            <CardDescription>Dettagli dell'ultima operazione</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Download className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Totale</span>
                </div>
                <p className="text-2xl font-bold text-blue-900" data-testid="text-total-fetched">
                  {scrapeResult.totalFetched || 0}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Importati</span>
                </div>
                <p className="text-2xl font-bold text-green-900" data-testid="text-imported">
                  {scrapeResult.imported || 0}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-900">Aggiornati</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900" data-testid="text-updated">
                  {scrapeResult.updated || 0}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-900">Errori</span>
                </div>
                <p className="text-2xl font-bold text-red-900" data-testid="text-failed">
                  {scrapeResult.failed || 0}
                </p>
              </div>
            </div>
            
            {scrapeResult.errors && scrapeResult.errors.length > 0 && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <h4 className="font-medium mb-2">Primi errori:</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {scrapeResult.errors.map((error: string, idx: number) => (
                    <li key={idx} className="truncate">• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Come funziona</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <Badge variant="outline" className="h-6">1</Badge>
              <p><strong>Scraping Multi-Zona:</strong> Ricerca automatica su 8 zone centrali di Milano usando Playwright. <strong className="text-blue-600">Filtro geografico: solo Milano entro 5 km dal Duomo</strong></p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="h-6">2</Badge>
              <p><strong>Browser Reale:</strong> Playwright usa un browser vero (Chromium) per bypassare protezioni anti-bot</p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="h-6">3</Badge>
              <p><strong>Import Automatico:</strong> Ogni immobile viene importato nel database con status="available"</p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="h-6">4</Badge>
              <p><strong>Deduplicazione:</strong> Algoritmo automatico identifica proprietà pluricondivise (stesso indirizzo, ±5% prezzo/mq)</p>
            </div>
            <div className="flex gap-3">
              <Badge variant="outline" className="h-6">5</Badge>
              <p><strong>Report:</strong> Risultati visibili in "Proprietà → Proprietà Pluricondivise"</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-green-900">
              <strong>✅ Vantaggi:</strong> Sistema completamente gratuito, nessun costo API. Il sistema Playwright è incluso in Replit.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
