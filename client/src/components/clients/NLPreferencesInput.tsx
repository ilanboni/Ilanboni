import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

interface NLPreferencesInputProps {
  clientId?: number;
  onFiltersExtracted?: (filters: any) => void;
  standaloneMode?: boolean;
}

export default function NLPreferencesInput({ clientId, onFiltersExtracted, standaloneMode = false }: NLPreferencesInputProps) {
  const [nlText, setNlText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleNLSubmit = async () => {
    if (!nlText.trim()) {
      toast({
        title: "Testo richiesta vuoto",
        description: "Inserisci una descrizione della richiesta del cliente",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      let filters;

      if (standaloneMode) {
        // Modalità standalone: chiama direttamente il servizio NL senza salvare
        const response = await fetch('/api/nl-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: nlText }),
        });

        if (!response.ok) {
          throw new Error('Errore durante l\'elaborazione NL');
        }

        const data = await response.json();
        filters = data.filters;

        toast({
          title: "✅ Criteri estratti!",
          description: "I campi del form sono stati precompilati con i criteri AI.",
        });

        // Chiama la callback con i filtri estratti
        if (onFiltersExtracted) {
          onFiltersExtracted(filters);
        }

        setIsProcessing(false);
      } else {
        // Modalità normale: usa l'endpoint con clientId
        if (!clientId) {
          throw new Error('ClientId richiesto per questa modalità');
        }

        const response = await apiRequest(
          `/api/clients/${clientId}/nl-request`,
          {
            method: "POST",
            data: { text: nlText },
          }
        );

        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.error || "Errore durante l'elaborazione");
        }

        filters = data.filters;

        toast({
          title: "✅ Richiesta elaborata!",
          description: "I criteri sono stati estratti. Verrai reindirizzato alla pagina di modifica.",
        });

        // Build query params from extracted filters
        const params = new URLSearchParams();
        if (filters.budgetMax) params.set('maxPrice', filters.budgetMax.toString());
        if (filters.sizeMin) params.set('minSize', filters.sizeMin.toString());
        if (filters.propertyType) params.set('propertyType', filters.propertyType);
        if (filters.rooms) params.set('rooms', filters.rooms.toString());
        if (filters.bathrooms) params.set('bathrooms', filters.bathrooms.toString());
        if (filters.zones && filters.zones.length > 0) {
          params.set('zones', JSON.stringify(filters.zones));
        }
        if (filters.features) {
          params.set('features', JSON.stringify(filters.features));
        }
        
        // Navigate to search page with pre-filled params
        setTimeout(() => {
          navigate(`/clients/${clientId}/search?${params.toString()}&ai_assisted=true`);
        }, 1000);
      }

    } catch (error: any) {
      console.error("Error processing NL request:", error);
      toast({
        title: "Errore elaborazione",
        description: error.message || "Impossibile elaborare la richiesta",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Compila Preferenze con AI
        </CardTitle>
        <CardDescription>
          Incolla la descrizione della richiesta del cliente in linguaggio naturale.
          L'AI estrarrà automaticamente i criteri e precompilerà i campi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Textarea
            placeholder="Es: Cerco appartamento di almeno 160 metri più terrazzo di almeno 30 metri. Deve essere un attico. Zona Pagano, Porta Romana, Wagner, Via Sardegna, Frua, Conciliazione. Budget massimo €800.000"
            value={nlText}
            onChange={(e) => setNlText(e.target.value)}
            disabled={isProcessing}
            className="min-h-[120px] bg-white"
            data-testid="textarea-nl-preferences"
          />
          <p className="text-xs text-gray-500 mt-2">
            Puoi includere: metratura, locali, bagni, zona, caratteristiche (terrazzo, balcone, attico, ecc.), budget
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleNLSubmit}
            disabled={isProcessing || !nlText.trim()}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
            data-testid="button-process-nl"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Elaborazione in corso...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Elabora con AI
              </>
            )}
          </Button>
          
          {nlText && !isProcessing && (
            <Button
              onClick={() => setNlText("")}
              variant="outline"
              data-testid="button-clear-nl"
            >
              Cancella
            </Button>
          )}
        </div>

        {isProcessing && (
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
            Analisi del testo in corso...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
