import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ClientWithDetails, ClientType } from "@/types";

export default function RecentClients() {
  const [activeType, setActiveType] = useState<ClientType>("seller");
  
  // In a real app, we would fetch this data from the API
  // For this prototype, we'll use some sample data
  const { data: clients, isLoading } = useQuery({
    queryKey: ['/api/clients/recent', activeType],
    queryFn: async () => {
      // This would be replaced with a real API call
      return [
        {
          id: 1,
          firstName: "Paolo",
          lastName: "Bianchi",
          salutation: "dott",
          type: "seller",
          phone: "+391234567890",
          email: "paolo.bianchi@example.com",
          property: {
            address: "Via Mazzini, 45",
            size: 180,
            price: 420000
          },
          avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200"
        },
        {
          id: 2,
          firstName: "Laura",
          lastName: "Russo",
          salutation: "sig.ra",
          type: "seller",
          phone: "+391234567891",
          email: "laura.russo@example.com",
          property: {
            address: "Corso Vittorio, 12",
            size: 90,
            price: 295000
          },
          avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200"
        },
        {
          id: 3,
          firstName: "Marco",
          lastName: "Ferrari",
          salutation: "ing",
          type: "seller",
          phone: "+391234567892",
          email: "marco.ferrari@example.com",
          property: {
            address: "Via Garibaldi, 78",
            size: 150,
            price: 375000
          },
          avatarUrl: "https://images.unsplash.com/photo-1566492031773-4f4e44671857?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200"
        }
      ] as ClientWithDetails[];
    }
  });

  if (isLoading) {
    return <RecentClientsSkeleton />;
  }

  const toggleClientType = (type: ClientType) => {
    setActiveType(type);
  };

  const formatSalutation = (salutation: string): string => {
    switch (salutation) {
      case "egr_dott": return "Egr. Dott.";
      case "gentma_sigra": return "Gent.ma Sig.ra";
      case "egr_avvto": return "Egr. Avv.to";
      case "caro": return "Caro";
      case "cara": return "Cara";
      case "ciao": return "Ciao";
      default: return "";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg text-gray-800">Clienti Recenti</h2>
        <div className="flex space-x-2">
          <Button 
            variant={activeType === "buyer" ? "default" : "outline"}
            className={activeType === "buyer" 
              ? "px-3 py-1 text-xs bg-primary-600 text-white rounded-md" 
              : "px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"}
            onClick={() => toggleClientType("buyer")}
            size="sm"
          >
            Compratori
          </Button>
          <Button 
            variant={activeType === "seller" ? "default" : "outline"}
            className={activeType === "seller" 
              ? "px-3 py-1 text-xs bg-primary-600 text-white rounded-md" 
              : "px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"}
            onClick={() => toggleClientType("seller")}
            size="sm"
          >
            Venditori
          </Button>
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {clients?.map((client) => (
          <div key={client.id} className="px-5 py-4 flex items-start">
            <img 
              className="h-10 w-10 rounded-full bg-gray-200" 
              src={client.avatarUrl} 
              alt={`${client.firstName} ${client.lastName}`} 
            />
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {formatSalutation(client.salutation)} {client.firstName} {client.lastName}
                </p>
                <div className="flex items-center">
                  <span className="text-xs font-medium text-emerald-800 px-2 py-0.5 bg-emerald-100 rounded-full">
                    {client.type === "buyer" ? "Compratore" : "Venditore"}
                  </span>
                </div>
              </div>
              {client.property && (
                <p className="text-xs text-gray-500 mt-1">
                  {client.property.address} - {client.property.size}m² - €{client.property.price.toLocaleString()}
                </p>
              )}
              <div className="mt-2 flex items-center space-x-3 text-xs">
                <button className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-phone-alt mr-1"></i> Chiama
                </button>
                <button className="text-gray-500 hover:text-gray-700">
                  <i className="fas fa-envelope mr-1"></i> Email
                </button>
                <button className="text-gray-500 hover:text-gray-700">
                  <i className="fab fa-whatsapp mr-1"></i> WhatsApp
                </button>
              </div>
            </div>
          </div>
        ))}
        
        <div className="px-5 py-3 bg-gray-50 text-center">
          <a href={`/clients/${activeType}`} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Vedi tutti i clienti
          </a>
        </div>
      </div>
    </div>
  );
}

function RecentClientsSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <Skeleton className="h-6 w-36" />
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      
      <div className="divide-y divide-gray-200">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-5 py-4 flex items-start">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-48 mb-2" />
              <div className="flex space-x-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        ))}
        
        <div className="px-5 py-3 bg-gray-50 text-center">
          <Skeleton className="h-4 w-36 mx-auto" />
        </div>
      </div>
    </div>
  );
}
