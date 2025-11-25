import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Star, Phone, User, Building, Building2, Home } from "lucide-react";
import { type SharedProperty } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Helmet } from "react-helmet";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const ITEMS_PER_PAGE = 50;

// Centralized query key helper with string-based params to avoid object reference issues
const rankingQueryKey = (page: number, limit: number) => 
  ['/api/properties/ranking', `page-${page}-limit-${limit}`] as const;

function cleanAddress(address: string): string {
  if (!address) return '';
  
  let cleaned = address
    .replace(/&#8212;/g, '-')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  
  const partBeforePunct = cleaned.split(/[.,]/)[0].trim();
  const match = partBeforePunct.match(/^(via|corso|viale|piazza|largo|via\s+|corso\s+|viale\s+|piazza\s+|largo\s+)\s*(.+?)(\s+\d+[a-z]?)?$/i);
  
  if (match) {
    const type = match[1].trim();
    const name = match[2].trim();
    const number = match[3]?.trim() || '';
    return `${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} ${name}${number}`;
  }
  
  return partBeforePunct.charAt(0).toUpperCase() + partBeforePunct.slice(1);
}

type RankedProperty = SharedProperty & {
  matchingBuyersCount: number;
  propertyType: 'private' | 'mono' | 'pluri';
};

export default function PropertiesRankingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [currentPage, setCurrentPage] = useState(1);
  
  const [filters, setFilters] = useState<{
    search?: string;
    sortOrder?: string;
    showPrivate?: boolean;
    showMono?: boolean;
    showPluri?: boolean;
    isFavorite?: boolean;
  }>({
    sortOrder: "most-matches",
    showPrivate: true,
    showMono: true,
    showPluri: true,
    isFavorite: false
  });
  
  const { data: rankingData, isLoading, isError, refetch } = useQuery<{
    properties: RankedProperty[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: rankingQueryKey(currentPage, ITEMS_PER_PAGE),
    queryFn: async () => {
      const res = await fetch(`/api/properties/ranking?page=${currentPage}&limit=${ITEMS_PER_PAGE}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    }
  });
  
  const allProperties = rankingData?.properties || [];

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ propertyId, isFavorite }: { propertyId: number; isFavorite: boolean }) => {
      return await apiRequest(`/api/properties/${propertyId}/favorite`, {
        method: 'PATCH',
        data: { isFavorite }
      });
    },
    onMutate: async ({ propertyId, isFavorite }) => {
      const queryKey = rankingQueryKey(currentPage, ITEMS_PER_PAGE);
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.properties) return old;
        return {
          ...old,
          properties: old.properties.map((prop: any) => 
            prop.id === propertyId ? { ...prop, isFavorite } : prop
          )
        };
      });
      
      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context) {
        const queryKey = rankingQueryKey(currentPage, ITEMS_PER_PAGE);
        queryClient.setQueryData(queryKey, context.previousData);
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
      queryClient.invalidateQueries({ 
        queryKey: rankingQueryKey(currentPage, ITEMS_PER_PAGE)
      });
    }
  });
  
  // Filter properties client-side (filtering is done client-side, but pagination server-side)
  const filteredProperties = useMemo(() => {
    const filtered = allProperties?.filter((property: RankedProperty) => {
      // Filtro tipo immobile
      if (!filters.showPrivate && property.propertyType === 'private') return false;
      if (!filters.showMono && property.propertyType === 'mono') return false;
      if (!filters.showPluri && property.propertyType === 'pluri') return false;
      
      // Ricerca testuale
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const addressMatch = property.address?.toLowerCase().includes(query);
        const cityMatch = property.city?.toLowerCase().includes(query);
        if (!addressMatch && !cityMatch) return false;
      }

      // Solo preferiti
      if (filters.isFavorite && !property.isFavorite) return false;
      
      return true;
    }) || [];
    
    // Sorting is already done server-side, so we don't need to re-sort
    return filtered;
  }, [allProperties, filters]);

  const totalPages = rankingData?.totalPages || 1;
  
  const stats = useMemo(() => ({
    total: rankingData?.total || 0,
    private: filteredProperties.filter(p => p.propertyType === 'private').length,
    mono: filteredProperties.filter(p => p.propertyType === 'mono').length,
    pluri: filteredProperties.filter(p => p.propertyType === 'pluri').length,
    withMatches: filteredProperties.filter(p => p.matchingBuyersCount > 0).length,
    favorites: filteredProperties.filter(p => p.isFavorite).length,
  }), [filteredProperties, rankingData]);
  
  const handleRefresh = () => {
    queryClient.invalidateQueries({ 
      queryKey: rankingQueryKey(currentPage, ITEMS_PER_PAGE)
    });
    toast({
      title: "Aggiornamento in corso",
      description: "Ricaricamento della classifica..."
    });
  };

  const getPropertyTypeBadge = (propertyType: 'private' | 'mono' | 'pluri') => {
    switch (propertyType) {
      case 'private':
        return <Badge variant="default" className="bg-green-600"><Home className="h-3 w-3 mr-1" />Privato</Badge>;
      case 'mono':
        return <Badge variant="default" className="bg-red-600"><Building className="h-3 w-3 mr-1" />Mono</Badge>;
      case 'pluri':
        return <Badge variant="default" className="bg-yellow-600"><Building2 className="h-3 w-3 mr-1" />Pluri</Badge>;
    }
  };

  if (isError) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Classifica Immobili</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          Si è verificato un errore nel caricamento della classifica.
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Classifica Immobili | RealEstate CRM</title>
        <meta name="description" content="Classifica immobili per numero di potenziali acquirenti interessati." />
      </Helmet>
      
      <div className="container py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Classifica Immobili</h1>
            <p className="text-sm text-gray-600 mt-1">
              Tutti gli immobili ordinati per numero di acquirenti interessati
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
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="text-xs">
            {stats.total} immobili totali
          </Badge>
          <Badge variant="outline" className="text-xs bg-green-50">
            <Home className="h-3 w-3 mr-1" />
            {stats.private} privati
          </Badge>
          <Badge variant="outline" className="text-xs bg-red-50">
            <Building className="h-3 w-3 mr-1" />
            {stats.mono} mono
          </Badge>
          <Badge variant="outline" className="text-xs bg-yellow-50">
            <Building2 className="h-3 w-3 mr-1" />
            {stats.pluri} pluri
          </Badge>
          {stats.withMatches > 0 && (
            <Badge variant="outline" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              {stats.withMatches} con matching
            </Badge>
          )}
          {stats.favorites > 0 && (
            <Badge variant="outline" className="text-xs">
              <Star className="h-3 w-3 mr-1 fill-yellow-400" />
              {stats.favorites} preferiti
            </Badge>
          )}
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col gap-4">
            <div className="relative flex-1">
              <Input
                placeholder="Cerca per indirizzo, città..."
                value={filters.search || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full"
                data-testid="input-search"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="private-filter" 
                  checked={filters.showPrivate}
                  onCheckedChange={(checked) => {
                    setCurrentPage(1);
                    setFilters(prev => ({ ...prev, showPrivate: checked }));
                  }}
                  data-testid="switch-private-filter"
                />
                <Label htmlFor="private-filter" className="text-sm cursor-pointer">
                  Privati ({stats.private})
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="mono-filter" 
                  checked={filters.showMono}
                  onCheckedChange={(checked) => {
                    setCurrentPage(1);
                    setFilters(prev => ({ ...prev, showMono: checked }));
                  }}
                  data-testid="switch-mono-filter"
                />
                <Label htmlFor="mono-filter" className="text-sm cursor-pointer">
                  Mono-condivisi ({stats.mono})
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                  id="pluri-filter" 
                  checked={filters.showPluri}
                  onCheckedChange={(checked) => {
                    setCurrentPage(1);
                    setFilters(prev => ({ ...prev, showPluri: checked }));
                  }}
                  data-testid="switch-pluri-filter"
                />
                <Label htmlFor="pluri-filter" className="text-sm cursor-pointer">
                  Pluri-condivisi ({stats.pluri})
                </Label>
              </div>
              
              <Select 
                value={filters.sortOrder} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, sortOrder: value }))}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-sort">
                  <SelectValue placeholder="Ordina per" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="most-matches">Più matching</SelectItem>
                  <SelectItem value="price-low">Prezzo: basso-alto</SelectItem>
                  <SelectItem value="price-high">Prezzo: alto-basso</SelectItem>
                  <SelectItem value="size-low">Metratura: piccolo-grande</SelectItem>
                  <SelectItem value="size-high">Metratura: grande-piccolo</SelectItem>
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
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">Nessun immobile trovato con i filtri selezionati.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((property) => (
                <Card 
                  key={property.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/properties/shared/${property.id}`)}
                  data-testid={`card-property-${property.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">
                        {cleanAddress(property.address || 'Indirizzo non disponibile')}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavoriteMutation.mutate({ 
                            propertyId: property.id, 
                            isFavorite: !property.isFavorite 
                          });
                        }}
                        data-testid={`button-favorite-${property.id}`}
                      >
                        <Star className={`h-4 w-4 ${property.isFavorite ? 'fill-yellow-400' : ''}`} />
                      </Button>
                    </div>
                    <CardDescription className="flex items-center gap-2 flex-wrap">
                      {getPropertyTypeBadge(property.propertyType)}
                      {property.matchingBuyersCount > 0 && (
                        <Badge variant="outline">
                          <User className="h-3 w-3 mr-1" />
                          {property.matchingBuyersCount} matching
                        </Badge>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-green-600">
                          €{property.price?.toLocaleString() || 'N/D'}
                        </span>
                        {property.size && (
                          <span className="text-lg text-gray-600">
                            {property.size}mq
                          </span>
                        )}
                      </div>
                      {property.ownerPhone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-3 w-3" />
                          {property.ownerPhone}
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="text-xs text-gray-500">
                    Aggiunto il {new Date(property.createdAt || '').toLocaleDateString('it-IT')}
                  </CardFooter>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Precedente
                </Button>
                <span className="text-sm text-gray-600">
                  Pagina {currentPage} di {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Successiva
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
