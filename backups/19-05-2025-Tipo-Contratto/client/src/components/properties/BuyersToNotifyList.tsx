import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import SendToAllButton from "./SendToAllButton";

interface BuyersToNotifyListProps {
  propertyId: number;
  onTabChange?: (tab: string) => void;
}

export default function BuyersToNotifyList({ propertyId, onTabChange }: BuyersToNotifyListProps) {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Funzione per caricare i dati
  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/properties/${propertyId}/buyers-with-notification-status`);
      const data = await response.json();
      setBuyers(data);
      console.log("Caricati buyer con stato notifica:", data);
    } catch (error) {
      console.error("Errore nel caricamento buyer:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti da notificare",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Carica dati all'inizio
  useEffect(() => {
    if (propertyId) {
      loadData();
    }
  }, [propertyId]);

  // Filtra i buyer non ancora notificati
  const buyersToNotify = buyers.filter(b => !b.notificationStatus?.notified);

  // Gestisce l'invio a un singolo buyer
  const handleSendToOne = async (buyer: any) => {
    try {
      const response = await fetch(`/api/clients/${buyer.id}/send-property/${propertyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore durante l\'invio dell\'immobile');
      }

      toast({
        title: 'Immobile inviato',
        description: `Immobile inviato con successo a ${buyer.firstName} ${buyer.lastName}`,
      });

      // Ricarica i dati
      loadData();
      queryClient.invalidateQueries({ queryKey: ['/api/properties', propertyId, 'notified-buyers'] });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: error.message || "Si è verificato un errore durante l'invio",
      });
    }
  };

  // Callback dopo invio a tutti
  const handleSendToAllSuccess = () => {
    loadData();
    if (onTabChange) {
      onTabChange("notifiedBuyers");
    }
  };

  // Render del contenuto in base allo stato
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin text-3xl text-gray-300">
          <i className="fas fa-spinner"></i>
        </div>
      </div>
    );
  }

  if (buyersToNotify.length === 0) {
    return (
      <div className="py-10 text-center text-gray-500">
        <div className="text-5xl mb-4 text-gray-300">
          <i className="fas fa-check-circle"></i>
        </div>
        <p className="text-lg font-medium">Tutti i clienti sono stati notificati</p>
        <p className="mt-1">Nessun cliente deve essere ancora notificato per questo immobile.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {buyersToNotify.length} clienti pronti da notificare
        </div>
        <SendToAllButton 
          propertyId={propertyId} 
          buyers={buyers} 
          onSuccess={handleSendToAllSuccess} 
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Contatti</TableHead>
            <TableHead>Preferenze</TableHead>
            <TableHead className="text-right">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buyersToNotify.map((buyer) => (
            <TableRow key={buyer.id}>
              <TableCell className="font-medium">
                <div className="flex items-center">
                  <div>
                    <Link href={`/clients/${buyer.id}`} className="hover:underline">
                      {buyer.salutation ? `${buyer.salutation} ` : ""}
                      {buyer.firstName} {buyer.lastName}
                    </Link>
                    <div className="text-xs mt-1">
                      {buyer.isFriend ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">Amico</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {buyer.phone && (
                    <div className="mb-1">
                      <i className="fas fa-phone text-gray-400 mr-1 w-4"></i> {buyer.phone}
                    </div>
                  )}
                  {buyer.email && (
                    <div>
                      <i className="fas fa-envelope text-gray-400 mr-1 w-4"></i> {buyer.email}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {buyer.preferences?.maxPrice && (
                    <div className="mb-1">
                      <i className="fas fa-tag text-gray-400 mr-1 w-4"></i> Max: €{buyer.preferences.maxPrice.toLocaleString()}
                    </div>
                  )}
                  {buyer.preferences?.minSize && (
                    <div>
                      <i className="fas fa-home text-gray-400 mr-1 w-4"></i> Min: {buyer.preferences.minSize} mq
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleSendToOne(buyer)}
                >
                  <i className="fas fa-paper-plane mr-2"></i> Invia immobile
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}