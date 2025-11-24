import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CasafariImportDialog() {
  const [open, setOpen] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch alert-based properties from Casafari
  const { data: alertsData, isLoading: loadingAlerts } = useQuery({
    queryKey: ["/api/casafari/saved-properties"],
    queryFn: async () => {
      const response = await apiRequest("/api/casafari/saved-properties", { method: "GET" });
      return (await response.json()) as { 
        success: boolean; 
        count: number; 
        alerts: any[];
        allProperties: any[];
      };
    },
    enabled: open,
    staleTime: 5 * 60 * 1000
  });

  // Import selected properties
  const importMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const response = await apiRequest("/api/import-casafari", {
        method: "POST",
        data: { items }
      });
      return await response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties/private"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shared-properties"] });
      
      toast({
        title: "✅ Import completato",
        description: `${result.imported} immobili importati${result.skipped > 0 ? `, ${result.skipped} saltati` : ""}`
      });
      
      setOpen(false);
      setSelectedProperties(new Set());
    },
    onError: (error) => {
      toast({
        title: "❌ Errore",
        description: "Errore durante l'import da Casafari",
        variant: "destructive"
      });
    }
  });

  const handleSelectAll = () => {
    const allProps = alertsData?.allProperties || [];
    if (selectedProperties.size === allProps.length) {
      setSelectedProperties(new Set());
    } else {
      setSelectedProperties(new Set(
        allProps.map((p: any) => p.externalId || p.address)
      ));
    }
  };

  const handleSelectProperty = (id: string) => {
    const newSet = new Set(selectedProperties);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedProperties(newSet);
  };

  const handleImport = () => {
    if (selectedProperties.size === 0) {
      toast({
        title: "⚠️ Nessuna selezione",
        description: "Seleziona almeno un immobile da importare"
      });
      return;
    }

    const itemsToImport = (alertsData?.allProperties || []).filter((p: any) =>
      selectedProperties.has(p.externalId || p.address)
    );

    importMutation.mutate(itemsToImport);
  };

  const alerts = alertsData?.alerts || [];
  const allProperties = alertsData?.allProperties || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Casafari
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importa Immobili da Alert Casafari</DialogTitle>
        </DialogHeader>

        {loadingAlerts ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2">Caricamento alert e immobili da Casafari...</span>
          </div>
        ) : alerts.length === 0 ? (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Nessun alert trovato in Casafari. Crea un alert di ricerca in Casafari e riprova.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedProperties.size === allProperties.length && allProperties.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  Seleziona tutto ({selectedProperties.size}/{allProperties.length})
                </span>
              </div>
            </div>

            <ScrollArea className="h-96 border rounded-md p-4">
              <div className="space-y-4">
                {alerts.map((alert: any) => (
                  <div key={alert.id} className="border-l-2 border-blue-300 pl-4 pb-4">
                    <h3 className="font-semibold text-sm mb-2">{alert.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">{alert.properties?.length || 0} immobili trovati</p>
                    <div className="space-y-2">
                      {alert.properties?.map((property: any) => {
                        const id = property.externalId || property.address;
                        return (
                          <div key={id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer text-sm">
                            <Checkbox 
                              checked={selectedProperties.has(id)}
                              onCheckedChange={() => handleSelectProperty(id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{property.address}</div>
                              <div className="text-xs text-gray-600">
                                {property.price ? `€${property.price.toLocaleString('it-IT')}` : 'Prezzo non disp.'} • 
                                {property.size ? ` ${property.size}m²` : ''} •
                                {property.bedrooms ? ` ${property.bedrooms}🛏️` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 justify-end mt-6">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={selectedProperties.size === 0 || importMutation.isPending}
                className="gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importazione...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Importa {selectedProperties.size > 0 ? `(${selectedProperties.size})` : ''}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
