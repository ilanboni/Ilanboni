import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ClientType } from "@/types";
import { ClientWithDetails } from "@shared/schema";
import ClientForm from "@/components/clients/ClientForm";
import { apiRequest } from "@/lib/queryClient";
import { Helmet } from "react-helmet";
import { useClientPreferences } from "@/hooks/useClientPreferences";

export default function ClientsByTypePage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Determine if we're creating a new client or editing an existing one
  const isNewClient = params.type === "new";
  
  // Controllo esplicito sui tipi di pattern URL per la modifica
  const isEditMode = (
    // Controlla prima i path pattern riconoscibili
    params.type === "edit" || 
    params.type === "modify" ||
    params.type?.startsWith("edit/") || 
    params.type?.startsWith("modify/") ||
    // Poi i pattern di ID numerici
    (params.type?.startsWith("edit") && !isNaN(parseInt(params.type.substring(4)))) ||
    (params.type?.startsWith("modify") && !isNaN(parseInt(params.type.substring(6)))) ||
    // Infine, controlla se c'è un ID esplicito nella route
    (!!params.id && !isNaN(parseInt(params.id)))
  );
  
  // Estrai l'ID cliente con controlli più rigorosi
  let clientId: number | null = null;
  if (isEditMode) {
    console.log("Debugging URLs - params:", params);
    
    // Controlla i parametri nell'ordine di priorità
    if (params.id && !isNaN(parseInt(params.id))) {
      // Caso /clients/:type/:id
      clientId = parseInt(params.id);
      console.log("ID trovato nel parametro id:", clientId);
    } else if (params.type?.startsWith("edit/")) {
      // Caso /clients/edit/123
      const idPart = params.type.substring(5);
      if (!isNaN(parseInt(idPart))) {
        clientId = parseInt(idPart);
        console.log("ID trovato nel formato edit/XXX:", clientId);
      }
    } else if (params.type?.startsWith("modify/")) {
      // Caso /clients/modify/123
      const idPart = params.type.substring(7);
      if (!isNaN(parseInt(idPart))) {
        clientId = parseInt(idPart);
        console.log("ID trovato nel formato modify/XXX:", clientId);
      }
    } else if (params.type?.startsWith("edit") && params.type.length > 4) {
      // Caso /clients/edit123
      const idPart = params.type.substring(4);
      if (!isNaN(parseInt(idPart))) {
        clientId = parseInt(idPart);
        console.log("ID trovato nel formato editXXX:", clientId);
      }
    } else if (params.type?.startsWith("modify") && params.type.length > 6) {
      // Caso /clients/modify123
      const idPart = params.type.substring(6);
      if (!isNaN(parseInt(idPart))) {
        clientId = parseInt(idPart);
        console.log("ID trovato nel formato modifyXXX:", clientId);
      }
    }
  }
  
  // Controlla se abbiamo un caso in cui si pensa di essere in modalità modifica ma non si ha ID cliente
  if (isEditMode && clientId === null) {
    console.warn("ATTENZIONE: Modalità modifica attiva ma clientId non trovato nei parametri:", params);
  }
  
  console.log("Editing mode details - isEditMode:", isEditMode, "clientId:", clientId, "isNewClient:", isNewClient);
  
  // Set appropriate client type based on URL or default to "buyer" for new clients
  const [clientType, setClientType] = useState<ClientType>("buyer");
  
  // For edit mode, fetch the client data
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ['/api/clients', clientId],
    // Quando in modalità modifica, usiamo l'API per ottenere i dati del cliente
    queryFn: async () => {
      if (!clientId) return null;
      const response = await apiRequest('GET', `/api/clients/${clientId}`);
      return await response.json();
    },
    enabled: isEditMode && !!clientId
  });
  
  // Per i clienti compratori in modalità modifica, recuperiamo anche i dati di ricerca
  const { data: buyerPreferences, isLoading: isLoadingPreferences } = useClientPreferences(
    isEditMode && !!clientId && client?.type === 'buyer' ? clientId : undefined
  );
  
  // Create mutation for saving client data
  const saveClientMutation = useMutation({
    mutationFn: async (data: any) => {
      // Usa API reali per salvare i dati del cliente
      const method = isEditMode ? 'PATCH' : 'POST';
      const url = isEditMode ? `/api/clients/${clientId}` : '/api/clients';
      
      try {
        const response = await apiRequest(method, url, data);
        
        // Se la risposta non è ok, tenta di ottenere i dettagli dell'errore
        if (!response.ok) {
          const errorData = await response.json();
          console.error("Errore risposta server:", errorData);
          throw new Error(errorData.error || "Errore sconosciuto");
        }
        
        return await response.json();
      } catch (error) {
        console.error("Errore durante la richiesta API:", error);
        throw error;
      }
    },
    onSuccess: (response) => {
      // Invalidate clients query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      
      // Show success message
      toast({
        title: isEditMode ? "Cliente aggiornato" : "Cliente creato",
        description: isEditMode 
          ? "Il cliente è stato aggiornato con successo." 
          : "Il nuovo cliente è stato creato con successo.",
      });
      
      if (isNewClient) {
        // Se è un nuovo cliente, reindirizza in base al tipo
        const newClientId = response.id;
        if (clientType === "buyer") {
          // Reindirizza alla pagina della ricerca immobili per il compratore
          navigate(`/clients/${newClientId}/search`);
        } else if (clientType === "seller") {
          // Reindirizza alla pagina di creazione immobile per il venditore
          navigate(`/properties/new?sellerId=${newClientId}`);
        }
      } else {
        // Se è una modifica, torna alla lista clienti
        navigate("/clients");
      }
    },
    onError: (error: any) => {
      console.error("Errore nella mutation:", error);
      
      let errorMessage = `Si è verificato un errore durante il ${isEditMode ? 'aggiornamento' : 'salvataggio'} del cliente.`;
      if (error && error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Errore",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });
  
  // Handle form submission
  const handleSubmit = (data: any) => {
    // Log dei dati ricevuti dal form per debug
    console.log("Dati form ricevuti:", data);
    
    // Aggiorna il tipo di cliente prima di inviare
    setClientType(data.type as ClientType);
    
    try {
      // Crea una versione semplificata dei dati del cliente, concentrandosi solo sui campi obbligatori
      const clientData: any = {
        type: data.type,
        salutation: data.salutation || "",
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        isFriend: !!data.isFriend,
        email: data.email || "",
        phone: data.phone || "",
        religion: data.religion || "",
        notes: data.notes || "",
      };
      
      // Rimuovi esplicitamente i campi problematici
      // Il server userà i valori di default per questi campi
      
      // Aggiungi i dati specifici in base al tipo di cliente in modo semplificato
      if (data.type === 'buyer') {
        clientData.buyer = {
          // Invia solo i dati più semplici possibile
          searchArea: data.searchArea || null,
          minSize: data.minSize ? parseInt(data.minSize, 10) : null,
          maxPrice: data.maxPrice ? parseInt(data.maxPrice, 10) : null,
          urgency: 3, // valore di default
          rating: 3,  // valore di default
          searchNotes: data.searchNotes || ""
        };
      } else if (data.type === 'seller') {
        clientData.seller = {
          propertyAddress: data.propertyAddress || "",
          propertyNotes: data.propertyNotes || ""
        };
      }
      
      // Log dei dati formattati per debug
      console.log("Dati semplificati inviati al server:", clientData);
      
      // Invia i dati formattati
      saveClientMutation.mutate(clientData);
    } catch (error) {
      console.error("Errore durante la preparazione dei dati:", error);
      toast({
        title: "Errore",
        description: `Si è verificato un errore durante la preparazione dei dati del cliente: ${error}`,
        variant: "destructive",
      });
    }
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
        buyerPreferences={buyerPreferences}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={saveClientMutation.isPending}
      />
    </>
  );
}
