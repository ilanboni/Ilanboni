import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { fetchRecentWhatsAppMessages } from "./lib/ultramsgApi";

// Intervallo in millisecondi per il polling dei messaggi WhatsApp
const WHATSAPP_POLLING_INTERVAL = 60000; // 1 minuto

// Importa lo scheduler per i follow-up automatici
import { startFollowUpScheduler } from "./services/followUpScheduler";

// Configura l'agente virtuale (impostazione di default, può essere cambiato tramite API)
if (process.env.ENABLE_VIRTUAL_AGENT === undefined) {
  process.env.ENABLE_VIRTUAL_AGENT = 'false'; // Disabilitato di default
}

// Log iniziale per la configurazione dell'agente virtuale
console.log(`🤖 Agente virtuale ${process.env.ENABLE_VIRTUAL_AGENT === 'true' ? 'ABILITATO' : 'DISABILITATO'}`);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Avvia il polling dei messaggi WhatsApp dopo l'avvio del server
    startWhatsAppPolling();
    
    // Avvia lo scheduler per i follow-up automatici (verifica ogni ora = 60 minuti)
    startFollowUpScheduler(60);
  });
})();
