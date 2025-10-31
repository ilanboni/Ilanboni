import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, Database, CheckCircle2, AlertCircle, Download, MapPin } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function ApifyAutomation() {
  const [testing, setTesting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapingFullCity, setScrapingFullCity] = useState(false);
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

  const startScrapingFullCity = async () => {
    setScrapingFullCity(true);
    setScrapeResult(null);
    
    toast({
      title: '🚀 Scraping COMPLETO avviato',
      description: 'Acquisizione COMPLETA di Milano senza limiti geografici...'
    });
    
    try {
      const data = await apiRequest('/api/apify/scrape-full-city', {
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
      setScrapingFullCity(false);
    }
  };

  const startScraping = async () => {
    setScraping(true);
    setScrapeResult(null);
    
    toast({
      title: '🚀 Scraping zone-based avviato',
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
          Sistema automatizzato di acquisizione immobili da Immobiliare.it usando Playwright - TUTTA Milano senza limiti geografici
        </p>
      </div>

      {/* Full City Scraping Card */}
      <Card className="mb-6 border-green-200 bg-green-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            <span className="text-green-900">Scraping COMPLETO Milano</span>
            <Badge variant="default" className="ml-2 bg-green-600">CONSIGLIATO</Badge>
          </CardTitle>
          <CardDescription className="text-green-800">
            Acquisizione COMPLETA di tutta Milano - senza filtri geografici, massima copertura
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <p className="text-green-900"><strong>✅ NESSUN FILTRO GEOGRAFICO</strong> - tutto il comune di Milano incluso periferie (Bovisa, Bicocca, etc.)</p>
            <p className="text-muted-foreground">• 🏙️ Ricerca unica su tutta la città</p>
            <p className="text-muted-foreground">• 📥 Import automatico con Playwright</p>
            <p className="text-muted-foreground">• 🔄 Deduplicazione multi-agency automatica</p>
            <p className="text-muted-foreground">• 🏢 Identificazione proprietà pluricondivise</p>
            <p className="text-muted-foreground">• 🆓 Completamente gratuito (no costi API)</p>
          </div>
          
          <Button 
            onClick={startScrapingFullCity} 
            disabled={scrapingFullCity}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
            data-testid="button-start-full-scraping"
          >
            {scrapingFullCity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {scrapingFullCity ? 'Scraping COMPLETO in corso...' : '🚀 Avvia Scraping COMPLETO Milano'}
          </Button>
          
          {scrapingFullCity && (
            <div className="p-3 rounded-md bg-green-100 border border-green-300">
              <p className="text-sm text-green-900">
                ⏳ Scraping COMPLETO in corso... Acquisizione di TUTTA Milano senza limiti geografici.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zone-based Scraping Card (Legacy) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Scraping Zone-Based (Metodo Legacy)
          </CardTitle>
          <CardDescription>
            Ricerca per zone specifiche - utile per test o aree mirate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• 🔍 Ricerca multipla: 30 zone di Milano</p>
            <p>• 📥 Import automatico con Playwright</p>
            <p>• 🔄 Deduplicazione multi-agency</p>
            <p>• ⚠️ Potrebbe mancare qualche annuncio rispetto a full-city</p>
          </div>
          
          <Button 
            onClick={startScraping} 
            disabled={scraping}
            className="w-full"
            variant="outline"
            size="lg"
            data-testid="button-start-zone-scraping"
          >
            {scraping && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {scraping ? 'Scraping zone in corso...' : 'Avvia Scraping Zone-Based'}
          </Button>
          
          {scraping && (
            <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-900">
                ⏳ Scraping in corso... Questo processo può richiedere 10-20 minuti per scansionare tutte le 30 zone.
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
              <p><strong>Scraping COMPLETO Milano:</strong> Ricerca automatica su TUTTA la città usando Playwright. <strong className="text-green-600">✅ NESSUN FILTRO GEOGRAFICO</strong> - include Bovisa, Bicocca, Lambrate, tutte le periferie</p>
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
