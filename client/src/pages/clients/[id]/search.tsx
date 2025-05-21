import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ClientType } from "@/types";
import { ClientWithDetails, Property } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Slider 
} from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { Helmet } from "react-helmet";
import { Building, Euro, MapPin, Search, BedDouble, Bath, Calendar, ArrowRight } from "lucide-react";
import PropertyCard from "@/components/properties/PropertyCard";

// Importazioni per la mappa
import { 
  MapContainer, 
  TileLayer, 
  Polygon, 
  useMapEvents, 
  Marker
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";

// Fix per l'icona di Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Inizializzazioni necessarie per Leaflet
// Funzione esterna perché non può essere usata direttamente nel componente (hooks al primo livello)
function fixLeafletIcons() {
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: icon,
      iconUrl: icon,
      shadowUrl: iconShadow,
    });
  }, []);
}

// Componente per il controllo del disegno sulla mappa
function MapDrawControl({ onCreated, onDeleted }) {
  const map = useMapEvents({});
  
  useEffect(() => {
    if (!map) return;
    
    // Crea layer gruppo per le features disegnate
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    // Configurazione dei controlli di disegno
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polygon: {
          allowIntersection: false,
          drawError: {
            color: '#e1e100',
            message: '<strong>Errore:</strong> I poligoni non possono intersecarsi!'
          },
          shapeOptions: {
            color: '#3388ff'
          }
        }
      },
      edit: {
        featureGroup: drawnItems
      }
    });
    
    map.addControl(drawControl);
    
    // Gestione eventi
    const handleCreated = (e) => {
      drawnItems.addLayer(e.layer);
      if (onCreated) onCreated(e);
    };
    
    const handleDeleted = (e) => {
      if (onDeleted) onDeleted(e);
    };
    
    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.DELETED, handleDeleted);
    
    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.DELETED, handleDeleted);
      map.removeControl(drawControl);
      if (map.hasLayer(drawnItems)) {
        map.removeLayer(drawnItems);
      }
    };
  }, [map, onCreated, onDeleted]);
  
  return null;
}

export default function ClientPropertySearchPage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Recupera l'ID del cliente dalla URL
  const clientId = parseInt(params.id);
  
  // Stati per i filtri di ricerca
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000000]);
  const [sizeRange, setSizeRange] = useState<[number, number]>([30, 300]);
  const [propertyType, setPropertyType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Stato per il poligono di ricerca
  const [searchArea, setSearchArea] = useState<[number, number][]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([45.4642, 9.1900]); // Milano
  const mapRef = useRef(null);
  
  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ['/api/clients', clientId],
    queryFn: async () => {
      return apiRequest('GET', `/api/clients/${clientId}`);
    },
    enabled: !!clientId
  });
  
  // Fetch available properties based on filters
  const { data: properties, isLoading: isLoadingProperties } = useQuery({
    queryKey: ['/api/properties', priceRange, sizeRange, propertyType, searchQuery],
    queryFn: async () => {
      // Build query params
      const params = new URLSearchParams();
      
      if (propertyType !== "all") {
        params.append("type", propertyType);
      }
      
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      
      // Add price and size ranges (server-side filtering will need to be implemented)
      params.append("minPrice", priceRange[0].toString());
      params.append("maxPrice", priceRange[1].toString());
      params.append("minSize", sizeRange[0].toString());
      params.append("maxSize", sizeRange[1].toString());
      
      const url = `/api/properties${params.toString() ? `?${params.toString()}` : ''}`;
      return apiRequest('GET', url);
    }
  });
  
  // Mutation to update buyer preferences
  const updateBuyerMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/buyers/${client?.buyer?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId] });
      toast({
        title: "Preferenze aggiornate",
        description: "Le preferenze di ricerca sono state aggiornate con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento delle preferenze.",
        variant: "destructive",
      });
    }
  });
  
  // Initialize filters from client data when loaded
  useEffect(() => {
    if (client?.buyer) {
      if (client.buyer.maxPrice) {
        setPriceRange([0, client.buyer.maxPrice]);
      }
      if (client.buyer.minSize) {
        setSizeRange([client.buyer.minSize, 300]);
      }
      
      // Carica il poligono di ricerca dai dati del cliente
      if (client.buyer.searchArea && client.buyer.searchArea.length > 0) {
        setSearchArea(client.buyer.searchArea);
        // Centra la mappa sul primo punto del poligono
        setMapCenter([client.buyer.searchArea[0][0], client.buyer.searchArea[0][1]]);
      }
    }
  }, [client]);
  
  // Save search preferences to buyer profile
  const saveSearchPreferences = () => {
    if (client?.buyer) {
      updateBuyerMutation.mutate({
        minSize: sizeRange[0],
        maxPrice: priceRange[1],
        searchArea: searchArea.length > 0 ? searchArea : null
      });
    }
  };
  
  // Gestisce i disegni sulla mappa (poligoni)
  const handleMapDraw = (e: any) => {
    const { layerType, layer } = e;
    
    if (layerType === 'polygon') {
      const drawnPolygon = layer.getLatLngs()[0];
      const coordinates: [number, number][] = drawnPolygon.map((point: any) => [point.lat, point.lng]);
      setSearchArea(coordinates);
    }
  };
  
  // Gestisce la cancellazione dei disegni sulla mappa
  const handleMapDelete = () => {
    setSearchArea([]);
  };
  
  // Function to match client with a property
  const matchWithProperty = (propertyId: number) => {
    // This would be implemented in a real system
    toast({
      title: "Proprietà abbinata",
      description: `Questa proprietà è stata abbinata al cliente ${client?.firstName} ${client?.lastName}.`,
    });
  };
  
  // Handle loading state
  if (isLoadingClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento dati cliente...</p>
        </div>
      </div>
    );
  }
  
  // Handle client not found
  if (!isLoadingClient && !client) {
    return (
      <div className="bg-red-50 text-red-800 p-6 rounded-lg text-center">
        <h2 className="text-xl font-bold mb-2">Cliente non trovato</h2>
        <p className="mb-4">Il cliente non esiste o non è possibile accedere ai suoi dati.</p>
        <button 
          onClick={() => navigate("/clients")}
          className="bg-red-800 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Torna alla lista clienti
        </button>
      </div>
    );
  }
  
  // Handle non-buyer client type
  if (client && client.type !== "buyer") {
    return (
      <div className="bg-yellow-50 text-yellow-800 p-6 rounded-lg text-center">
        <h2 className="text-xl font-bold mb-2">Tipo cliente non valido</h2>
        <p className="mb-4">Questa pagina è disponibile solo per i clienti compratori.</p>
        <button 
          onClick={() => navigate(`/clients/${clientId}`)}
          className="bg-yellow-800 text-white px-4 py-2 rounded hover:bg-yellow-700"
        >
          Torna al profilo cliente
        </button>
      </div>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>Ricerca Immobili | RealEstate CRM</title>
        <meta 
          name="description" 
          content="Cerca immobili in base alle preferenze del cliente."
        />
      </Helmet>
      
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-gray-900">
          Ricerca Immobili per {client?.firstName} {client?.lastName}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Trova gli immobili più adatti alle preferenze del cliente
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Preferences Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Preferenze Cliente</CardTitle>
              <CardDescription>
                Definisci i criteri di ricerca
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Prezzo Massimo: {priceRange[1].toLocaleString('it-IT')} €</label>
                <Slider 
                  defaultValue={[priceRange[1]]} 
                  max={1000000}
                  step={10000}
                  onValueChange={(value) => setPriceRange([0, value[0]])}
                  className="mt-2"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Metratura Minima: {sizeRange[0]} m²</label>
                <Slider 
                  defaultValue={[sizeRange[0]]} 
                  min={30}
                  max={300}
                  step={5}
                  onValueChange={(value) => setSizeRange([value[0], 300])}
                  className="mt-2"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium block mb-2">Tipo Immobile</label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti i tipi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i tipi</SelectItem>
                    <SelectItem value="apartment">Appartamento</SelectItem>
                    <SelectItem value="house">Casa indipendente</SelectItem>
                    <SelectItem value="villa">Villa</SelectItem>
                    <SelectItem value="office">Ufficio</SelectItem>
                    <SelectItem value="commercial">Commerciale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Mappa per il poligono di ricerca */}
              <div className="mt-4">
                <label className="text-sm font-medium block mb-2">Area di Ricerca</label>
                <div className="h-[300px] border rounded-md overflow-hidden">
                  {/* La mappa verrà mostrata qui */}
                  <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    ref={mapRef}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    
                    {/* Mostra il poligono esistente se presente */}
                    {searchArea && searchArea.length > 0 && (
                      <Polygon 
                        positions={searchArea}
                        pathOptions={{ color: 'blue', fillColor: 'rgba(0, 0, 255, 0.2)' }}
                      />
                    )}
                    
                    {/* Per ora rimuoviamo il controllo di disegno che causa errori */}
                  </MapContainer>
                </div>
                {searchArea && searchArea.length > 0 ? (
                  <p className="text-xs text-green-600 mt-1">
                    <i className="fas fa-check-circle mr-1"></i>
                    Area di ricerca definita
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    <i className="fas fa-info-circle mr-1"></i>
                    Disegna un poligono sulla mappa per definire l'area di ricerca
                  </p>
                )}
              </div>
              
              <div className="pt-4">
                <Button 
                  onClick={saveSearchPreferences}
                  disabled={updateBuyerMutation.isPending}
                  className="w-full"
                >
                  Salva Preferenze
                </Button>
              </div>
              
              {/* Client Notes */}
              {client?.buyer?.searchNotes && (
                <div className="mt-4 p-3 bg-amber-50 rounded-md border border-amber-200">
                  <h4 className="font-medium text-amber-800 mb-1">Note di Ricerca</h4>
                  <p className="text-sm text-amber-700">{client.buyer.searchNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Property Results */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Immobili Disponibili</CardTitle>
                  <CardDescription>
                    {isLoadingProperties ? "Caricamento..." : `${properties?.length || 0} immobili trovati`}
                  </CardDescription>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Cerca per indirizzo o città"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-60"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingProperties ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Ricerca immobili in corso...</p>
                  </div>
                </div>
              ) : properties && properties.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {properties.map((property: Property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      onView={() => navigate(`/properties/${property.id}`)}
                      onMatch={() => matchWithProperty(property.id)}
                      client={client}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Building className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-lg font-medium text-gray-900">Nessun immobile trovato</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Prova a modificare i criteri di ricerca per trovare più risultati.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}