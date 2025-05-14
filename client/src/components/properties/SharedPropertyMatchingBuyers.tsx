import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  Button,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Badge
} from "@/components/ui";
import { 
  AlertCircle,
  Ban,
  User,
  Phone,
  Mail,
  Info,
  Lock
} from "lucide-react";
import { ClientWithDetails } from "@shared/schema";
import { Link } from "wouter";

interface SharedPropertyMatchingBuyersProps {
  sharedPropertyId: number;
  isAcquired: boolean;
}

export default function SharedPropertyMatchingBuyers({ 
  sharedPropertyId, 
  isAcquired 
}: SharedPropertyMatchingBuyersProps) {
  // Fetch matching buyers
  const { 
    data: matchingBuyers, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/shared-properties', sharedPropertyId, 'matching-buyers'],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/shared-properties/${sharedPropertyId}/matching-buyers`);
        if (!response.ok) {
          throw new Error("Errore nel caricamento dei potenziali acquirenti");
        }
        return response.json() as Promise<ClientWithDetails[]>;
      } catch (error) {
        console.error("Errore nel caricamento dei potenziali acquirenti:", error);
        throw error;
      }
    }
  });

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Potenziali Interessati</CardTitle>
          <CardDescription>Clienti che potrebbero essere interessati a questa proprietà</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center p-3 border rounded-md">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="ml-3 flex-1">
                  <Skeleton className="h-5 w-40 mb-1" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6 border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Potenziali Interessati</CardTitle>
          <CardDescription>Clienti che potrebbero essere interessati a questa proprietà</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-600">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Si è verificato un errore nel caricamento dei potenziali interessati.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedBuyers = matchingBuyers?.sort((a, b) => {
    // First by search criteria match (would be implemented on backend)
    if (a.matchPercentage !== undefined && b.matchPercentage !== undefined) {
      return b.matchPercentage - a.matchPercentage;
    }
    // Then by urgency if available
    if (a.buyer?.urgency && b.buyer?.urgency) {
      return b.buyer.urgency - a.buyer.urgency;
    }
    // Then by name
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  }) || [];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">Potenziali Interessati</CardTitle>
            <CardDescription>
              {sortedBuyers.length} client{sortedBuyers.length !== 1 ? "i" : "e"} potrebber{sortedBuyers.length !== 1 ? "o" : "e"} essere interessat{sortedBuyers.length !== 1 ? "i" : "o"} a questa proprietà
            </CardDescription>
          </div>
          
          {!isAcquired && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center text-amber-600">
                    <Lock className="h-4 w-4 mr-1" />
                    <span className="text-xs">Notifiche bloccate</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Non puoi inviare notifiche ai clienti finché la proprietà non viene acquisita.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedBuyers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <User className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>Nessun cliente potenzialmente interessato</p>
            <p className="text-sm mt-1">Non ci sono abbinamenti tra questa proprietà e i clienti nel database</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedBuyers.map((client) => {
              const matchPercent = client.matchPercentage || 0;
              let matchColor = "bg-amber-100 text-amber-800";
              
              if (matchPercent >= 90) {
                matchColor = "bg-green-100 text-green-800";
              } else if (matchPercent >= 75) {
                matchColor = "bg-emerald-100 text-emerald-800";
              } else if (matchPercent >= 60) {
                matchColor = "bg-blue-100 text-blue-800";
              }
              
              return (
                <div key={client.id} className="border rounded-md p-3 flex flex-wrap md:flex-nowrap justify-between items-center">
                  <div className="flex items-center mb-2 md:mb-0 w-full md:w-auto">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-100 text-primary-600">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="ml-3">
                      <h4 className="font-medium">{client.firstName} {client.lastName}</h4>
                      <div className="flex items-center text-sm text-gray-500 space-x-3">
                        {client.phone && (
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            <span>{client.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 w-full md:w-auto">
                    <Badge className={matchColor}>
                      Match {matchPercent}%
                    </Badge>
                    
                    <div className="flex space-x-1">
                      <Link href={`/clients/${client.id}`}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs"
                        >
                          <Info className="h-3.5 w-3.5 mr-1" />
                          Dettagli
                        </Button>
                      </Link>
                      
                      {isAcquired ? (
                        <Button 
                          size="sm" 
                          className="h-8 text-xs"
                          disabled={false}
                        >
                          Notifica
                        </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="sm" 
                                className="h-8 text-xs"
                                disabled={true}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                Notifica
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Acquisisci prima la proprietà per poter inviare notifiche</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}