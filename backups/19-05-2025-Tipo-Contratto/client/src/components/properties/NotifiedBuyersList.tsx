import { useState, useEffect } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface NotifiedBuyersListProps {
  propertyId: number;
}

export default function NotifiedBuyersList({ propertyId }: NotifiedBuyersListProps) {
  const [notifiedBuyers, setNotifiedBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Carica i dati dei clienti già notificati
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/properties/${propertyId}/notified-buyers`);
        if (!response.ok) {
          throw new Error("Errore nel caricamento dei clienti notificati");
        }
        const data = await response.json();
        setNotifiedBuyers(data);
      } catch (error) {
        console.error("Errore:", error);
      } finally {
        setLoading(false);
      }
    }
    
    if (propertyId) {
      loadData();
    }
  }, [propertyId]);

  // Formatta la data
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy HH:mm");
    } catch (e) {
      return dateString;
    }
  };

  // Ottiene il badge per lo stato della notifica
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-blue-100 text-blue-800">Inviato</Badge>;
      case "delivered":
        return <Badge className="bg-green-100 text-green-800">Consegnato</Badge>;
      case "read":
        return <Badge className="bg-purple-100 text-purple-800">Letto</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Fallito</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">In attesa</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completato</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin text-3xl text-gray-300">
          <i className="fas fa-spinner"></i>
        </div>
      </div>
    );
  }

  if (notifiedBuyers.length === 0) {
    return (
      <div className="py-10 text-center text-gray-500">
        <div className="text-5xl mb-4 text-gray-300">
          <i className="fas fa-info-circle"></i>
        </div>
        <p className="text-lg font-medium">Nessun cliente notificato</p>
        <p className="mt-1">Questo immobile non è stato inviato ad alcun cliente.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Contatti</TableHead>
          <TableHead>Data invio</TableHead>
          <TableHead>Stato</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notifiedBuyers.map((buyer) => (
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
              {buyer.communicationDate ? formatDate(buyer.communicationDate) : 'N/D'}
            </TableCell>
            <TableCell>
              {getStatusBadge(buyer.communicationStatus || 'unknown')}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}