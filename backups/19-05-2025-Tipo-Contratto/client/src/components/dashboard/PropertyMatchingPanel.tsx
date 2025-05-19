import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Match {
  id: number;
  property: {
    id: number;
    title: string;
    address: string;
    size: number;
    price: number;
    imageUrl: string;
  };
  matchPercentage: number;
  interestedClients: number;
}

export default function PropertyMatchingPanel() {
  // In a real app, we would fetch this data from the API
  // For this prototype, we'll use some sample data
  const { data: matches, isLoading } = useQuery({
    queryKey: ['/api/matches/recent'],
    queryFn: async () => {
      // This would be replaced with a real API call
      return [
        {
          id: 1,
          property: {
            id: 101,
            title: "Appartamento moderno con terrazzo",
            address: "Via Garibaldi, 28",
            size: 110,
            price: 350000,
            imageUrl: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200"
          },
          matchPercentage: 92,
          interestedClients: 5
        },
        {
          id: 2,
          property: {
            id: 102,
            title: "Villa con piscina e giardino",
            address: "Via dei Pini, 8",
            size: 250,
            price: 780000,
            imageUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200"
          },
          matchPercentage: 78,
          interestedClients: 3
        },
        {
          id: 3,
          property: {
            id: 103,
            title: "Loft in ex spazio industriale",
            address: "Via Torino, 42",
            size: 135,
            price: 420000,
            imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200"
          },
          matchPercentage: 86,
          interestedClients: 4
        }
      ] as Match[];
    }
  });

  if (isLoading) {
    return <PropertyMatchingPanelSkeleton />;
  }

  const renderMatchBadge = (percentage: number) => {
    let bgColor = "bg-amber-100";
    let textColor = "text-amber-800";
    
    if (percentage >= 90) {
      bgColor = "bg-green-100";
      textColor = "text-green-800";
    } else if (percentage >= 80) {
      bgColor = "bg-green-100";
      textColor = "text-green-800";
    }
    
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${bgColor} ${textColor}`}>
        Match al {percentage}%
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg text-gray-800">Match Immobiliari Recenti</h2>
        <a href="/matches" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Vedi tutti</a>
      </div>
      
      <div className="divide-y divide-gray-200">
        {matches?.map((match) => (
          <div key={match.id} className="px-5 py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex items-start space-x-4">
                <img 
                  src={match.property.imageUrl} 
                  alt={match.property.title}
                  className="h-16 w-20 object-cover rounded-md" 
                />
                
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{match.property.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {match.property.address} - {match.property.size}m² - €{match.property.price.toLocaleString()}
                  </p>
                  
                  <div className="mt-2 flex items-center">
                    {renderMatchBadge(match.matchPercentage)}
                    <span className="ml-2 text-xs text-gray-500">{match.interestedClients} clienti interessati</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 md:mt-0 flex items-center space-x-3">
                <Button size="sm" className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-md px-3 py-1.5">
                  <i className="fas fa-paper-plane mr-1"></i> Invia 
                </Button>
                <Button variant="outline" size="sm" className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-medium rounded-md px-3 py-1.5">
                  Dettagli
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyMatchingPanelSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      <div className="divide-y divide-gray-200">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-5 py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="flex items-start space-x-4">
                <Skeleton className="h-16 w-20 rounded-md" />
                
                <div>
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-40 mb-2" />
                  
                  <div className="mt-2 flex items-center">
                    <Skeleton className="h-4 w-24 rounded-full mr-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </div>
              
              <div className="mt-4 md:mt-0 flex items-center space-x-3">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
