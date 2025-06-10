import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn, formatPrice } from "@/lib/utils";
import { MapPin, Users, DollarSign, Home, TrendingUp, Target } from "lucide-react";

interface SearchHeatmapData {
  lat: number;
  lng: number;
  searchCount: number;
  avgBudget: number;
  avgSize: number;
  clients: Array<{
    id: number;
    name: string;
    phone: string;
    budget: number;
    size: number;
  }>;
}

interface FilterState {
  minBudget: number;
  maxBudget: number;
  minSize: number;
  maxSize: number;
  minSearches: number;
}

export default function SearchHeatmapPage() {
  const [selectedZone, setSelectedZone] = useState<SearchHeatmapData | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    minBudget: 0,
    maxBudget: 2000000,
    minSize: 20,
    maxSize: 300,
    minSearches: 1
  });

  // Carica dati heatmap delle ricerche
  const { data: heatmapData, isLoading } = useQuery<SearchHeatmapData[]>({
    queryKey: ['/api/analytics/search-heatmap', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        minBudget: filters.minBudget.toString(),
        maxBudget: filters.maxBudget.toString(),
        minSize: filters.minSize.toString(),
        maxSize: filters.maxSize.toString(),
        minSearches: filters.minSearches.toString()
      });
      
      const response = await fetch(`/api/analytics/search-heatmap?${params}`);
      if (!response.ok) throw new Error('Failed to fetch heatmap data');
      return response.json();
    },
  });

  // Statistiche aggregate
  const stats = React.useMemo(() => {
    if (!heatmapData) return null;
    
    const totalSearches = heatmapData.reduce((sum, point) => sum + point.searchCount, 0);
    const avgBudget = heatmapData.reduce((sum, point) => sum + point.avgBudget, 0) / heatmapData.length;
    const avgSize = heatmapData.reduce((sum, point) => sum + point.avgSize, 0) / heatmapData.length;
    const hotZones = heatmapData.filter(point => point.searchCount >= 3).length;
    
    return {
      totalSearches,
      avgBudget: avgBudget || 0,
      avgSize: avgSize || 0,
      hotZones,
      totalZones: heatmapData.length
    };
  }, [heatmapData]);

  // Trova le zone più richieste
  const topZones = React.useMemo(() => {
    if (!heatmapData) return [];
    return heatmapData
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 10);
  }, [heatmapData]);

  return (
    <>
      <Helmet>
        <title>Analisi Zone Ricerche - Gestionale Immobiliare</title>
        <meta name="description" content="Analisi delle zone più ricercate dai clienti per identificare opportunità di investimento" />
      </Helmet>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analisi Zone Ricerche</h1>
            <p className="text-muted-foreground">
              Identifica le zone più richieste dai tuoi clienti per orientare la ricerca di nuovi immobili
            </p>
          </div>

          {/* Statistiche generali */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold">{stats.totalSearches}</div>
                      <p className="text-xs text-muted-foreground">Ricerche totali</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold">{formatPrice(stats.avgBudget)}</div>
                      <p className="text-xs text-muted-foreground">Budget medio</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Home className="h-4 w-4 text-orange-600" />
                    <div>
                      <div className="text-2xl font-bold">{Math.round(stats.avgSize)} m²</div>
                      <p className="text-xs text-muted-foreground">Metratura media</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-red-600" />
                    <div>
                      <div className="text-2xl font-bold">{stats.hotZones}</div>
                      <p className="text-xs text-muted-foreground">Zone calde (3+ ricerche)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filtri */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Filtri</CardTitle>
              <CardDescription>
                Personalizza l'analisi delle ricerche
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Budget: {formatPrice(filters.minBudget)} - {formatPrice(filters.maxBudget)}
                </label>
                <div className="space-y-3">
                  <Slider
                    value={[filters.minBudget]}
                    onValueChange={([value]) => setFilters(f => ({ ...f, minBudget: value }))}
                    max={2000000}
                    min={0}
                    step={50000}
                    className="w-full"
                  />
                  <Slider
                    value={[filters.maxBudget]}
                    onValueChange={([value]) => setFilters(f => ({ ...f, maxBudget: value }))}
                    max={2000000}
                    min={0}
                    step={50000}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Metratura: {filters.minSize} - {filters.maxSize} m²
                </label>
                <div className="space-y-3">
                  <Slider
                    value={[filters.minSize]}
                    onValueChange={([value]) => setFilters(f => ({ ...f, minSize: value }))}
                    max={300}
                    min={20}
                    step={10}
                    className="w-full"
                  />
                  <Slider
                    value={[filters.maxSize]}
                    onValueChange={([value]) => setFilters(f => ({ ...f, maxSize: value }))}
                    max={300}
                    min={20}
                    step={10}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Ricerche minime: {filters.minSearches}
                </label>
                <Slider
                  value={[filters.minSearches]}
                  onValueChange={([value]) => setFilters(f => ({ ...f, minSearches: value }))}
                  max={20}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>

              <Button 
                onClick={() => setFilters({
                  minBudget: 0,
                  maxBudget: 2000000,
                  minSize: 20,
                  maxSize: 300,
                  minSearches: 1
                })}
                variant="outline"
                className="w-full"
              >
                Reset Filtri
              </Button>
            </CardContent>
          </Card>

          {/* Zone più richieste */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Zone più Richieste
              </CardTitle>
              <CardDescription>
                Classifica delle aree con il maggior numero di ricerche dei clienti
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Caricamento dati...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {topZones.length === 0 ? (
                    <div className="text-center py-8">
                      <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nessuna zona trovata con i filtri selezionati</p>
                      <p className="text-sm text-gray-400">Prova a modificare i filtri per vedere più risultati</p>
                    </div>
                  ) : (
                    topZones.map((zone, index) => (
                      <div
                        key={`${zone.lat}-${zone.lng}`}
                        className={cn(
                          "p-4 border rounded-lg cursor-pointer transition-colors",
                          selectedZone === zone ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setSelectedZone(zone)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn(
                                "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                                index < 3 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"
                              )}>
                                {index + 1}
                              </span>
                              <MapPin className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">
                                Zona {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                              </span>
                              <Badge 
                                variant={zone.searchCount >= 5 ? "destructive" : zone.searchCount >= 3 ? "default" : "secondary"}
                              >
                                {zone.searchCount} ricerche
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Budget medio:</span>
                                <div className="font-medium">{formatPrice(zone.avgBudget)}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">Metratura media:</span>
                                <div className="font-medium">{zone.avgSize} m²</div>
                              </div>
                              <div>
                                <span className="text-gray-500">Clienti interessati:</span>
                                <div className="font-medium">{zone.clients.length}</div>
                              </div>
                              <div>
                                <span className="text-gray-500">Priorità:</span>
                                <div className={cn(
                                  "font-medium",
                                  zone.searchCount >= 5 ? "text-red-600" : zone.searchCount >= 3 ? "text-orange-600" : "text-green-600"
                                )}>
                                  {zone.searchCount >= 5 ? "Alta" : zone.searchCount >= 3 ? "Media" : "Bassa"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dettagli zona selezionata */}
        {selectedZone && (
          <Card>
            <CardHeader>
              <CardTitle>Dettagli Zona Selezionata</CardTitle>
              <CardDescription>
                Coordinate: {selectedZone.lat.toFixed(6)}, {selectedZone.lng.toFixed(6)} • {selectedZone.searchCount} ricerche totali
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Opportunità di Investimento
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="p-3 bg-blue-50 rounded-md">
                      <p className="font-medium text-blue-900">Domanda alta</p>
                      <p className="text-blue-700">{selectedZone.searchCount} clienti cercano in questa zona</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-md">
                      <p className="font-medium text-green-900">Budget disponibile</p>
                      <p className="text-green-700">Budget medio: {formatPrice(selectedZone.avgBudget)}</p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-md">
                      <p className="font-medium text-orange-900">Tipologia ricercata</p>
                      <p className="text-orange-700">Metratura media: {selectedZone.avgSize} m²</p>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Clienti Interessati ({selectedZone.clients.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {selectedZone.clients.map(client => (
                      <div key={client.id} className="p-3 bg-gray-50 rounded-md border">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-sm">{client.name}</p>
                          <Badge variant="outline" className="text-xs">ID: {client.id}</Badge>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{client.phone}</p>
                        <div className="flex gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {formatPrice(client.budget)}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {client.size} m²
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">💡 Suggerimento Strategico</h4>
                <p className="text-yellow-800 text-sm">
                  Concentra la ricerca di nuovi immobili in questa zona. Con {selectedZone.searchCount} clienti interessati 
                  e un budget medio di {formatPrice(selectedZone.avgBudget)}, rappresenta un'ottima opportunità di business.
                  Cerca immobili di circa {selectedZone.avgSize} m² per massimizzare le possibilità di vendita.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}