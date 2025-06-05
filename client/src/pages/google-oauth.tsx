import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Check, AlertCircle } from "lucide-react";

export default function GoogleOAuthPage() {
  const [authUrl, setAuthUrl] = useState<string>("");
  const [authCode, setAuthCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { toast } = useToast();

  // Genera l'URL di autorizzazione Google
  const generateAuthUrl = () => {
    const clientId = "876070482272-badt95el39sgg9om6mumtf8tcebgiard.apps.googleusercontent.com";
    const redirectUri = "https://client-management-system-ilanboni.replit.app/oauth/callback";
    const scope = "https://www.googleapis.com/auth/calendar";
    
    const url = `https://accounts.google.com/o/oauth2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    setAuthUrl(url);
  };

  useEffect(() => {
    generateAuthUrl();
  }, []);

  const handleAuthorization = async () => {
    if (!authCode.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci il codice di autorizzazione",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/oauth/manual-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ code: authCode.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setIsAuthorized(true);
        toast({
          title: "Successo!",
          description: "Google Calendar è stato configurato correttamente"
        });
      } else {
        throw new Error(data.error || "Errore durante l'autorizzazione");
      }
    } catch (error) {
      console.error("Errore autorizzazione:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore durante l'autorizzazione",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthorized) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Check className="h-6 w-6" />
              Google Calendar Configurato
            </CardTitle>
            <CardDescription>
              La sincronizzazione con Google Calendar è stata completata con successo!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Ora tutti gli eventi del gestionale si sincronizzeranno automaticamente con il tuo Google Calendar personale.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-4">
              <Button onClick={() => window.location.href = '/calendar'}>
                Vai al Calendario
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                Torna alla Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Configurazione Google Calendar</CardTitle>
          <CardDescription>
            Configura la sincronizzazione con il tuo Google Calendar personale
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Per sincronizzare gli eventi con il tuo Google Calendar personale, devi autorizzare l'applicazione.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Passo 1: Autorizza l'applicazione</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Clicca sul pulsante qui sotto per aprire la pagina di autorizzazione Google:
              </p>
              <Button 
                onClick={() => window.open(authUrl, '_blank')}
                className="w-full"
                disabled={!authUrl}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Autorizza Google Calendar
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="authCode" className="text-base font-semibold">
                Passo 2: Inserisci il codice di autorizzazione
              </Label>
              <p className="text-sm text-muted-foreground">
                Dopo aver autorizzato l'app, Google ti fornirà un codice. Copialo e incollalo qui:
              </p>
              <Textarea
                id="authCode"
                placeholder="Incolla qui il codice di autorizzazione di Google..."
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                rows={3}
              />
            </div>

            <Button 
              onClick={handleAuthorization}
              disabled={!authCode.trim() || isLoading}
              className="w-full"
            >
              {isLoading ? "Configurazione in corso..." : "Completa Configurazione"}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Cosa succede dopo:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Gli eventi del gestionale si sincronizzeranno automaticamente</li>
              <li>• Il tuo appuntamento del 6 giugno alle 10:00 apparirà nel tuo Google Calendar</li>
              <li>• Tutti i futuri appuntamenti saranno sincronizzati in tempo reale</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}