import { useQuery } from '@tanstack/react-query';
import type { Buyer } from '@shared/schema';

/**
 * Hook per recuperare le preferenze di ricerca di un cliente compratore
 * @param clientId ID del cliente di cui recuperare le preferenze
 */
export function useClientPreferences(clientId?: number) {
  return useQuery({
    queryKey: ['/api/clients', clientId, 'preferences'],
    queryFn: async () => {
      if (!clientId) return null;
      
      const response = await fetch(`/api/clients/${clientId}/preferences`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // Nessuna preferenza trovata per questo cliente
          return null;
        }
        
        // Altri errori
        const error = await response.json();
        throw new Error(error.error || 'Errore durante il recupero delle preferenze del cliente');
      }
      
      return response.json() as Promise<Buyer>;
    },
    enabled: !!clientId, // Esegui la query solo se clientId è definito
    refetchOnWindowFocus: false,
  });
}