import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Settings, 
  MessageSquare,
  ExternalLink,
  Loader2
} from "lucide-react";

interface WebhookStatus {
  success: boolean;
  current_webhook?: string;
  ideal_webhook?: string;
  webhook_correctly_configured?: boolean;
  instance_id?: string;
  instructions?: string;
  error?: string;
}

interface RecentMessages {
  success: boolean;
  total_messages?: number;
  incoming_messages?: number;
  recent_messages?: Array<{
    id: string;
    from: string;
    body: string;
    timestamp: string;
  }>;
  error?: string;
}

export default function WhatsAppDiagnosticPage() {
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);

  // Query per verificare lo stato del webhook
  const { data: webhookStatus, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery<WebhookStatus>({
    queryKey: ['/api/whatsapp/diagnostic/check-webhook'],
  });

  // Query per ottenere messaggi recenti
  const { data: recentMessages, isLoading: isLoadingMessages, refetch: refetchMessages } = useQuery<RecentMessages>({
    queryKey: ['/api/whatsapp/diagnostic/test-messages'],
    enabled: false, // Non caricare automaticamente, solo su richiesta
  });

  // Mutation per configurare automaticamente il webhook
  const configureMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/whatsapp/diagnostic/configure-webhook', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Configurazione completata",
        description: "Il webhook UltraMsg è stato configurato correttamente",
      });
      // Ricarica lo stato del webhook
      refetchStatus();
    },
    onError: (error: any) => {
      toast({
        title: "Errore nella configurazione",
        description: error.message || "Impossibile configurare il webhook automaticamente",
        variant: "destructive",
      });
    },
  });

  const handleFetchMessages = () => {
    refetchMessages();
  };

  const handleConfigureWebhook = () => {
    configureMutation.mutate();
  };

  const maskInstanceId = (instanceId?: string) => {
    if (!instanceId) return "N/A";
    if (instanceId.length <= 8) return instanceId;
    return `${instanceId.substring(0, 4)}***${instanceId.substring(instanceId.length - 4)}`;
  };

  return (
    <>
      <Helmet>
        <title>Diagnostica WhatsApp | Gestionale Immobiliare</title>
        <meta 
          name="description"
          content="Verifica e configura il webhook WhatsApp UltraMsg"
        />
      </Helmet>
      
      <div className="container max-w-5xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Diagnostica WhatsApp</h1>
            <p className="text-gray-600">
              Verifica e risolvi problemi di sincronizzazione messaggi WhatsApp
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              refetchStatus();
              toast({
                title: "Ricaricamento...",
                description: "Aggiornamento stato webhook in corso",
              });
            }}
            disabled={isLoadingStatus}
            className="gap-2"
            data-testid="button-refresh-status"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            Ricarica
          </Button>
        </div>

        {/* Stato Webhook */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <CardTitle>Stato Webhook UltraMsg</CardTitle>
              </div>
              {webhookStatus?.webhook_correctly_configured !== undefined && (
                <Badge 
                  variant={webhookStatus.webhook_correctly_configured ? "default" : "destructive"}
                  className={webhookStatus.webhook_correctly_configured ? "bg-green-500" : ""}
                >
                  {webhookStatus.webhook_correctly_configured ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Configurato</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Non Configurato</>
                  )}
                </Badge>
              )}
            </div>
            <CardDescription>
              Verifica che il webhook sia configurato per ricevere messaggi dal cellulare
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStatus ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : webhookStatus?.error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Errore</AlertTitle>
                <AlertDescription>{webhookStatus.error}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Instance ID</label>
                    <div className="text-sm font-mono bg-gray-50 p-2 rounded border">
                      {maskInstanceId(webhookStatus?.instance_id)}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Webhook Attuale</label>
                    <div className="text-sm font-mono bg-gray-50 p-2 rounded border truncate" title={webhookStatus?.current_webhook}>
                      {webhookStatus?.current_webhook || "Non configurato"}
                    </div>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-600">Webhook Desiderato</label>
                    <div className="text-sm font-mono bg-green-50 p-2 rounded border truncate" title={webhookStatus?.ideal_webhook}>
                      {webhookStatus?.ideal_webhook}
                    </div>
                  </div>
                </div>

                {webhookStatus?.instructions && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Istruzioni</AlertTitle>
                    <AlertDescription>{webhookStatus.instructions}</AlertDescription>
                  </Alert>
                )}

                {!webhookStatus?.webhook_correctly_configured && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleConfigureWebhook}
                      disabled={configureMutation.isPending}
                      className="gap-2"
                      data-testid="button-auto-configure"
                    >
                      {configureMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Configurazione in corso...
                        </>
                      ) : (
                        <>
                          <Settings className="h-4 w-4" />
                          Configura Automaticamente
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowInstructions(!showInstructions)}
                      className="gap-2"
                      data-testid="button-manual-instructions"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Configurazione Manuale
                    </Button>
                  </div>
                )}

                {showInstructions && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Configurazione Manuale</AlertTitle>
                    <AlertDescription className="space-y-2 mt-2">
                      <p>Per configurare manualmente il webhook:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Vai su <a href="https://app.ultramsg.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">app.ultramsg.com</a></li>
                        <li>Seleziona la tua istanza <code className="bg-gray-100 px-1 py-0.5 rounded">{webhookStatus?.instance_id}</code></li>
                        <li>Vai su "Settings" → "Webhook"</li>
                        <li>Incolla questo URL nel campo webhook:<br/>
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs block mt-1 break-all">
                            {webhookStatus?.ideal_webhook}
                          </code>
                        </li>
                        <li>Salva le modifiche</li>
                        <li>Torna qui e clicca "Ricarica" per verificare</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Test Messaggi Recenti */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <CardTitle>Test Messaggi Recenti</CardTitle>
            </div>
            <CardDescription>
              Verifica se il sistema riceve correttamente i messaggi WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleFetchMessages}
              disabled={isLoadingMessages}
              variant="outline"
              className="gap-2"
              data-testid="button-fetch-messages"
            >
              {isLoadingMessages ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recupero in corso...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Recupera Ultimi Messaggi
                </>
              )}
            </Button>

            {recentMessages && (
              <div className="space-y-4">
                {recentMessages.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Errore</AlertTitle>
                    <AlertDescription>{recentMessages.error}</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-700">
                          {recentMessages.total_messages || 0}
                        </div>
                        <div className="text-sm text-blue-600">Messaggi Totali</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-700">
                          {recentMessages.incoming_messages || 0}
                        </div>
                        <div className="text-sm text-green-600">Messaggi in Arrivo</div>
                      </div>
                    </div>

                    {recentMessages.recent_messages && recentMessages.recent_messages.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Ultimi Messaggi in Arrivo:</h4>
                        <div className="space-y-2">
                          {recentMessages.recent_messages.map((msg) => (
                            <div 
                              key={msg.id} 
                              className="bg-gray-50 p-3 rounded border"
                              data-testid={`message-${msg.id}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-700">
                                    {msg.from}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {msg.body}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 ml-2">
                                  {new Date(msg.timestamp).toLocaleString('it-IT')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {recentMessages.incoming_messages === 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Nessun messaggio in arrivo</AlertTitle>
                        <AlertDescription>
                          Non sono stati trovati messaggi in arrivo recenti. 
                          Prova ad inviare un messaggio WhatsApp dal tuo cellulare e riprova.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Come funziona la sincronizzazione?</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800">
            <ul className="space-y-2 list-disc list-inside">
              <li>
                Quando invii o ricevi messaggi WhatsApp dal cellulare, UltraMsg li invia al nostro webhook
              </li>
              <li>
                Il sistema salva automaticamente i messaggi nel database e li associa ai clienti
              </li>
              <li>
                I messaggi appaiono nella chat WhatsApp della scheda cliente in tempo reale
              </li>
              <li>
                Se il webhook non è configurato, i messaggi dal cellulare NON verranno sincronizzati
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
