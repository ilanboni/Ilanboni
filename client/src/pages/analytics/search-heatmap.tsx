import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn, formatPrice } from "@/lib/utils";
import { MapPin, Users, DollarSign, Home, TrendingUp, Target, Activity, Eye } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

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
      if (!response.ok) {
        throw new Error('Errore nel caricamento dati heatmap');
      }
      return response.json();
    },
  });

  // Statistiche aggregate
  const stats = useMemo(() => {
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
  const topZones = useMemo(() => {
    if (!heatmapData) return [];
    return heatmapData
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 10);
  }, [heatmapData]);

  // Determina il nome della zona basato sulle coordinate
  const getZoneName = (lat: number, lng: number) => {
    // Zone principali di Milano con coordinate approssimative
    if (Math.abs(lat - 45.4642) < 0.008 && Math.abs(lng - 9.1900) < 0.008) return "Duomo";
    if (Math.abs(lat - 45.4773) < 0.008 && Math.abs(lng - 9.1815) < 0.008) return "Brera";
    if (Math.abs(lat - 45.4825) < 0.008 && Math.abs(lng - 9.2078) < 0.008) return "Porta Garibaldi";
    if (Math.abs(lat - 45.4868) < 0.008 && Math.abs(lng - 9.1918) < 0.008) return "Porta Nuova";
    if (Math.abs(lat - 45.4541) < 0.008 && Math.abs(lng - 9.1853) < 0.008) return "Navigli";
    if (Math.abs(lat - 45.4969) < 0.008 && Math.abs(lng - 9.2071) < 0.008) return "Isola";
    if (Math.abs(lat - 45.4388) < 0.008 && Math.abs(lng - 9.1946) < 0.008) return "Porta Romana";
    if (Math.abs(lat - 45.4520) < 0.008 && Math.abs(lng - 9.1525) < 0.008) return "Porta Ticinese";
    if (Math.abs(lat - 45.4906) < 0.008 && Math.abs(lng - 9.1665) < 0.008) return "Sempione";
    if (Math.abs(lat - 45.4681) < 0.008 && Math.abs(lng - 9.1781) < 0.008) return "Castello";
    if (Math.abs(lat - 45.4832) < 0.008 && Math.abs(lng - 9.2173) < 0.008) return "Viale Abruzzi";
    if (Math.abs(lat - 45.4620) < 0.008 && Math.abs(lng - 9.2267) < 0.008) return "Lambrate";
    if (Math.abs(lat - 45.4457) < 0.008 && Math.abs(lng - 9.2040) < 0.008) return "Porta Vittoria";
    if (Math.abs(lat - 45.4751) < 0.008 && Math.abs(lng - 9.2158) < 0.008) return "Buenos Aires";
    if (Math.abs(lat - 45.4892) < 0.008 && Math.abs(lng - 9.1813) < 0.008) return "Moscova";
    return `Zona ${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  };

  return (
    <>
      <Helmet>
        <title>Zone più Richieste - Analytics Immobiliare</title>
        <meta name="description" content="Visualizza su mappa interattiva le zone più ricercate dai clienti per identificare opportunità di investimento" />
      </Helmet>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Zone più Richieste
            </h1>
            <p className="text-muted-foreground text-lg">
              Mappa interattiva delle zone più cercate dai tuoi clienti
            </p>
          </div>

          {/* Statistiche generali */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold text-blue-700">{stats.totalSearches}</div>
                      <p className="text-xs text-blue-600">Ricerche Totali</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold text-green-700">{stats.hotZones}</div>
                      <p className="text-xs text-green-600">Zone Calde (3+ ricerche)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="text-2xl font-bold text-purple-700">{formatPrice(stats.avgBudget)}</div>
                      <p className="text-xs text-purple-600">Budget Medio</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Home className="h-5 w-5 text-orange-600" />
                    <div>
                      <div className="text-2xl font-bold text-orange-700">{Math.round(stats.avgSize)} m²</div>
                      <p className="text-xs text-orange-600">Superficie Media</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mappa Principale */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Mappa Ricerche Interactive
                </CardTitle>
                <CardDescription>
                  Cerchi più grandi e rossi = zone più richieste. Clicca per dettagli.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] rounded-lg overflow-hidden border-2 border-gray-200">
                  <MapContainer
                    center={[45.4642, 9.1900]} // Centro Milano
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {heatmapData?.map((zone, index) => {
                      const maxSearches = Math.max(...(heatmapData?.map(z => z.searchCount) || [1]));
                      const intensity = zone.searchCount / maxSearches;
                      const radius = Math.max(10, intensity * 30); // Raggio basato su intensità
                      
                      // Colore basato su numero di ricerche - più intenso e visibile
                      const getColor = (searches: number) => {
                        if (searches >= 5) return '#dc2626'; // Rosso intenso per zone molto richieste
                        if (searches >= 4) return '#ea580c'; // Arancione rosso
                        if (searches >= 3) return '#f59e0b'; // Arancione
                        if (searches >= 2) return '#3b82f6'; // Blu
                        return '#6b7280'; // Grigio per zone meno richieste
                      };

                      return (
                        <CircleMarker
                          key={`${zone.lat}-${zone.lng}-${index}`}
                          center={[zone.lat, zone.lng]}
                          radius={radius}
                          fillColor={getColor(zone.searchCount)}
                          color="#ffffff"
                          weight={3}
                          opacity={1}
                          fillOpacity={0.8}
                          eventHandlers={{
                            click: () => setSelectedZone(zone),
                            mouseover: (e) => {
                              e.target.setStyle({ weight: 5, fillOpacity: 0.9 });
                            },
                            mouseout: (e) => {
                              e.target.setStyle({ weight: 3, fillOpacity: 0.8 });
                            }
                          }}
                        >
                          <Popup>
                            <div className="min-w-64">
                              <div className="font-bold text-lg mb-3 text-blue-700 border-b pb-2">
                                🏠 {getZoneName(zone.lat, zone.lng)}
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-blue-50 p-2 rounded">
                                  <div className="font-semibold text-blue-700">Ricerche</div>
                                  <div className="text-xl font-bold text-blue-900">{zone.searchCount}</div>
                                </div>
                                <div className="bg-green-50 p-2 rounded">
                                  <div className="font-semibold text-green-700">Clienti</div>
                                  <div className="text-xl font-bold text-green-900">{zone.clients.length}</div>
                                </div>
                                <div className="bg-purple-50 p-2 rounded">
                                  <div className="font-semibold text-purple-700">Budget Medio</div>
                                  <div className="text-sm font-bold text-purple-900">{formatPrice(zone.avgBudget)}</div>
                                </div>
                                <div className="bg-orange-50 p-2 rounded">
                                  <div className="font-semibold text-orange-700">Superficie</div>
                                  <div className="text-sm font-bold text-orange-900">{Math.round(zone.avgSize)} m²</div>
                                </div>
                              </div>
                              {zone.clients.length > 0 && (
                                <div className="mt-3 pt-2 border-t">
                                  <div className="font-semibold text-sm text-gray-700 mb-2">
                                    👥 Clienti Interessati:
                                  </div>
                                  <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {zone.clients.slice(0, 5).map((client, i) => (
                                      <div key={client.id} className="text-xs bg-gray-50 p-2 rounded">
                                        <div className="font-medium">{client.name}</div>
                                        <div className="text-gray-600">{formatPrice(client.budget)} • {client.size} m²</div>
                                      </div>
                                    ))}
                                    {zone.clients.length > 5 && (
                                      <div className="text-xs text-gray-500 italic text-center">
                                        +{zone.clients.length - 5} altri clienti...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </Popup>
                          <Tooltip>
                            <div className="text-center bg-black text-white p-2 rounded shadow-lg">
                              <div className="font-bold">{getZoneName(zone.lat, zone.lng)}</div>
                              <div className="text-sm">{zone.searchCount} ricerche • {formatPrice(zone.avgBudget)}</div>
                            </div>
                          </Tooltip>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>
                </div>
                
                {/* Legenda colori migliorata */}
                <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Legenda Intensità Ricerche:</div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-white"></div>
                      <span>1 ricerca</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
                      <span>2 ricerche</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-white"></div>
                      <span>3 ricerche</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-orange-600 border-2 border-white"></div>
                      <span>4 ricerche</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white"></div>
                      <span>5+ ricerche</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top 10 Zone e Filtri */}
            <div className="space-y-6">
              {/* Filtri rapidi */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5" />
                    Filtri Rapidi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Budget Minimo</label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[filters.minBudget]}
                        onValueChange={([value]) => setFilters(f => ({ ...f, minBudget: value }))}
                        max={1000000}
                        min={0}
                        step={50000}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-600 min-w-20">{formatPrice(filters.minBudget)}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ricerche Minime</label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[filters.minSearches]}
                        onValueChange={([value]) => setFilters(f => ({ ...f, minSearches: value }))}
                        max={10}
                        min={1}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-600 min-w-8">{filters.minSearches}</span>
                    </div>
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
                    size="sm"
                    className="w-full"
                  >
                    Reset
                  </Button>
                </CardContent>
              </Card>

              {/* Top 10 Zone */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    🏆 Top Zone
                  </CardTitle>
                  <CardDescription>
                    Le zone più richieste dai clienti
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topZones.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {topZones.map((zone, index) => {
                        const isSelected = selectedZone?.lat === zone.lat && selectedZone?.lng === zone.lng;
                        const isTopThree = index < 3;
                        
                        return (
                          <div
                            key={`${zone.lat}-${zone.lng}`}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg",
                              isSelected
                                ? "bg-blue-50 border-blue-300 shadow-md"
                                : "hover:bg-gray-50 border-gray-200",
                              isTopThree && "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200"
                            )}
                            onClick={() => setSelectedZone(zone)}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={cn(
                                "flex items-center justify-center w-7 h-7 text-xs font-bold text-white rounded-full",
                                isTopThree 
                                  ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                                  : "bg-blue-600"
                              )}>
                                {isTopThree ? ["🥇", "🥈", "🥉"][index] : index + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-sm">
                                  {getZoneName(zone.lat, zone.lng)}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {zone.clients.length} clienti • {formatPrice(zone.avgBudget)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge 
                                variant={zone.searchCount >= 5 ? "destructive" : 
                                       zone.searchCount >= 3 ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {zone.searchCount} ricerche
                              </Badge>
                              <div className="text-xs text-gray-500 mt-1">
                                {Math.round(zone.avgSize)} m²
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nessuna zona trovata con i filtri attuali</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Dettagli zona selezionata */}
        {selectedZone && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Target className="h-5 w-5" />
                Dettagli Zona: {getZoneName(selectedZone.lat, selectedZone.lng)}
              </CardTitle>
              <CardDescription>
                Informazioni complete sui clienti interessati a questa zona
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Numero Ricerche</div>
                  <div className="text-2xl font-bold text-blue-600">{selectedZone.searchCount}</div>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Budget Medio</div>
                  <div className="text-2xl font-bold text-green-600">{formatPrice(selectedZone.avgBudget)}</div>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Superficie Media</div>
                  <div className="text-2xl font-bold text-purple-600">{Math.round(selectedZone.avgSize)} m²</div>
                </div>
              </div>
              
              {selectedZone.clients.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-700 mb-3">Clienti interessati ({selectedZone.clients.length}):</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedZone.clients.map((client) => (
                      <div key={client.id} className="bg-white p-3 rounded-lg border">
                        <div className="font-medium text-sm">{client.name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Budget: {formatPrice(client.budget)} • Superficie: {client.size} m²
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {client.phone}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}