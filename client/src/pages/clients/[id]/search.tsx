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
  Marker,
  FeatureGroup
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
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

// Componente per gestire i click sulla mappa
const MapClickHandler = ({ setSearchArea }) => {
  const map = useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      console.log("Clic sulla mappa:", { lat, lng });
      
      // Aggiungi il nuovo punto all'area
      setSearchArea(prevArea => {
        const newArea = [...(prevArea || [])];
        newArea.push([lat, lng]);
        return newArea;
      });
    },
  });
  
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
      // Assicuriamoci che l'area sia un poligono valido
      let areaToSave = searchArea;
      
      // Se l'area ha almeno 3 punti ma non è chiusa (il primo e l'ultimo punto non coincidono)
      if (areaToSave.length >= 3) {
        const firstPoint = areaToSave[0];
        const lastPoint = areaToSave[areaToSave.length - 1];
        
        // Se primo e ultimo punto non coincidono, aggiungi il primo punto alla fine per chiudere il poligono
        if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
          areaToSave = [...areaToSave, [firstPoint[0], firstPoint[1]]];
        }
      }
      
      // Stampa l'area per debug
      console.log("Salvataggio area:", areaToSave);
      
      // Esegui la mutation
      updateBuyerMutation.mutate({
        minSize: sizeRange[0],
        maxPrice: priceRange[1],
        searchArea: areaToSave.length > 0 ? areaToSave : null
      }, {
        onSuccess: () => {
          toast({
            title: "Area salvata",
            description: "L'area di ricerca è stata salvata con successo.",
            variant: "default",
          });
        },
        onError: (error) => {
          console.error("Errore durante il salvataggio:", error);
          toast({
            title: "Errore",
            description: "Si è verificato un errore durante il salvataggio. Riprova.",
            variant: "destructive",
          });
        }
      });
    } else {
      toast({
        title: "Impossibile salvare",
        description: "Nessun cliente acquirente trovato. Aggiorna la pagina e riprova.",
        variant: "destructive",
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
  
  // RIMOSSO controllo sul tipo di cliente - consentiamo a tutti i clienti di essere visualizzati
  
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
                
                <div className="mb-2 text-sm text-gray-600">
                  <strong>Clicca direttamente sulla mappa</strong> per disegnare l'area di ricerca. Ogni clic aggiunge un punto al poligono.
                </div>
                
                <div className="flex gap-2 mb-4">
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setSearchArea([])}
                  >
                    Ricomincia da capo
                  </Button>
                  
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      // Chiudi il poligono se ci sono almeno 3 punti
                      if (searchArea && searchArea.length >= 3) {
                        const newArea = [...searchArea];
                        // Aggiungi il primo punto alla fine per chiudere il poligono
                        newArea.push([searchArea[0][0], searchArea[0][1]]);
                        setSearchArea(newArea);
                      }
                    }}
                    disabled={!searchArea || searchArea.length < 3}
                  >
                    Chiudi Area
                  </Button>
                </div>
                
                <div className="h-[500px] border rounded-md overflow-hidden relative">
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
                    
                    {/* Handler per i click sulla mappa */}
                    <MapClickHandler setSearchArea={setSearchArea} />
                    
                    {/* Mostra il poligono esistente */}
                    {searchArea && searchArea.length > 0 && (
                      <Polygon 
                        positions={searchArea}
                        pathOptions={{ color: 'blue', fillColor: 'rgba(0, 0, 255, 0.2)' }}
                      />
                    )}
                    
                    {/* Mostra i marker per ogni punto del poligono */}
                    {searchArea && searchArea.map((point, index) => (
                      <Marker 
                        key={`marker-${index}`} 
                        position={[point[0], point[1]]} 
                      />
                    ))}
                  </MapContainer>
                  
                  {/* Istruzioni sovrimpresse sulla mappa */}
                  <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-md z-[1000] max-w-xs">
                    <h4 className="font-bold text-sm mb-1">Come disegnare:</h4>
                    <ol className="text-xs ml-4 list-decimal">
                      <li>Clicca sulla mappa per inserire un vertice dell'area</li>
                      <li>Continua a cliccare per aggiungere altri punti</li>
                      <li>Dopo aver inserito almeno 3 punti, premi "Chiudi Area"</li>
                      <li>Salva con il pulsante in fondo alla pagina</li>
                    </ol>
                  </div>
                </div>
                
                <div className="mt-6 flex flex-col items-center">
                  <Button 
                    className="w-full py-4 text-lg font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg"
                    onClick={saveSearchPreferences}
                    disabled={!searchArea || searchArea.length < 3}
                  >
                    SALVA L'AREA DISEGNATA
                  </Button>
                  
                  <div className="mt-2 text-sm text-center text-gray-700">
                    {(!searchArea || searchArea.length === 0) && "Nessuna area definita. Clicca sulla mappa per iniziare a disegnare."}
                    {searchArea && searchArea.length > 0 && searchArea.length < 3 && "Continua a cliccare: servono almeno 3 punti per definire un'area."}
                    {searchArea && searchArea.length >= 3 && searchArea.length < 4 && "Clicca 'Chiudi Area' oppure puoi salvare direttamente l'area disegnata."}
                    {searchArea && searchArea.length >= 4 && "Area completata! Clicca il pulsante sopra per salvare."}
                  </div>
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