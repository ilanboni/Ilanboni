import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Users, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Euro, 
  Maximize2,
  Star,
  MessageSquare,
  TrendingUp,
  Eye,
  ExternalLink
} from "lucide-react";

interface Buyer {
  id: number;
  clientId: number;
  name: string;
  phone: string;
  email: string | null;
  rating: number;
  minSize: number | null;
  maxPrice: number | null;
  searchNotes: string | null;
}

interface Property {
  id: number;
  address: string;
  city: string;
  size: number;
  price: number;
  type: string;
  isMultiagency?: boolean;
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
}

interface SharedProperty {
  id: number;
  address: string;
  city: string | null;
  size: number | null;
  price: number | null;
  type: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  rating: number;
}

interface BuyerWithMatches {
  buyer: Buyer;
  properties: {
    total: number;
    multiagency: number;
    regular: number;
    multiagencyList: Property[];
    regularList: Property[];
  };
}

interface HighPriorityData {
  ok: boolean;
  total: number;
  buyers: BuyerWithMatches[];
}

interface PropertyCluster {
  address: string;
  city: string;
  normalizedAddress: string;
  count: number;
  properties: Property[];
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  avgSize: number;
}

interface MultiagencyData {
  ok: boolean;
  total: number;
  clusters: {
    count: number;
    list: PropertyCluster[];
  };
  sharedProperties: {
    count: number;
    list: SharedProperty[];
  };
}

interface PrivatePropertiesData {
  ok: boolean;
  total: number;
  withPhone: {
    count: number;
    list: Property[];
  };
  withEmailOnly: {
    count: number;
    list: Property[];
  };
}

function BuyerMatchCard({ buyerData }: { buyerData: BuyerWithMatches }) {
  const { buyer, properties } = buyerData;
  
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-blue-100 text-blue-700">
                {buyer.rating} <Star className="h-3 w-3 ml-1 inline" />
              </Badge>
              <Badge variant="outline">{properties.total} immobili</Badge>
              {properties.multiagency > 0 && (
                <Badge className="bg-orange-100 text-orange-700">
                  {properties.multiagency} pluricondivisi
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{buyer.name}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-green-500" />
            <a href={`tel:${buyer.phone}`} className="text-blue-600 hover:underline">
              {buyer.phone}
            </a>
          </div>
          
          {buyer.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-purple-500" />
              <a href={`mailto:${buyer.email}`} className="text-blue-600 hover:underline">
                {buyer.email}
              </a>
            </div>
          )}
          
          <div className="text-sm text-gray-600 flex gap-4">
            {buyer.maxPrice && (
              <span>Budget: €{buyer.maxPrice.toLocaleString()}</span>
            )}
            {buyer.minSize && (
              <span>Min: {buyer.minSize}mq</span>
            )}
          </div>
        </div>

        {properties.multiagency > 0 && (
          <div className="border-t pt-3 mt-3">
            <p className="text-sm font-medium text-orange-600 mb-2">
              🎯 {properties.multiagency} immobili pluricondivisi trovati
            </p>
            <div className="space-y-1">
              {properties.multiagencyList.slice(0, 2).map((prop) => (
                <div key={prop.id} className="text-xs text-gray-600 flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  <span>{prop.address} - €{prop.price.toLocaleString()}</span>
                </div>
              ))}
              {properties.multiagency > 2 && (
                <p className="text-xs text-gray-500 italic">
                  +{properties.multiagency - 2} altri...
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button 
            className="flex-1"
            onClick={() => window.location.href = `/clients/${buyer.clientId}`}
            data-testid={`button-view-buyer-${buyer.id}`}
          >
            Vedi Cliente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ClusterCard({ cluster }: { cluster: PropertyCluster }) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Card 
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => setShowDialog(true)}
        data-testid={`cluster-card-${cluster.normalizedAddress}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-orange-100 text-orange-700">
                  {cluster.count} Agenzie
                </Badge>
                <Badge variant="outline">Pluricondiviso</Badge>
              </div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {cluster.address}
              </CardTitle>
              <CardDescription>{cluster.city}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1">
              <Euro className="h-4 w-4 text-green-600" />
              <span className="font-semibold">€{cluster.avgPrice.toLocaleString()}</span>
              <span className="text-gray-500 text-xs">media</span>
            </div>
            {cluster.avgSize && (
              <div className="flex items-center gap-1">
                <Maximize2 className="h-4 w-4 text-blue-600" />
                <span>{cluster.avgSize}mq</span>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <p className="text-sm text-gray-600 mb-2">
              Range prezzo: €{cluster.minPrice.toLocaleString()} - €{cluster.maxPrice.toLocaleString()}
            </p>
            <Button 
              className="w-full"
              data-testid={`button-view-cluster-${cluster.normalizedAddress}`}
            >
              <Eye className="h-4 w-4 mr-2" />
              Vedi {cluster.count} Annunci
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {cluster.address} - {cluster.count} Annunci
            </DialogTitle>
            <DialogDescription>
              Immobile pluricondiviso presente su {cluster.count} agenzie/portali
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 mt-4">
            {cluster.properties.map((prop, idx) => (
              <Card key={prop.id} className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">Annuncio #{idx + 1}</Badge>
                        {prop.portal && (
                          <Badge className="bg-blue-100 text-blue-700">{prop.portal}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-base">
                        €{prop.price.toLocaleString()} - {prop.size}mq
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {prop.type && (
                      <div>
                        <span className="font-medium">Tipo:</span> {prop.type}
                      </div>
                    )}
                    {prop.description && (
                      <div>
                        <span className="font-medium">Descrizione:</span>
                        <p className="text-gray-600 mt-1 line-clamp-2">{prop.description}</p>
                      </div>
                    )}
                    {prop.url && (
                      <div className="pt-2">
                        <a 
                          href={prop.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Vedi annuncio originale
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/properties/${prop.id}`;
                      }}
                      data-testid={`button-view-property-${prop.id}`}
                    >
                      Dettagli Completi
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PropertyCard({ property, showContact = false }: { property: Property | SharedProperty; showContact?: boolean }) {
  const isShared = 'rating' in property;
  
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isShared ? (
                <Badge className="bg-purple-100 text-purple-700">Shared Property</Badge>
              ) : (
                <Badge className="bg-orange-100 text-orange-700">Multi-Agency</Badge>
              )}
            </div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {property.address}
            </CardTitle>
            {property.city && (
              <CardDescription>{property.city}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4 text-sm">
          {property.price && (
            <div className="flex items-center gap-1">
              <Euro className="h-4 w-4 text-green-600" />
              <span className="font-semibold">€{property.price.toLocaleString()}</span>
            </div>
          )}
          {property.size && (
            <div className="flex items-center gap-1">
              <Maximize2 className="h-4 w-4 text-blue-600" />
              <span>{property.size}mq</span>
            </div>
          )}
          {property.type && (
            <Badge variant="outline">{property.type}</Badge>
          )}
        </div>

        {showContact && (
          <div className="border-t pt-3 space-y-2">
            {property.ownerName && (
              <div className="text-sm">
                <span className="font-medium">Proprietario:</span> {property.ownerName}
              </div>
            )}
            {property.ownerPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-green-500" />
                <a href={`tel:${property.ownerPhone}`} className="text-blue-600 hover:underline">
                  {property.ownerPhone}
                </a>
              </div>
            )}
            {property.ownerEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-purple-500" />
                <a href={`mailto:${property.ownerEmail}`} className="text-blue-600 hover:underline">
                  {property.ownerEmail}
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          {showContact && property.ownerPhone && (
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => window.open(`https://wa.me/${property.ownerPhone.replace(/\D/g, '')}`, '_blank')}
              data-testid={`button-whatsapp-${property.id}`}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={() => window.location.href = isShared ? `/properties/shared/${property.id}` : `/properties/${property.id}`}
            data-testid={`button-view-property-${property.id}`}
          >
            Dettagli
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AcquisitionsReportsPage() {
  const { data: highPriorityData, isLoading: loadingHighPriority } = useQuery<HighPriorityData>({
    queryKey: ["/api/reports/high-priority-matches"]
  });

  const { data: multiagencyData, isLoading: loadingMultiagency } = useQuery<MultiagencyData>({
    queryKey: ["/api/reports/multiagency-properties"]
  });

  const { data: privateData, isLoading: loadingPrivate } = useQuery<PrivatePropertiesData>({
    queryKey: ["/api/reports/private-properties"]
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <TrendingUp className="h-8 w-8" />
          Report Acquisizione Immobili
        </h1>
        <p className="text-gray-600">
          Richieste prioritarie, immobili pluricondivisi e contatti diretti proprietari
        </p>
      </div>

      <Tabs defaultValue="high-priority" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="high-priority" data-testid="tab-high-priority">
            <Users className="h-4 w-4 mr-2" />
            Richieste Top (Rating 4-5)
          </TabsTrigger>
          <TabsTrigger value="multiagency" data-testid="tab-multiagency">
            <Building2 className="h-4 w-4 mr-2" />
            Pluricondivisi Milano
          </TabsTrigger>
          <TabsTrigger value="private" data-testid="tab-private">
            <Phone className="h-4 w-4 mr-2" />
            Privati con Contatto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="high-priority" className="mt-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Clienti con Rating 4-5 e Immobili in Target</CardTitle>
              <CardDescription>
                Clienti ad alta priorità con immobili corrispondenti alle loro richieste. Gli immobili pluricondivisi sono evidenziati.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHighPriority ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                  ))}
                </div>
              ) : highPriorityData && highPriorityData.total > 0 ? (
                <div className="grid gap-4">
                  {highPriorityData.buyers.map((buyerData) => (
                    <BuyerMatchCard key={buyerData.buyer.id} buyerData={buyerData} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun cliente con rating 4-5 ha immobili in target al momento</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multiagency" className="mt-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Immobili Pluricondivisi a Milano</CardTitle>
              <CardDescription>
                Tutti gli immobili presenti su più agenzie o portali, inclusi privati + agenzia
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMultiagency ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                  ))}
                </div>
              ) : multiagencyData && multiagencyData.total > 0 ? (
                <div className="space-y-6">
                  {multiagencyData.clusters.count > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">
                        Immobili Pluricondivisi ({multiagencyData.clusters.count} cluster)
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {multiagencyData.clusters.list.map((cluster) => (
                          <ClusterCard key={cluster.normalizedAddress} cluster={cluster} />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {multiagencyData.sharedProperties.count > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">
                        Shared Properties ({multiagencyData.sharedProperties.count})
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {multiagencyData.sharedProperties.list.map((prop) => (
                          <PropertyCard key={prop.id} property={prop} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun immobile pluricondiviso trovato a Milano</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="private" className="mt-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Immobili di Privati con Contatto Diretto</CardTitle>
              <CardDescription>
                Immobili con contatto telefono o email del proprietario per comunicazione diretta via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPrivate ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                  ))}
                </div>
              ) : privateData && privateData.total > 0 ? (
                <div className="space-y-6">
                  {privateData.withPhone.count > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Phone className="h-5 w-5 text-green-600" />
                        Con Telefono ({privateData.withPhone.count})
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {privateData.withPhone.list.map((prop) => (
                          <PropertyCard key={prop.id} property={prop} showContact={true} />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {privateData.withEmailOnly.count > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Mail className="h-5 w-5 text-purple-600" />
                        Solo Email ({privateData.withEmailOnly.count})
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        {privateData.withEmailOnly.list.map((prop) => (
                          <PropertyCard key={prop.id} property={prop} showContact={true} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun immobile di privati con contatto diretto</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
