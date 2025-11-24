import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Zap, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

export function AutoImportPropertyDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [extracted, setExtracted] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (importUrl: string) => {
      const response = await apiRequest("/api/properties/auto-import", {
        method: "POST",
        data: { url: importUrl }
      });
      return await response.json();
    },
    onSuccess: (result: any) => {
      // Se i dati sono completi, salva direttamente
      if (result.preview?.isComplete) {
        saveMutation.mutate({
          extracted: true,
          data: result.data,
          url: result.url
        });
      } else {
        // Altrimenti mostra il form per completare
        setExtracted(true);
        setPreview(result.preview);
        setEditedData({
          address: result.data.address,
          price: result.data.price,
          type: result.data.type,
          bedrooms: result.data.bedrooms,
          bathrooms: result.data.bathrooms,
          size: result.data.size,
          ownerPhone: result.data.ownerPhone,
          ownerName: result.data.ownerName,
          agencyName: result.data.agencyName,
          agencyPhone: result.data.agencyPhone,
          description: result.data.description
        });
      }
    },
    onError: (error: any) => {
      console.error("Errore import:", error);
      toast({
        title: "❌ Errore",
        description: "Non è stato possibile estrarre i dati dal link",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (saveData?: any) => {
      const dataToSave = editedData || saveData?.data;
      const urlToSave = url || saveData?.url;
      
      const isAgency = dataToSave.agencyName && dataToSave.agencyName !== "" && dataToSave.agencyName !== "Da completare";
      const endpoint = isAgency ? "/api/properties/manual-agency" : "/api/properties/manual-private";
      
      const payload = {
        url: urlToSave,
        address: dataToSave.address,
        city: "Milano",
        type: dataToSave.type || "apartment",
        price: Number(dataToSave.price),
        bedrooms: dataToSave.bedrooms ? Number(dataToSave.bedrooms) : undefined,
        bathrooms: dataToSave.bathrooms ? Number(dataToSave.bathrooms) : undefined,
        size: dataToSave.size ? Number(dataToSave.size) : undefined,
        floor: undefined,
        description: dataToSave.description,
        ...(isAgency ? {
          agencyName: dataToSave.agencyName,
          agencyPhone: dataToSave.agencyPhone,
          agencyUrl: urlToSave
        } : {
          ownerPhone: dataToSave.ownerPhone,
          ownerName: dataToSave.ownerName,
          ownerEmail: undefined
        })
      };

      return await apiRequest(endpoint, {
        method: "POST",
        data: payload
      });
    },
    onSuccess: (result, saveData) => {
      const dataToSave = editedData || saveData?.data;
      queryClient.invalidateQueries({ queryKey: ["/api/shared-properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/private"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/multi-agency"] });
      
      toast({
        title: "✅ Immobile importato!",
        description: `${dataToSave.address} - €${dataToSave.price.toLocaleString('it-IT')}`,
      });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Errore save:", error);
      toast({
        title: "❌ Errore",
        description: error?.message || "Non è stato possibile salvare l'immobile",
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
    setExtracted(false);
    setPreview(null);
    setEditedData(null);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => handleReset(), 300);
  };

  const isFormComplete = editedData?.address && editedData?.price > 0;

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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Import Veloce
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Incolla un link e il sistema estrae i dati automaticamente
          </p>
        </DialogHeader>

        {!extracted ? (
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
                  Estrai Dati
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert className="border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-xs">
                {!preview?.isComplete 
                  ? "Alcuni dati non sono stati estratti. Completali qui sotto e salva."
                  : "Dati completi estratti dal link!"
                }
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-gray-600">Preview</p>
              <p className="text-lg font-bold">{preview?.title}</p>
              <p className="text-md">{preview?.classification}</p>
              {preview?.description && (
                <p className="text-sm text-gray-700">{preview?.description}</p>
              )}
            </div>

            <div className="space-y-4 bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-600">Completa i dati</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Indirizzo *</Label>
                  <Input
                    value={editedData?.address || ""}
                    onChange={(e) => setEditedData({ ...editedData, address: e.target.value })}
                    placeholder="Via Esempio, 123"
                    data-testid="input-address"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Prezzo *</Label>
                  <Input
                    type="number"
                    value={editedData?.price || ""}
                    onChange={(e) => setEditedData({ ...editedData, price: Number(e.target.value) })}
                    placeholder="0"
                    data-testid="input-price"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={editedData?.type} onValueChange={(value) => setEditedData({ ...editedData, type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">Appartamento</SelectItem>
                      <SelectItem value="penthouse">Attico</SelectItem>
                      <SelectItem value="villa">Villa</SelectItem>
                      <SelectItem value="loft">Loft</SelectItem>
                      <SelectItem value="other">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Camere</Label>
                  <Input
                    type="number"
                    value={editedData?.bedrooms || ""}
                    onChange={(e) => setEditedData({ ...editedData, bedrooms: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Bagni</Label>
                  <Input
                    type="number"
                    value={editedData?.bathrooms || ""}
                    onChange={(e) => setEditedData({ ...editedData, bathrooms: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Superficie (m²)</Label>
                  <Input
                    type="number"
                    value={editedData?.size || ""}
                    onChange={(e) => setEditedData({ ...editedData, size: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label className="text-xs">Nome Proprietario / Agenzia</Label>
                  <Input
                    value={editedData?.ownerName || editedData?.agencyName || ""}
                    onChange={(e) => setEditedData({ ...editedData, ownerName: e.target.value, agencyName: e.target.value })}
                    placeholder="Nome"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label className="text-xs">Telefono</Label>
                  <Input
                    value={editedData?.ownerPhone || editedData?.agencyPhone || ""}
                    onChange={(e) => setEditedData({ ...editedData, ownerPhone: e.target.value, agencyPhone: e.target.value })}
                    placeholder="+39..."
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label className="text-xs">Descrizione</Label>
                  <textarea
                    value={editedData?.description || ""}
                    onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                    placeholder="Descrizione immobile"
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                data-testid="button-close-auto-import"
              >
                Annulla
              </Button>
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => saveMutation.mutate(undefined)}
                disabled={saveMutation.isPending || !isFormComplete}
                data-testid="button-save-auto-import"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Salva Immobile
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
