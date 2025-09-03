import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AppointmentForFollowUp {
  id: number;
  appointmentDate: string;
  appointmentTime: string;
  lastName: string;
  firstName: string;
  phone: string;
  propertyAddress: string;
  propertyCode?: string;
  clientId: number;
  propertyId?: number;
  sharedPropertyId?: number;
  sentAt: string;
}

interface AppointmentFollowUpPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppointmentFollowUpPopup({ isOpen, onClose }: AppointmentFollowUpPopupProps) {
  const [outcome, setOutcome] = useState<string>("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch degli appuntamenti che necessitano follow-up (giorno dopo la data appuntamento)
  const { data: pendingAppointments = [] } = useQuery({
    queryKey: ['/api/appointment-confirmations/pending-follow-up'],
    enabled: isOpen
  });

  const currentAppointment = pendingAppointments[0] as AppointmentForFollowUp | undefined;

  // Mutation per salvare il follow-up
  const saveFollowUpMutation = useMutation({
    mutationFn: async (data: { appointmentId: number; outcome: string; notes: string }) => {
      return apiRequest(`/api/appointment-confirmations/${data.appointmentId}/follow-up`, {
        method: 'POST',
        body: JSON.stringify({
          outcome: data.outcome,
          notes: data.notes
        })
      });
    },
    onSuccess: () => {
      toast({
        title: "Follow-up salvato",
        description: "L'esito dell'appuntamento è stato registrato con successo"
      });
      
      // Reset form
      setOutcome("");
      setNotes("");
      
      // Refresh della lista
      queryClient.invalidateQueries({ queryKey: ['/api/appointment-confirmations/pending-follow-up'] });
      
      // Se non ci sono altri appuntamenti, chiudi il popup
      if (pendingAppointments.length <= 1) {
        onClose();
      }
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: "Errore nel salvare il follow-up dell'appuntamento",
        variant: "destructive"
      });
      console.error('Errore nel salvare follow-up:', error);
    }
  });

  const handleSave = () => {
    if (!currentAppointment || !outcome) {
      toast({
        title: "Dati mancanti",
        description: "Seleziona un esito per l'appuntamento",
        variant: "destructive"
      });
      return;
    }

    saveFollowUpMutation.mutate({
      appointmentId: currentAppointment.id,
      outcome,
      notes
    });
  };

  const handleSkip = () => {
    // Segna come saltato (salva con outcome "skipped")
    if (!currentAppointment) return;
    
    saveFollowUpMutation.mutate({
      appointmentId: currentAppointment.id,
      outcome: "skipped",
      notes: "Follow-up saltato"
    });
  };

  useEffect(() => {
    // Reset form quando cambia l'appuntamento
    setOutcome("");
    setNotes("");
  }, [currentAppointment?.id]);

  if (!currentAppointment) {
    return null;
  }

  const appointmentDate = new Date(currentAppointment.appointmentDate);
  const formattedDate = appointmentDate.toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      case 'neutral': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Follow-up Appuntamento
            {pendingAppointments.length > 1 && (
              <Badge variant="secondary">
                1 di {pendingAppointments.length}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dettagli Appuntamento */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{formattedDate}</span>
              <Clock className="h-4 w-4 text-gray-500 ml-4" />
              <span>{currentAppointment.appointmentTime}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">
                {currentAppointment.firstName} {currentAppointment.lastName}
              </span>
              <span className="text-gray-600">({currentAppointment.phone})</span>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-500 mt-1" />
              <div>
                <span className="font-medium">{currentAppointment.propertyAddress}</span>
                {currentAppointment.propertyCode && (
                  <span className="text-gray-600 ml-2">({currentAppointment.propertyCode})</span>
                )}
              </div>
            </div>
          </div>

          {/* Form per Esito */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="outcome">Esito Appuntamento *</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona l'esito..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      Positivo
                    </div>
                  </SelectItem>
                  <SelectItem value="negative">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      Negativo
                    </div>
                  </SelectItem>
                  <SelectItem value="neutral">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      Neutro
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Note aggiuntive</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Aggiungi dettagli sull'appuntamento, feedback del cliente, prossimi passi..."
                rows={4}
              />
            </div>
          </div>

          {/* Azioni */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleSkip}>
              Salta questo
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Chiudi
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!outcome || saveFollowUpMutation.isPending}
              >
                {saveFollowUpMutation.isPending ? "Salvando..." : "Salva Follow-up"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}