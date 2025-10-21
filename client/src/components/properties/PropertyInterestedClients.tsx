import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Phone,
  Mail,
  MessageSquare,
  TrendingUp,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "wouter";

interface PropertyMatch {
  taskId: number;
  clientId: number;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  score: number;
  type: string;
  maxPrice: number | null;
  urgency: number | null;
  status: string;
  createdAt: string;
}

interface PropertyInterestedClientsProps {
  propertyId: number;
}

export default function PropertyInterestedClients({ propertyId }: PropertyInterestedClientsProps) {
  const { data: matches, isLoading } = useQuery<PropertyMatch[]>({
    queryKey: [`/api/properties/${propertyId}/matches`, { since: '1d' }],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${propertyId}/matches?since=1d`);
      if (!response.ok) throw new Error('Errore caricamento clienti interessati');
      return response.json();
    },
    enabled: !!propertyId,
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'WHATSAPP_SEND':
        return <MessageSquare className="h-4 w-4" />;
      case 'CALL_OWNER':
        return <Phone className="h-4 w-4" />;
      case 'CALL_AGENCY':
        return <Phone className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'WHATSAPP_SEND':
        return 'WhatsApp inviato';
      case 'CALL_OWNER':
        return 'Chiama proprietario';
      case 'CALL_AGENCY':
        return 'Chiama agenzia';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'WHATSAPP_SEND':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'CALL_OWNER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CALL_AGENCY':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getUrgencyColor = (urgency: number | null) => {
    if (!urgency) return 'bg-gray-100 text-gray-600';
    if (urgency >= 4) return 'bg-red-100 text-red-700';
    if (urgency >= 3) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  const getUrgencyLabel = (urgency: number | null) => {
    if (!urgency) return 'N/A';
    if (urgency >= 4) return 'Alta';
    if (urgency >= 3) return 'Media';
    return 'Bassa';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clienti Interessati
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Caricamento clienti...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clienti Interessati
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Nessun cliente interessato nelle ultime 24 ore
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Clienti Interessati
          <Badge variant="secondary" className="ml-2">
            {matches.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {matches.map((match) => (
          <div
            key={match.taskId}
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            data-testid={`client-match-${match.clientId}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Link href={`/clients/${match.clientId}`}>
                    <span className="font-medium cursor-pointer hover:text-blue-600">
                      {match.clientName}
                    </span>
                  </Link>
                  <Badge variant="secondary">
                    Score: {match.score}%
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className={getTypeColor(match.type)} variant="outline">
                    {getTypeIcon(match.type)}
                    <span className="ml-1">{getTypeLabel(match.type)}</span>
                  </Badge>
                  
                  {match.urgency && (
                    <Badge className={getUrgencyColor(match.urgency)} variant="outline">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Urgenza: {getUrgencyLabel(match.urgency)}
                    </Badge>
                  )}
                  
                  {match.status === 'open' && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      Da contattare
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-1 text-sm text-gray-600">
                  {match.clientPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${match.clientPhone}`} className="hover:text-blue-600">
                        {match.clientPhone}
                      </a>
                    </div>
                  )}
                  {match.clientEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <a href={`mailto:${match.clientEmail}`} className="hover:text-blue-600">
                        {match.clientEmail}
                      </a>
                    </div>
                  )}
                  {match.maxPrice && (
                    <div className="text-xs text-gray-500">
                      Budget massimo: €{match.maxPrice.toLocaleString('it-IT')}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500">
                  Match creato {format(new Date(match.createdAt), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  data-testid={`button-view-client-${match.clientId}`}
                >
                  <Link href={`/clients/${match.clientId}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Vedi scheda
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
