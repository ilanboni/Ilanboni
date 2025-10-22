import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Mail, MessageSquare, MapPin, Euro, Maximize2, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";

interface Task {
  id: number;
  type: string;
  title: string;
  description: string;
  priority: number;
  dueDate: string;
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  action: string;
  target: string;
  notes: string;
  sharedProperty?: any;
}

interface OutreachData {
  tasks: Task[];
  count: number;
  date: string;
}

function MessageTemplateDialog({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"formal" | "friendly" | "neutral">("neutral");
  const [loading, setLoading] = useState(false);

  const loadTemplate = async () => {
    if (!task.sharedProperty) return;

    setLoading(true);
    try {
      const response: any = await apiRequest("/api/templates/generate", {
        method: "POST",
        data: {
          sharedPropertyId: task.sharedProperty.id,
          channel: task.type === 'WHATSAPP_SEND' ? 'whatsapp' : 
                   task.type === 'CALL_OWNER' || task.type === 'CALL_AGENCY' ? 'phone' : 
                   'email',
          tone,
          agentInfo: {
            name: "Marco",
            agency: "Agenzia Immobiliare",
            phone: "+39 340 1234567",
            email: "marco@agenzia.it"
          }
        }
      });

      setMessage(response.message);
    } catch (error) {
      console.error("Errore caricamento template:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      await apiRequest("/api/interactions", {
        method: "POST",
        data: {
          channel: task.type === 'WHATSAPP_SEND' ? 'whatsapp' : 
                   task.type === 'CALL_OWNER' || task.type === 'CALL_AGENCY' ? 'call' : 
                   'email',
          direction: 'out',
          sharedPropertyId: task.sharedProperty?.id,
          text: message,
          outcome: 'no_response'
        }
      });

      await apiRequest(`/api/tasks/${task.id}/complete`, {
        method: "PATCH"
      });

      queryClient.invalidateQueries({ queryKey: ["/api/outreach/today"] });
      setOpen(false);
    } catch (error: any) {
      if (error.status === 409) {
        alert("Interazione duplicata - già contattato di recente");
      } else {
        console.error("Errore invio:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex-1" data-testid={`button-message-${task.id}`}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Messaggio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Genera Messaggio</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Tone of Voice</label>
            <Select value={tone} onValueChange={(v: any) => setTone(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formale</SelectItem>
                <SelectItem value="friendly">Amichevole</SelectItem>
                <SelectItem value="neutral">Neutro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={loadTemplate} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Caricamento..." : "Carica Template"}
          </Button>

          <Textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Il messaggio verrà generato qui..."
            rows={12}
            className="font-mono text-sm"
          />

          <div className="flex gap-2">
            <Button 
              onClick={handleSend}
              disabled={!message}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              Invia e Completa
            </Button>
            <Button 
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annulla
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutreachCard({ task }: { task: Task }) {
  const handleSkip = async () => {
    try {
      await apiRequest(`/api/tasks/${task.id}/skip`, {
        method: "PATCH"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/outreach/today"] });
    } catch (error) {
      console.error("Errore skip task:", error);
    }
  };

  const priorityColor = task.priority >= 90 ? "bg-red-100 border-red-300" :
                       task.priority >= 70 ? "bg-orange-100 border-orange-300" :
                       "bg-blue-100 border-blue-300";

  return (
    <Card className={`${priorityColor} hover:shadow-lg transition-shadow`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Badge variant="outline" className="mb-2">{task.type}</Badge>
            <CardTitle className="text-lg">{task.title}</CardTitle>
          </div>
          <Badge className="ml-2">Priorità: {task.priority}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {task.description && (
          <p className="text-sm text-gray-700 mb-3 whitespace-pre-line">
            {task.description}
          </p>
        )}
        
        <div className="space-y-2 mb-4">
          {task.contactPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-green-600" />
              <a href={`tel:${task.contactPhone}`} className="text-blue-600 hover:underline font-medium">
                {task.contactPhone}
              </a>
            </div>
          )}
          
          {task.contactEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-purple-600" />
              <a href={`mailto:${task.contactEmail}`} className="text-blue-600 hover:underline">
                {task.contactEmail}
              </a>
            </div>
          )}
          
          {task.sharedProperty && (
            <div className="border-t pt-2 mt-2">
              <div className="flex items-center gap-2 text-sm mb-1 font-medium">
                <MapPin className="h-4 w-4 text-red-600" />
                <span>{task.sharedProperty.address}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                {task.sharedProperty.price && (
                  <div className="flex items-center gap-1">
                    <Euro className="h-3 w-3" />
                    <span>€{task.sharedProperty.price.toLocaleString()}</span>
                  </div>
                )}
                {task.sharedProperty.size && (
                  <div className="flex items-center gap-1">
                    <Maximize2 className="h-3 w-3" />
                    <span>{task.sharedProperty.size}mq</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {task.type === 'WHATSAPP_SEND' || task.type === 'EMAIL_OWNER' ? (
            <MessageTemplateDialog task={task} />
          ) : (
            <Button 
              onClick={async () => {
                await apiRequest(`/api/tasks/${task.id}/complete`, { method: "PATCH" });
                queryClient.invalidateQueries({ queryKey: ["/api/outreach/today"] });
              }}
              className="flex-1"
              data-testid={`button-complete-${task.id}`}
            >
              Completa
            </Button>
          )}
          <Button 
            onClick={handleSkip} 
            variant="outline"
            data-testid={`button-skip-${task.id}`}
          >
            Salta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SecretaryOutreach() {
  const { data, isLoading, error } = useQuery<OutreachData>({
    queryKey: ["/api/outreach/today"]
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">Errore durante il caricamento della coda outreach</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Coda Outreach</h1>
        <p className="text-gray-600 mt-1">
          Contatti da processare - {data?.count || 0} task in coda
        </p>
      </div>

      {data && data.tasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Coda vuota</h3>
            <p className="text-gray-600">
              Nessun contatto da processare al momento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.tasks.map((task) => (
            <OutreachCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
