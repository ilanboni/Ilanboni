import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { CardHeader } from "@/components/ui/card";
import { CardTitle } from "@/components/ui/card";
import { CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  AlertCircle, 
  Building, 
  Users, 
  MapPin,
  ChevronRight,
  Loader2
} from "lucide-react";
import { Link } from "wouter";

interface RankedSharedProperty {
  id: number;
  address: string;
  city: string;
  size: number;
  price: number;
  interestedBuyersCount: number;
  matchPercentage: number;
  stage: string;
  isAcquired: boolean;
}

interface MatchingBuyer {
  id: number;
  firstName: string;
  lastName: string;
  phone?: string;
}

export default function SharedPropertiesRanking() {
  const [openPopover, setOpenPopover] = useState<number | null>(null);
  const [buyersByProperty, setBuyersByProperty] = useState<Record<number, MatchingBuyer[] | null>>({});
  const [loadingBuyers, setLoadingBuyers] = useState<Record<number, boolean>>({});

  // Fetch proprietà condivise con più potenziali interessati
  const { 
    data: rankedProperties, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/analytics/shared-properties-ranking'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/analytics/shared-properties-ranking');
        if (!response.ok) {
          throw new Error("Errore nel caricamento della classifica delle proprietà condivise");
        }
        return response.json() as Promise<RankedSharedProperty[]>;
      } catch (error) {
        console.error("Errore nel caricamento delle proprietà condivise:", error);
        throw error;
      }
    }
  });

  const handleOpenPopover = async (propertyId: number) => {
    setOpenPopover(propertyId);
    
    // Se i buyer sono già caricati, non fare nulla
    if (buyersByProperty[propertyId]) {
      return;
    }

    // Fetch dei buyer interessati
    setLoadingBuyers(prev => ({ ...prev, [propertyId]: true }));
    try {
      const response = await fetch(`/api/shared-properties/${propertyId}/matching-buyers`);
      if (response.ok) {
        const buyers = await response.json() as MatchingBuyer[];
        setBuyersByProperty(prev => ({
          ...prev,
          [propertyId]: buyers.map(b => ({
            id: b.id,
            firstName: b.firstName,
            lastName: b.lastName,
            phone: b.phone
          }))
        }));
      }
    } catch (error) {
      console.error("Errore nel caricamento dei buyer:", error);
      setBuyersByProperty(prev => ({ ...prev, [propertyId]: [] }));
    } finally {
      setLoadingBuyers(prev => ({ ...prev, [propertyId]: false }));
    }
  };

  if (isLoading) {
    return <SharedPropertiesRankingSkeleton />;
  }

  if (error || !rankedProperties) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Proprietà Condivise</CardTitle>
          <CardDescription>Classifica per potenziali interessati</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Si è verificato un errore nel caricamento della classifica.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  function getStageLabel(stage: string) {
    switch (stage) {
      case "address_found":
        return "Indirizzo trovato";
      case "owner_found":
        return "Proprietario trovato";
      case "owner_contact_found":
        return "Contatto proprietario";
      case "owner_contacted":
        return "Proprietario contattato";
      case "result":
        return "Risultato";
      default:
        return stage;
    }
  }

  function getStageColor(stage: string) {
    switch (stage) {
      case "address_found":
        return "bg-gray-100 text-gray-800";
      case "owner_found":
        return "bg-blue-100 text-blue-800";
      case "owner_contact_found":
        return "bg-indigo-100 text-indigo-800";
      case "owner_contacted":
        return "bg-violet-100 text-violet-800";
      case "result":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proprietà Condivise</CardTitle>
        <CardDescription>Classifica per potenziali interessati</CardDescription>
      </CardHeader>
      <CardContent>
        {rankedProperties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Building className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>Nessuna proprietà condivisa trovata</p>
            <p className="text-sm mt-1">Aggiungi proprietà condivise per visualizzare la classifica</p>
            <div className="mt-5">
              <p className="text-xs text-gray-600 mb-3 italic max-w-md mx-auto">
                Le proprietà condivise ti permettono di tracciare immobili di altre agenzie 
                e identificare potenziali clienti interessati
              </p>
              <button
                className="px-4 py-2 text-sm text-white bg-primary rounded hover:bg-primary/90"
                onClick={() => window.location.href = "/properties/shared/add"}
              >
                Aggiungi proprietà condivisa
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {rankedProperties.map((property, index) => (
              <div key={property.id} className="border rounded-md p-3 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center">
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary-100 text-primary-800 text-sm font-medium mr-2">
                        {index + 1}
                      </span>
                      <h3 className="font-medium">{property.address}</h3>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <MapPin className="h-3 w-3 mr-1" />
                      <span>{property.city}</span>
                      {property.size && property.price && (
                        <span className="ml-3">
                          {property.size} m² - {property.price.toLocaleString()} €
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={getStageColor(property.stage)}>
                    {getStageLabel(property.stage)}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm">
                    <Users className="h-4 w-4 text-primary-600 mr-1" />
                    
                    <Popover open={openPopover === property.id} onOpenChange={(open) => {
                      if (open) {
                        handleOpenPopover(property.id);
                      } else {
                        setOpenPopover(null);
                      }
                    }}>
                      <PopoverTrigger asChild>
                        <button
                          className="font-medium hover:underline cursor-pointer text-primary hover:text-primary-700"
                          data-testid={`button-show-buyers-${property.id}`}
                        >
                          {property.interestedBuyersCount} potenziali interessati
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Clienti interessati</h4>
                          {loadingBuyers[property.id] ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          ) : buyersByProperty[property.id] && buyersByProperty[property.id]!.length > 0 ? (
                            <ul className="space-y-2 max-h-64 overflow-y-auto">
                              {buyersByProperty[property.id]!.map((buyer) => (
                                <li key={buyer.id} className="p-2 rounded bg-gray-50 hover:bg-gray-100">
                                  <div className="text-sm font-medium">{buyer.firstName} {buyer.lastName}</div>
                                  {buyer.phone && (
                                    <div className="text-xs text-gray-600">{buyer.phone}</div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-sm text-gray-600 py-4">
                              Nessun cliente interessato trovato
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {property.matchPercentage && (
                      <Badge className="ml-2 bg-green-100 text-green-800 text-xs">
                        Match {property.matchPercentage}%
                      </Badge>
                    )}
                  </div>
                  
                  <Link href={`/properties/shared/${property.id}`}>
                    <Button size="sm" variant="ghost" className="text-xs">
                      Dettagli <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-4 flex justify-center">
          <Link href="/properties/shared">
            <button className="px-3 py-1 text-sm border rounded hover:bg-slate-50">
              Visualizza tutte le proprietà condivise
            </button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function SharedPropertiesRankingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proprietà Condivise</CardTitle>
        <CardDescription>Classifica per potenziali interessati</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-md p-3">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center">
                    <Skeleton className="h-6 w-6 rounded-full mr-2" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <div className="flex items-center mt-1">
                    <Skeleton className="h-4 w-56" />
                  </div>
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
              
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex justify-center">
          <Skeleton className="h-9 w-48" />
        </div>
      </CardContent>
    </Card>
  );
}