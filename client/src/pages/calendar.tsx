import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, MapPin, User, Settings, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  syncStatus: string;
  googleEventId?: string;
  createdAt: string;
}

interface CalendarStatus {
  googleCalendarConfigured: boolean;
  message: string;
}

export default function CalendarPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: events = [], isLoading: eventsLoading } = useQuery<{
    event: CalendarEvent;
    client?: any;
    property?: any;
  }[]>({
    queryKey: ['/api/calendar/events'],
    refetchInterval: 30000 // Aggiorna ogni 30 secondi
  });

  const { data: status } = useQuery<CalendarStatus>({
    queryKey: ['/api/calendar/status']
  });

  const syncMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/calendar/events/${eventId}/sync`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Errore nella sincronizzazione');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({
        title: "Sincronizzazione completata",
        description: "L'evento è stato sincronizzato con Google Calendar"
      });
    },
    onError: () => {
      toast({
        title: "Errore di sincronizzazione",
        description: "Non è stato possibile sincronizzare l'evento",
        variant: "destructive"
      });
    }
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSyncStatusBadge = (status: string, googleEventId?: string) => {
    switch (status) {
      case 'synced':
        return <Badge variant="default" className="bg-green-100 text-green-800">Sincronizzato</Badge>;
      case 'pending':
        return <Badge variant="secondary">In attesa</Badge>;
      case 'failed':
        return <Badge variant="destructive">Errore</Badge>;
      default:
        return <Badge variant="outline">Sconosciuto</Badge>;
    }
  };

  if (eventsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Caricamento calendario...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Calendario Appuntamenti
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestisci i tuoi appuntamenti e sincronizza con Google Calendar
          </p>
        </div>
      </div>

      {/* Stato sincronizzazione Google Calendar */}
      {status && (
        <Alert className={`mb-6 ${status.googleCalendarConfigured ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
          <Settings className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{status.message}</span>
            {!status.googleCalendarConfigured && (
              <Button variant="outline" size="sm">
                Configura Google Calendar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Lista eventi */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nessun evento programmato</h3>
              <p className="text-muted-foreground text-center">
                Gli eventi del calendario appariranno qui quando crei conferme appuntamenti
              </p>
            </CardContent>
          </Card>
        ) : (
          events.map(({ event, client, property }) => (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {event.title}
                      {getSyncStatusBadge(event.syncStatus, event.googleEventId)}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDate(event.startDate)}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {event.syncStatus === 'pending' || event.syncStatus === 'failed' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncMutation.mutate(event.id)}
                        disabled={syncMutation.isPending}
                      >
                        {syncMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Sincronizza'
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {event.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {event.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-4 text-sm">
                  {client && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{client.firstName} {client.lastName}</span>
                      {client.phone && (
                        <span className="text-muted-foreground">• {client.phone}</span>
                      )}
                    </div>
                  )}
                  
                  {property && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{property.address}, {property.city}</span>
                      <span className="text-muted-foreground">• {property.size}mq</span>
                    </div>
                  )}
                </div>

                {event.googleEventId && (
                  <div className="mt-4 pt-4 border-t">
                    <span className="text-xs text-muted-foreground">
                      ID Google Calendar: {event.googleEventId}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Statistiche */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Eventi Totali</p>
                <p className="text-2xl font-bold">{events.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sincronizzati</p>
                <p className="text-2xl font-bold text-green-600">
                  {events.filter(e => e.event.syncStatus === 'synced').length}
                </p>
              </div>
              <RefreshCw className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Attesa</p>
                <p className="text-2xl font-bold text-orange-600">
                  {events.filter(e => e.event.syncStatus === 'pending' || e.event.syncStatus === 'failed').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}