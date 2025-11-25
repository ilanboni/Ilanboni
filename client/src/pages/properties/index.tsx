import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { type PropertyWithDetails } from "@shared/schema";
import PropertyCard from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Search, ChevronLeft, ChevronRight, Trash2, CheckSquare, XSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Helmet } from "react-helmet";
import { queryClient } from "@/lib/queryClient";

export default function PropertiesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // State for filtering
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [sortOrder, setSortOrder] = useState("matching");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  
  // Property type filters (all enabled by default)
  const [showPrivate, setShowPrivate] = useState(true);
  const [showMonoShared, setShowMonoShared] = useState(true);
  const [showMultiShared, setShowMultiShared] = useState(true);
  
  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Debounce search query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to page 1 when search changes
    }, 500); // Wait 500ms after user stops typing
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, showPrivate, showMonoShared, showMultiShared]);
  
  // State for dialog
  const [propertyToView, setPropertyToView] = useState<PropertyWithDetails | null>(null);
  
  // Build property type filter string for query key
  const propertyTypeFilter = `private=${showPrivate}&mono=${showMonoShared}&multi=${showMultiShared}`;
  
  // Fetch properties
  const { data: paginationData, isLoading, isError, refetch } = useQuery({
    queryKey: ['/api/properties', statusFilter, debouncedSearchQuery, currentPage, sortOrder, propertyTypeFilter],
    queryFn: async () => {
      // Build query parameters
      const params = new URLSearchParams();
      
      // Add pagination
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());
      
      // Add search query if present
      if (debouncedSearchQuery) {
        params.append('search', debouncedSearchQuery);
      }
      
      // Add status filter if not "all"
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      // Add sortBy parameter for matching sort (server-side)
      if (sortOrder === 'matching') {
        params.append('sortBy', 'matching');
      }
      
      // Add property type filters
      params.append('showPrivate', showPrivate.toString());
      params.append('showMonoShared', showMonoShared.toString());
      params.append('showMultiShared', showMultiShared.toString());
      
      const url = `/api/properties?${params.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch properties');
      }
      
      return await response.json();
    }
  });
  
  // Extract properties from pagination data and apply client-side sorting
  const properties = useMemo(() => {
    if (!paginationData || !paginationData.properties || paginationData.properties.length === 0) {
      return [];
    }
    
    // If sorting by matching, the backend already sorted, return as-is
    if (sortOrder === 'matching') {
      return paginationData.properties;
    }
    
    return [...paginationData.properties].sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'price_asc':
          return (a.price || 0) - (b.price || 0);
        case 'price_desc':
          return (b.price || 0) - (a.price || 0);
        case 'size_asc':
          return (a.size || 0) - (b.size || 0);
        case 'size_desc':
          return (b.size || 0) - (a.size || 0);
        default:
          return 0;
      }
    });
  }, [paginationData, sortOrder]);
  
  // Pagination info
  const total = paginationData?.total || 0;
  const totalPages = paginationData?.totalPages || 1;
  
  // Handle property actions
  const handleEditProperty = (property: PropertyWithDetails) => {
    // Naviga alla pagina di dettaglio e apre automaticamente il modal di modifica
    navigate(`/properties/${property.id}?edit=true`);
  };
  
  const handleViewProperty = (property: PropertyWithDetails) => {
    console.log('Navigating to property detail:', property.id);
    // Naviga alla pagina di dettaglio dell'immobile
    navigate(`/properties/${property.id}`);
  };
  
  const handleDeleteProperty = async (property: PropertyWithDetails) => {
    try {
      await apiRequest(`/api/properties/${property.id}`, { method: 'DELETE' });
      
      toast({
        title: "Immobile eliminato",
        description: `${property.address} è stato eliminato con successo.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione dell'immobile.",
        variant: "destructive",
      });
    }
  };
  
  const handleSendToClients = async (property: PropertyWithDetails) => {
    try {
      await apiRequest(`/api/properties/${property.id}/match`, { method: 'POST' });
      
      toast({
        title: "Invio completato",
        description: "L'immobile è stato inviato ai clienti interessati.",
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio dell'immobile ai clienti.",
        variant: "destructive",
      });
    }
  };
  
  // Multi-select handlers
  const handleSelectProperty = (property: PropertyWithDetails, selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(property.id);
      } else {
        newSet.delete(property.id);
      }
      return newSet;
    });
  };
  
  const handleSelectAll = () => {
    if (properties && properties.length > 0) {
      const allIds = new Set<number>(properties.map((p: PropertyWithDetails) => p.id));
      setSelectedIds(allIds);
    }
  };
  
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };
  
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };
  
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setIsBulkDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      await apiRequest('/api/properties/bulk-delete', { method: 'POST', data: { ids: idsArray } });
      
      toast({
        title: "Eliminazione completata",
        description: `${idsArray.length} immobili sono stati eliminati con successo.`,
      });
      
      setSelectedIds(new Set());
      setSelectionMode(false);
      setShowBulkDeleteDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione degli immobili.",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };
  
  // Create empty state component
  const EmptyState = () => (
    <div className="text-center py-10">
      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <i className="fas fa-building text-gray-400 text-xl"></i>
      </div>
      <h3 className="text-lg font-medium text-gray-900">Nessun immobile trovato</h3>
      <p className="mt-1 text-sm text-gray-500">
        {searchQuery 
          ? "Nessun immobile corrisponde ai criteri di ricerca." 
          : "Inizia aggiungendo un nuovo immobile."}
      </p>
      <div className="mt-6">
        <Button onClick={() => navigate("/properties/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Aggiungi Immobile
        </Button>
      </div>
    </div>
  );
  
  return (
    <>
      <Helmet>
        <title>Gestione Immobili | RealEstate CRM</title>
        <meta name="description" content="Gestisci il tuo portafoglio immobiliare, visualizza dettagli e informazioni sugli immobili." />
      </Helmet>
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Immobili</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestisci il tuo portafoglio immobiliare
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <Button 
            variant={selectionMode ? "secondary" : "outline"}
            onClick={toggleSelectionMode}
            data-testid="button-selection-mode"
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            {selectionMode ? "Esci selezione" : "Seleziona"}
          </Button>
          <Button onClick={() => navigate("/properties/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Immobile
          </Button>
        </div>
      </div>
      
      {/* Selection Mode Bar */}
      {selectionMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-blue-800">
              {selectedIds.size} immobili selezionati
            </span>
            <Button variant="outline" size="sm" onClick={handleSelectAll} data-testid="button-select-all">
              <CheckSquare className="mr-2 h-4 w-4" />
              Seleziona tutti
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll} data-testid="button-deselect-all">
              <XSquare className="mr-2 h-4 w-4" />
              Deseleziona tutti
            </Button>
          </div>
          <Button 
            variant="destructive" 
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={() => setShowBulkDeleteDialog(true)}
            data-testid="button-bulk-delete"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Elimina selezionati ({selectedIds.size})
          </Button>
        </div>
      )}
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col gap-4">
          {/* Top Row: Search and Status/Sort Controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Cerca immobile per indirizzo, città..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            
            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Tabs 
                value={statusFilter} 
                onValueChange={setStatusFilter}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">Tutti</TabsTrigger>
                  <TabsTrigger value="available">Disponibili</TabsTrigger>
                  <TabsTrigger value="pending">In Trattativa</TabsTrigger>
                  <TabsTrigger value="sold">Venduti</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-sort">
                  <SelectValue placeholder="Ordinamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="matching">Più matching</SelectItem>
                  <SelectItem value="newest">Più recenti</SelectItem>
                  <SelectItem value="oldest">Più vecchi</SelectItem>
                  <SelectItem value="price_asc">Prezzo (crescente)</SelectItem>
                  <SelectItem value="price_desc">Prezzo (decrescente)</SelectItem>
                  <SelectItem value="size_asc">Metratura (crescente)</SelectItem>
                  <SelectItem value="size_desc">Metratura (decrescente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Property Type Filters */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-600">Tipo proprietà:</span>
            
            <div className="flex items-center gap-2">
              <Switch
                id="filter-private"
                checked={showPrivate}
                onCheckedChange={setShowPrivate}
                data-testid="switch-private"
              />
              <Label htmlFor="filter-private" className="flex items-center gap-1.5 text-sm cursor-pointer">
                <span className="inline-block w-3 h-3 rounded bg-green-500"></span>
                <span>Privati</span>
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="filter-mono"
                checked={showMonoShared}
                onCheckedChange={setShowMonoShared}
                data-testid="switch-mono-shared"
              />
              <Label htmlFor="filter-mono" className="flex items-center gap-1.5 text-sm cursor-pointer">
                <span className="inline-block w-3 h-3 rounded bg-red-500"></span>
                <span>Monocondivisi</span>
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="filter-multi"
                checked={showMultiShared}
                onCheckedChange={setShowMultiShared}
                data-testid="switch-multi-shared"
              />
              <Label htmlFor="filter-multi" className="flex items-center gap-1.5 text-sm cursor-pointer">
                <span className="inline-block w-3 h-3 rounded bg-yellow-500"></span>
                <span>Pluricondivisi</span>
              </Label>
            </div>
          </div>
        </div>
      </div>
      
      {/* Property List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex justify-between mb-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex justify-between mt-4">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">
          Si è verificato un errore durante il caricamento degli immobili. Riprova più tardi.
        </div>
      ) : properties && properties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property: PropertyWithDetails) => (
            <PropertyCard
              key={property.id}
              property={property}
              onView={handleViewProperty}
              onEdit={handleEditProperty}
              onDelete={handleDeleteProperty}
              onSendToClients={handleSendToClients}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(property.id)}
              onSelect={handleSelectProperty}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
      
      {/* Pagination Controls */}
      {properties && properties.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="text-sm text-gray-600">
            Mostrando <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> - <span className="font-medium">{Math.min(currentPage * itemsPerPage, total)}</span> di <span className="font-medium">{total}</span> immobili
          </div>
          
          <div className="flex items-center gap-2">
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
            
            <div className="text-sm text-gray-600">
              Pagina <span className="font-medium">{currentPage}</span> di <span className="font-medium">{totalPages}</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              data-testid="button-next-page"
            >
              Successiva
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Property View Dialog */}
      <Dialog open={!!propertyToView} onOpenChange={() => setPropertyToView(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Dettagli Immobile</DialogTitle>
          </DialogHeader>
          
          {propertyToView && (
            <div className="mt-4">
              <PropertyCard 
                property={propertyToView}
                onView={() => {}}
                onEdit={handleEditProperty}
                onDelete={handleDeleteProperty}
                onSendToClients={handleSendToClients}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma eliminazione</DialogTitle>
            <DialogDescription>
              Stai per eliminare <strong>{selectedIds.size}</strong> immobili. Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={isBulkDeleting}
            >
              Annulla
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              data-testid="button-confirm-bulk-delete"
            >
              {isBulkDeleting ? "Eliminazione..." : `Elimina ${selectedIds.size} immobili`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
