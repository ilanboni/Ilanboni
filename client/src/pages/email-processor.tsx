import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, User, Home, Calendar, TrendingUp, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const manualProcessSchema = z.object({
  subject: z.string().min(1, 'Oggetto obbligatorio'),
  body: z.string().min(10, 'Contenuto email troppo breve'),
  fromAddress: z.string().email('Email non valida').optional()
});

export default function EmailProcessor() {
  const { toast } = useToast();
  const [selectedEmail, setSelectedEmail] = useState<any>(null);

  // Form per elaborazione manuale
  const form = useForm<z.infer<typeof manualProcessSchema>>({
    resolver: zodResolver(manualProcessSchema),
    defaultValues: {
      subject: '',
      body: '',
      fromAddress: 'noreply@immobiliare.it'
    }
  });

  // Query per statistiche
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/emails/stats'],
    refetchInterval: 30000 // Aggiorna ogni 30 secondi
  });

  // Query per lista email
  const { data: emails, isLoading: emailsLoading } = useQuery({
    queryKey: ['/api/emails'],
    refetchInterval: 30000
  });

  // Query per stato Gmail
  const { data: gmailStatus, isLoading: gmailStatusLoading } = useQuery({
    queryKey: ['/api/emails/gmail/status'],
    refetchInterval: 15000 // Aggiorna ogni 15 secondi
  });

  // Mutation per elaborazione manuale
  const { mutate: processManually, isPending: isProcessing } = useMutation({
    mutationFn: async (data: z.infer<typeof manualProcessSchema>) => {
      return await apiRequest('/api/emails/manual-process', {
        method: 'POST',
        data: data
      });
    },
    onSuccess: () => {
      toast({
        title: 'Email elaborata',
        description: 'Email elaborata manualmente con successo. Task e cliente creati automaticamente.'
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/emails/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Errore',
        description: error.details || 'Errore nell\'elaborazione dell\'email',
        variant: 'destructive'
      });
    }
  });

  // Mutation per controllo Gmail manuale
  const { mutate: checkGmail, isPending: isCheckingGmail } = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/emails/gmail/check', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Controllo completato',
        description: 'Controllo email Gmail completato con successo.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/emails/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/emails/gmail/status'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Errore',
        description: error.message || 'Errore nel controllo Gmail',
        variant: 'destructive'
      });
    }
  });

  const getStatusBadge = (email: any) => {
    if (!email.processed) {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />In attesa</Badge>;
    }
    if (email.processingError) {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Errore</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Elaborata</Badge>;
  };

  const getRequestTypeBadge = (type: string) => {
    const variants = {
      'visita': 'default',
      'informazioni': 'secondary', 
      'contatto': 'outline'
    } as const;
    
    return <Badge variant={variants[type as keyof typeof variants] || 'outline'}>{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email da Immobiliare.it</h1>
          <p className="text-muted-foreground">
            Sistema automatico per creare task da email di richieste visite
          </p>
        </div>
      </div>

      {/* Stato Gmail */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg font-medium">Monitoraggio Gmail Automatico</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sistema di polling automatico per email da immobiliare.it (controllo ogni 5 minuti)
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => checkGmail()} 
              disabled={isCheckingGmail}
              variant="outline"
              size="sm"
            >
              {isCheckingGmail ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Controllo...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Controlla Ora
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${gmailStatus?.isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">
                  {gmailStatusLoading ? 'Verifica...' : (gmailStatus?.isAuthenticated ? 'Gmail Connesso' : 'Gmail Non Connesso')}
                </span>
              </div>
              {gmailStatus?.lastCheck && (
                <div className="text-sm text-muted-foreground">
                  Ultimo controllo: {new Date(gmailStatus.lastCheck).toLocaleString('it-IT')}
                </div>
              )}
            </div>
            
            {!gmailStatus?.isAuthenticated && (
              <div className="flex items-center space-x-2">
                <Button 
                  onClick={() => window.open('/oauth/gmail/start', '_blank')}
                  variant="outline"
                  size="sm"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Configura Gmail
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistiche */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totali</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsLoading ? '...' : stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Email ricevute</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Elaborate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statsLoading ? '...' : stats?.processed || 0}</div>
            <p className="text-xs text-muted-foreground">Task creati automaticamente</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In attesa</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{statsLoading ? '...' : stats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">Da elaborare</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errori</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statsLoading ? '...' : stats?.errors || 0}</div>
            <p className="text-xs text-muted-foreground">Email con problemi</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="emails" className="space-y-4">
        <TabsList>
          <TabsTrigger value="emails">Email Ricevute</TabsTrigger>
          <TabsTrigger value="manual">Elaborazione Manuale</TabsTrigger>
          <TabsTrigger value="webhook">Setup Webhook</TabsTrigger>
        </TabsList>

        <TabsContent value="emails" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email da Immobiliare.it</CardTitle>
            </CardHeader>
            <CardContent>
              {emailsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="text-muted-foreground">Caricamento email...</div>
                </div>
              ) : emails?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Nessuna email ricevuta ancora</p>
                  <p className="text-sm">Le email da immobiliare.it appariranno qui automaticamente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {emails?.map((email: any) => (
                    <Card key={email.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEmail(email)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{email.subject}</h4>
                              {getStatusBadge(email)}
                              {email.requestType && getRequestTypeBadge(email.requestType)}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Da: {email.fromAddress}</span>
                              <span>•</span>
                              <span>{new Date(email.receivedAt).toLocaleString('it-IT')}</span>
                            </div>

                            {email.clientName && (
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <User className="w-4 h-4" />
                                  <span>{email.clientName}</span>
                                </div>
                                {email.propertyAddress && (
                                  <>
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                      <Home className="w-4 h-4" />
                                      <span>{email.propertyAddress}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {email.body.substring(0, 200)}...
                            </p>

                            {email.processingError && (
                              <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
                                <strong>Errore:</strong> {email.processingError}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Elaborazione Manuale</CardTitle>
              <p className="text-sm text-muted-foreground">
                Testa il sistema incollando qui il contenuto di un'email da immobiliare.it
              </p>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => processManually(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fromAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mittente (opzionale)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="noreply@immobiliare.it" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Oggetto Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Es: Richiesta di visita per immobile in Via Roma 123" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contenuto Email</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Incolla qui il contenuto completo dell'email da immobiliare.it..."
                            className="min-h-[200px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={isProcessing}>
                    {isProcessing ? 'Elaborazione...' : 'Elabora Email'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Setup Webhook</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configura il tuo provider email per inviare le notifiche a questo endpoint
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <label className="text-sm font-medium">Endpoint Webhook:</label>
                <code className="block mt-1 p-2 bg-white rounded border text-sm">
                  {window.location.origin}/api/emails/webhook
                </code>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Come configurare:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>Configura il tuo provider email (Gmail, Outlook, ecc.) per inviare webhook</li>
                  <li>Imposta l'URL sopra come endpoint di destinazione</li>
                  <li>Configura il filtro per email da immobiliare.it</li>
                  <li>Le email verranno elaborate automaticamente</li>
                </ol>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">Formato richiesto:</h4>
                <pre className="text-xs text-yellow-800 bg-yellow-100 p-2 rounded overflow-x-auto">
{`{
  "emailId": "unique-id",
  "fromAddress": "noreply@immobiliare.it",
  "subject": "Richiesta visita immobile",
  "body": "Contenuto email...",
  "htmlBody": "HTML opzionale",
  "receivedAt": "2025-06-08T19:30:00Z"
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal dettagli email */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedEmail.subject}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(selectedEmail)}
                    {selectedEmail.requestType && getRequestTypeBadge(selectedEmail.requestType)}
                  </div>
                </div>
                <Button variant="outline" onClick={() => setSelectedEmail(null)}>
                  Chiudi
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Da:</strong> {selectedEmail.fromAddress}
                </div>
                <div>
                  <strong>Ricevuta:</strong> {new Date(selectedEmail.receivedAt).toLocaleString('it-IT')}
                </div>
                {selectedEmail.clientName && (
                  <div>
                    <strong>Cliente:</strong> {selectedEmail.clientName}
                  </div>
                )}
                {selectedEmail.clientEmail && (
                  <div>
                    <strong>Email cliente:</strong> {selectedEmail.clientEmail}
                  </div>
                )}
                {selectedEmail.clientPhone && (
                  <div>
                    <strong>Telefono:</strong> {selectedEmail.clientPhone}
                  </div>
                )}
                {selectedEmail.propertyAddress && (
                  <div>
                    <strong>Immobile:</strong> {selectedEmail.propertyAddress}
                  </div>
                )}
              </div>

              <div>
                <strong>Contenuto:</strong>
                <div className="bg-muted p-3 rounded mt-2 text-sm whitespace-pre-wrap">
                  {selectedEmail.body}
                </div>
              </div>

              {selectedEmail.processingError && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <strong className="text-red-700">Errore di elaborazione:</strong>
                  <p className="text-red-600 text-sm mt-1">{selectedEmail.processingError}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}