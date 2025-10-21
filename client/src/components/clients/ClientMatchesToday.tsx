import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  MapPin, 
  Euro, 
  ExternalLink,
  Phone,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "wouter";

interface ClientMatch {
  taskId: number;
  propertyId: number;
  title: string;
  address: string;
  priceEur: number | null;
  score: number;
  type: string;
  url: string | null;
  status: string;
  createdAt: string;
}

interface ClientMatchesTodayProps {
  clientId: number;
}

export default function ClientMatchesToday({ clientId }: ClientMatchesTodayProps) {
  const { data: matches, isLoading } = useQuery<ClientMatch[]>({
    queryKey: [`/api/clients/${clientId}/matches`, { since: '1d' }],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/matches?since=1d`);
      if (!response.ok) throw new Error('Errore caricamento match');
      return response.json();
    },
    enabled: !!clientId,
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'WHATSAPP_SEND':
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'CALL_OWNER':
        return <Phone className="h-4 w-4 text-blue-600" />;
      case 'CALL_AGENCY':
        return <Phone className="h-4 w-4 text-purple-600" />;
      default:
        return <Sparkles className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'WHATSAPP_SEND':
        return 'WhatsApp';
      case 'CALL_OWNER':
        return 'Chiama Proprietario';
      case 'CALL_AGENCY':
        return 'Chiama Agenzia';
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Matching di Oggi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Caricamento match...
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
            <Sparkles className="h-5 w-5" />
            Matching di Oggi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Nessun match trovato nelle ultime 24 ore
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Matching di Oggi
          <Badge variant="secondary" className="ml-2">
            {matches.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.map((match) => (
          <div
            key={match.taskId}
            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            data-testid={`match-card-${match.propertyId}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={getTypeColor(match.type)} variant="outline">
                    {getTypeIcon(match.type)}
                    <span className="ml-1">{getTypeLabel(match.type)}</span>
                  </Badge>
                  <Badge variant="secondary">
                    Score: {match.score}%
                  </Badge>
                  {match.status === 'open' && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      Da completare
                    </Badge>
                  )}
                </div>

                <Link href={`/properties/${match.propertyId}`}>
                  <div className="flex items-start gap-2 cursor-pointer hover:text-blue-600">
                    <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                    <span className="font-medium">{match.address}</span>
                  </div>
                </Link>

                {match.priceEur && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Euro className="h-4 w-4" />
                    <span>{match.priceEur.toLocaleString('it-IT')} €</span>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  {format(new Date(match.createdAt), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {match.url && (
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    data-testid={`button-view-property-${match.propertyId}`}
                  >
                    <a href={match.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Vedi annuncio
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
