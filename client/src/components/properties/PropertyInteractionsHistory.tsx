import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  MessageSquare, 
  Phone,
  Building2,
  User,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "wouter";

interface Client {
  id: number;
  name: string;
  phone: string;
}

interface PropertyInteraction {
  id: number;
  channel: string;
  client: Client | null;
  payload: any;
  createdAt: string;
}

interface PropertyInteractionsHistoryProps {
  propertyId: number;
  days?: number;
}

export default function PropertyInteractionsHistory({ propertyId, days = 30 }: PropertyInteractionsHistoryProps) {
  const { data: interactions, isLoading } = useQuery<PropertyInteraction[]>({
    queryKey: [`/api/properties/${propertyId}/interactions`, { since: `${days}d` }],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${propertyId}/interactions?since=${days}d`);
      if (!response.ok) throw new Error('Errore caricamento interactions');
      return response.json();
    },
    enabled: !!propertyId,
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'call_owner':
        return <Phone className="h-4 w-4 text-blue-600" />;
      case 'call_agency':
        return <Building2 className="h-4 w-4 text-purple-600" />;
      default:
        return <History className="h-4 w-4 text-gray-600" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'WhatsApp';
      case 'call_owner':
        return 'Chiamata Proprietario';
      case 'call_agency':
        return 'Chiamata Agenzia';
      default:
        return channel;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'call_owner':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'call_agency':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Cronologia Azioni (ultimi {days} giorni)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Caricamento cronologia...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!interactions || interactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Cronologia Azioni (ultimi {days} giorni)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Nessuna azione negli ultimi {days} giorni
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Cronologia Azioni (ultimi {days} giorni)
          <Badge variant="secondary" className="ml-2">
            {interactions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {interactions.map((interaction) => (
          <div
            key={interaction.id}
            className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
            data-testid={`interaction-${interaction.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={getChannelColor(interaction.channel)} variant="outline">
                    {getChannelIcon(interaction.channel)}
                    <span className="ml-1">{getChannelLabel(interaction.channel)}</span>
                  </Badge>
                  
                  {interaction.payload?.sent === false && (
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                      Task creato
                    </Badge>
                  )}
                  
                  {interaction.payload?.sent === true && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Inviato
                    </Badge>
                  )}
                </div>

                {interaction.client && (
                  <Link href={`/clients/${interaction.client.id}`}>
                    <div className="flex items-center gap-2 cursor-pointer hover:text-blue-600">
                      <User className="h-4 w-4" />
                      <span className="text-sm font-medium">{interaction.client.name}</span>
                      {interaction.client.phone && (
                        <span className="text-sm text-gray-500">({interaction.client.phone})</span>
                      )}
                    </div>
                  </Link>
                )}

                {interaction.payload?.message && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {interaction.payload.message}
                  </p>
                )}

                {interaction.payload?.action && (
                  <p className="text-sm text-gray-600">
                    <strong>Azione:</strong> {interaction.payload.action}
                  </p>
                )}

                <div className="text-xs text-gray-500">
                  {format(new Date(interaction.createdAt), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
