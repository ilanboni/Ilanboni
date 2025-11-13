import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PropertyAttachment } from "@shared/schema";

export function useSharedPropertyAttachments(sharedPropertyId: number) {
  return useQuery<PropertyAttachment[]>({
    queryKey: ['/api/shared-properties', sharedPropertyId, 'attachments'],
    queryFn: async () => {
      const response = await fetch(`/api/shared-properties/${sharedPropertyId}/attachments`);
      if (!response.ok) throw new Error('Errore caricamento allegati');
      return response.json();
    },
    enabled: !!sharedPropertyId
  });
}

export function useUploadPropertyAttachment(sharedPropertyId: number) {
  return useMutation({
    mutationFn: async ({ file, category, notes }: { file: File; category: string; notes?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      if (notes) formData.append('notes', notes);

      const response = await fetch(`/api/shared-properties/${sharedPropertyId}/attachments`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore durante l\'upload');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/shared-properties', sharedPropertyId, 'attachments']
      });
    }
  });
}

export function useDeletePropertyAttachment(sharedPropertyId: number) {
  return useMutation({
    mutationFn: async (attachmentId: number) => {
      return await apiRequest(`/api/shared-properties/${sharedPropertyId}/attachments/${attachmentId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/shared-properties', sharedPropertyId, 'attachments']
      });
    }
  });
}
