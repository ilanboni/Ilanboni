import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { WhatsAppModal } from "@/components/communications/WhatsAppModal";
import { WhatsAppImportDialog } from "@/components/communications/WhatsAppImportDialog";
import { useToast } from "@/hooks/use-toast";
import SentPropertiesHistory from "@/components/clients/SentPropertiesHistory";
import SimpleSearchAreaMap from "@/components/clients/SimpleSearchAreaMap";
import { CheckSquare, XSquare, Trash2, EyeOff, Heart, Star, Map, List, Plus, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  type ClientWithDetails, 
  type Communication,
  type Appointment,
  type Task
} from "@shared/schema";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const [_, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [propertyBeingNotified, setPropertyBeingNotified] = useState<number | null>(null);
  const { toast } = useToast();
  
  // Multi-select state for "Possibili Immobili" section
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkIgnoreDialog, setShowBulkIgnoreDialog] = useState(false);
  const [isBulkIgnoring, setIsBulkIgnoring] = useState(false);
  
  // View mode for properties (list or map)
  const [propertiesViewMode, setPropertiesViewMode] = useState<'list' | 'map'>('list');
  
  // Manual property add dialog
  const [showAddPropertyDialog, setShowAddPropertyDialog] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState('');
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [addPropertyMode, setAddPropertyMode] = useState<'search' | 'new'>('search');
  
  // New property form state
  const [newPropertyUrl, setNewPropertyUrl] = useState('');
  const [newPropertyAddress, setNewPropertyAddress] = useState('');
  const [newPropertyCity, setNewPropertyCity] = useState('Milano');
  const [newPropertyType, setNewPropertyType] = useState('apartment');
  const [newPropertyPrice, setNewPropertyPrice] = useState('');
  const [newPropertySize, setNewPropertySize] = useState('');
  const [newPropertyFloor, setNewPropertyFloor] = useState('');
  const [newPropertyNotes, setNewPropertyNotes] = useState('');
  const [isCreatingNewProperty, setIsCreatingNewProperty] = useState(false);
  
  // Track if notification tab was visited (to avoid loading slow query until needed)
  const [notificationTabVisited, setNotificationTabVisited] = useState(false);
  
  // Fetch client details
  const { data: client, isLoading: isClientLoading, isSuccess: isClientSuccess } = useQuery<ClientWithDetails>({
    queryKey: [`/api/clients/${id}`],
    enabled: !isNaN(id),
  });
  
  // Computed flags for buyer queries - must be computed AFTER client query
  const isBuyer = client?.type === "buyer";
  const hasSufficientRating = (client?.buyer?.rating ?? 0) >= 4;
  const canFetchMatchingProps = isClientSuccess && isBuyer && hasSufficientRating;
  
  // Fetch client communications
  const { data: communications, isLoading: isCommunicationsLoading } = useQuery<Communication[]>({
    queryKey: [`/api/clients/${id}/communications`],
    enabled: !isNaN(id),
  });
  
  // Fetch client appointments
  const { data: appointments, isLoading: isAppointmentsLoading } = useQuery<Appointment[]>({
    queryKey: [`/api/clients/${id}/appointments`],
    enabled: !isNaN(id),
  });
  
  // Fetch client tasks
  const { data: tasks, isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: [`/api/clients/${id}/tasks`],
    enabled: !isNaN(id),
  });
  
  // Filter states for matching properties
  const [showPrivate, setShowPrivate] = useState(true);
  const [showMonoAgency, setShowMonoAgency] = useState(true);
  const [showMultiAgency, setShowMultiAgency] = useState(true);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  
  // Client favorites state
  const [favoritingPropertyId, setFavoritingPropertyId] = useState<number | null>(null);
  
  // Fetch client favorites
  const { data: clientFavorites = [], refetch: refetchFavorites } = useQuery<any[]>({
    queryKey: [`/api/clients/${id}/favorites`],
    enabled: !isNaN(id),
  });
  
  // Helper to check if a property is favorited
  const isPropertyFavorite = (propertyId: number, ownerType: string) => {
    return clientFavorites.some((fav: any) => 
      ownerType === 'private' 
        ? fav.propertyId === propertyId 
        : fav.sharedPropertyId === propertyId
    );
  };
  
  // Handle toggle favorite
  const handleToggleFavorite = async (propertyId: number, ownerType: string) => {
    setFavoritingPropertyId(propertyId);
    try {
      const isFav = isPropertyFavorite(propertyId, ownerType);
      
      if (isFav) {
        await apiRequest(`/api/clients/${id}/favorites/${propertyId}?ownerType=${ownerType}`, {
          method: 'DELETE'
        });
        toast({
          title: "Rimosso dai preferiti",
          description: "L'immobile è stato rimosso dai preferiti del cliente"
        });
      } else {
        await apiRequest(`/api/clients/${id}/favorites`, {
          method: 'POST',
          data: ownerType === 'private' 
            ? { propertyId } 
            : { sharedPropertyId: propertyId }
        });
        toast({
          title: "Aggiunto ai preferiti",
          description: "L'immobile è stato aggiunto ai preferiti del cliente"
        });
      }
      
      refetchFavorites();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'operazione",
        variant: "destructive"
      });
    } finally {
      setFavoritingPropertyId(null);
    }
  };
  
  // State for owner type change
  const [changingOwnerTypeId, setChangingOwnerTypeId] = useState<number | null>(null);
  
  // Handle change owner type
  const handleChangeOwnerType = async (propertyId: number, newOwnerType: 'private' | 'agency') => {
    setChangingOwnerTypeId(propertyId);
    try {
      await apiRequest(`/api/properties/${propertyId}/owner-type`, {
        method: 'PATCH',
        data: { ownerType: newOwnerType }
      });
      toast({
        title: "Classificazione aggiornata",
        description: `L'immobile è ora classificato come ${newOwnerType === 'private' ? 'privato' : 'agenzia'}`
      });
      // Refetch matching properties to update the UI
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}/matching-properties-advanced`] });
    } catch (error) {
      console.error('Error changing owner type:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la modifica",
        variant: "destructive"
      });
    } finally {
      setChangingOwnerTypeId(null);
    }
  };
  
  // Track previous match IDs to show "New" badge using ref
  const previousMatchIdsRef = useRef<Set<number>>(new Set());
  const [previousMatchIds, setPreviousMatchIds] = useState<Set<number>>(new Set());
  
  // Fetch matching properties (per client compratori) - Advanced matching with tolerances
  // Disabilitata quando il dialog è aperto per evitare blocchi durante l'input
  const { data: matchingProperties, isLoading: isMatchingPropertiesLoading, error: matchingPropertiesError, refetch: refetchMatchingProperties } = useQuery<any[]>({
    queryKey: [`/api/clients/${id}/matching-properties-advanced`],
    enabled: isClientSuccess && client?.type === "buyer" && !showAddPropertyDialog,
    staleTime: Infinity, // Cache indefinitely until manually refreshed
    refetchInterval: false, // Disable auto-refetch to prevent freezing
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      console.log('[MATCHING-QUERY] Fetching matching properties for client', id);
      const response = await fetch(`/api/clients/${id}/matching-properties-advanced`, {
        credentials: 'include'
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MATCHING-QUERY] Error response:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log('[MATCHING-QUERY] Received', data.total, 'total properties,', data.properties?.length || 0, 'in array');
      // Debug: check ownerType for property 21957
      const prop21957 = data.properties?.find((p: any) => p.id === 21957);
      if (prop21957) {
        console.log('[MATCHING-QUERY] Property 21957 ownerType:', prop21957.ownerType, '| Full object:', JSON.stringify(prop21957).slice(0, 200));
      }
      // Debug: count private vs shared
      const privateCount = data.properties?.filter((p: any) => p.ownerType === 'private').length || 0;
      const sharedCount = data.properties?.filter((p: any) => p.ownerType === 'shared').length || 0;
      console.log('[MATCHING-QUERY] ownerType breakdown: private=', privateCount, ', shared=', sharedCount);
      return data.properties || [];
    }
  });
  
  // Track previous IDs when matchingProperties changes
  useEffect(() => {
    if (matchingProperties && matchingProperties.length > 0) {
      // Copy current IDs to previous before updating state
      setPreviousMatchIds(new Set(previousMatchIdsRef.current));
      // Update ref with current IDs for next comparison
      previousMatchIdsRef.current = new Set(matchingProperties.map((p: any) => p.id));
    }
  }, [matchingProperties]);
  
  // Filter matching properties based on ownership type (not classificationColor)
  const filteredMatchingProperties = useMemo(() => {
    if (!matchingProperties) return [];
    return matchingProperties.filter((prop: any) => {
      // Private properties have ownerType === 'private'
      const isPrivate = prop.ownerType === 'private';
      // Multi-agency properties have isMultiagency === true
      const isMulti = !isPrivate && prop.isMultiagency === true;
      // Mono-agency is everything else (not private and not multi-agency)
      const isMono = !isPrivate && !isMulti;
      
      if (isPrivate && !showPrivate) return false;
      if (isMulti && !showMultiAgency) return false;
      if (isMono && !showMonoAgency) return false;
      
      // Filter by favorites if enabled
      if (showOnlyFavorites) {
        const isFav = isPropertyFavorite(prop.id, prop.ownerType || 'shared');
        if (!isFav) return false;
      }
      
      return true;
    });
  }, [matchingProperties, showPrivate, showMonoAgency, showMultiAgency, showOnlyFavorites, clientFavorites]);
  
  // Helper to check if property is new
  const isNewProperty = (propertyId: number) => {
    return previousMatchIds.size > 0 && !previousMatchIds.has(propertyId);
  };
  
  // Helper to get classification style based on match quality (classificationColor)
  const getClassificationStyle = (prop: any) => {
    // Colors based on match quality from backend
    if (prop.classificationColor === 'green') {
      return 'border-l-4 border-l-green-500 bg-green-50';
    }
    if (prop.classificationColor === 'yellow') {
      return 'border-l-4 border-l-yellow-500 bg-yellow-50';
    }
    if (prop.classificationColor === 'red') {
      return 'border-l-4 border-l-red-500 bg-red-50';
    }
    // Fallback based on ownership if no classificationColor
    if (prop.ownerType === 'private') {
      return 'border-l-4 border-l-green-500 bg-green-50';
    }
    if (prop.isMultiagency === true) {
      return 'border-l-4 border-l-yellow-500 bg-yellow-50';
    }
    return 'border-l-4 border-l-red-500 bg-red-50';
  };
  
  // Helper to get ownership badge based on property type
  const getClassificationBadge = (prop: any) => {
    // Badge shows ownership type (private/multi/mono)
    if (prop.ownerType === 'private') {
      return <Badge className="bg-green-500 text-white text-xs">Privato</Badge>;
    }
    if (prop.isMultiagency === true) {
      return <Badge className="bg-yellow-500 text-white text-xs">Multi-Agenzia</Badge>;
    }
    return <Badge className="bg-red-500 text-white text-xs">Mono-Agenzia</Badge>;
  };
  
  // Helper to create marker icon based on property type
  const createPropertyMarker = (prop: any) => {
    const isPrivate = prop.ownerType === 'private';
    const isMulti = !isPrivate && prop.isMultiagency === true;
    const color = isPrivate ? '#10b981' : isMulti ? '#eab308' : '#ef4444';
    const label = isPrivate ? 'P' : isMulti ? 'M' : 'A';
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background-color: ${color};
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
          ${label}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  };
  
  // Filter properties with valid coordinates for map
  const propertiesWithCoords = useMemo(() => {
    if (!filteredMatchingProperties) return [];
    return filteredMatchingProperties.filter((p: any) => 
      p.latitude && p.longitude && 
      !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude))
    );
  }, [filteredMatchingProperties]);
  
  // Calculate map center based on properties
  const mapCenter = useMemo(() => {
    if (propertiesWithCoords.length > 0) {
      const avgLat = propertiesWithCoords.reduce((sum: number, p: any) => sum + parseFloat(p.latitude), 0) / propertiesWithCoords.length;
      const avgLng = propertiesWithCoords.reduce((sum: number, p: any) => sum + parseFloat(p.longitude), 0) / propertiesWithCoords.length;
      return [avgLat, avgLng] as [number, number];
    }
    return [45.4642, 9.1900] as [number, number]; // Default: Milano
  }, [propertiesWithCoords]);
  
  // Search for properties to add manually
  const { data: searchedProperties, isLoading: isSearchingProperties, refetch: refetchSearchProperties } = useQuery({
    queryKey: [`/api/properties/search`, propertySearchQuery],
    enabled: propertySearchQuery.length >= 3 && showAddPropertyDialog && addPropertyMode === 'search',
    queryFn: async () => {
      const response = await fetch(`/api/properties/search?q=${encodeURIComponent(propertySearchQuery)}&limit=20`);
      if (!response.ok) throw new Error('Errore nella ricerca');
      return response.json();
    }
  });

  // Memoized handlers for new property form
  const handlePropertyUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPropertyUrl(e.target.value);
  }, []);

  const handlePropertyAddressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPropertyAddress(e.target.value);
  }, []);

  const handlePropertyCityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPropertyCity(e.target.value);
  }, []);

  const handlePropertyTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setNewPropertyType(e.target.value);
  }, []);

  const handlePropertyPriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPropertyPrice(e.target.value);
  }, []);

  const handlePropertySizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPropertySize(e.target.value);
  }, []);

  const handlePropertyFloorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPropertyFloor(e.target.value);
  }, []);

  const handlePropertyNotesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPropertyNotes(e.target.value);
  }, []);
  
  // Handler to add a property manually as favorite
  const handleAddPropertyManually = async (propertyId: number, ownerType: string) => {
    setIsAddingProperty(true);
    try {
      await apiRequest(`/api/clients/${id}/favorites`, {
        method: 'POST',
        data: ownerType === 'private' 
          ? { propertyId } 
          : { sharedPropertyId: propertyId }
      });
      toast({
        title: "Immobile aggiunto",
        description: "L'immobile è stato aggiunto ai preferiti del cliente"
      });
      // Invalidate caches without blocking UI
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}/favorites`] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'matching-properties'] });
      setShowAddPropertyDialog(false);
      setPropertySearchQuery('');
    } catch (error) {
      console.error('Error adding property:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'operazione",
        variant: "destructive"
      });
    } finally {
      setIsAddingProperty(false);
    }
  };
  
  // Handler to create a new property from scratch
  const handleCreateNewProperty = async () => {
    if (!newPropertyUrl || !newPropertyAddress || !newPropertyPrice) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci almeno URL, indirizzo e prezzo",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreatingNewProperty(true);
    try {
      const response = await apiRequest('/api/shared-properties/manual', {
        method: 'POST',
        data: {
          url: newPropertyUrl,
          address: newPropertyAddress,
          city: newPropertyCity || 'Milano',
          type: newPropertyType,
          price: parseInt(newPropertyPrice),
          size: newPropertySize ? parseInt(newPropertySize) : undefined,
          floor: newPropertyFloor || undefined,
          notes: newPropertyNotes || undefined,
          scrapedForClientId: id
        }
      });
      
      const result = await response.json();
      
      toast({
        title: result.isDuplicate ? "Immobile già presente" : "Immobile creato",
        description: result.isDuplicate 
          ? "L'immobile esisteva già ed è stato aggiunto ai preferiti" 
          : "L'immobile è stato creato e aggiunto ai preferiti del cliente"
      });
      
      // Reset form
      setNewPropertyUrl('');
      setNewPropertyAddress('');
      setNewPropertyCity('Milano');
      setNewPropertyType('apartment');
      setNewPropertyPrice('');
      setNewPropertySize('');
      setNewPropertyFloor('');
      setNewPropertyNotes('');
      setAddPropertyMode('search');
      setShowAddPropertyDialog(false);
      
      // Refresh data
      refetchFavorites();
      queryClient.invalidateQueries({ queryKey: ['/api/shared-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      
    } catch (error: any) {
      console.error('[CREATE-PROPERTY] Error:', error);
      toast({
        title: "Errore",
        description: error?.message || "Si è verificato un errore durante la creazione",
        variant: "destructive"
      });
    } finally {
      setIsCreatingNewProperty(false);
    }
  };
  
  // Debug logging with useEffect to track changes
  useEffect(() => {
    console.log('[MATCHING-DEBUG] Component state', {
      isClientSuccess,
      isClientLoading,
      clientType: client?.type,
      rating: client?.buyer?.rating,
      matchingPropertiesLength: matchingProperties?.length,
      isMatchingPropertiesLoading,
      matchingPropertiesError: matchingPropertiesError?.message
    });
  }, [isClientSuccess, isClientLoading, client?.type, client?.buyer?.rating, matchingProperties?.length, isMatchingPropertiesLoading, matchingPropertiesError]);
  
  // Fetch matching properties with notification status (per client compratori)
  // LAZY LOADING: Only fetch when user visits "Immobili da inviare" tab to avoid slow page load
  const { data: propertiesWithNotifications, isLoading: isPropertiesWithNotificationsLoading, refetch: refetchPropertiesWithNotifications } = useQuery({
    queryKey: [`/api/clients/${id}/properties-with-notification-status`],
    enabled: isClientSuccess && client?.type === "buyer" && notificationTabVisited,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/properties-with-notification-status`);
      if (!response.ok) {
        if (response.status === 400) {
          return []; // Il cliente non è un compratore
        }
        throw new Error('Errore nel caricamento degli immobili con stato di notifica');
      }
      return response.json();
    }
  });
  
  // Fetch SAVED scraped properties (FAST - from database)
  const { data: savedScrapedProperties, isLoading: isSavedScrapedPropertiesLoading, refetch: refetchSavedScrapedProperties } = useQuery({
    queryKey: [`/api/clients/${id}/saved-scraped-properties`],
    enabled: isClientSuccess && client?.type === "buyer" && (client?.buyer?.rating ?? 0) === 5,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/saved-scraped-properties`);
      if (!response.ok) {
        if (response.status === 400) {
          return [];
        }
        throw new Error('Errore nel caricamento degli immobili salvati');
      }
      return response.json();
    }
  });

  // Fetch scraped properties (SLOW - scraping) - manual only, click "Aggiorna"
  const { data: scrapedProperties, isLoading: isScrapedPropertiesLoading, refetch: refetchScrapedProperties } = useQuery({
    queryKey: [`/api/clients/${id}/scraped-properties`],
    enabled: false, // Disabled: scraping starts only when user clicks "Aggiorna"
    staleTime: 0, // Don't cache scraping results - always use saved ones
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/scraped-properties`);
      if (!response.ok) {
        if (response.status === 400) {
          return [];
        }
        throw new Error('Errore nel caricamento degli immobili scrapati');
      }
      return response.json();
    }
  });
  
  // Fetch properties sent to client
  const { data: sentProperties, isLoading: isSentPropertiesLoading } = useQuery({
    queryKey: [`/api/clients/${id}/sent-properties`],
    enabled: !isNaN(id),
    queryFn: async () => {
      const response = await fetch(`/api/clients/${id}/sent-properties`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento degli immobili inviati');
      }
      return response.json();
    }
  });
  
  // Loading state
  if (isClientLoading || isNaN(id)) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <div className="text-6xl text-gray-300 mb-4">
          {isClientLoading ? (
            <i className="fas fa-spinner animate-spin"></i>
          ) : (
            <i className="fas fa-search"></i>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-gray-700 mb-4">
          {isClientLoading ? "Caricamento in corso..." : "Cliente non trovato"}
        </h1>
        <p className="text-gray-500 mb-6">
          {isClientLoading
            ? "Attendere mentre carichiamo i dati del cliente."
            : "Il cliente che stai cercando non esiste o è stato rimosso."
          }
        </p>
        <Button asChild>
          <Link href="/clients">
            <div className="px-2 py-1">
              <i className="fas fa-arrow-left mr-2"></i> Torna ai clienti
            </div>
          </Link>
        </Button>
      </div>
    );
  }
  
  // Get name initials for avatar
  const getInitials = (firstName: string | null | undefined, lastName: string | null | undefined) => {
    const firstInitial = firstName && firstName.length > 0 ? firstName.charAt(0) : '';
    const lastInitial = lastName && lastName.length > 0 ? lastName.charAt(0) : '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };
  
  // Format client type
  const formatClientType = (type: string) => {
    switch (type) {
      case "buyer":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Acquirente</Badge>;
      case "seller":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Venditore</Badge>;
      case "both":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Acquirente/Venditore</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };
  
  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy");
    } catch (e) {
      return dateString;
    }
  };
  
  // Format communication type
  const getCommunicationTypeBadge = (type: string) => {
    switch (type) {
      case "email":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Email</Badge>;
      case "phone":
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Telefono</Badge>;
      case "whatsapp":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">WhatsApp</Badge>;
      case "meeting":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Incontro</Badge>;
      case "sms":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50">SMS</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };
  
  // Format direction indicator
  const getDirectionIcon = (direction: string) => {
    if (direction === "inbound") {
      return (
        <div className="flex items-center text-green-600">
          <i className="fas fa-arrow-down mr-1"></i>
          <span className="text-xs font-medium">Ricevuto</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-blue-600">
          <i className="fas fa-arrow-up mr-1"></i>
          <span className="text-xs font-medium">Inviato</span>
        </div>
      );
    }
  };
  
  // Multi-select handlers for "Possibili Immobili"
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };
  
  const handlePropertyToggle = (propertyId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(propertyId)) {
      newSelected.delete(propertyId);
    } else {
      newSelected.add(propertyId);
    }
    setSelectedIds(newSelected);
  };
  
  const handleSelectAll = () => {
    if (filteredMatchingProperties && filteredMatchingProperties.length > 0) {
      const allIds = filteredMatchingProperties.map((p: any) => p.id).filter((id: any) => id != null);
      setSelectedIds(new Set(allIds));
    }
  };
  
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };
  
  const handleBulkIgnore = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      setIsBulkIgnoring(true);
      
      await apiRequest(`/api/clients/${id}/bulk-ignore-properties`, {
        method: 'POST',
        data: { propertyIds: Array.from(selectedIds) }
      });
      
      toast({
        title: "Immobili ignorati",
        description: `${selectedIds.size} immobili aggiunti alla lista ignorati`,
      });
      
      setSelectedIds(new Set());
      setSelectionMode(false);
      setShowBulkIgnoreDialog(false);
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}/matching-properties-advanced`] });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile aggiungere gli immobili alla lista ignorati",
        variant: "destructive",
      });
    } finally {
      setIsBulkIgnoring(false);
    }
  };
  
  // Handle ignore single property
  const handleIgnoreProperty = async (propertyId: number) => {
    try {
      await apiRequest(`/api/clients/${id}/bulk-ignore-properties`, {
        method: 'POST',
        data: { propertyIds: [propertyId] }
      });
      
      toast({
        title: "Immobile ignorato",
        description: "L'immobile non verrà più mostrato",
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}/matching-properties-advanced`] });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile ignorare l'immobile",
        variant: "destructive",
      });
    }
  };
  
  // Invia una notifica di immobile al cliente
  const handleSendPropertyNotification = async (propertyId: number) => {
    // Se c'è già un'operazione in corso, non procedere
    if (isSendingNotification) return;
    
    try {
      setIsSendingNotification(true);
      setPropertyBeingNotified(propertyId);
      
      // Chiama l'API per inviare la notifica
      const response = await fetch(`/api/clients/${id}/send-property/${propertyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Errore durante l'invio della notifica");
      }
      
      // Aggiorna i dati delle proprietà con notifiche
      await refetchPropertiesWithNotifications();
      
      // Notifica all'utente
      toast({
        title: "Notifica inviata",
        description: "L'immobile è stato inviato con successo al cliente"
      });
    } catch (error: any) {
      console.error("Errore nell'invio della notifica:", error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'invio della notifica",
        variant: "destructive"
      });
    } finally {
      setIsSendingNotification(false);
      setPropertyBeingNotified(null);
    }
  };
  
  // Format appointment status
  const getAppointmentStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Programmato</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completato</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Annullato</Badge>;
      case "postponed":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Posticipato</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  // Format task status
  const getTaskStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In attesa</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">In corso</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completato</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Annullato</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  // Format task priority
  const getTaskTypeBadge = (type: string) => {
    switch (type) {
      case "call":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Chiamata</Badge>;
      case "email":
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Email</Badge>;
      case "visit":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">Visita</Badge>;
      case "document":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 hover:bg-amber-50">Documento</Badge>;
      case "follow_up":
        return <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">Follow-up</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };
  
  return (
    <>
      <Helmet>
        <title>
          {client ? `${client.firstName} ${client.lastName}` : "Dettaglio Cliente"} | Gestionale Immobiliare
        </title>
        <meta 
          name="description" 
          content={`Visualizza i dettagli, le comunicazioni e gli appuntamenti di ${client?.firstName} ${client?.lastName}`} 
        />
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-14 w-14 border-2 border-primary-100">
              <AvatarFallback className="bg-primary-50 text-primary-700 text-lg">
                {client && getInitials(client.firstName, client.lastName)}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {client?.firstName} {client?.lastName}
              </h1>
              <div className="flex items-center mt-1 space-x-2">
                {formatClientType(client?.type || "")}
                {client?.isFriend && (
                  <Badge variant="outline" className="border-blue-300 text-blue-500">
                    Amico
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              asChild
              size="sm"
            >
              <Link href="/clients">
                <i className="fas fa-arrow-left mr-1"></i> Indietro
              </Link>
            </Button>
            
            <Button 
              variant="outline"
              asChild
              size="sm"
              className="gap-1"
            >
              <Link href={`/clients/edit/${id}`}>
                <i className="fas fa-edit"></i>
                <span className="hidden sm:inline">Modifica</span>
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              className="gap-1 border-green-600 text-green-600 hover:bg-green-50"
              onClick={() => setIsWhatsAppModalOpen(true)}
            >
              <i className="fab fa-whatsapp"></i>
              <span className="hidden sm:inline">WhatsApp</span>
            </Button>
            
            <Button 
              variant="outline"
              size="sm"
              className={`gap-1 ${client?.searchLink ? 'border-purple-600 text-purple-600 hover:bg-purple-50' : 'border-gray-300 text-gray-400 cursor-not-allowed'}`}
              onClick={() => client?.searchLink && window.open(client.searchLink, '_blank')}
              disabled={!client?.searchLink}
              title={client?.searchLink ? 'Apri ricerca Casafari' : 'Nessun link Casafari salvato - Modifica il cliente per aggiungerlo'}
              data-testid="button-manual-search"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Casafari</span>
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="overview" value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          if (value === 'properties-notification-status') {
            setNotificationTabVisited(true);
          }
        }} className="w-full">
          <TabsList className="w-full flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="overview">Panoramica</TabsTrigger>
            <TabsTrigger value="communications">Comunicazioni</TabsTrigger>
            <TabsTrigger value="appointments">Appuntamenti</TabsTrigger>
            <TabsTrigger value="tasks">Note e Attività</TabsTrigger>
            {client?.type === 'buyer' && (
              <>
                <TabsTrigger value="matching-properties">Immobili compatibili</TabsTrigger>
                <TabsTrigger value="matching-shared">Possibili immobili</TabsTrigger>
                <TabsTrigger value="properties-notification-status">Immobili da inviare</TabsTrigger>
              </>
            )}
            <TabsTrigger value="sent-properties">Immobili inviati</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Informazioni Personali</CardTitle>
                  <CardDescription>Dettagli anagrafici e di contatto</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
                    <p>{client?.email || "Non specificata"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Telefono</h3>
                    <p>{client?.phone || "Non specificato"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Data di nascita</h3>
                    <p>{client?.birthday ? formatDate(client.birthday) : "Non specificata"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Religione</h3>
                    <p>{client?.religion || "Non specificata"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Tipo di contratto</h3>
                    <p>{client?.contractType || "Non specificato"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Cliente dal</h3>
                    <p>{client?.createdAt ? formatDate(client.createdAt.toString()) : "Data non disponibile"}</p>
                  </div>
                </CardContent>
              </Card>
              
              <div className="space-y-6">
                {/* Statistics Card */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Statistiche</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Comunicazioni</span>
                      <Badge variant="secondary">{communications?.length || 0}</Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Appuntamenti</span>
                      <Badge variant="secondary">{appointments?.length || 0}</Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Note e attività</span>
                      <Badge variant="secondary">{tasks?.length || 0}</Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Ultima comunicazione</span>
                      <span className="text-sm">
                        {client?.lastCommunication ? (
                          formatDistanceToNow(new Date(client.lastCommunication.createdAt), { 
                            addSuffix: true,
                            locale: it 
                          })
                        ) : (
                          "Nessuna"
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Interest Information */}
                {client?.buyer && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Interessi Acquisto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-500 block mb-1">Budget massimo</span>
                        <span>{client.buyer.maxPrice ? `€${client.buyer.maxPrice.toLocaleString()}` : "Non specificato"}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500 block mb-1">Dimensione min.</span>
                        <span>{client.buyer.minSize ? `${client.buyer.minSize}m²` : "Non specificata"}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500 block mb-1">Urgenza</span>
                        <span>{client.buyer.urgency ? `${client.buyer.urgency}/5` : "Non specificata"}</span>
                      </div>
                      {client.buyer.rating && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Rating</span>
                          <span className="flex text-yellow-400">
                            {Array.from({ length: client.buyer.rating }, (_, i) => (
                              <i key={i} className="fas fa-star"></i>
                            ))}
                            {Array.from({ length: 5 - (client.buyer.rating || 0) }, (_, i) => (
                              <i key={i} className="far fa-star"></i>
                            ))}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* Seller Information */}
                {client?.seller && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Informazioni Venditore</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {client.seller.propertyId && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Immobile ID</span>
                          <Link href={`/properties/${client.seller.propertyId}`}>
                            <span className="text-primary-600 hover:text-primary-700 hover:underline">
                              #{client.seller.propertyId}
                            </span>
                          </Link>
                        </div>
                      )}
                      {client.seller.rating && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 block mb-1">Rating</span>
                          <span className="flex text-yellow-400">
                            {Array.from({ length: client.seller.rating }, (_, i) => (
                              <i key={i} className="fas fa-star"></i>
                            ))}
                            {Array.from({ length: 5 - (client.seller.rating || 0) }, (_, i) => (
                              <i key={i} className="far fa-star"></i>
                            ))}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
            
            {/* Area di Ricerca - Mappa */}
            {client?.buyer?.searchArea && (
              <Card>
                <CardHeader>
                  <CardTitle>Area di Ricerca</CardTitle>
                  <CardDescription>Zona geografica di interesse per l'acquisto</CardDescription>
                </CardHeader>
                <CardContent>
                  <SimpleSearchAreaMap searchArea={client.buyer.searchArea} />
                  <div className="mt-2 flex justify-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                      className="text-xs"
                    >
                      <Link href={`/clients/${id}/search`}>
                        <i className="fas fa-edit mr-1"></i>
                        Modifica Area
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {client?.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Note</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-line text-gray-700">
                    {client.notes}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Communications Tab */}
          <TabsContent value="communications" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Comunicazioni</CardTitle>
                <div className="flex gap-2">
                  <WhatsAppImportDialog 
                    clientId={id} 
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: [`/api/clients/${id}/communications`] });
                    }}
                  />
                  <Button 
                    variant="default"
                    className="gap-2"
                    asChild
                  >
                    <Link href={`/communications/new?clientId=${id}`}>
                      <i className="fas fa-plus"></i>
                      <span>Nuova Comunicazione</span>
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isCommunicationsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !communications || communications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-comments"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessuna comunicazione</h3>
                    <p>
                      Non ci sono comunicazioni registrate per questo cliente.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="w-32">Tipo</TableHead>
                          <TableHead className="w-48">Data</TableHead>
                          <TableHead>Oggetto</TableHead>
                          <TableHead className="w-32">Stato</TableHead>
                          <TableHead className="w-24">Follow-up</TableHead>
                          <TableHead className="w-20 text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {communications.map((comm) => (
                          <TableRow key={comm.id}>
                            <TableCell>{getDirectionIcon(comm.direction)}</TableCell>
                            <TableCell>{getCommunicationTypeBadge(comm.type)}</TableCell>
                            <TableCell className="text-sm">
                              {(() => {
                                try {
                                  return formatDistanceToNow(new Date(comm.createdAt), {
                                    addSuffix: true,
                                    locale: it,
                                  });
                                } catch (e) {
                                  console.error("Errore formattazione data:", e);
                                  return "Data non disponibile";
                                }
                              })()}
                            </TableCell>
                            <TableCell className="font-medium">
                              <Link href={`/communications/${comm.id}`}>
                                <div className="hover:text-primary-700 cursor-pointer">
                                  <div>{comm.subject}</div>
                                  {comm.type === "whatsapp" && (
                                    <div className="text-sm text-gray-500 mt-1 line-clamp-1">
                                      {comm.content}
                                    </div>
                                  )}
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell>
                              {comm.status && (
                                <Badge
                                  className={`${
                                    comm.status === "completed"
                                      ? "bg-green-100 text-green-800"
                                      : comm.status === "pending"
                                      ? "bg-orange-100 text-orange-800"
                                      : comm.status === "ongoing"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {comm.status === "completed"
                                    ? "Completata"
                                    : comm.status === "pending"
                                    ? "In attesa"
                                    : comm.status === "ongoing"
                                    ? "In corso"
                                    : "Nuova"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {comm.needsFollowUp && (
                                <Badge variant="outline" className="bg-red-50 text-red-700">
                                  Richiesto
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" asChild>
                                  <Link href={`/communications/${comm.id}`}>
                                    <i className="fas fa-eye"></i>
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Appuntamenti</CardTitle>
                <Button 
                  variant="default"
                  className="gap-2"
                  asChild
                >
                  <Link href={`/appointments/new?clientId=${id}`}>
                    <i className="fas fa-plus"></i>
                    <span>Nuovo Appuntamento</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isAppointmentsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !appointments || appointments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-calendar"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessun appuntamento</h3>
                    <p>
                      Non ci sono appuntamenti programmati per questo cliente.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-32">Data</TableHead>
                          <TableHead className="w-24">Ora</TableHead>
                          <TableHead className="w-48">Immobile</TableHead>
                          <TableHead className="w-32">Tipo</TableHead>
                          <TableHead>Note</TableHead>
                          <TableHead className="w-32">Stato</TableHead>
                          <TableHead className="w-20 text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointments.map((appointment) => (
                          <TableRow key={appointment.id}>
                            <TableCell>{formatDate(appointment.date)}</TableCell>
                            <TableCell>{appointment.time}</TableCell>
                            <TableCell>
                              {(appointment as any).property?.address ? (
                                <Link href={`/properties/${appointment.propertyId}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                                  <div className="max-w-[200px] truncate">
                                    {(appointment as any).property.address}
                                  </div>
                                </Link>
                              ) : (
                                <span className="text-gray-400">Non specificato</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-gray-700">
                                {appointment.type === "visit"
                                  ? "Visita immobile"
                                  : appointment.type === "meeting"
                                  ? "Incontro in agenzia"
                                  : appointment.type === "call"
                                  ? "Chiamata telefonica"
                                  : appointment.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {appointment.notes ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="max-w-[300px] truncate cursor-help">
                                        {appointment.notes}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                      <p className="text-sm">{appointment.notes}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>{getAppointmentStatusBadge(appointment.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" asChild>
                                  <Link href={`/appointments/${appointment.id}`}>
                                    <i className="fas fa-eye"></i>
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Note e Attività</CardTitle>
                <Button 
                  variant="default"
                  className="gap-2"
                  asChild
                >
                  <Link href="/tasks">
                    <i className="fas fa-tasks"></i>
                    <span>Gestisci Attività</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isTasksLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !tasks || tasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-clipboard-list"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessuna nota o attività</h3>
                    <p>
                      Non ci sono note o attività registrate per questo cliente.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48">Data</TableHead>
                          <TableHead className="w-48">Scadenza</TableHead>
                          <TableHead className="w-40">Tipo</TableHead>
                          <TableHead>Titolo</TableHead>
                          <TableHead className="w-32">Stato</TableHead>
                          <TableHead className="w-20 text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              {(() => {
                                try {
                                  return formatDistanceToNow(new Date(task.createdAt), {
                                    addSuffix: true,
                                    locale: it,
                                  });
                                } catch (e) {
                                  console.error("Errore formattazione data:", e);
                                  return "Data non disponibile";
                                }
                              })()}
                            </TableCell>
                            <TableCell>{formatDate(task.dueDate)}</TableCell>
                            <TableCell>{getTaskTypeBadge(task.type)}</TableCell>
                            <TableCell className="font-medium">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="max-w-[300px] truncate cursor-help">
                                      {task.title}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <p className="font-medium">{task.title}</p>
                                    {task.description && (
                                      <p className="text-sm mt-1">{task.description}</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>{getTaskStatusBadge(task.status)}</TableCell>
                            <TableCell className="text-right">
                              <span className="text-xs text-gray-400">#{task.id}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Immobili Compatibili Tab */}
          <TabsContent value="matching-properties" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Immobili Compatibili</CardTitle>
                  <CardDescription>Immobili che corrispondono alle preferenze del cliente</CardDescription>
                </div>
                <Button 
                  variant="outline"
                  className="gap-2"
                  asChild
                >
                  <Link href={`/clients/${id}/search`}>
                    <i className="fas fa-search"></i>
                    <span>Ricerca Avanzata</span>
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {isMatchingPropertiesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !matchingProperties || matchingProperties.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-home"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessun immobile compatibile</h3>
                    <p>
                      Non ci sono immobili che corrispondono alle preferenze del cliente.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {matchingProperties.map((property) => (
                      <Card key={property.id} className="overflow-hidden">
                        <div className="aspect-video relative bg-gray-100">
                          {property.images && property.images.length > 0 ? (
                            <img 
                              src={property.images[0]} 
                              alt={property.title} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              <i className="fas fa-home text-4xl"></i>
                            </div>
                          )}
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-primary-900/80 text-white">
                              € {property.price?.toLocaleString() || "N/D"}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg line-clamp-1">
                                <Link href={property.ownerType === 'private' ? `/properties/private/${property.id}` : `/properties/shared/${property.id}`} className="hover:text-primary-600">
                                  {property.title}
                                </Link>
                              </h3>
                              <p className="text-sm text-gray-600 line-clamp-1">{property.address}</p>
                            </div>
                            <Badge className={property.status === "available" ? "bg-green-100 text-green-800" : ""}>
                              {property.status === "available" ? "Disponibile" : property.status}
                            </Badge>
                          </div>
                          
                          <div className="flex justify-between mt-3 text-sm">
                            <div>
                              <span className="font-medium">{property.size} m²</span>
                              <span className="mx-1">•</span>
                              <span>{property.bedrooms || 0} cam.</span>
                              <span className="mx-1">•</span>
                              <span>{property.bathrooms || 0} bagni</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex justify-between">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs"
                              asChild
                            >
                              <Link href={property.ownerType === 'private' ? `/properties/private/${property.id}` : `/properties/shared/${property.id}`}>
                                <i className="fas fa-info-circle mr-1"></i> Dettagli
                              </Link>
                            </Button>
                            
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="text-xs"
                              asChild
                            >
                              <Link href={`/communications/whatsapp?clientId=${id}&propertyId=${property.id}`}>
                                <i className="fab fa-whatsapp mr-1"></i> Invia
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Possibili Immobili (Proprietà Condivise) Tab */}
          <TabsContent value="matching-shared" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-col gap-4 pb-2">
                <div className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Possibili Immobili</CardTitle>
                    <CardDescription>
                      {(client?.buyer?.rating ?? 0) >= 4 
                        ? `Immobili matching (${filteredMatchingProperties?.length || 0} di ${matchingProperties?.length || 0})` 
                        : `Disponibile solo per clienti con rating ≥ 4 (rating attuale: ${client?.buyer?.rating})`
                      }
                    </CardDescription>
                  </div>
                  {(client?.buyer?.rating ?? 0) >= 4 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => refetchMatchingProperties()}
                        disabled={isMatchingPropertiesLoading}
                        data-testid="button-refresh-matching"
                      >
                        <i className={`fas fa-sync-alt mr-2 ${isMatchingPropertiesLoading ? 'animate-spin' : ''}`}></i>
                        Aggiorna
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddPropertyDialog(true)}
                        data-testid="button-add-property-manual"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Aggiungi
                      </Button>
                      <div className="flex border rounded-md">
                        <Button 
                          variant={propertiesViewMode === 'list' ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setPropertiesViewMode('list')}
                          data-testid="button-view-list"
                          className="rounded-r-none"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant={propertiesViewMode === 'map' ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setPropertiesViewMode('map')}
                          data-testid="button-view-map"
                          className="rounded-l-none"
                        >
                          <Map className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button 
                        variant={selectionMode ? "secondary" : "outline"}
                        onClick={toggleSelectionMode}
                        data-testid="button-selection-mode"
                      >
                        <CheckSquare className="mr-2 h-4 w-4" />
                        {selectionMode ? "Esci selezione" : "Seleziona"}
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Filter toggles */}
                {(client?.buyer?.rating ?? 0) >= 4 && (
                  <div className="flex flex-wrap gap-2 items-center border-t pt-4">
                    <span className="text-sm font-medium text-gray-600 mr-2">Filtra:</span>
                    <Button 
                      variant={showMonoAgency ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowMonoAgency(!showMonoAgency)}
                      className={showMonoAgency ? "bg-red-500 hover:bg-red-600" : ""}
                      data-testid="filter-mono-agency"
                    >
                      <span className="mr-1">🔴</span> Mono-Agenzia
                    </Button>
                    <Button 
                      variant={showMultiAgency ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowMultiAgency(!showMultiAgency)}
                      className={showMultiAgency ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                      data-testid="filter-multi-agency"
                    >
                      <span className="mr-1">🟡</span> Multi-Agenzia
                    </Button>
                    <Button 
                      variant={showPrivate ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowPrivate(!showPrivate)}
                      className={showPrivate ? "bg-green-500 hover:bg-green-600" : ""}
                      data-testid="filter-private"
                    >
                      <span className="mr-1">🟢</span> Privati
                    </Button>
                    <span className="mx-2 text-gray-400">|</span>
                    <Button 
                      variant={showOnlyFavorites ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                      className={showOnlyFavorites ? "bg-pink-500 hover:bg-pink-600" : ""}
                      data-testid="filter-only-favorites"
                    >
                      <Star className={`mr-1 h-4 w-4 ${showOnlyFavorites ? 'fill-current' : ''}`} /> 
                      Solo Preferiti {clientFavorites.length > 0 && `(${clientFavorites.length})`}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {/* Selection Mode Bar */}
                {selectionMode && filteredMatchingProperties && filteredMatchingProperties.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
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
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={selectedIds.size === 0 || isBulkIgnoring}
                        onClick={() => setShowBulkIgnoreDialog(true)}
                        data-testid="button-bulk-ignore"
                      >
                        <EyeOff className="mr-2 h-4 w-4" />
                        Ignora ({selectedIds.size})
                      </Button>
                    </div>
                  </div>
                )}
                
                {(client?.buyer?.rating ?? 0) < 4 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-star-half-alt"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Rating non sufficiente</h3>
                    <p>
                      Questa funzionalità è disponibile solo per clienti con rating ≥ 4.<br />
                      Rating attuale: {client?.buyer?.rating || 'N/A'}
                    </p>
                  </div>
                ) : isMatchingPropertiesLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                    <p className="text-gray-500">Caricamento immobili matching...</p>
                  </div>
                ) : !filteredMatchingProperties || filteredMatchingProperties.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-search"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessun immobile trovato</h3>
                    <p>
                      Non ci sono immobili salvati nel database.<br />
                      Clicca "Aggiorna" per avviare lo scraping e trovare nuovi immobili.
                    </p>
                  </div>
                ) : propertiesViewMode === 'map' ? (
                  <div className="space-y-4">
                    <div className="bg-gray-100 p-3 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Privato (P)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> Multi-Agenzia (M)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Mono-Agenzia (A)</span>
                      </div>
                      <span className="text-sm text-gray-600">{propertiesWithCoords.length} immobili con coordinate</span>
                    </div>
                    <div className="h-[600px] rounded-lg overflow-hidden border">
                      <MapContainer
                        center={mapCenter}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {propertiesWithCoords.map((property: any, idx: number) => (
                          <Marker 
                            key={`marker-${property.id}-${idx}`}
                            position={[parseFloat(property.latitude), parseFloat(property.longitude)]}
                            icon={createPropertyMarker(property)}
                          >
                            <Popup>
                              <div className="max-w-xs">
                                <h3 className="font-semibold text-sm mb-1">{property.title || property.address}</h3>
                                <p className="text-xs text-gray-600 mb-2">{property.address}</p>
                                <div className="flex items-center gap-2 text-xs mb-2">
                                  <span className="font-bold">€ {property.price?.toLocaleString()}</span>
                                  <span>•</span>
                                  <span>{property.size} m²</span>
                                  {property.bedrooms && <><span>•</span><span>{property.bedrooms} cam.</span></>}
                                </div>
                                <div className="flex gap-2">
                                  <Link 
                                    href={property.ownerType === 'private' ? `/properties/private/${property.id}` : `/properties/shared/${property.id}`}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    Dettagli
                                  </Link>
                                  {property.url && (
                                    <a 
                                      href={property.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      Annuncio
                                    </a>
                                  )}
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredMatchingProperties.map((property: any, idx: number) => {
                      const isSelected = selectedIds.has(property.id);
                      const isNew = isNewProperty(property.id);
                      return (
                        <Card 
                          key={`matching-${property.id}-${idx}`} 
                          className={`overflow-hidden ${getClassificationStyle(property)} ${selectionMode && isSelected ? 'ring-2 ring-blue-500' : ''}`}
                          data-testid={`card-matching-property-${idx}`}
                        >
                          <div className="aspect-video relative bg-gray-100">
                            {property.images && property.images.length > 0 ? (
                              <img 
                                src={property.images[0]} 
                                alt={property.title || property.address} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-400">
                                <i className="fas fa-building text-4xl"></i>
                              </div>
                            )}
                            {selectionMode && (
                              <div className="absolute top-2 left-2">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handlePropertyToggle(property.id)}
                                  className="h-5 w-5 bg-white border-2 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                  data-testid={`checkbox-property-${idx}`}
                                />
                              </div>
                            )}
                            <div className="absolute top-2 right-2 flex gap-2">
                              {isNew && (
                                <Badge className="bg-purple-600 text-white animate-pulse">
                                  NEW
                                </Badge>
                              )}
                              {property.ownerType === 'private' ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Badge 
                                      className="bg-green-500 text-white text-xs cursor-pointer hover:bg-green-600"
                                      data-testid={`badge-owner-type-${idx}`}
                                    >
                                      Privato ▼
                                    </Badge>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem 
                                      onClick={() => handleChangeOwnerType(property.id, 'agency')}
                                      disabled={changingOwnerTypeId === property.id}
                                    >
                                      <i className="fas fa-building mr-2"></i>
                                      Cambia in Agenzia
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                getClassificationBadge(property)
                              )}
                              <Badge className="bg-primary-900/80 text-white">
                                € {property.price?.toLocaleString() || "N/D"}
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg line-clamp-1" data-testid={`text-title-${idx}`}>
                                  {property.title || property.address}
                                </h3>
                                <p className="text-sm text-gray-600 line-clamp-1" data-testid={`text-address-${idx}`}>
                                  {property.address} {property.city && `- ${property.city}`}
                                </p>
                                {property.agencyName && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <i className="fas fa-building mr-1"></i>{property.agencyName}
                                  </p>
                                )}
                              </div>
                            </div>
                          
                            <div className="flex justify-between mt-3 text-sm">
                              <div>
                                <span className="font-medium">{property.size} m²</span>
                                {property.bedrooms && (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span>{property.bedrooms} cam.</span>
                                  </>
                                )}
                                {property.bathrooms && (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span>{property.bathrooms} bagni</span>
                                  </>
                                )}
                              </div>
                            </div>
                          
                            {property.matchScore && (
                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Match:</span>
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-green-500 h-2 rounded-full" 
                                      style={{ width: `${Math.min(property.matchScore, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-medium">{property.matchScore}%</span>
                                </div>
                              </div>
                            )}
                          
                            <div className="mt-4 flex flex-col gap-2">
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs flex-1"
                                  asChild
                                  data-testid={`button-view-property-${idx}`}
                                  onClick={() => console.log(`[LINK-CLICK] Property ${property.id}: ownerType='${property.ownerType}', navigating to ${property.ownerType === 'private' ? `/properties/private/${property.id}` : `/properties/shared/${property.id}`}`)}
                                >
                                  <Link href={property.ownerType === 'private' ? `/properties/private/${property.id}` : `/properties/shared/${property.id}`}>
                                    <i className="fas fa-info-circle mr-1"></i> Dettagli
                                  </Link>
                                </Button>
                                {property.url && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-xs flex-1"
                                    asChild
                                    data-testid={`button-view-external-${idx}`}
                                  >
                                    <a href={property.url} target="_blank" rel="noopener noreferrer">
                                      <i className="fas fa-external-link-alt mr-1"></i> Annuncio
                                    </a>
                                  </Button>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  className="text-xs flex-1 gap-1"
                                  asChild
                                  data-testid={`button-send-property-${idx}`}
                                >
                                  <Link href={`/communications/whatsapp?clientId=${id}&propertyId=${property.id}`}>
                                    <i className="fab fa-whatsapp"></i> Invia
                                  </Link>
                                </Button>
                                <Button 
                                  variant={isPropertyFavorite(property.id, property.ownerType || 'shared') ? "default" : "outline"}
                                  size="sm" 
                                  className={`text-xs flex-1 gap-1 ${isPropertyFavorite(property.id, property.ownerType || 'shared') ? 'bg-pink-500 hover:bg-pink-600' : ''}`}
                                  onClick={() => handleToggleFavorite(property.id, property.ownerType || 'shared')}
                                  disabled={favoritingPropertyId === property.id}
                                  data-testid={`button-favorite-property-${idx}`}
                                >
                                  <Heart className={`h-3 w-3 ${isPropertyFavorite(property.id, property.ownerType || 'shared') ? 'fill-current' : ''}`} /> 
                                  {isPropertyFavorite(property.id, property.ownerType || 'shared') ? 'Preferito' : 'Preferito'}
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="text-xs flex-1 gap-1"
                                  onClick={() => handleIgnoreProperty(property.id)}
                                  data-testid={`button-ignore-property-${idx}`}
                                >
                                  <i className="fas fa-eye-slash"></i> Ignora
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Immobili da Inviare (Properties with Notification Status) Tab */}
          <TabsContent value="properties-notification-status" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Immobili da Inviare</CardTitle>
                  <CardDescription>
                    Immobili compatibili con il cliente e stato delle notifiche
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {isPropertiesWithNotificationsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : !propertiesWithNotifications || propertiesWithNotifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-5xl mb-4">
                      <i className="fas fa-home"></i>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Nessun immobile compatibile</h3>
                    <p>
                      Non ci sono immobili che corrispondono alle preferenze del cliente.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Immobile</TableHead>
                          <TableHead>Dettagli</TableHead>
                          <TableHead>Stato invio</TableHead>
                          <TableHead>Data invio</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {propertiesWithNotifications.map((property) => (
                          <TableRow key={property.id}>
                            <TableCell className="font-medium">
                              <Link href={property.ownerType === 'private' ? `/properties/private/${property.id}` : `/properties/shared/${property.id}`} className="text-primary-600 hover:underline">
                                {property.address}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{property.city}</span>
                                <span className="text-sm text-gray-500">{property.size} m² - €{property.price?.toLocaleString()}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {property.notificationStatus?.notified ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700">
                                  <i className="fas fa-check mr-1"></i> Inviato
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                  <i className="fas fa-clock mr-1"></i> Non inviato
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {property.notificationStatus?.sentAt ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span>
                                        {format(new Date(property.notificationStatus.sentAt), "dd/MM/yyyy")}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{format(new Date(property.notificationStatus.sentAt), "dd/MM/yyyy HH:mm")}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant={property.notificationStatus?.notified ? "outline" : "default"}
                                  className={property.notificationStatus?.notified ? "gap-1 border-green-600 text-green-600" : "gap-1"}
                                  onClick={() => handleSendPropertyNotification(property.id)}
                                  disabled={isSendingNotification && propertyBeingNotified === property.id}
                                >
                                  {isSendingNotification && propertyBeingNotified === property.id ? (
                                    <>
                                      <i className="fas fa-spinner animate-spin"></i>
                                      <span>Invio...</span>
                                    </>
                                  ) : property.notificationStatus?.notified ? (
                                    <>
                                      <i className="fas fa-paper-plane"></i>
                                      <span>Invia di nuovo</span>
                                    </>
                                  ) : (
                                    <>
                                      <i className="fas fa-paper-plane"></i>
                                      <span>Invia Notifica</span>
                                    </>
                                  )}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-slate-800"
                                  asChild
                                >
                                  <Link href={property.ownerType === 'private' ? `/properties/private/${property.id}` : `/properties/shared/${property.id}`}>
                                    <i className="fas fa-eye"></i>
                                  </Link>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Immobili Inviati Tab */}
          <TabsContent value="sent-properties" className="space-y-6 mt-6">
            <SentPropertiesHistory clientId={id} />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* WhatsApp Modal */}
      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen} 
        onClose={() => setIsWhatsAppModalOpen(false)} 
        client={client}
      />
      
      {/* Bulk Ignore Confirmation Dialog */}
      <AlertDialog open={showBulkIgnoreDialog} onOpenChange={setShowBulkIgnoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma ignoramento immobili</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler ignorare {selectedIds.size} {selectedIds.size === 1 ? 'immobile' : 'immobili'}?
              <br /><br />
              Gli immobili ignorati non verranno più mostrati per questo cliente, ma rimarranno nel database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkIgnoring}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkIgnore}
              disabled={isBulkIgnoring}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isBulkIgnoring ? (
                <>
                  <i className="fas fa-spinner animate-spin mr-2"></i>
                  Ignorando...
                </>
              ) : (
                <>Ignora</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Add Property Manual Dialog */}
      <Dialog open={showAddPropertyDialog} onOpenChange={(open) => {
        setShowAddPropertyDialog(open);
        if (!open) {
          setAddPropertyMode('search');
          setPropertySearchQuery('');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aggiungi immobile</DialogTitle>
            <DialogDescription>
              Cerca un immobile esistente o inseriscine uno nuovo
            </DialogDescription>
          </DialogHeader>
          
          {/* Mode selector */}
          <div className="flex gap-2 mt-2">
            <Button
              variant={addPropertyMode === 'search' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setAddPropertyMode('search')}
            >
              <Search className="h-4 w-4 mr-2" />
              Cerca esistente
            </Button>
            <Button
              variant={addPropertyMode === 'new' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setAddPropertyMode('new')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Inserisci nuovo
            </Button>
          </div>
          
          {/* Search mode */}
          {addPropertyMode === 'search' && (
            <div className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Cerca per indirizzo, città o ID..."
                  value={propertySearchQuery}
                  onChange={(e) => setPropertySearchQuery(e.target.value)}
                  className="flex-1"
                  data-testid="input-search-property"
                />
                <Button variant="outline" disabled={isSearchingProperties}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              
              {propertySearchQuery.length < 3 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Inserisci almeno 3 caratteri per cercare
                </p>
              )}
              
              {isSearchingProperties && (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              )}
              
              {searchedProperties && searchedProperties.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {searchedProperties.map((property: any) => {
                    const isAlreadyFavorite = isPropertyFavorite(property.id, property.ownerType || 'shared');
                    return (
                      <div 
                        key={property.id}
                        className={`p-3 border rounded-lg flex items-center justify-between ${isAlreadyFavorite ? 'bg-pink-50 border-pink-200' : 'hover:bg-gray-50'}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm">{property.address}</h4>
                            <Badge className={property.ownerType === 'private' ? 'bg-green-500' : 'bg-blue-500'} variant="secondary">
                              {property.ownerType === 'private' ? 'Privato' : 'Condiviso'}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {property.city} • {property.size} m² • € {property.price?.toLocaleString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isAlreadyFavorite ? "secondary" : "default"}
                          onClick={() => handleAddPropertyManually(property.id, property.ownerType || 'shared')}
                          disabled={isAddingProperty || isAlreadyFavorite}
                          className="ml-4"
                        >
                          {isAlreadyFavorite ? (
                            <>
                              <Heart className="h-4 w-4 mr-1 fill-current" /> Già aggiunto
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-1" /> Aggiungi
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {searchedProperties && searchedProperties.length === 0 && propertySearchQuery.length >= 3 && !isSearchingProperties && (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 mb-3">
                    Nessun immobile trovato per "{propertySearchQuery}"
                  </p>
                  <Button variant="outline" onClick={() => setAddPropertyMode('new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Inserisci nuovo immobile
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {/* New property mode */}
          {addPropertyMode === 'new' && (
            <div className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Link annuncio *</label>
                  <Input
                    placeholder="https://www.immobiliare.it/..."
                    value={newPropertyUrl}
                    onChange={handlePropertyUrlChange}
                    data-testid="input-new-property-url"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Indirizzo *</label>
                    <Input
                      placeholder="Via Roma 15"
                      value={newPropertyAddress}
                      onChange={handlePropertyAddressChange}
                      data-testid="input-new-property-address"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Città</label>
                    <Input
                      placeholder="Milano"
                      value={newPropertyCity}
                      onChange={handlePropertyCityChange}
                      data-testid="input-new-property-city"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tipo</label>
                    <select
                      className="w-full h-10 px-3 border rounded-md text-sm"
                      value={newPropertyType}
                      onChange={handlePropertyTypeChange}
                    >
                      <option value="apartment">Appartamento</option>
                      <option value="house">Casa</option>
                      <option value="villa">Villa</option>
                      <option value="loft">Loft</option>
                      <option value="office">Ufficio</option>
                      <option value="commercial">Commerciale</option>
                      <option value="other">Altro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Prezzo (€) *</label>
                    <Input
                      type="number"
                      placeholder="250000"
                      value={newPropertyPrice}
                      onChange={handlePropertyPriceChange}
                      data-testid="input-new-property-price"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Superficie (m²)</label>
                    <Input
                      type="number"
                      placeholder="80"
                      value={newPropertySize}
                      onChange={handlePropertySizeChange}
                      data-testid="input-new-property-size"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Piano</label>
                    <Input
                      placeholder="3"
                      value={newPropertyFloor}
                      onChange={handlePropertyFloorChange}
                      data-testid="input-new-property-floor"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Note</label>
                    <Input
                      placeholder="Dettagli aggiuntivi..."
                      value={newPropertyNotes}
                      onChange={handlePropertyNotesChange}
                      data-testid="input-new-property-notes"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setAddPropertyMode('search')}
                >
                  Annulla
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateNewProperty}
                  disabled={isCreatingNewProperty || !newPropertyUrl || !newPropertyAddress || !newPropertyPrice}
                  data-testid="button-create-property"
                >
                  {isCreatingNewProperty ? (
                    <>
                      <i className="fas fa-spinner animate-spin mr-2"></i>
                      Creazione...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea e aggiungi ai preferiti
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}