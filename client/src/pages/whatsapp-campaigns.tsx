import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Send,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Users,
  Phone,
  Bot,
  Calendar,
  Eye,
  Settings
} from "lucide-react";

const campaignFormSchema = z.object({
  name: z.string().min(1, "Nome richiesto"),
  description: z.string().optional(),
  messageTemplate: z.string().min(10, "Template messaggio troppo corto"),
  followUpTemplate: z.string().optional(),
  followUpDelayDays: z.coerce.number().min(1).max(30).optional(),
  useAiPersonalization: z.boolean().optional(),
  instructions: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional()
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  messageTemplate: string;
  followUpTemplate: string | null;
  followUpDelayDays: number | null;
  useAiPersonalization: boolean;
  instructions: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed';
  sentCount: number | null;
  responseCount: number | null;
  createdAt: string;
  stats?: {
    totalMessages: number;
    followUpSent: number;
    followUpPending: number;
    followUpResponded: number;
  };
  messages?: Array<{
    id: number;
    phoneNumber: string;
    messageContent: string;
    status: string;
  }>;
}

export default function WhatsAppCampaignsPage() {
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: campaigns, isLoading: loadingCampaigns } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ['/api/whatsapp-campaigns'],
  });

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-whatsapp-campaigns">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Campagne WhatsApp Bot
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Sistema automatizzato per contattare proprietari privati con bot conversazionale AI
          </p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-campaign">
              <Plus className="h-4 w-4 mr-2" />
              Nuova Campagna
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crea Nuova Campagna WhatsApp</DialogTitle>
              <DialogDescription>
                Configura una campagna automatizzata per contattare proprietari privati
              </DialogDescription>
            </DialogHeader>
            <CampaignForm
              onSuccess={() => {
                setCreateDialogOpen(false);
                toast({
                  title: "Campagna creata",
                  description: "La campagna è stata creata con successo",
                });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loadingCampaigns ? (
        <div className="text-center py-12" data-testid="loading-campaigns">
          <p className="text-muted-foreground">Caricamento campagne...</p>
        </div>
      ) : campaigns?.campaigns && campaigns.campaigns.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onClick={() => setSelectedCampaign(campaign)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nessuna campagna attiva</h3>
            <p className="text-muted-foreground mb-6">
              Crea la tua prima campagna per iniziare a contattare proprietari privati automaticamente
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-campaign">
              <Plus className="h-4 w-4 mr-2" />
              Crea Prima Campagna
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedCampaign && (
        <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedCampaign.name}
                <Badge variant={
                  selectedCampaign.status === 'active' ? 'default' :
                  selectedCampaign.status === 'draft' ? 'secondary' :
                  selectedCampaign.status === 'paused' ? 'outline' : 'destructive'
                }>
                  {selectedCampaign.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {selectedCampaign.description || 'Dettagli campagna e conversazioni'}
              </DialogDescription>
            </DialogHeader>
            <CampaignDetails campaign={selectedCampaign} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CampaignCard({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800'
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow" 
      onClick={onClick}
      data-testid={`card-campaign-${campaign.id}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{campaign.name}</CardTitle>
          <Badge className={statusColors[campaign.status]}>
            {campaign.status}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">
          {campaign.description || 'Nessuna descrizione'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Send className="h-4 w-4" />
              Messaggi inviati
            </span>
            <span className="font-semibold">{campaign.sentCount || 0}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Risposte ricevute
            </span>
            <span className="font-semibold">{campaign.responseCount || 0}</span>
          </div>

          {campaign.stats && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Follow-up in attesa
              </span>
              <span className="font-semibold">{campaign.stats.followUpPending}</span>
            </div>
          )}

          {campaign.useAiPersonalization && (
            <Badge variant="outline" className="w-full justify-center">
              <Bot className="h-3 w-3 mr-1" />
              AI Personalizzazione
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignForm({ 
  campaign, 
  onSuccess 
}: { 
  campaign?: Campaign; 
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: campaign ? {
      name: campaign.name,
      description: campaign.description || "",
      messageTemplate: campaign.messageTemplate,
      followUpTemplate: campaign.followUpTemplate || "",
      followUpDelayDays: campaign.followUpDelayDays || 3,
      useAiPersonalization: campaign.useAiPersonalization,
      instructions: campaign.instructions || "",
      status: campaign.status
    } : {
      name: "",
      description: "",
      messageTemplate: "Buongiorno {{name}},\n\nSono un agente immobiliare e ho notato il suo annuncio per l'immobile in {{address}} a €{{price}}.\n\nSarei interessato a discutere una possibile collaborazione. Possiamo organizzare una chiamata?\n\nGrazie,\n[Nome Agente]",
      followUpTemplate: "Buongiorno {{name}},\n\nVolevo sapere se ha avuto modo di considerare la mia proposta per la proprietà in {{address}}.\n\nResto a disposizione per qualsiasi chiarimento.\n\nCordiali saluti",
      followUpDelayDays: 3,
      useAiPersonalization: false,
      instructions: "",
      status: 'draft' as const
    }
  });

  const createMutation = useMutation({
    mutationFn: async (values: CampaignFormValues) => {
      const response = await fetch('/api/whatsapp-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!response.ok) throw new Error('Errore creazione campagna');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-campaigns'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (values: CampaignFormValues) => {
      const response = await fetch(`/api/whatsapp-campaigns/${campaign?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!response.ok) throw new Error('Errore aggiornamento campagna');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-campaigns'] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (values: CampaignFormValues) => {
    if (campaign) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Campagna</FormLabel>
              <FormControl>
                <Input placeholder="Es: Outreach Milano Centro Q4 2025" {...field} data-testid="input-campaign-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrizione (opzionale)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descrizione obiettivi campagna..." 
                  {...field} 
                  data-testid="input-campaign-description"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="messageTemplate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template Messaggio Iniziale</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Usa variabili: {{name}}, {{address}}, {{price}}, {{size}}, ecc." 
                  rows={6}
                  {...field}
                  data-testid="input-message-template"
                />
              </FormControl>
              <FormDescription>
                Variabili disponibili: {'{'}{'{'} name{'}'}{'}'}, {'{'}{'{'} address{'}'}{'}'}, {'{'}{'{'} price{'}'}{'}'}, {'{'}{'{'} size{'}'}{'}'}, {'{'}{'{'} rooms{'}'}{'}'}, {'{'}{'{'} bathrooms{'}'}{'}'}, {'{'}{'{'} floor{'}'}{'}'}, {'{'}{'{'} propertyType{'}'}{'}'}, {'{'}{'{'} description{'}'}{'}'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="useAiPersonalization"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Personalizzazione AI
                </FormLabel>
                <FormDescription>
                  Usa ChatGPT per personalizzare ogni messaggio in base al contesto immobile
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-ai-personalization"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="followUpTemplate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template Follow-up (opzionale)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Messaggio automatico per chi non risponde..." 
                  rows={4}
                  {...field}
                  value={field.value || ""}
                  data-testid="input-followup-template"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="followUpDelayDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Giorni prima del Follow-up</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min="1" 
                  max="30" 
                  {...field} 
                  data-testid="input-followup-delay"
                />
              </FormControl>
              <FormDescription>
                Numero di giorni di attesa prima di inviare follow-up automatico
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Istruzioni Bot Conversazionale (opzionale)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Istruzioni specifiche per il bot AI su come gestire le risposte..." 
                  rows={3}
                  {...field}
                  value={field.value || ""}
                  data-testid="input-bot-instructions"
                />
              </FormControl>
              <FormDescription>
                Guida il bot AI su come rispondere ai proprietari (tono, obiettivi, limiti)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stato Campagna</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-campaign-status">
                    <SelectValue placeholder="Seleziona stato" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="draft">Bozza</SelectItem>
                  <SelectItem value="active">Attiva</SelectItem>
                  <SelectItem value="paused">In Pausa</SelectItem>
                  <SelectItem value="completed">Completata</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-save-campaign"
          >
            {createMutation.isPending || updateMutation.isPending ? "Salvataggio..." : campaign ? "Aggiorna" : "Crea Campagna"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function CampaignDetails({ campaign }: { campaign: Campaign }) {
  const { data: details } = useQuery<{ campaign: Campaign }>({
    queryKey: ['/api/whatsapp-campaigns', campaign.id],
  });

  const campaignData = (details?.campaign as Campaign) || campaign;

  return (
    <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Panoramica</TabsTrigger>
        <TabsTrigger value="messages">Messaggi</TabsTrigger>
        <TabsTrigger value="properties">Proprietà</TabsTrigger>
        <TabsTrigger value="settings">Impostazioni</TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto mt-4">
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Messaggi Inviati"
              value={campaignData.sentCount || 0}
              icon={<Send className="h-4 w-4" />}
            />
            <StatCard
              title="Risposte Ricevute"
              value={campaignData.responseCount || 0}
              icon={<MessageSquare className="h-4 w-4" />}
            />
            <StatCard
              title="Follow-up Inviati"
              value={campaignData.stats?.followUpSent || 0}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              title="In Attesa Follow-up"
              value={campaignData.stats?.followUpPending || 0}
              icon={<Calendar className="h-4 w-4" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Template Messaggio</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap">
                {campaignData.messageTemplate}
              </pre>
            </CardContent>
          </Card>

          {campaignData.followUpTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Template Follow-up</CardTitle>
                <CardDescription>
                  Inviato dopo {campaignData.followUpDelayDays} giorni senza risposta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap">
                  {campaignData.followUpTemplate}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Messaggi Campagna</CardTitle>
              <CardDescription>
                Storico messaggi inviati e conversazioni
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaignData.messages && campaignData.messages.length > 0 ? (
                <div className="space-y-2">
                  {campaignData.messages.map((msg: any) => (
                    <div key={msg.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{msg.phoneNumber}</span>
                        <Badge variant={
                          msg.status === 'sent' ? 'default' :
                          msg.status === 'delivered' ? 'default' :
                          msg.status === 'read' ? 'default' :
                          msg.status === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {msg.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {msg.messageContent}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nessun messaggio inviato ancora
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="properties">
          <Card>
            <CardHeader>
              <CardTitle>Selezione Proprietà Private</CardTitle>
              <CardDescription>
                Seleziona proprietà da contattare per questa campagna
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Feature in arrivo: selezione proprietà private da database
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Impostazioni Campagna</CardTitle>
            </CardHeader>
            <CardContent>
              <CampaignForm
                campaign={campaignData}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-campaigns'] });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </div>
    </Tabs>
  );
}

function StatCard({ 
  title, 
  value, 
  icon 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
