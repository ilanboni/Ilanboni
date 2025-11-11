import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building, Filter, MapPin, Plus, User, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { SharedProperty } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SimplifiedSharedPropertyCard } from "@/components/properties/SimplifiedSharedPropertyCard";

const ITEMS_PER_PAGE = 50;

function getStageColor(stage: string) {
  switch (stage) {
    case "address_found":
      return "bg-gray-200 text-gray-800";
    case "owner_found":
      return "bg-blue-200 text-blue-800";
    case "owner_contact_found":
      return "bg-indigo-200 text-indigo-800";
    case "owner_contacted":
      return "bg-violet-200 text-violet-800";
    case "result":
      return "bg-green-200 text-green-800";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

function getStageLabel(stage: string) {
  switch (stage) {
    case "address_found":
      return "Indirizzo trovato";
    case "owner_found":
      return "Proprietario trovato";
    case "owner_contact_found":
      return "Contatto del proprietario";
    case "owner_contacted":
      return "Proprietario contattato";
    case "result":
      return "Risultato";
    default:
      return stage;
  }
}

export default function SharedPropertiesPage() {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<{ 
    stage?: string; 
    search?: string; 
    multiAgencyOnly?: boolean;
    classification?: 'private' | 'multiagency' | 'single-agency' | 'all';
    isFavorite?: boolean;
  }>({
    classification: 'all',
    multiAgencyOnly: true // Default: show only properties within 5km of Duomo
  });
  const { toast } = useToast();

  // Mutation for deleting property
  const deleteMutation = useMutation({
    mutationFn: async (propertyId: number) => {
      return await apiRequest(`/api/shared-properties/${propertyId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: "Proprietà eliminata",
        description: "La proprietà è stata eliminata con successo"
      });
      // Invalidate all shared-properties queries
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scraped-properties/multi-agency'] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la proprietà",
        variant: "destructive"
      });
    }
  });

  // Mutation for toggling favorite status
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ propertyId, isFavorite }: { propertyId: number; isFavorite: boolean }) => {
      return await apiRequest(`/api/shared-properties/${propertyId}/favorite`, {
        method: 'PATCH',
        data: { isFavorite }
      });
    },
    onMutate: async ({ propertyId, isFavorite }) => {
      // Optimistic update - use EXACT same key structure as useQuery
      const queryKey = filters.multiAgencyOnly 
        ? ['/api/scraped-properties/multi-agency', filters] 
        : ['/api/shared-properties', filters];
      
      await queryClient.cancelQueries({ queryKey });
      
      const previousData = queryClient.getQueryData(queryKey);
      
      queryClient.setQueryData(queryKey, (old: any[]) => {
        return old?.map(prop => 
          prop.id === propertyId ? { ...prop, isFavorite } : prop
        ) || old;
      });
      
      return { previousData, queryKey };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previousData);
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
      // Invalidate all shared-properties queries to keep other filters in sync
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scraped-properties/multi-agency'] });
    }
  });

  // Fetch shared properties (all or multi-agency only)
  const { data: sharedProperties, isLoading, isError } = useQuery({
    queryKey: [filters.multiAgencyOnly ? '/api/scraped-properties/multi-agency' : '/api/shared-properties', filters],
    queryFn: async () => {
      try {
        if (filters.multiAgencyOnly) {
          // Fetch multi-agency properties near Duomo
          const queryParams = new URLSearchParams();
          if (filters.isFavorite) queryParams.set('isFavorite', 'true');
          
          const response = await fetch(`/api/scraped-properties/multi-agency?${queryParams}`);
          if (!response.ok) {
            throw new Error('Errore nel caricamento delle proprietà multi-agency');
          }
          return response.json() as Promise<SharedProperty[]>;
        } else {
          // Fetch all shared properties with stage/search filters
          const queryParams = new URLSearchParams();
          if (filters.stage) queryParams.set('stage', filters.stage);
          if (filters.search) queryParams.set('search', filters.search);
          if (filters.isFavorite) queryParams.set('isFavorite', 'true');

          const response = await fetch(`/api/shared-properties?${queryParams}`);
          if (!response.ok) {
            throw new Error('Errore nel caricamento delle proprietà condivise');
          }
          return response.json() as Promise<SharedProperty[]>;
        }
      } catch (error) {
        console.error("Errore nel caricamento delle proprietà:", error);
        throw error;
      }
    },
    retry: 1,
    retryDelay: 1000
  });

  // Handle search
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const searchInput = e.currentTarget.elements.namedItem('search') as HTMLInputElement;
    setFilters(prev => ({ ...prev, search: searchInput.value }));
  };

  // Handle filter by stage
  const handleStageFilter = (stage: string) => {
    setFilters(prev => ({ ...prev, stage: stage === 'all' ? undefined : stage }));
  };

  // Toggle multi-agency filter
  const toggleMultiAgencyFilter = () => {
    setCurrentPage(1); // Reset to first page
    setFilters(prev => ({ 
      ...prev, 
      multiAgencyOnly: !prev.multiAgencyOnly,
      // Reset stage/search when switching to multi-agency
      stage: !prev.multiAgencyOnly ? undefined : prev.stage,
      search: !prev.multiAgencyOnly ? undefined : prev.search
    }));
  };

  // Handle classification filter change
  const handleClassificationChange = (value: string) => {
    setCurrentPage(1); // Reset to first page
    setFilters(prev => ({ 
      ...prev, 
      classification: value as 'private' | 'multiagency' | 'single-agency' | 'all'
    }));
  };

  // Filter properties by classification (backend already provides classification field)
  const filteredProperties = useMemo(() => {
    if (!sharedProperties) return [];
    if (!filters.classification || filters.classification === 'all') {
      return sharedProperties;
    }
    
    return sharedProperties.filter(property => {
      // Backend returns 'multiagency' or 'private', map 'single-agency' to 'private' for now
      if (filters.classification === 'single-agency') {
        return property.classification === 'private';
      }
      return property.classification === filters.classification;
    });
  }, [sharedProperties, filters.classification]);

  // Paginate properties
  const paginatedProperties = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredProperties.slice(startIndex, endIndex);
  }, [filteredProperties, currentPage]);

  const totalPages = Math.ceil((filteredProperties?.length || 0) / ITEMS_PER_PAGE);

  if (isError) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Proprietà Condivise</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          Si è verificato un errore nel caricamento delle proprietà condivise.
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Proprietà Condivise</h1>
        <Button onClick={() => setLocation("/properties/shared/new")}>
          <Plus className="mr-2 h-4 w-4" /> Nuova proprietà condivisa
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input 
              name="search" 
              placeholder="Cerca per indirizzo, città o proprietario" 
              defaultValue={filters.search} 
              className="flex-1"
              disabled={filters.multiAgencyOnly}
            />
            <Button type="submit" disabled={filters.multiAgencyOnly}>Cerca</Button>
          </form>
        </div>
        <div className="w-full md:w-48">
          <Select 
            value={filters.classification || 'all'} 
            onValueChange={handleClassificationChange}
          >
            <SelectTrigger>
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              <SelectItem value="private">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                  Privati
                </div>
              </SelectItem>
              <SelectItem value="multiagency">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
                  Pluricondivise
                </div>
              </SelectItem>
              <SelectItem value="single-agency">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                  Monocondivise
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-48">
          <Select 
            value={filters.stage || 'all'} 
            onValueChange={handleStageFilter}
            disabled={filters.multiAgencyOnly}
          >
            <SelectTrigger>
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtra per fase" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le fasi</SelectItem>
              <SelectItem value="address_found">Indirizzo trovato</SelectItem>
              <SelectItem value="owner_found">Proprietario trovato</SelectItem>
              <SelectItem value="owner_contact_found">Contatto del proprietario</SelectItem>
              <SelectItem value="owner_contacted">Proprietario contattato</SelectItem>
              <SelectItem value="result">Risultato</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-auto">
          <Button 
            variant={filters.multiAgencyOnly ? "default" : "outline"}
            onClick={toggleMultiAgencyFilter}
            className="w-full md:w-auto"
          >
            <Building className="mr-2 h-4 w-4" />
            {filters.multiAgencyOnly ? "Mostra tutte" : "Multi-Agency Duomo"}
          </Button>
        </div>
        <div className="w-full md:w-auto">
          <Button 
            variant={filters.isFavorite ? "default" : "outline"}
            onClick={() => {
              setCurrentPage(1);
              setFilters(prev => ({ ...prev, isFavorite: !prev.isFavorite }));
            }}
            className="w-full md:w-auto"
            data-testid="button-toggle-favorites"
          >
            <Star className={`mr-2 h-4 w-4 ${filters.isFavorite ? 'fill-yellow-400' : ''}`} />
            Solo preferiti
          </Button>
        </div>
      </div>

      {filters.multiAgencyOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-sm text-blue-800">
            📍 Filtro attivo: Proprietà gestite da 2+ agenzie diverse entro 5km dal Duomo di Milano
          </p>
        </div>
      )}

      {/* Legend for color-coding */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
        <p className="text-xs font-semibold text-gray-700 mb-2">Legenda classificazione:</p>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>Privato</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span>Pluricondivise (Multi-Agency)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span>Monocondivise (Singola Agenzia)</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4 mb-1" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {(!paginatedProperties || paginatedProperties.length === 0) ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              {filters.multiAgencyOnly ? (
                <>
                  <p className="text-gray-600 mb-2">Nessuna proprietà multi-agency trovata entro 5km dal Duomo</p>
                  <p className="text-sm text-gray-500">Le proprietà multi-agency appaiono qui quando vengono scrapate per clienti con rating 4-5</p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 mb-2">Nessuna proprietà condivisa trovata</p>
                  <Button variant="outline" onClick={() => setLocation("/properties/shared/new")}>
                    <Plus className="mr-2 h-4 w-4" /> Aggiungi proprietà condivisa
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3" data-testid="properties-grid">
                {paginatedProperties.map((property) => (
                  <SimplifiedSharedPropertyCard
                    key={property.id}
                    property={property}
                    onToggleFavorite={(propertyId, isFavorite) => {
                      toggleFavoriteMutation.mutate({ propertyId, isFavorite });
                    }}
                    onDelete={(propertyId) => {
                      deleteMutation.mutate(propertyId);
                    }}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Precedente
                  </Button>
                  <span className="text-sm text-gray-600">
                    Pagina {currentPage} di {totalPages} ({filteredProperties.length} proprietà)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Successiva
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}