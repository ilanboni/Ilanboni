import { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ArrowLeft, ExternalLink, MapPin, Phone, Mail, Building, Home, Euro, Ruler, BedDouble, Bath, Calendar, User, Heart, HeartOff, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Property } from "@shared/schema";
import MapPreview from "@/components/maps/MapPreview";

function formatPrice(price: number | null | undefined): string {
  if (!price) return "-";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(price);
}

function formatDate(dateString: string | Date | null | undefined) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("it-IT", { 
    day: "numeric", 
    month: "long", 
    year: "numeric" 
  }).format(date);
}

function getPortalDisplayName(portal: string | null | undefined): string {
  if (!portal) return 'Annuncio';
  const lower = portal.toLowerCase();
  if (lower.includes('immobiliare')) return 'Immobiliare.it';
  if (lower.includes('idealista')) return 'Idealista';
  if (lower.includes('casadaprivato')) return 'CasaDaPrivato';
  if (lower.includes('clickcase')) return 'ClickCase';
  if (lower.includes('casafari')) return 'Casafari';
  return portal.charAt(0).toUpperCase() + portal.slice(1);
}

function getOwnerTypeLabel(ownerType: string | null | undefined): string {
  if (ownerType === 'private') return 'Privato';
  if (ownerType === 'agency') return 'Agenzia';
  return 'Non specificato';
}

function getOwnerTypeBadgeColor(ownerType: string | null | undefined): string {
  if (ownerType === 'private') return 'bg-green-100 text-green-800';
  if (ownerType === 'agency') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-800';
}

export default function PrivatePropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: property, isLoading, isError, error } = useQuery({
    queryKey: ['/api/properties', params.id],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${params.id}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei dettagli della proprietà');
      }
      return response.json() as Promise<Property>;
    },
    retry: 1,
    retryDelay: 1000
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/properties/${params.id}/favorite`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: !property?.isFavorite })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties', params.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: property?.isFavorite ? "Rimosso dai preferiti" : "Aggiunto ai preferiti",
        description: property?.isFavorite 
          ? "La proprietà è stata rimossa dai preferiti"
          : "La proprietà è stata aggiunta ai preferiti",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare i preferiti",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/properties/private")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/properties/private")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Dettagli Proprietà</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Errore</AlertTitle>
          <AlertDescription>
            Impossibile caricare i dettagli della proprietà. {error?.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const externalUrl = property.url || property.externalLink;

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/properties/private")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-property-address">{property.address}</h1>
            <p className="text-muted-foreground">{property.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={property.isFavorite ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFavoriteMutation.mutate()}
            disabled={toggleFavoriteMutation.isPending}
            data-testid="button-toggle-favorite"
          >
            {property.isFavorite ? (
              <>
                <Heart className="h-4 w-4 mr-2 fill-current" />
                Preferito
              </>
            ) : (
              <>
                <HeartOff className="h-4 w-4 mr-2" />
                Aggiungi ai preferiti
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Informazioni Proprietà
              </CardTitle>
              <Badge className={getOwnerTypeBadgeColor(property.ownerType)}>
                {getOwnerTypeLabel(property.ownerType)}
              </Badge>
            </div>
            <CardDescription>
              ID: {property.id} • {property.type}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Prezzo</p>
                  <p className="font-semibold" data-testid="text-property-price">{formatPrice(property.price)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Superficie</p>
                  <p className="font-semibold" data-testid="text-property-size">{property.size ? `${property.size} mq` : '-'}</p>
                </div>
              </div>
              {property.bedrooms && (
                <div className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Camere</p>
                    <p className="font-semibold">{property.bedrooms}</p>
                  </div>
                </div>
              )}
              {property.bathrooms && (
                <div className="flex items-center gap-2">
                  <Bath className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Bagni</p>
                    <p className="font-semibold">{property.bathrooms}</p>
                  </div>
                </div>
              )}
              {property.floor && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Piano</p>
                    <p className="font-semibold">{property.floor}</p>
                  </div>
                </div>
              )}
              {property.energyClass && (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Classe Energetica</p>
                    <p className="font-semibold">{property.energyClass}</p>
                  </div>
                </div>
              )}
            </div>

            {property.description && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Descrizione</p>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-property-description">{property.description}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Link Annuncio
              </CardTitle>
              <CardDescription>
                Fonte: {getPortalDisplayName(property.portal)}
                {property.agencyName && ` • ${property.agencyName}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {externalUrl ? (
                <a 
                  href={externalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                  data-testid="link-external-listing"
                >
                  <ExternalLink className="h-4 w-4" />
                  Visualizza annuncio su {getPortalDisplayName(property.portal)}
                </a>
              ) : (
                <p className="text-muted-foreground">Nessun link disponibile</p>
              )}

              {property.isMultiagency && (
                <div className="mt-4">
                  <Badge variant="secondary">Pluricondiviso</Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    Questa proprietà è presente su più portali
                  </p>
                </div>
              )}

              {property.exclusivityHint && (
                <div className="mt-4">
                  <Badge className="bg-amber-100 text-amber-800">Esclusiva</Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    Questa proprietà potrebbe essere in esclusiva
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {(property.ownerName || property.ownerPhone || property.ownerEmail) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contatti Proprietario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {property.ownerName && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span data-testid="text-owner-name">{property.ownerName}</span>
                  </div>
                )}
                {property.ownerPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${property.ownerPhone}`} className="text-primary hover:underline" data-testid="link-owner-phone">
                      {property.ownerPhone}
                    </a>
                  </div>
                )}
                {property.ownerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${property.ownerEmail}`} className="text-primary hover:underline" data-testid="link-owner-email">
                      {property.ownerEmail}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {property.location && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Posizione
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] rounded-md overflow-hidden">
                  <MapPreview location={property.location} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Date
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {property.firstSeenAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prima visione</span>
                  <span>{formatDate(property.firstSeenAt)}</span>
                </div>
              )}
              {property.lastSeenAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ultimo aggiornamento</span>
                  <span>{formatDate(property.lastSeenAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creato</span>
                <span>{formatDate(property.createdAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
