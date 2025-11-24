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

  // Fetch saved properties from Casafari
  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: ["/api/casafari/saved-properties"],
    queryFn: async () => {
      const response = await apiRequest("/api/casafari/saved-properties", { method: "GET" });
      return (await response.json()) as { success: boolean; count: number; properties: any[] };
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
    if (selectedProperties.size === propertiesData?.properties?.length) {
      setSelectedProperties(new Set());
    } else {
      setSelectedProperties(new Set(
        propertiesData?.properties?.map((p: any) => p.externalId || p.address) || []
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

    const itemsToImport = propertiesData?.properties?.filter((p: any) =>
      selectedProperties.has(p.externalId || p.address)
    ) || [];

    importMutation.mutate(itemsToImport);
  };

  const properties = propertiesData?.properties || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Casafari
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importa Immobili Salvati da Casafari</DialogTitle>
        </DialogHeader>

        {loadingProperties ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2">Caricamento immobili salvati...</span>
          </div>
        ) : properties.length === 0 ? (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Nessun immobile salvato trovato in Casafari. Salva immobili in Casafari e riprova.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedProperties.size === properties.length && properties.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  Seleziona tutto ({selectedProperties.size}/{properties.length})
                </span>
              </div>
            </div>

            <ScrollArea className="h-80 border rounded-md p-4">
              <div className="space-y-3">
                {properties.map((property: any) => {
                  const id = property.externalId || property.address;
                  return (
                    <div key={id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <Checkbox 
                        checked={selectedProperties.has(id)}
                        onCheckedChange={() => handleSelectProperty(id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{property.address}</div>
                        <div className="text-xs text-gray-600">
                          {property.price ? `€${property.price.toLocaleString('it-IT')}` : 'Prezzo non disponibile'} • 
                          {property.size ? ` ${property.size}m²` : ''} •
                          {property.bedrooms ? ` ${property.bedrooms}🛏️` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
