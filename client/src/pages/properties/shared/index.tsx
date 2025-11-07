import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Building, Filter, MapPin, Plus, User } from "lucide-react";
import { SharedProperty } from "@shared/schema";

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
  const [filters, setFilters] = useState<{ stage?: string; search?: string; multiAgencyOnly?: boolean }>({});
  const { toast } = useToast();

  // Fetch shared properties (all or multi-agency only)
  const { data: sharedProperties, isLoading, isError } = useQuery({
    queryKey: [filters.multiAgencyOnly ? '/api/scraped-properties/multi-agency' : '/api/shared-properties', filters],
    queryFn: async ({ queryKey }) => {
      try {
        const [endpoint, filters] = queryKey;
        
        if (filters.multiAgencyOnly) {
          // Fetch multi-agency properties near Duomo
          const response = await fetch(`/api/scraped-properties/multi-agency`);
          if (!response.ok) {
            throw new Error('Errore nel caricamento delle proprietà multi-agency');
          }
          return response.json() as Promise<SharedProperty[]>;
        } else {
          // Fetch all shared properties with stage/search filters
          const queryParams = new URLSearchParams();
          if (filters.stage) queryParams.set('stage', filters.stage);
          if (filters.search) queryParams.set('search', filters.search);

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
    setFilters(prev => ({ 
      ...prev, 
      multiAgencyOnly: !prev.multiAgencyOnly,
      // Reset stage/search when switching to multi-agency
      stage: !prev.multiAgencyOnly ? undefined : prev.stage,
      search: !prev.multiAgencyOnly ? undefined : prev.search
    }));
  };

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
        <div className="w-full md:w-60">
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
      </div>

      {filters.multiAgencyOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-sm text-blue-800">
            📍 Filtro attivo: Proprietà gestite da 2+ agenzie diverse entro 500m dal Duomo di Milano
          </p>
        </div>
      )}

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
          {(!sharedProperties || sharedProperties.length === 0) ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              {filters.multiAgencyOnly ? (
                <>
                  <p className="text-gray-600 mb-2">Nessuna proprietà multi-agency trovata entro 500m dal Duomo</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedProperties.map((property) => (
                <Link key={property.id} href={`/properties/shared/${property.id}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{property.address}</CardTitle>
                        <Badge className={getStageColor(property.stage)}>
                          {getStageLabel(property.stage)}
                        </Badge>
                      </div>
                      <CardDescription>
                        <div className="flex items-center text-gray-500">
                          <MapPin className="h-3.5 w-3.5 mr-1" />
                          {property.city || "Città sconosciuta"}
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <div className="space-y-2">
                        {property.ownerName && (
                          <div className="flex items-center text-sm">
                            <User className="h-4 w-4 mr-2 text-gray-400" />
                            {property.ownerName}
                          </div>
                        )}
                        {property.size && property.price && (
                          <div className="flex items-center text-sm">
                            <Building className="h-4 w-4 mr-2 text-gray-400" />
                            {property.size} m² - {property.price.toLocaleString()} €
                          </div>
                        )}
                        {property.agencies && Array.isArray(property.agencies) && property.agencies.length > 0 && (
                          <div className="flex items-center text-sm font-medium text-blue-600">
                            <Building className="h-4 w-4 mr-2" />
                            {property.agencies.length} {property.agencies.length === 1 ? 'agenzia' : 'agenzie'}
                          </div>
                        )}
                        {property.isAcquired && (
                          <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-200">
                            Acquisito
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button variant="outline" className="w-full">
                        Vedi dettagli
                      </Button>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}