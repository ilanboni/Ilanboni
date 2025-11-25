import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Plus, RefreshCw, Map, List, Star, Phone, Trash2, User } from "lucide-react";
import { type SharedProperty } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const ITEMS_PER_PAGE = 50;

// Coordinate del Duomo di Milano
const DUOMO_LAT = 45.464204;
const DUOMO_LNG = 9.191383;
const RADIUS_KM = 4;

// Pulisce l'indirizzo per mostrare solo la parte essenziale
function cleanAddress(address: string): string {
  if (!address) return '';
  
  // Rimuovi HTML entities
  let cleaned = address
    .replace(/&#8212;/g, '-')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  
  // Estrai solo la parte prima del primo punto o comma
  const partBeforePunct = cleaned.split(/[.,]/)[0].trim();
  
  // Se la parte è troppo lunga, potrebbe contenere dettagli inutili - tronca dopo la strada
  // Estrai: Via/Corso/Viale + [nome] + [numero]
  const match = partBeforePunct.match(/^(via|corso|viale|piazza|largo|via\s+|corso\s+|viale\s+|piazza\s+|largo\s+)\s*(.+?)(\s+\d+[a-z]?)?$/i);
  
  if (match) {
    const type = match[1].trim();
    const name = match[2].trim();
    const number = match[3]?.trim() || '';
    return `${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} ${name}${number}`;
  }
  
  // Fallback: ritorna la parte prima della punteggiatura, capitalizzata
  return partBeforePunct.charAt(0).toUpperCase() + partBeforePunct.slice(1);
}

// Calcola distanza in km usando formula di Haversine
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raggio della Terra in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Create custom marker icon for private properties
const createPrivateMarker = () => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: #10b981;
        color: white;
        border: 2px solid white;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        P
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

export default function PrivatePropertiesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // View mode and pagination
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  
  // State for filtering
  const [filters, setFilters] = useState<{
    search?: string;
    sortOrder?: string;
    onlyWithPhone?: boolean;
    portalFilter?: string;
    isFavorite?: boolean;
  }>({
    sortOrder: "newest",
    onlyWithPhone: false,
    portalFilter: "all",
    isFavorite: false
  });
  
  // Fetch only private shared properties using new classification system
  const { data: allProperties, isLoading, isError, refetch } = useQuery<SharedProperty[]>({
    queryKey: ['/api/properties/private']
  });

  // Mutation for toggling favorite status
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ propertyId, isFavorite }: { propertyId: number; isFavorite: boolean }) => {
      return await apiRequest(`/api/properties/${propertyId}/favorite`, {
        method: 'PATCH',
        data: { isFavorite }
      });
    },
    onMutate: async ({ propertyId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/properties/private'] });
      const previousData = queryClient.getQueryData(['/api/properties/private']);
      
      queryClient.setQueryData(['/api/properties/private'], (old: any[]) => {
        return old?.map(prop => 
          prop.id === propertyId ? { ...prop, isFavorite } : prop
        ) || old;
      });
      
      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context) {
        queryClient.setQueryData(['/api/properties/private'], context.previousData);
      }
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato preferito",
        variant: "destructive"
      });
    },
    onSuccess: () => {
      toast({
        title: "Aggiornato",
        description: "Lo stato preferito è stato modificato"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties/private'] });
    }
  });
  
  // Mutation for deleting property
  const deleteMutation = useMutation({
    mutationFn: async (propertyId: number) => {
      return await apiRequest(`/api/properties/${propertyId}?type=shared`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Proprietà eliminata",
        description: "La proprietà è stata eliminata con successo"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/properties/private'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la proprietà",
        variant: "destructive"
      });
    }
  });
  
  // Filter and sort properties with memoization for performance
  const filteredProperties = useMemo(() => {
    // Filter properties - backend already returns only green (private) properties
    const filtered = allProperties?.filter((property: SharedProperty) => {
      // Filtro location: Estrai lat/lng da location object
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (property.location) {
        const loc = property.location as any;
        if (loc.lat !== undefined && loc.lng !== undefined) {
          lat = typeof loc.lat === 'number' ? loc.lat : parseFloat(loc.lat);
          lng = typeof loc.lng === 'number' ? loc.lng : parseFloat(loc.lng);
        }
      }
      
      // Filtro 1: Raggio 4km dal Duomo di Milano (opzionale - già filtrato dal backend)
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const distance = calculateDistance(DUOMO_LAT, DUOMO_LNG, lat, lng);
        if (isNaN(distance) || distance > RADIUS_KM) {
          return false;
        }
      }
      
      // Filtro 4: Solo con telefono (opzionale)
      if (filters.onlyWithPhone && !property.ownerPhone) return false;
      
      // Filtro 5: Portale specifico
      if (filters.portalFilter && filters.portalFilter !== 'all') {
        const portal = property.portalSource?.toLowerCase() || '';
        if (filters.portalFilter === 'immobiliare' && !portal.includes('immobiliare')) return false;
        if (filters.portalFilter === 'idealista' && !portal.includes('idealista')) return false;
        if (filters.portalFilter === 'clickcase' && !portal.includes('clickcase')) return false;
        if (filters.portalFilter === 'casadaprivato' && !portal.includes('casadaprivato')) return false;
      }
      
      // Filtro 6: Ricerca testuale
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const addressMatch = property.address?.toLowerCase().includes(query);
        const cityMatch = property.city?.toLowerCase().includes(query);
        // SharedProperty doesn't have description field
        if (!addressMatch && !cityMatch) return false;
      }

      // Filtro 7: Solo preferiti
      if (filters.isFavorite && !property.isFavorite) return false;
      
      return true;
    }) || [];
    
    // Sort properties
    return [...filtered].sort((a, b) => {
      switch (filters.sortOrder) {
        case 'most-matches':
          return ((b as any).matchingBuyersCount || 0) - ((a as any).matchingBuyersCount || 0);
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'price-low':
          return (a.price || 0) - (b.price || 0);
        case 'price-high':
          return (b.price || 0) - (a.price || 0);
        default:
          return 0;
      }
    });
  }, [allProperties, filters]);

  // Paginate properties
  const paginatedProperties = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredProperties.slice(startIndex, endIndex);
  }, [filteredProperties, currentPage]);

  const totalPages = Math.ceil((filteredProperties?.length || 0) / ITEMS_PER_PAGE);
  
  // Calcola statistiche
  const stats = useMemo(() => ({
    total: filteredProperties.length,
    withPhone: filteredProperties.filter(p => p.ownerPhone).length,
    immobiliare: filteredProperties.filter(p => p.portalSource?.toLowerCase().includes('immobiliare')).length,
    idealista: filteredProperties.filter(p => p.portalSource?.toLowerCase().includes('idealista')).length,
    clickcase: filteredProperties.filter(p => p.portalSource?.toLowerCase().includes('clickcase')).length,
    casadaprivato: filteredProperties.filter(p => p.portalSource?.toLowerCase().includes('casadaprivato')).length,
    favorites: filteredProperties.filter(p => p.isFavorite).length,
  }), [filteredProperties]);
  
  // Function to refresh data
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/properties/private'] });
    toast({
      title: "Aggiornamento in corso",
      description: "Ricaricamento delle proprietà..."
    });
  };

  if (isError) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Proprietà Private</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          Si è verificato un errore nel caricamento delle proprietà private.
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Proprietà Private | RealEstate CRM</title>
        <meta name="description" content="Visualizza le proprietà in vendita direttamente dai privati entro 4km dal Duomo di Milano." />
      </Helmet>
      
      <div className="container py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Proprietà Private</h1>
            <p className="text-sm text-gray-600 mt-1">
              Immobili venduti direttamente dai proprietari entro {RADIUS_KM}km dal Duomo di Milano
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              data-testid="button-refresh"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Aggiorna
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
              data-testid="button-toggle-view"
            >
              {viewMode === 'list' ? (
                <><Map className="mr-2 h-4 w-4" /> Mappa</>
              ) : (
                <><List className="mr-2 h-4 w-4" /> Lista</>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Badges */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            Raggio {RADIUS_KM}km dal Duomo
          </Badge>
          <Badge variant="outline" className="text-xs">
            {stats.total} immobili
          </Badge>
          {stats.withPhone > 0 && (
            <Badge variant="outline" className="text-xs">
              <Phone className="h-3 w-3 mr-1" />
              {stats.withPhone} con telefono
            </Badge>
          )}
          {stats.favorites > 0 && (
            <Badge variant="outline" className="text-xs">
              <Star className="h-3 w-3 mr-1 fill-yellow-400" />
              {stats.favorites} preferiti
            </Badge>
          )}
        </div>
        
        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Input
                placeholder="Cerca per indirizzo, città, descrizione..."
                value={filters.search || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full"
                data-testid="input-search"
              />
            </div>
            
            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="phone-filter" 
                  checked={filters.onlyWithPhone}
                  onCheckedChange={(checked) => {
                    setCurrentPage(1);
                    setFilters(prev => ({ ...prev, onlyWithPhone: checked }));
                  }}
                  data-testid="switch-phone-filter"
                />
                <Label htmlFor="phone-filter" className="text-sm cursor-pointer">
                  Solo con telefono ({stats.withPhone})
                </Label>
              </div>
              
              <Select 
                value={filters.portalFilter} 
                onValueChange={(value) => {
                  setCurrentPage(1);
                  setFilters(prev => ({ ...prev, portalFilter: value }));
                }}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-portal">
                  <SelectValue placeholder="Portale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i portali</SelectItem>
                  <SelectItem value="immobiliare">Immobiliare.it ({stats.immobiliare})</SelectItem>
                  <SelectItem value="idealista">Idealista.it ({stats.idealista})</SelectItem>
                  <SelectItem value="clickcase">ClickCase.it ({stats.clickcase})</SelectItem>
                  <SelectItem value="casadaprivato">CasaDaPrivato.it ({stats.casadaprivato})</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={filters.sortOrder} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, sortOrder: value }))}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-sort">
                  <SelectValue placeholder="Ordina per" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="most-matches">Più matching</SelectItem>
                  <SelectItem value="newest">Più recenti</SelectItem>
                  <SelectItem value="oldest">Più vecchi</SelectItem>
                  <SelectItem value="price-low">Prezzo: basso-alto</SelectItem>
                  <SelectItem value="price-high">Prezzo: alto-basso</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant={filters.isFavorite ? "default" : "outline"}
                onClick={() => {
                  setCurrentPage(1);
                  setFilters(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
                }}
                className="w-full sm:w-auto"
                data-testid="button-toggle-favorites"
              >
                <Star className={`mr-2 h-4 w-4 ${filters.isFavorite ? 'fill-yellow-400' : ''}`} />
                Solo preferiti
              </Button>
            </div>
          </div>
        </div>
        
        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        ) : viewMode === 'map' ? (
          // Map View
          <>
            {filteredProperties.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
                <p className="text-gray-600 mb-2">Nessuna proprietà da mostrare sulla mappa</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    🗺️ Vista Mappa - Mostrando {filteredProperties.length} proprietà
                  </p>
                </div>
                <div className="h-[600px] rounded-lg overflow-hidden border-2 border-gray-200">
                  <MapContainer
                    center={[DUOMO_LAT, DUOMO_LNG]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    key={`map-${filteredProperties.length}`}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {filteredProperties.map((property) => {
                      // Extract lat/lng from location object
                      const loc = property.location as any;
                      const lat = loc?.lat ? (typeof loc.lat === 'number' ? loc.lat : parseFloat(loc.lat)) : NaN;
                      const lng = loc?.lng ? (typeof loc.lng === 'number' ? loc.lng : parseFloat(loc.lng)) : NaN;
                      
                      if (isNaN(lat) || isNaN(lng)) return null;
                      
                      return (
                        <Marker
                          key={property.id}
                          position={[lat, lng]}
                          icon={createPrivateMarker()}
                        >
                          <Popup>
                            <div className="min-w-[250px]">
                              <h3 className="font-semibold text-sm mb-1">{cleanAddress(property.address)}</h3>
                              <p className="text-xs text-gray-600 mb-2">{property.city}</p>
                              {property.price && (
                                <p className="text-sm font-bold text-green-600 mb-2">
                                  €{property.price.toLocaleString()}
                                </p>
                              )}
                              {property.ownerPhone && (
                                <p className="text-xs text-gray-700 mb-2">
                                  <Phone className="inline h-3 w-3 mr-1" />
                                  {property.ownerPhone}
                                </p>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/properties/${property.id}?type=shared`)}
                                >
                                  Dettagli
                                </Button>
                                <Button
                                  size="sm"
                                  variant={property.isFavorite ? "default" : "outline"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavoriteMutation.mutate({ 
                                      propertyId: property.id, 
                                      isFavorite: !property.isFavorite 
                                    });
                                  }}
                                >
                                  <Star className={`h-3 w-3 ${property.isFavorite ? 'fill-yellow-400' : ''}`} />
                                </Button>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>
              </>
            )}
          </>
        ) : (
          // List View
          <>
            {filteredProperties.length === 0 ? (
              <div className="text-center py-10">
                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <MapPin className="text-gray-400 h-8 w-8" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Nessuna proprietà privata trovata</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filters.search 
                    ? "Nessuna proprietà corrisponde ai criteri di ricerca." 
                    : "Non ci sono proprietà private entro 4km dal Duomo di Milano."}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  Le proprietà vengono importate automaticamente da Immobiliare.it e Idealista.it
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedProperties.map((property) => (
                    <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">{cleanAddress(property.address)}</CardTitle>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteMutation.mutate({ 
                                propertyId: property.id, 
                                isFavorite: !property.isFavorite 
                              });
                            }}
                          >
                            <Star className={`h-4 w-4 ${property.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                          </Button>
                        </div>
                        <CardDescription>{property.city}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {property.price && (
                          <div className="text-lg font-bold text-green-600">
                            €{property.price.toLocaleString()}
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {(property as any).matchingBuyersCount !== undefined && (
                            <Badge 
                              variant={(property as any).matchingBuyersCount > 0 ? "default" : "outline"} 
                              className="text-xs"
                            >
                              <User className="h-3 w-3 mr-1" />
                              {(property as any).matchingBuyersCount} matching
                            </Badge>
                          )}
                          {(property as any).isAlsoFromAgency !== undefined && (
                            <Badge 
                              variant={(property as any).isAlsoFromAgency ? "secondary" : "default"}
                              className={(property as any).isAlsoFromAgency ? "text-xs bg-orange-500 text-white" : "text-xs bg-green-600 text-white"}
                            >
                              {(property as any).isAlsoFromAgency ? "Privato + Agenzia" : "Solo Privato"}
                            </Badge>
                          )}
                          {property.size && (
                            <Badge variant="outline" className="text-xs">
                              {property.size}m²
                            </Badge>
                          )}
                          {property.ownerPhone && (
                            <Badge variant="secondary" className="text-xs">
                              <Phone className="h-3 w-3 mr-1" />
                              Telefono
                            </Badge>
                          )}
                        </div>
                        {property.ownerPhone && (
                          <div className="text-sm text-gray-700">
                            📱 {property.ownerPhone}
                          </div>
                        )}
                        {property.portalSource && (
                          <div className="text-xs text-gray-500">
                            Fonte: {property.portalSource}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/properties/${property.id}?type=shared`)}
                        >
                          Dettagli
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Eliminare "${property.address}"?`)) {
                              deleteMutation.mutate(property.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Precedente
                    </Button>
                    <span className="text-sm text-gray-600">
                      Pagina {currentPage} di {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Successiva
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
