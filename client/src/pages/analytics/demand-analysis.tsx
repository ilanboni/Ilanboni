import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatPrice } from "@/lib/utils";
import { 
  TrendingUp, 
  Users, 
  Target, 
  Brain, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Home,
  DollarSign,
  Lightbulb,
  Search
} from "lucide-react";

interface DemandRecommendation {
  rank: number;
  zone: string;
  priceRange: string;
  sizeRange: string;
  demandCount: number;
  priority: "Alta" | "Media" | "Bassa";
  avgPrice: number;
  avgSize: number;
  searchStrategy: string;
  potentialClients: Array<{
    id: number;
    name: string;
    phone: string;
    exactPrice: number;
    exactSize: number;
  }>;
  marketInsight: string;
}

interface DemandAnalysisData {
  totalPatterns: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  recommendations: DemandRecommendation[];
}

export default function DemandAnalysisPage() {
  const [selectedRecommendation, setSelectedRecommendation] = useState<DemandRecommendation | null>(null);

  // Carica analisi della domanda
  const { data: analysisData, isLoading } = useQuery<DemandAnalysisData>({
    queryKey: ['/api/analytics/demand-analysis'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/demand-analysis');
      if (!response.ok) {
        throw new Error('Errore nel caricamento analisi domanda');
      }
      return response.json();
    },
  });

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "Alta": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "Media": return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Alta": return "bg-red-50 border-red-200 text-red-700";
      case "Media": return "bg-yellow-50 border-yellow-200 text-yellow-700";
      default: return "bg-green-50 border-green-200 text-green-700";
    }
  };

  return (
    <>
      <Helmet>
        <title>Analisi Intelligente Domanda - Gestionale Immobiliare</title>
        <meta name="description" content="Analisi AI delle richieste più frequenti per ottimizzare la ricerca di immobili" />
      </Helmet>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Analisi Intelligente Domanda
            </h1>
            <p className="text-muted-foreground text-lg">
              L'AI analizza le richieste più frequenti per suggerire immobili ad alta probabilità di vendita
            </p>
          </div>

          {/* Statistiche generali */}
          {analysisData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="text-2xl font-bold text-purple-700">{analysisData.totalPatterns}</div>
                      <p className="text-xs text-purple-600">Pattern Identificati</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <div>
                      <div className="text-2xl font-bold text-red-700">{analysisData.highPriorityCount}</div>
                      <p className="text-xs text-red-600">Priorità Alta</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <div>
                      <div className="text-2xl font-bold text-yellow-700">{analysisData.mediumPriorityCount}</div>
                      <p className="text-xs text-yellow-600">Priorità Media</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista Raccomandazioni */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Raccomandazioni AI per Ricerca Immobili
                </CardTitle>
                <CardDescription>
                  Cerca immobili con queste caratteristiche per massimizzare le probabilità di vendita
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysisData?.recommendations && analysisData.recommendations.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {analysisData.recommendations.map((recommendation) => (
                      <div
                        key={`${recommendation.zone}-${recommendation.priceRange}-${recommendation.sizeRange}`}
                        className={cn(
                          "flex items-start justify-between p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg",
                          selectedRecommendation?.rank === recommendation.rank
                            ? "bg-blue-50 border-blue-300 shadow-md"
                            : "hover:bg-gray-50 border-gray-200"
                        )}
                        onClick={() => setSelectedRecommendation(recommendation)}
                      >
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={cn(
                            "flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full",
                            recommendation.rank <= 3 
                              ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
                              : "bg-blue-600 text-white"
                          )}>
                            {recommendation.rank <= 3 ? ["🥇", "🥈", "🥉"][recommendation.rank - 1] : recommendation.rank}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{recommendation.zone}</h3>
                              <Badge className={cn("text-xs", getPriorityColor(recommendation.priority))}>
                                {getPriorityIcon(recommendation.priority)}
                                <span className="ml-1">{recommendation.priority}</span>
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {recommendation.priceRange}
                              </div>
                              <div className="flex items-center gap-1">
                                <Home className="h-3 w-3" />
                                {recommendation.sizeRange}
                              </div>
                            </div>
                            
                            <div className="text-sm text-gray-700 mb-2">
                              <strong>Clienti interessati:</strong> {recommendation.demandCount}
                            </div>
                            
                            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                              <Lightbulb className="h-3 w-3 inline mr-1" />
                              {recommendation.searchStrategy}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-green-600">
                            {formatPrice(recommendation.avgPrice)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {recommendation.avgSize} m² medi
                          </div>
                          <Badge variant="outline" className="mt-1">
                            {recommendation.demandCount} richieste
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nessuna raccomandazione disponibile</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dettagli raccomandazione selezionata */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="h-5 w-5 text-purple-600" />
                    Insight AI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedRecommendation ? (
                    <div className="space-y-4">
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-purple-700 mb-2">
                          {selectedRecommendation.zone}
                        </h4>
                        <p className="text-sm text-purple-600">
                          {selectedRecommendation.marketInsight}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 p-3 rounded">
                          <div className="text-xs text-gray-600">Domanda</div>
                          <div className="font-bold text-lg">{selectedRecommendation.demandCount}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <div className="text-xs text-gray-600">Priorità</div>
                          <div className="font-bold text-lg">{selectedRecommendation.priority}</div>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h5 className="font-semibold text-green-700 mb-2">
                          🎯 Ricerca Ottimale
                        </h5>
                        <div className="text-sm space-y-1">
                          <div><strong>Zona:</strong> {selectedRecommendation.zone}</div>
                          <div><strong>Prezzo:</strong> {selectedRecommendation.priceRange}</div>
                          <div><strong>Superficie:</strong> {selectedRecommendation.sizeRange}</div>
                          <div><strong>Target medio:</strong> {formatPrice(selectedRecommendation.avgPrice)} • {selectedRecommendation.avgSize} m²</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Seleziona una raccomandazione per vedere i dettagli</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Clienti interessati */}
              {selectedRecommendation && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                      Clienti Potenziali ({selectedRecommendation.potentialClients.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {selectedRecommendation.potentialClients.map((client) => (
                        <div key={client.id} className="bg-gray-50 p-3 rounded-lg">
                          <div className="font-medium text-sm">{client.name}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {formatPrice(client.exactPrice)} • {client.exactSize} m²
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            {client.phone}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Riepilogo azioni */}
        {analysisData && analysisData.recommendations.length > 0 && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <TrendingUp className="h-5 w-5" />
                Azioni Prioritarie Consigliate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analysisData.recommendations.slice(0, 3).map((rec, index) => (
                  <div key={rec.rank} className="bg-white p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <span className="font-semibold">{rec.zone}</span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {rec.priceRange} • {rec.sizeRange}
                    </div>
                    <div className="text-xs bg-blue-100 text-blue-700 p-2 rounded">
                      {rec.demandCount} clienti in attesa
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}