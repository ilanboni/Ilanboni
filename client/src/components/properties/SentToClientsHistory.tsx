import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  CheckCircle, 
  MessageSquare, 
  RefreshCw,
  User,
  Phone,
  Mail,
  ThumbsUp,
  ThumbsDown,
  Minus,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface SentToClient {
  id: number;
  clientId: number;
  sentAt: string;
  messageType: string;
  messageContent: string;
  clientResponseReceived: boolean;
  responseContent: string | null;
  responseSentiment: string | null;
  responseAnalysis: string | null;
  responseReceivedAt: string | null;
  resendScheduled: boolean;
  resendAt: string | null;
  // Dati del cliente
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientType: string;
}

interface SentToClientsHistoryProps {
  sharedPropertyId: number;
}

export default function SentToClientsHistory({ sharedPropertyId }: SentToClientsHistoryProps) {
  const { data: sentToClients, isLoading } = useQuery<SentToClient[]>({
    queryKey: ['/api/shared-properties', sharedPropertyId, 'sent-to-clients'],
    enabled: !!sharedPropertyId,
  });

  const getSentimentIcon = (sentiment: string | null) => {
    if (!sentiment) return <Minus className="h-4 w-4 text-gray-400" />;
    
    switch (sentiment) {
      case 'positive':
        return <ThumbsUp className="h-4 w-4 text-green-500" />;
      case 'negative':
        return <ThumbsDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'negative':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'neutral':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getMessageTypeColor = (messageType: string) => {
    return messageType === 'formal' 
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-purple-50 text-purple-700 border-purple-200';
  };

  const getClientTypeBadge = (type: string) => {
    return type === 'buyer' 
      ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Acquirente</Badge>
      : <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Venditore</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Inviato a Clienti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            Caricamento cronologia invii...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sentToClients || !Array.isArray(sentToClients) || sentToClients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Inviato a Clienti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            <User className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p>Nessun cliente ha ricevuto questo immobile</p>
            <p className="text-sm mt-2">Gli invii ai clienti appariranno qui automaticamente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Inviato a Clienti ({sentToClients?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sentToClients?.map((sent: SentToClient) => {
          const clientFullName = `${sent.clientFirstName} ${sent.clientLastName}`;

          return (
            <div key={sent.id} className="border rounded-lg p-4 space-y-3">
              {/* Header dell'invio */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link 
                    href={`/clients/${sent.clientId}`}
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                    data-testid={`link-client-${sent.clientId}`}
                  >
                    {clientFullName}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  {getClientTypeBadge(sent.clientType)}
                  <Badge className={getMessageTypeColor(sent.messageType)}>
                    {sent.messageType === 'formal' ? 'Formale' : 'Informale'}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500">
                  {format(new Date(sent.sentAt), 'dd MMM yyyy • HH:mm', { locale: it })}
                </div>
              </div>

              {/* Informazioni contatto cliente */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start gap-3 flex-wrap text-sm text-gray-600">
                  {sent.clientPhone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {sent.clientPhone}
                    </div>
                  )}
                  {sent.clientEmail && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {sent.clientEmail}
                    </div>
                  )}
                </div>
              </div>

              {/* Stato della risposta */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {sent.clientResponseReceived ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-700">Risposta ricevuta</span>
                      {getSentimentIcon(sent.responseSentiment)}
                      {sent.responseSentiment && (
                        <Badge className={`text-xs ${getSentimentColor(sent.responseSentiment)}`}>
                          {sent.responseSentiment === 'positive' ? 'Interessato' : 
                           sent.responseSentiment === 'negative' ? 'Non interessato' : 'Neutrale'}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-yellow-700">In attesa di risposta</span>
                    </>
                  )}
                </div>

                {/* Stato del reinvio */}
                {!sent.clientResponseReceived && sent.resendScheduled && sent.resendAt && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <RefreshCw className="h-3 w-3" />
                    <span>
                      Reinvio: {format(new Date(sent.resendAt), 'dd MMM yyyy', { locale: it })}
                    </span>
                  </div>
                )}
              </div>

              {/* Contenuto della risposta se presente */}
              {sent.clientResponseReceived && sent.responseContent && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-900 mb-1">
                        Risposta del cliente:
                      </div>
                      <div className="text-sm text-blue-800">
                        "{sent.responseContent}"
                      </div>
                      {sent.responseReceivedAt && (
                        <div className="text-xs text-blue-600 mt-1">
                          {format(new Date(sent.responseReceivedAt), 'dd MMM yyyy • HH:mm', { locale: it })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Analisi IA se presente */}
              {sent.responseAnalysis && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-purple-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-purple-900 mb-1">
                        Analisi IA:
                      </div>
                      <div className="text-sm text-purple-800">
                        {sent.responseAnalysis}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
