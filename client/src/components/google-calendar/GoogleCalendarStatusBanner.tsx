import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface GoogleCalendarStatus {
  isConnected: boolean;
  eventsNeedingAuth: number;
}

export function GoogleCalendarStatusBanner() {
  const { data: status } = useQuery<GoogleCalendarStatus>({
    queryKey: ['/api/google-calendar/status'],
    refetchInterval: 60000, // Check every minute
  });

  if (!status || status.isConnected) {
    return null;
  }

  return (
    <Alert variant="destructive" className="rounded-none border-x-0 border-t-0" data-testid="google-calendar-disconnected-banner">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Google Calendar disconnesso</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          La connessione con Google Calendar è scaduta. 
          {status.eventsNeedingAuth > 0 && (
            <> {status.eventsNeedingAuth} {status.eventsNeedingAuth === 1 ? 'appuntamento richiede' : 'appuntamenti richiedono'} riautorizzazione.</>
          )}
        </span>
        <Link href="/google-oauth">
          <Button variant="outline" size="sm" className="ml-4 bg-white hover:bg-gray-100" data-testid="button-reconnect-calendar">
            Riconnetti Google Calendar
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}
