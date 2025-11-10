import express, { Request, Response } from 'express';
import axios from 'axios';

const router = express.Router();

// Endpoint per controllare la configurazione del webhook UltraMsg
router.get('/check-webhook', async (req: Request, res: Response) => {
  try {
    console.log("Verifica configurazione webhook UltraMsg");
    
    if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_API_KEY) {
      return res.status(400).json({
        success: false,
        error: "Credenziali UltraMsg mancanti"
      });
    }
    
    // URL dell'API di UltraMsg per verificare il webhook configurato
    const webhookApiUrl = `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/webhook`;
    
    // Richiesta per ottenere la configurazione attuale
    const response = await axios.get(webhookApiUrl, {
      params: {
        token: process.env.ULTRAMSG_API_KEY
      }
    });
    
    // Ottieni l'URL del webhook configurato
    const currentWebhook = response.data.webhook;
    
    // Determina l'URL ideale per il webhook in base all'ambiente
    const baseUrl = process.env.REPLIT_SLUG 
      ? `https://${process.env.REPLIT_SLUG}.replit.app` 
      : (process.env.BASE_URL || 'http://localhost:5000');
    
    const idealWebhookUrl = `${baseUrl}/api/whatsapp/webhook`;
    
    return res.status(200).json({
      success: true,
      current_webhook: currentWebhook,
      ideal_webhook: idealWebhookUrl,
      webhook_correctly_configured: currentWebhook === idealWebhookUrl,
      instance_id: process.env.ULTRAMSG_INSTANCE_ID,
      instructions: currentWebhook !== idealWebhookUrl 
        ? `Per configurare correttamente il webhook, vai su app.ultramsg.com > configura ${process.env.ULTRAMSG_INSTANCE_ID} > webhook e imposta ${idealWebhookUrl}` 
        : "Il webhook è configurato correttamente"
    });
  } catch (error: any) {
    console.error("Errore nella verifica del webhook:", error);
    return res.status(500).json({
      success: false,
      error: "Errore nella verifica del webhook",
      details: error.message || "Errore sconosciuto",
      axios_error: error.response?.data
    });
  }
});

// Endpoint per testare la ricezione di messaggi
router.get('/test-messages', async (req: Request, res: Response) => {
  try {
    console.log("Test ricezione messaggi recenti");
    
    if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_API_KEY) {
      return res.status(400).json({
        success: false,
        error: "Credenziali UltraMsg mancanti"
      });
    }
    
    // URL dell'API di UltraMsg per ottenere i messaggi recenti
    const messagesApiUrl = `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages`;
    
    // Richiesta per ottenere gli ultimi 10 messaggi
    const response = await axios.get(messagesApiUrl, {
      params: {
        token: process.env.ULTRAMSG_API_KEY,
        limit: 10,
        order: "desc"
      }
    });
    
    // Filtra i messaggi in entrata (non inviati da noi)
    const incomingMessages = response.data.messages
      ? response.data.messages.filter((msg: any) => !msg.fromMe && msg.from !== "390235981509@c.us")
      : [];
    
    return res.status(200).json({
      success: true,
      total_messages: response.data.messages ? response.data.messages.length : 0,
      incoming_messages: incomingMessages.length,
      recent_messages: incomingMessages.slice(0, 5).map((msg: any) => ({
        id: msg.id,
        from: msg.from,
        body: msg.body.substring(0, 50) + (msg.body.length > 50 ? '...' : ''),
        timestamp: new Date(msg.time * 1000).toISOString()
      }))
    });
  } catch (error: any) {
    console.error("Errore nel recupero dei messaggi:", error);
    return res.status(500).json({
      success: false,
      error: "Errore nel recupero dei messaggi",
      details: error.message || "Errore sconosciuto",
      axios_error: error.response?.data
    });
  }
});

// Endpoint per configurare automaticamente il webhook UltraMsg
router.post('/configure-webhook', async (req: Request, res: Response) => {
  try {
    console.log("Configurazione automatica webhook UltraMsg");
    
    if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_API_KEY) {
      return res.status(400).json({
        success: false,
        error: "Credenziali UltraMsg mancanti"
      });
    }
    
    // URL dell'API UltraMsg per configurare il webhook
    const hookUrl = `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/webhook`;
    
    // Determina l'URL del webhook basato sull'ambiente (STESSA LOGICA DI check-webhook)
    const baseUrl = process.env.REPLIT_SLUG 
      ? `https://${process.env.REPLIT_SLUG}.replit.app` 
      : (process.env.BASE_URL || 'http://localhost:5000');
    
    const webhookUrl = `${baseUrl}/api/whatsapp/webhook`;
    console.log(`Configurazione webhook su: ${webhookUrl}`);
    
    // Invia la richiesta per aggiornare il webhook
    const updateResponse = await axios.post(
      hookUrl,
      new URLSearchParams({
        webhook: webhookUrl
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        params: {
          token: process.env.ULTRAMSG_API_KEY
        }
      }
    );
    
    if (updateResponse.data && updateResponse.data.status === 'success') {
      console.log("✅ Webhook UltraMsg aggiornato con successo");
      return res.status(200).json({
        success: true,
        message: "Webhook UltraMsg aggiornato con successo",
        webhook_url: webhookUrl,
        response: updateResponse.data
      });
    } else {
      console.error("❌ Errore nell'aggiornamento del webhook:", updateResponse.data);
      return res.status(400).json({
        success: false,
        error: "Errore nell'aggiornamento del webhook",
        details: updateResponse.data
      });
    }
  } catch (error: any) {
    console.error("Errore nella configurazione del webhook:", error);
    return res.status(500).json({
      success: false,
      error: "Errore nella configurazione del webhook",
      details: error.message || "Errore sconosciuto",
      axios_error: error.response?.data
    });
  }
});

export default router;