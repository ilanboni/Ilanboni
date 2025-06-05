import { Request, Response } from 'express';
import { google } from 'googleapis';

// Determina l'URL base dell'applicazione
const getBaseUrl = () => {
  // Per questa app deployata su Replit, usa sempre l'URL deployato specifico
  return 'https://client-management-system-ilanboni.replit.app';
};

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  `${getBaseUrl()}/oauth/callback`
);

// Scopes necessari per Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * Genera l'URL per l'autorizzazione OAuth
 */
export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Forza il consenso per ottenere il refresh token
  });
}

/**
 * Gestisce il callback OAuth e ottiene i token
 */
export async function handleOAuthCallback(req: Request, res: Response) {
  const { code, error } = req.query;
  
  if (error) {
    return res.status(400).send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body>
          <h1>Errore di autorizzazione</h1>
          <p>Errore: ${error}</p>
          <p><a href="/calendar">Torna al calendario</a></p>
        </body>
      </html>
    `);
  }
  
  if (!code || typeof code !== 'string') {
    return res.status(400).send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body>
          <h1>Codice di autorizzazione mancante</h1>
          <p><a href="/calendar">Torna al calendario</a></p>
        </body>
      </html>
    `);
  }

  try {
    console.log('[OAUTH] Processing authorization code:', code.substring(0, 20) + '...');
    const { tokens } = await oauth2Client.getToken(code);
    
    if (tokens.refresh_token) {
      // Configurazione automatica del refresh token
      process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = tokens.refresh_token;
      console.log('[OAUTH] Google Calendar configured successfully');
      
      res.send(`
        <html>
          <head><title>OAuth Success</title></head>
          <body>
            <h1>✅ Google Calendar configurato con successo!</h1>
            <p>Il calendario è ora sincronizzato. Gli appuntamenti creati nell'app appariranno automaticamente nel tuo Google Calendar.</p>
            <p><a href="/calendar">Vai al calendario</a></p>
            <script>
              setTimeout(() => {
                window.location.href = '/calendar';
              }, 3000);
            </script>
          </body>
        </html>
      `);
    } else {
      res.send(`
        <html>
          <head><title>OAuth Warning</title></head>
          <body>
            <h1>⚠️ Configurazione parziale</h1>
            <p>Autorizzazione completata ma nessun refresh token ricevuto.</p>
            <p>Potrebbe essere necessario revocare l'accesso e riprovare.</p>
            <p><a href="/calendar">Torna al calendario</a></p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('[OAUTH] Error getting tokens:', error);
    res.status(500).send(`
      <html>
        <head><title>OAuth Error</title></head>
        <body>
          <h1>❌ Errore di configurazione</h1>
          <p>Errore: ${error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <p><a href="/calendar">Torna al calendario</a></p>
        </body>
      </html>
    `);
  }
}

/**
 * Mostra le informazioni di configurazione OAuth
 */
export function renderConfigPage(req: Request, res: Response) {
  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/oauth/callback`;
  const authUrl = getAuthUrl();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Google Calendar OAuth Configuration</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .info-box { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .warning-box { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { display: inline-block; background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
            code { background: #eee; padding: 5px; display: block; margin: 10px 0; font-family: monospace; }
        </style>
    </head>
    <body>
        <h1>Google Calendar Integration Configuration</h1>
        
        <div class="info-box">
            <h3>Step 1: Configure Google Cloud Console</h3>
            <p>Add this redirect URI to your OAuth 2.0 client:</p>
            <code>${redirectUri}</code>
            <p><strong>Current environment:</strong> ${process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1' ? 'Production (Deployed)' : 'Development (Local)'}</p>
        </div>

        <div class="warning-box">
            <h3>Configuration Status</h3>
            <p><strong>Client ID:</strong> ${process.env.GOOGLE_CALENDAR_CLIENT_ID ? '✓ Configured' : '✗ Missing'}</p>
            <p><strong>Client Secret:</strong> ${process.env.GOOGLE_CALENDAR_CLIENT_SECRET ? '✓ Configured' : '✗ Missing'}</p>
            <p><strong>Refresh Token:</strong> ${process.env.GOOGLE_CALENDAR_REFRESH_TOKEN ? '✓ Configured' : '✗ Missing'}</p>
        </div>

        <div class="info-box">
            <h3>Step 2: Test OAuth Authorization</h3>
            <p>After configuring the redirect URI in Google Cloud Console:</p>
            <a href="/oauth/setup" class="button">Start OAuth Authorization</a>
        </div>
    </body>
    </html>
  `;
  
  res.send(html);
}

/**
 * Pagina di avvio del processo OAuth
 */
export function renderAuthPage(req: Request, res: Response) {
  const authUrl = getAuthUrl();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Google Calendar OAuth Setup</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .button { display: inline-block; background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
            .code { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; font-family: monospace; }
        </style>
    </head>
    <body>
        <h1>Google Calendar Integration Setup</h1>
        <p>Per completare l'integrazione con Google Calendar, devi autorizzare l'applicazione:</p>
        
        <h2>Passo 1: Autorizza l'applicazione</h2>
        <a href="${authUrl}" class="button" target="_blank">Autorizza Google Calendar</a>
        
        <h2>Passo 2: Configurazione automatica</h2>
        <p>Dopo aver autorizzato l'applicazione, verrai reindirizzato a questa pagina con i token necessari.</p>
        
        <h2>Configurazione manuale delle credenziali</h2>
        <p>Se preferisci, puoi anche configurare manualmente le seguenti variabili d'ambiente:</p>
        <div class="code">
            GOOGLE_CALENDAR_CLIENT_ID=445154107730-v53u8u5bk8q0h4u5ijhk4n7lf1hb1pl8.apps.googleusercontent.com<br>
            GOOGLE_CALENDAR_CLIENT_SECRET=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<br>
            GOOGLE_CALENDAR_REFRESH_TOKEN=(ottenuto dopo l'autorizzazione)
        </div>
    </body>
    </html>
  `;
  
  res.send(html);
}