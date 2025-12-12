import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Link2, 
  Loader2, 
  CheckCircle, 
  Home, 
  Building2, 
  Users, 
  ArrowLeft,
  Zap,
  AlertTriangle
} from "lucide-react";
import { Link } from "wouter";

type PropertyClassification = "private" | "single-agency" | "multi-agency";

interface ExtractedData {
  address: string;
  city: string;
  price: number | null;
  size: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  description: string | null;
  ownerPhone: string | null;
  ownerName: string | null;
  agencyName: string | null;
  agencyPhone: string | null;
  portalSource: string;
  url: string;
  classification: PropertyClassification;
  classificationReason: string;
  existingPropertyId?: number;
  matchingAgencies?: string[];
  requiresManualInput?: boolean;
}

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [step, setStep] = useState<"input" | "preview" | "success">("input");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const extractMutation = useMutation({
    mutationFn: async (importUrl: string) => {
      const response = await apiRequest("/api/properties/smart-import", {
        method: "POST",
        data: { url: importUrl }
      });
      return response.json();
    },
    onSuccess: (result: any) => {
      if (result.success) {
        setExtractedData(result.data);
        setStep("preview");
      } else {
        toast({
          title: "Errore estrazione",
          description: result.error || "Non è stato possibile estrarre i dati",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error?.message || "Errore durante l'estrazione",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!extractedData) throw new Error("Nessun dato da salvare");
      
      const response = await apiRequest("/api/properties/smart-import/save", {
        method: "POST",
        data: extractedData
      });
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/private"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties/multi-agency"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      
      setStep("success");
      toast({
        title: "Immobile importato!",
        description: `${extractedData?.address} salvato come ${getClassificationLabel(extractedData?.classification || "private")}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore salvataggio",
        description: error?.message || "Non è stato possibile salvare",
        variant: "destructive",
      });
    },
  });

  const handleExtract = () => {
    if (!url.trim()) {
      toast({
        description: "Incolla un link valido",
        variant: "destructive",
      });
      return;
    }
    extractMutation.mutate(url);
  };

  const handleReset = () => {
    setUrl("");
    setExtractedData(null);
    setStep("input");
  };

  const getClassificationLabel = (classification: PropertyClassification) => {
    switch (classification) {
      case "private": return "Privato";
      case "single-agency": return "Mono-agenzia";
      case "multi-agency": return "Pluri-agenzia";
    }
  };

  const getClassificationIcon = (classification: PropertyClassification) => {
    switch (classification) {
      case "private": return <Home className="h-5 w-5" />;
      case "single-agency": return <Building2 className="h-5 w-5" />;
      case "multi-agency": return <Users className="h-5 w-5" />;
    }
  };

  const getClassificationColor = (classification: PropertyClassification) => {
    switch (classification) {
      case "private": return "bg-green-100 text-green-800 border-green-300";
      case "single-agency": return "bg-blue-100 text-blue-800 border-blue-300";
      case "multi-agency": return "bg-purple-100 text-purple-800 border-purple-300";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Import Rapido</h1>
            <p className="text-sm text-gray-500">Incolla un link, il sistema fa il resto</p>
          </div>
        </div>

        {step === "input" && (
          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5 text-blue-600" />
                Inserisci Link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="https://www.idealista.it/immobile/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={extractMutation.isPending}
                className="text-base py-6"
                data-testid="input-import-url"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !extractMutation.isPending) {
                    handleExtract();
                  }
                }}
              />
              
              <div className="text-xs text-gray-500 space-y-1">
                <p>Portali supportati:</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">Idealista</Badge>
                  <Badge variant="outline" className="text-xs">Immobiliare.it</Badge>
                  <Badge variant="outline" className="text-xs">CasaDaPrivato</Badge>
                  <Badge variant="outline" className="text-xs">ClickCase</Badge>
                </div>
              </div>

              <Button
                onClick={handleExtract}
                disabled={extractMutation.isPending || !url.trim()}
                className="w-full gap-2 py-6 text-base"
                data-testid="button-extract"
              >
                {extractMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analisi in corso...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5" />
                    Analizza Link
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "preview" && extractedData && (
          <div className="space-y-4">
            <Card className={`shadow-lg border-2 ${getClassificationColor(extractedData.classification || "private")}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Classificazione</CardTitle>
                  <Badge className={`gap-1 ${getClassificationColor(extractedData.classification || "private")}`}>
                    {getClassificationIcon(extractedData.classification || "private")}
                    {getClassificationLabel(extractedData.classification || "private")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{extractedData.classificationReason || "Classificazione automatica"}</p>
                {extractedData.matchingAgencies && extractedData.matchingAgencies.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-500">Agenzie trovate:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {extractedData.matchingAgencies.map((agency, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{agency}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {extractedData.requiresManualInput ? "Inserisci Dati Manualmente" : "Dati Estratti"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {extractedData.requiresManualInput ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-gray-500">Indirizzo *</Label>
                      <Input 
                        value={extractedData.address || ""}
                        onChange={(e) => setExtractedData({...extractedData, address: e.target.value})}
                        placeholder="Via Roma 1, Milano"
                        data-testid="input-address"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">Prezzo (€)</Label>
                        <Input 
                          type="number"
                          value={extractedData.price || ""}
                          onChange={(e) => setExtractedData({...extractedData, price: parseInt(e.target.value) || null})}
                          placeholder="250000"
                          data-testid="input-price"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Superficie (m²)</Label>
                        <Input 
                          type="number"
                          value={extractedData.size || ""}
                          onChange={(e) => setExtractedData({...extractedData, size: parseInt(e.target.value) || null})}
                          placeholder="80"
                          data-testid="input-size"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">Camere</Label>
                        <Input 
                          type="number"
                          value={extractedData.bedrooms || ""}
                          onChange={(e) => setExtractedData({...extractedData, bedrooms: parseInt(e.target.value) || null})}
                          placeholder="2"
                          data-testid="input-bedrooms"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Bagni</Label>
                        <Input 
                          type="number"
                          value={extractedData.bathrooms || ""}
                          onChange={(e) => setExtractedData({...extractedData, bathrooms: parseInt(e.target.value) || null})}
                          placeholder="1"
                          data-testid="input-bathrooms"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Telefono</Label>
                      <Input 
                        value={extractedData.ownerPhone || ""}
                        onChange={(e) => setExtractedData({...extractedData, ownerPhone: e.target.value})}
                        placeholder="3331234567"
                        data-testid="input-phone"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-gray-500">Indirizzo</p>
                      <p className="font-medium">{extractedData.address || "Non trovato"}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Prezzo</p>
                        <p className="font-medium">
                          {extractedData.price 
                            ? `€${extractedData.price.toLocaleString('it-IT')}` 
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Superficie</p>
                        <p className="font-medium">
                          {extractedData.size ? `${extractedData.size} m²` : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Camere</p>
                        <p className="font-medium">{extractedData.bedrooms || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Bagni</p>
                        <p className="font-medium">{extractedData.bathrooms || "—"}</p>
                      </div>
                    </div>

                    {(extractedData.ownerName || extractedData.agencyName) && (
                      <div>
                        <p className="text-xs text-gray-500">
                          {extractedData.classification === "private" ? "Proprietario" : "Agenzia"}
                        </p>
                        <p className="font-medium">
                          {extractedData.ownerName || extractedData.agencyName}
                        </p>
                      </div>
                    )}

                    {(extractedData.ownerPhone || extractedData.agencyPhone) && (
                      <div>
                        <p className="text-xs text-gray-500">Telefono</p>
                        <p className="font-medium">
                          {extractedData.ownerPhone || extractedData.agencyPhone}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <p className="text-xs text-gray-500">Fonte</p>
                  <Badge variant="outline">{extractedData.portalSource}</Badge>
                </div>
              </CardContent>
            </Card>

            {!extractedData.address && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Indirizzo non trovato. L'immobile potrebbe non essere salvabile.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 py-6"
                onClick={handleReset}
                disabled={saveMutation.isPending}
                data-testid="button-cancel-import"
              >
                Annulla
              </Button>
              <Button
                className="flex-1 py-6 gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !extractedData.address}
                data-testid="button-save-import"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Salva
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <Card className="shadow-lg border-2 border-green-300 bg-green-50">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-800">Importato!</h2>
                <p className="text-green-700">{extractedData?.address}</p>
                <Badge className={`mt-2 ${getClassificationColor(extractedData?.classification || "private")}`}>
                  {getClassificationLabel(extractedData?.classification || "private")}
                </Badge>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReset}
                  data-testid="button-import-another"
                >
                  Importa altro
                </Button>
                <Link href="/" className="flex-1">
                  <Button className="w-full" data-testid="button-go-home">
                    Vai alla Home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
