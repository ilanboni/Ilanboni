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
  const { toast } = useToast();

  // Fetch multi-agency properties near Duomo (500m radius)
  const { data: sharedProperties, isLoading, isError } = useQuery({
    queryKey: ['/api/scraped-properties/multi-agency'],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/scraped-properties/multi-agency`);
        if (!response.ok) {
          throw new Error('Errore nel caricamento delle proprietà multi-agency');
        }
        return response.json() as Promise<SharedProperty[]>;
      } catch (error) {
        console.error("Errore nel caricamento delle proprietà multi-agency:", error);
        throw error;
      }
    },
    retry: 1,
    retryDelay: 1000
  });

  if (isError) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Proprietà Multi-Agency</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">
          Si è verificato un errore nel caricamento delle proprietà multi-agency.
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Proprietà Multi-Agency</h1>
          <p className="text-gray-600 mt-1">Proprietà entro 500m dal Duomo gestite da 2 o più agenzie diverse</p>
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
          {(!sharedProperties || sharedProperties.length === 0) ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-600 mb-2">Nessuna proprietà multi-agency trovata entro 500m dal Duomo</p>
              <p className="text-sm text-gray-500">Le proprietà multi-agency appaiono qui quando vengono scrapate per clienti con rating 4-5</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedProperties.map((property) => (
                <Link key={property.id} href={`/properties/shared/${property.id}`}>
                  <a className="block h-full">
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
                  </a>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}