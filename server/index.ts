import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerFileUpload } from "./fileUpload";
import { setupVite, serveStatic, log } from "./vite";
import { fetchRecentWhatsAppMessages } from "./lib/ultramsgApi";
import diagnosticRouter from "./diagnostic-webhook";
import { gmailService } from "./services/gmailService";
import { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';

// Intervallo in millisecondi per il polling dei messaggi WhatsApp
const WHATSAPP_POLLING_INTERVAL = 15000; // 15 secondi (aumentata frequenza per test)

// Intervallo in millisecondi per il polling delle email Gmail
const GMAIL_POLLING_INTERVAL = 60000; // 1 minuto

// Importa lo scheduler per i follow-up automatici
import { startFollowUpScheduler } from "./services/followUpScheduler";
// Importa lo scheduler per la deduplicazione automatica
import { deduplicationScheduler } from "./services/deduplicationScheduler";
// Importa il service per l'ingestion multi-portale
import { ingestionService } from "./services/portalIngestionService";
import { IdealistaAdapter } from "./services/adapters/idealistaAdapter";
// DISABLED: Playwright adapter lacks agency/private classification data (uses only Apify)
// import { ImmobiliarePlaywrightAdapter } from "./services/adapters/immobiliarePlaywrightAdapter";
// Importa lo scheduler per l'ingestion automatica
import { ingestionScheduler } from "./services/ingestionScheduler";

// Configura l'agente virtuale (impostazione di default, può essere cambiato tramite API)
if (process.env.ENABLE_VIRTUAL_AGENT === undefined) {
  process.env.ENABLE_VIRTUAL_AGENT = 'true'; // Abilitato per default
}

// Log iniziale per la configurazione dell'agente virtuale
console.log(`🤖 Agente virtuale ${process.env.ENABLE_VIRTUAL_AGENT === 'true' ? 'ABILITATO' : 'DISABILITATO'}`);

const app = express();
app.use(express.json({ limit: '50mb' })); // Aumentato limite per file base64
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Endpoint specifico per file OAuth (solo quando richiesto esplicitamente)
app.get('/oauth-reauth', (req, res) => {
  res.sendFile('google-calendar-reauth.html', { root: '.' });
});

app.get('/oauth-setup', (req, res) => {
  res.sendFile('oauth-setup-simple.html', { root: '.' });
});

// Aggiungi il router diagnostico per webhook WhatsApp
app.use('/api/diagnostic', diagnosticRouter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Funzione che gestisce il polling dei messaggi WhatsApp
function startWhatsAppPolling() {
  console.log("🔄 Inizializzazione sistema di polling messaggi WhatsApp...");
  
  // Esegui immediatamente la prima verifica
  pollWhatsAppMessages();
  
  // Imposta il polling periodico
  setInterval(pollWhatsAppMessages, WHATSAPP_POLLING_INTERVAL);
}

// Funzione che gestisce il polling delle email Gmail
async function startGmailPolling() {
  console.log("📧 Inizializzazione sistema di polling email Gmail...");
  
  // Aspetta che il servizio Gmail sia inizializzato con timeout
  try {
    console.log("📧 Attesa inizializzazione Gmail service...");
    
    // Timeout di 10 secondi per l'inizializzazione Gmail
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout inizializzazione Gmail')), 10000)
    );
    
    await Promise.race([gmailService.ready, timeout]);
    const status = gmailService.getStatus();
    console.log("📧 Gmail service status:", status);
    
    if (!status.authenticated) {
      console.log("📧 ⚠️ Gmail service non autenticato - polling disabilitato");
      return;
    }
    
    console.log("📧 ✅ Gmail service pronto - avvio polling");
  } catch (error) {
    console.error("📧 ❌ Errore inizializzazione Gmail service:", error);
    return;
  }
  
  // Esegui immediatamente la prima verifica
  pollGmailMessages();
  
  // Imposta il polling periodico
  setInterval(pollGmailMessages, GMAIL_POLLING_INTERVAL);
}

// Funzione che esegue il polling delle email Gmail
async function pollGmailMessages() {
  try {
    const now = new Date();
    console.log(`📧 [${now.toLocaleTimeString()}] Controllo automatico email Gmail...`);
    await gmailService.checkNewEmails();
  } catch (error) {
    console.error("❌ Errore durante il polling delle email Gmail:", error);
  }
}

// Funzione che esegue il polling effettivo
async function pollWhatsAppMessages() {
  if (!process.env.ULTRAMSG_API_KEY || !process.env.ULTRAMSG_INSTANCE_ID) {
    console.log("⚠️ Chiavi API UltraMsg non configurate, polling disabilitato");
    return;
  }
  
  try {
    // Forza sempre il logging dettagliato per la diagnosi
    const now = new Date();
    const minutes = now.getMinutes();
    const isVerboseLogging = true; // Sempre true per debug
    
    if (isVerboseLogging) {
      console.log(`📩 [${now.toLocaleTimeString()}] Verifica nuovi messaggi WhatsApp...`);
    }
    
    const result = await fetchRecentWhatsAppMessages();
    
    if (result.processedCount > 0) {
      console.log(`✅ [${now.toLocaleTimeString()}] Elaborati ${result.processedCount} nuovi messaggi WhatsApp`);
      console.log(`ℹ️ Dettagli: ${result.ignoredCount} messaggi ignorati, ${result.errorCount} errori`);
      console.log(`📱 Messaggi: ${result.messages.map(m => `${m.from}: "${m.body.substring(0, 20)}..."`).join(', ')}`);
    } else if (result.ignoredCount > 0 && isVerboseLogging) {
      console.log(`ℹ️ [${now.toLocaleTimeString()}] Nessun nuovo messaggio. ${result.ignoredCount} messaggi già elaborati in precedenza`);
    } else if (isVerboseLogging) {
      console.log(`ℹ️ [${now.toLocaleTimeString()}] Nessun nuovo messaggio WhatsApp`);
    }
  } catch (error) {
    console.error("❌ Errore durante il polling dei messaggi WhatsApp:", error);
  }
}

(async () => {
  const server = await registerRoutes(app);
  
  // Registra gli endpoint per il file upload
  registerFileUpload(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    
    // TEMPORANEAMENTE DISABILITATO: WebSocket server per upload file
    // Causa conflitto con WebSocket HMR di Vite che impedisce caricamento app
    // TODO: Trovare soluzione per far coesistere i due WebSocket
    /*
    // Setup WebSocket server DOPO listen (quando il server HTTP è attivo)
    const wss = new WebSocketServer({ server, path: '/ws-upload' });
    log('🔌 WebSocket server configurato su /ws-upload');
    
    wss.on('connection', (ws, req: IncomingMessage) => {
      console.log('🔌 [WS] Nuova connessione WebSocket da:', req.socket.remoteAddress);
      
      ws.on('message', async (rawData) => {
        try {
          const message = JSON.parse(rawData.toString());
          console.log('🔌 [WS] Messaggio ricevuto:', message.type);
          
          if (message.type === 'file-upload') {
            console.log('🔌 [WS] Upload file:', message.fileName, message.fileSize, 'bytes');
            
            // Importa le dipendenze necessarie
            const { storage } = await import('./storage');
            const { getUltraMsgClient } = await import('./lib/ultramsg');
            
            const ultraMsgClient = getUltraMsgClient();
            
            try {
              // Converti base64 in Buffer
              const fileBuffer = Buffer.from(message.fileData, 'base64');
              console.log('🔌 [WS] Buffer creato:', fileBuffer.length, 'bytes');
              
              // Invia il file tramite UltraMsg
              const ultraMsgResponse = await ultraMsgClient.sendFile(
                message.to,
                fileBuffer,
                message.fileName,
                message.caption
              );
              
              console.log('🔌 [WS] Risposta UltraMsg:', ultraMsgResponse);
              
              // Salva la comunicazione nel database
              if (ultraMsgResponse.sent) {
                const client = await storage.getClientByPhone(message.to);
                
                if (client) {
                  const communication = {
                    clientId: client.id,
                    type: 'whatsapp' as const,
                    direction: 'outbound' as const,
                    subject: `File: ${message.fileName}`,
                    body: message.caption || `Inviato file ${message.fileName}`,
                    sentAt: new Date(),
                    status: 'sent',
                    externalId: ultraMsgResponse.id || undefined
                  };
                  
                  await storage.createCommunication(communication);
                  console.log('🔌 [WS] Comunicazione salvata per cliente', client.id);
                }
                
                ws.send(JSON.stringify({
                  success: true,
                  message: 'File inviato con successo!',
                  whatsappMessageId: ultraMsgResponse.id
                }));
              } else {
                throw new Error(ultraMsgResponse.error || 'Errore sconosciuto nell\'invio WhatsApp');
              }
            } catch (error: any) {
              console.error('🔌 [WS] Errore invio file:', error);
              ws.send(JSON.stringify({
                success: false,
                error: error.message || String(error)
              }));
            }
          }
        } catch (error) {
          console.error('🔌 [WS] Errore parsing messaggio:', error);
          ws.send(JSON.stringify({
            success: false,
            error: 'Errore parsing messaggio'
          }));
        }
      });
      
      ws.on('close', () => {
        console.log('🔌 [WS] Connessione chiusa');
      });
      
      ws.on('error', (error) => {
        console.error('🔌 [WS] Errore WebSocket:', error);
      });
    });
    */
    
    // Avvia il polling dei messaggi WhatsApp dopo l'avvio del server
    // TEMPORANEAMENTE DISABILITATO per diagnosi problemi caricamento frontend
    // startWhatsAppPolling();
    
    // Gmail polling temporaneamente disabilitato per diagnosi
    // startGmailPolling().catch(err => console.error('📧 ❌ Errore avvio Gmail polling:', err));
    
    // Registra gli adapter per l'ingestion multi-portale
    ingestionService.registerAdapter(new IdealistaAdapter());
    // DISABLED: Immobiliare Playwright adapter (using Apify only for accurate classification)
    // ingestionService.registerAdapter(new ImmobiliarePlaywrightAdapter());
    console.log('[INGESTION] Adapters registered successfully (Playwright-based)');
    
    // Avvia lo scheduler per i follow-up automatici (verifica ogni ora = 60 minuti)
    startFollowUpScheduler(60);
    
    // Avvia lo scheduler per la deduplicazione automatica (verifica ogni 7 giorni)
    deduplicationScheduler.start();
    
    // Avvia lo scheduler per l'ingestion automatica (verifica ogni giorno)
    ingestionScheduler.start();
    console.log('[INGESTION] Scheduler avviato con successo');
  });
})();
