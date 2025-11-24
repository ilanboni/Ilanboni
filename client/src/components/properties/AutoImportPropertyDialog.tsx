import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Zap, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

export function AutoImportPropertyDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [imported, setImported] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (importUrl: string) => {
      return await apiRequest("/api/properties/auto-import", {
        method: "POST",
        data: { url: importUrl }
      });
    },
    onSuccess: (result: any) => {
      setImported(true);
      setPreview(result.preview);
      queryClient.invalidateQueries({ queryKey: ["/api/shared-properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/private"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/multi-agency"] });
      
      toast({
        title: "✅ Immobile importato!",
        description: result.preview?.title,
      });
    },
    onError: (error: any) => {
      console.error("Errore import:", error);
      toast({
        title: "❌ Errore",
        description: error?.message || "Non è stato possibile importare l'immobile dal link",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!url.trim()) {
      toast({
        description: "Incolla un link valido",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate(url);
  };

  const handleReset = () => {
    setUrl("");
    setImported(false);
    setPreview(null);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => handleReset(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) handleReset();
    }}>
      <DialogTrigger asChild>
        <Button 
          className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
          data-testid="button-auto-import-property"
        >
          <Zap className="h-4 w-4" />
          <span>Rapido</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Import Veloce
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Incolla un link e il sistema importa tutto automaticamente
          </p>
        </DialogHeader>

        {!imported ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Link Immobile *</label>
              <Input
                placeholder="https://www.immobiliare.it/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={importMutation.isPending}
                data-testid="input-auto-import-url"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !importMutation.isPending) {
                    handleImport();
                  }
                }}
              />
              <p className="text-xs text-gray-500">
                Funziona con Immobiliare.it, Idealista, CasaDaPrivato, ClickCase e altri
              </p>
            </div>

            <Button
              onClick={handleImport}
              disabled={importMutation.isPending || !url.trim()}
              className="w-full gap-2"
              data-testid="button-submit-auto-import"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Estrazione in corso...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Estrai e Salva
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Proprietà salvata!</strong>
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-600">Titolo</p>
                <p className="font-bold text-base">{preview?.title}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600">Classificazione</p>
                <p className="text-lg font-bold">{preview?.classification}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-600">Dettagli</p>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Indirizzo:</dt>
                    <dd className="font-medium">{preview?.details?.indirizzo}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Prezzo:</dt>
                    <dd className="font-medium">{preview?.details?.prezzo}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Tipo:</dt>
                    <dd className="font-medium">{preview?.details?.tipo}</dd>
                  </div>
                  {preview?.details?.camere && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Camere:</dt>
                      <dd className="font-medium">{preview?.details?.camere}</dd>
                    </div>
                  )}
                  {preview?.details?.bagni && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Bagni:</dt>
                      <dd className="font-medium">{preview?.details?.bagni}</dd>
                    </div>
                  )}
                  {preview?.details?.superficie && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Superficie:</dt>
                      <dd className="font-medium">{preview?.details?.superficie}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Agenzia/Privato:</dt>
                    <dd className="font-medium">{preview?.details?.agenzia}</dd>
                  </div>
                  {preview?.multiAgencies > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600">Agenzie rilevate:</dt>
                      <dd className="font-medium">{preview?.multiAgencies}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-xs">
                  La proprietà è stata salvata e sarà disponibile nei matching dei tuoi buyer
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  handleClose();
                }}
                data-testid="button-close-auto-import"
              >
                Chiudi
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => {
                  handleReset();
                }}
                data-testid="button-import-another"
              >
                <Zap className="h-4 w-4" />
                Importa Altro
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
