import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ClientWithDetails, ClientType } from "@/types";
import ClientForm from "@/components/clients/ClientForm";
import { apiRequest } from "@/lib/queryClient";
import { Helmet } from "react-helmet";

export default function ClientsByTypePage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Determine if we're creating a new client or editing an existing one
  const isNewClient = params.type === "new";
  const isEditMode = params.type.startsWith("edit/");
  const clientId = isEditMode ? parseInt(params.type.replace("edit/", "")) : null;
  
  // Set appropriate client type based on URL or default to "buyer" for new clients
  const [clientType, setClientType] = useState<ClientType>("buyer");
  
  // For edit mode, fetch the client data
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ['/api/clients', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      // This would be replaced with a real API call
      // In a real app, we would fetch the client from the server
      const mockClients: ClientWithDetails[] = [
        {
          id: 1,
          type: "buyer",
          salutation: "dott",
          firstName: "Marco",
          lastName: "Bianchi",
          isFriend: true,
          phone: "+39 123 456 7890",
          email: "marco.bianchi@example.com",
          religion: "christian",
          contractType: "sale",
          createdAt: "2023-05-15T10:30:00Z",
          updatedAt: "2023-06-20T15:45:00Z",
          buyer: {
            id: 1,
            clientId: 1,
            minSize: 80,
            maxPrice: 350000,
            urgency: 4,
            rating: 5,
            searchNotes: "Cerca appartamento in zona centrale con terrazzo"
          }
        },
        {
          id: 2,
          type: "seller",
          salutation: "sig.ra",
          firstName: "Laura",
          lastName: "Rossi",
          isFriend: false,
          phone: "+39 333 123 4567",
          email: "laura.rossi@example.com",
          birthday: "1975-08-22",
          contractType: "sale",
          createdAt: "2023-04-10T09:15:00Z",
          updatedAt: "2023-05-05T11:20:00Z",
          seller: {
            id: 1,
            clientId: 2,
            propertyId: 1
          }
        }
      ];
      
      const foundClient = mockClients.find(c => c.id === clientId);
      if (foundClient) {
        setClientType(foundClient.type as ClientType);
        return foundClient;
      }
      
      return null;
    },
    enabled: isEditMode && !!clientId
  });
  
  // Create mutation for saving client data
  const saveClientMutation = useMutation({
    mutationFn: async (data: any) => {
      // This would be replaced with a real API call
      // const method = isEditMode ? 'PUT' : 'POST';
      // const url = isEditMode ? `/api/clients/${clientId}` : '/api/clients';
      // return apiRequest(method, url, data);
      
      // For now, just simulate a successful API call
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, data });
        }, 1000);
      });
    },
    onSuccess: () => {
      // Invalidate clients query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      
      // Show success message
      toast({
        title: isEditMode ? "Cliente aggiornato" : "Cliente creato",
        description: isEditMode 
          ? "Il cliente è stato aggiornato con successo." 
          : "Il nuovo cliente è stato creato con successo.",
      });
      
      // Navigate back to clients list
      navigate("/clients");
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: `Si è verificato un errore durante il ${isEditMode ? 'aggiornamento' : 'salvataggio'} del cliente.`,
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const handleSubmit = (data: any) => {
    saveClientMutation.mutate(data);
  };
  
  // Handle cancel button click
  const handleCancel = () => {
    navigate("/clients");
  };
  
  // Set page title based on mode
  const pageTitle = isNewClient 
    ? "Nuovo Cliente" 
    : isEditMode 
      ? "Modifica Cliente" 
      : "Dettaglio Cliente";
  
  // Handle loading state
  if (isEditMode && isLoadingClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento informazioni cliente...</p>
        </div>
      </div>
    );
  }
  
  // Handle client not found in edit mode
  if (isEditMode && !isLoadingClient && !client) {
    return (
      <div className="bg-red-50 text-red-800 p-6 rounded-lg text-center">
        <h2 className="text-xl font-bold mb-2">Cliente non trovato</h2>
        <p className="mb-4">Il cliente che stai cercando di modificare non esiste.</p>
        <button 
          onClick={() => navigate("/clients")}
          className="bg-red-800 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Torna alla lista
        </button>
      </div>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>{pageTitle} | RealEstate CRM</title>
        <meta 
          name="description" 
          content={isNewClient 
            ? "Crea un nuovo cliente compratore o venditore" 
            : "Modifica i dettagli del cliente"
          } 
        />
      </Helmet>
      
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-gray-900">{pageTitle}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {isNewClient 
            ? "Inserisci i dettagli del nuovo cliente" 
            : "Modifica i dettagli del cliente esistente"
          }
        </p>
      </div>
      
      {/* Client Form */}
      <ClientForm
        initialData={client}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={saveClientMutation.isPending}
      />
    </>
  );
}
