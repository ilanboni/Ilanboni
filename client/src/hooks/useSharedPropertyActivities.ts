import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PropertyActivity, InsertPropertyActivity } from "@shared/schema";

export function useSharedPropertyActivities(sharedPropertyId: number) {
  return useQuery<PropertyActivity[]>({
    queryKey: ['/api/shared-properties', sharedPropertyId, 'activities'],
    queryFn: async () => {
      const response = await fetch(`/api/shared-properties/${sharedPropertyId}/activities`);
      if (!response.ok) throw new Error('Errore caricamento attività');
      return response.json();
    },
    enabled: !!sharedPropertyId
  });
}

export function useCreatePropertyActivity(sharedPropertyId: number) {
  return useMutation({
    mutationFn: async (data: Omit<InsertPropertyActivity, 'sharedPropertyId'>) => {
      return await apiRequest(`/api/shared-properties/${sharedPropertyId}/activities`, {
        method: 'POST',
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/shared-properties', sharedPropertyId, 'activities']
      });
    }
  });
}

export function useUpdatePropertyActivity(sharedPropertyId: number) {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertPropertyActivity> }) => {
      return await apiRequest(`/api/shared-properties/${sharedPropertyId}/activities/${id}`, {
        method: 'PATCH',
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/shared-properties', sharedPropertyId, 'activities']
      });
    }
  });
}

export function useDeletePropertyActivity(sharedPropertyId: number) {
  return useMutation({
    mutationFn: async (activityId: number) => {
      return await apiRequest(`/api/shared-properties/${sharedPropertyId}/activities/${activityId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/shared-properties', sharedPropertyId, 'activities']
      });
    }
  });
}
