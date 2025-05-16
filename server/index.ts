import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { fetchRecentWhatsAppMessages } from "./lib/ultramsgApi";

// Intervallo in millisecondi per il polling dei messaggi WhatsApp
const WHATSAPP_POLLING_INTERVAL = 60000; // 1 minuto

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
    // Uso un timestamp per i log di debug solo ogni 5 minuti
    const now = new Date();
    const minutes = now.getMinutes();
    const isVerboseLogging = minutes % 5 === 0;
    
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
  // Endpoint di emergenza per inserire direttamente cliente nel database
  app.post("/api/clients/direct-sql", async (req: Request, res: Response) => {
    try {
      console.log("=============================================");
      console.log("RICHIESTA INSERIMENTO DIRETTO SQL CLIENTE");
      console.log("Dati ricevuti:", JSON.stringify(req.body, null, 2));
      
      if (!req.body || !req.body.type || !req.body.firstName || !req.body.lastName || !req.body.phone) {
        return res.status(400).json({
          success: false,
          error: "Dati obbligatori mancanti",
          detail: "Servono almeno type, firstName, lastName e phone"
        });
      }
      
      const { pool } = require('./db');
      
      // Crea query SQL per cliente (usa snake_case per i nomi colonne)
      const clientQuery = `
        INSERT INTO clients (
          type, 
          salutation, 
          first_name, 
          last_name, 
          is_friend, 
          email, 
          phone, 
          religion,
          contract_type, 
          notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING id;
      `;
      
      // Parametri per la query cliente
      const clientParams = [
        req.body.type,
        req.body.salutation || "",
        req.body.firstName,
        req.body.lastName,
        req.body.isFriend === true,
        req.body.email || "",
        req.body.phone,
        req.body.religion || "",
        req.body.contractType || null,
        req.body.notes || ""
      ];
      
      // Esegui query cliente
      const clientResult = await pool.query(clientQuery, clientParams);
      const clientId = clientResult.rows[0].id;
      
      console.log("Cliente creato con ID:", clientId);
      
      // Se è buyer, crea anche preferenze
      if (req.body.type === "buyer" && req.body.buyer) {
        try {
          // Normalizza i valori numerici
          const minSize = parseInt(String(req.body.buyer.minSize)) || null;
          const maxPrice = parseInt(String(req.body.buyer.maxPrice)) || null;
          const urgency = parseInt(String(req.body.buyer.urgency)) || 3;
          const rating = parseInt(String(req.body.buyer.rating)) || 3;
          
          // Query SQL per buyer (usa snake_case)
          const buyerQuery = `
            INSERT INTO buyers (
              client_id,
              search_area,
              min_size,
              max_price,
              urgency,
              rating,
              search_notes
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7
            ) RETURNING id;
          `;
          
          // Parametri query buyer
          const buyerParams = [
            clientId,
            JSON.stringify(req.body.buyer.searchArea || null),
            minSize,
            maxPrice,
            urgency,
            rating,
            req.body.buyer.searchNotes || ""
          ];
          
          // Esegui query buyer
          const buyerResult = await pool.query(buyerQuery, buyerParams);
          const buyerId = buyerResult.rows[0].id;
          
          console.log("Buyer creato con ID:", buyerId);
          
          return res.status(201).json({
            success: true,
            client: { id: clientId, type: req.body.type },
            buyer: { id: buyerId, minSize, maxPrice }
          });
        } catch (buyerError) {
          console.error("Errore creazione buyer:", buyerError);
          return res.status(201).json({
            success: true,
            client: { id: clientId, type: req.body.type },
            warning: "Cliente creato ma errore nella creazione buyer",
            error: String(buyerError)
          });
        }
      } else {
        return res.status(201).json({
          success: true,
          client: { id: clientId, type: req.body.type }
        });
      }
    } catch (error) {
      console.error("ERRORE inserimento diretto:", error);
      return res.status(500).json({ 
        success: false, 
        error: String(error)
      });
    }
  });
  
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
  });
})();
