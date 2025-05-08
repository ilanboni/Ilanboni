import axios from 'axios';
import express, { Request, Response } from 'express';

/**
 * Questa classe gestisce l'inoltro dei webhooks da webhook.site al server locale
 */
export class WebhookForwarder {
  private forwardKey: string;
  
  constructor(forwardKey: string) {
    this.forwardKey = forwardKey;
  }
  
  /**
   * Registra le route per il forwarder
   * @param app Express app
   */
  registerRoutes(app: express.Express) {
    // Endpoint che riceve i webhooks da webhook.site e li inoltra alla funzione locale
    app.post("/api/webhooksite/forward", async (req: Request, res: Response) => {
      try {
        const { key, payload } = req.body;
        
        // Verifica la chiave di sicurezza
        if (key !== this.forwardKey) {
          console.error("Chiave di inoltro non valida:", key);
          return res.status(403).json({ error: "Chiave di sicurezza non valida" });
        }
        
        console.log("=== WEBHOOK SITE FORWARDER ===");
        console.log("Ricevuto payload da webhook.site:", JSON.stringify(payload, null, 2));
        
        // Inoltra il payload al webhook locale di WhatsApp
        try {
          const localResponse = await axios.post(
            'http://localhost:5000/api/whatsapp/webhook',
            payload,
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-By': 'webhook-site-forwarder'
              }
            }
          );
          
          console.log("Risposta dal webhook locale:", localResponse.status, localResponse.data);
          return res.status(200).json({ 
            success: true, 
            message: "Payload inoltrato con successo", 
            response: localResponse.data 
          });
        } catch (localError: any) {
          console.error("Errore nell'inoltro al webhook locale:", localError.message);
          return res.status(500).json({ 
            error: "Errore nell'inoltro al webhook locale", 
            details: localError.message
          });
        }
      } catch (error: any) {
        console.error("Errore generale nel forwarder:", error);
        return res.status(500).json({ error: "Errore di inoltro", details: error.message });
      }
    });
    
    // Endpoint di test per verificare che il forwarder funzioni
    app.get("/api/webhooksite/ping", (req: Request, res: Response) => {
      res.status(200).json({ 
        success: true, 
        message: "Webhook Site Forwarder attivo", 
        timestamp: new Date().toISOString()
      });
    });
  }
}

// Chiave di sicurezza per l'inoltro (generata casualmente)
const FORWARD_KEY = process.env.WEBHOOK_FORWARD_KEY || 'webhook-site-forward-key-' + Math.random().toString(36).substring(2, 15);

export function getWebhookForwarder(): WebhookForwarder {
  return new WebhookForwarder(FORWARD_KEY);
}

export function getForwardKey(): string {
  return FORWARD_KEY;
}