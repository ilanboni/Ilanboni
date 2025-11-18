import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { type PropertyWithDetails } from "@shared/schema";
import PropertyCard from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Search, Phone, MapPin, RefreshCw } from "lucide-react";
import { Helmet } from "react-helmet";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Coordinate del Duomo di Milano
const DUOMO_LAT = 45.464204;
const DUOMO_LNG = 9.191383;
const RADIUS_KM = 4;

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

export default function PrivatePropertiesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // State for filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [onlyWithPhone, setOnlyWithPhone] = useState(false);
  const [portalFilter, setPortalFilter] = useState<string>("all");
  
  // Fetch properties usando il default fetcher configurato (apiRequest)
  const { data: allProperties, isLoading, isError, refetch } = useQuery<PropertyWithDetails[]>({
    queryKey: ['/api/properties']
  });
  
  // Filter and sort properties with memoization for performance
  const sortedProperties = useMemo(() => {
    // Filter properties
    const filtered = allProperties?.filter((property: PropertyWithDetails) => {
      // Filtro 1: Solo privati
      if (property.ownerType !== 'private') return false;
      
      // Filtro 2: Solo da Apify (Immobiliare.it e Idealista.it)
      if (!property.source || !['apify', 'scraper-immobiliare', 'scraper-idealista'].includes(property.source)) {
        return false;
      }
      
      // Filtro 3: Raggio 4km dal Duomo di Milano
      // Validazione esplicita delle coordinate per evitare NaN e accettare zero
      if (property.latitude === null || property.latitude === undefined || 
          property.longitude === null || property.longitude === undefined ||
          property.latitude === '' || property.longitude === '') {
        return false;
      }
      
      const lat = parseFloat(property.latitude);
      const lng = parseFloat(property.longitude);
      
      // Rifiuta esplicitamente NaN
      if (isNaN(lat) || isNaN(lng)) {
        return false;
      }
      
      const distance = calculateDistance(DUOMO_LAT, DUOMO_LNG, lat, lng);
      
      // Rifiuta distanze NaN o oltre il raggio
      if (isNaN(distance) || distance > RADIUS_KM) {
        return false;
      }
      
      // Filtro 4: Solo con telefono (opzionale)
      if (onlyWithPhone && !property.ownerPhone) return false;
      
      // Filtro 5: Portale specifico
      if (portalFilter !== 'all') {
        if (portalFilter === 'immobiliare' && property.source !== 'scraper-immobiliare') return false;
        if (portalFilter === 'idealista' && property.source !== 'scraper-idealista') return false;
      }
      
      // Filtro 6: Ricerca testuale
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const addressMatch = property.address?.toLowerCase().includes(query);
        const cityMatch = property.city?.toLowerCase().includes(query);
        const descMatch = property.description?.toLowerCase().includes(query);
        if (!addressMatch && !cityMatch && !descMatch) return false;
      }
      
      return true;
    }) || [];
    
    // Sort properties
    return [...filtered].sort((a, b) => {
      switch (sortOrder) {
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
  }, [allProperties, searchQuery, sortOrder, onlyWithPhone, portalFilter]);
  
  // Calcola statistiche con memoization
  const stats = useMemo(() => ({
    total: sortedProperties.length,
    withPhone: sortedProperties.filter(p => p.ownerPhone).length,
    immobiliare: sortedProperties.filter(p => p.source === 'scraper-immobiliare').length,
    idealista: sortedProperties.filter(p => p.source === 'scraper-idealista').length,
  }), [sortedProperties]);
  
  // Handle property actions
  const handleViewProperty = (property: PropertyWithDetails) => {
    navigate(`/properties/${property.id}`);
  };
  
  const handleEditProperty = (property: PropertyWithDetails) => {
    navigate(`/properties/${property.id}?edit=true`);
  };
  
  const handleDeleteProperty = async (property: PropertyWithDetails) => {
    if (!confirm(`Sei sicuro di voler eliminare l'immobile in ${property.address}?`)) return;
    
    try {
      await apiRequest(`/api/properties/${property.id}`, {
        method: 'DELETE'
      });
      
      toast({
        description: `Immobile eliminato con successo.`,
      });
      
      await queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
    } catch (error) {
      toast({
        description: "Si è verificato un errore durante l'eliminazione dell'immobile.",
        variant: "destructive",
      });
    }
  };
  
  const handleSendToClients = async (property: PropertyWithDetails) => {
    try {
      await apiRequest(`/api/properties/${property.id}/match`, {
        method: 'POST',
        data: null
      });
      
      toast({
        description: "L'immobile è stato inviato ai clienti interessati.",
      });
      
      await queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
    } catch (error) {
      toast({
        description: "Si è verificato un errore durante l'invio dell'immobile ai clienti.",
        variant: "destructive",
      });
    }
  };
  
  // Empty state
  const EmptyState = () => (
    <div className="text-center py-10">
      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <i className="fas fa-user text-gray-400 text-xl"></i>
      </div>
      <h3 className="text-lg font-medium text-gray-900">Nessuna proprietà privata trovata</h3>
      <p className="mt-1 text-sm text-gray-500">
        {searchQuery 
          ? "Nessuna proprietà corrisponde ai criteri di ricerca." 
          : "Non ci sono proprietà private entro 4km dal Duomo di Milano."}
      </p>
      <p className="mt-2 text-xs text-gray-400">
        Le proprietà vengono importate automaticamente da Immobiliare.it e Idealista.it
      </p>
    </div>
  );
  
  return (
    <>
      <Helmet>
        <title>Proprietà Private | RealEstate CRM</title>
        <meta name="description" content="Visualizza le proprietà in vendita direttamente dai privati entro 4km dal Duomo di Milano." />
      </Helmet>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Proprietà Private</h1>
          <p className="mt-1 text-sm text-gray-600">
            Immobili venduti direttamente dai proprietari entro 4km dal Duomo di Milano
          </p>
          <div className="flex items-center gap-2 mt-2">
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
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className="mr-2 h-4 w-4" />
            Aggiorna
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Cerca per indirizzo, città, descrizione..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          
          {/* Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center space-x-2">
              <Switch 
                id="phone-filter" 
                checked={onlyWithPhone}
                onCheckedChange={setOnlyWithPhone}
                data-testid="switch-phone-filter"
              />
              <Label htmlFor="phone-filter" className="text-sm cursor-pointer">
                Solo con telefono ({stats.withPhone})
              </Label>
            </div>
            
            <Select value={portalFilter} onValueChange={setPortalFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-portal">
                <SelectValue placeholder="Portale" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i portali</SelectItem>
                <SelectItem value="immobiliare">Immobiliare.it ({stats.immobiliare})</SelectItem>
                <SelectItem value="idealista">Idealista.it ({stats.idealista})</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[180px]" data-testid="select-sort">
                <SelectValue placeholder="Ordina per" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Più recenti</SelectItem>
                <SelectItem value="oldest">Più vecchi</SelectItem>
                <SelectItem value="price-low">Prezzo: basso-alto</SelectItem>
                <SelectItem value="price-high">Prezzo: alto-basso</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Properties Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-10">
          <p className="text-red-600">Errore nel caricamento delle proprietà.</p>
          <Button onClick={() => refetch()} className="mt-4">
            Riprova
          </Button>
        </div>
      ) : sortedProperties.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onView={() => handleViewProperty(property)}
              onEdit={() => handleEditProperty(property)}
              onDelete={() => handleDeleteProperty(property)}
              onSendToClients={() => handleSendToClients(property)}
            />
          ))}
        </div>
      )}
    </>
  );
}
