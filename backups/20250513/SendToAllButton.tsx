import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, SendIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface SendToAllButtonProps {
  propertyId: number;
  buyers: any[];
  onSuccess?: () => void;
}

export default function SendToAllButton({ propertyId, buyers, onSuccess }: SendToAllButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSendToAll = async () => {
    try {
      const clientsToNotify = buyers.filter(b => !b.notificationStatus?.notified);
      
      if (clientsToNotify.length === 0) {
        toast({
          title: "Nessun cliente da notificare",
          description: "Non ci sono clienti in attesa di notifica.",
          variant: "destructive"
        });
        return;
      }
      
      const confirmSend = window.confirm(`Sei sicuro di voler inviare una notifica a tutti i ${clientsToNotify.length} clienti?`);
      if (!confirmSend) return;
      
      // Teniamo traccia di successi e fallimenti
      let successCount = 0;
      let failureCount = 0;
      
      setIsLoading(true);
      
      for (const buyer of clientsToNotify) {
        try {
          await fetch(`/api/clients/${buyer.id}/send-property/${propertyId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          successCount++;
        } catch (error) {
          console.error(`Errore nell'invio al cliente ${buyer.id}:`, error);
          failureCount++;
        }
      }
      
      // Messaggi di risposta
      if (successCount > 0) {
        toast({
          title: "Notifica inviata con successo",
          description: `${successCount} clienti sono stati notificati.${failureCount > 0 ? ` ${failureCount} notifiche fallite.` : ''}`,
          variant: "default"
        });
        
        // Aggiorna anche i dati notificati
        queryClient.invalidateQueries({ queryKey: ['/api/properties', propertyId, 'buyers-with-notification-status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/properties', propertyId, 'notified-buyers'] });
        
        // Callback di successo
        if (failureCount === 0 && onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: "Errore nell'invio",
          description: "Non è stato possibile notificare i clienti.",
          variant: "destructive"
        });
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Errore globale:', error);
      setIsLoading(false);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio massivo.",
        variant: "destructive"
      });
    }
  };

  return (
    <Button 
      size="sm" 
      className="bg-green-600 hover:bg-green-700"
      onClick={handleSendToAll}
      disabled={isLoading}
    >
      {isLoading ? (
        <div className="flex items-center gap-1">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Invio in corso...</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <SendIcon className="h-4 w-4" />
          <span>Invia a tutti</span>
        </div>
      )}
    </Button>
  );
}