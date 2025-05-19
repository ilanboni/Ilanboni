import axios from 'axios';

/**
 * Utility per verificare e configurare il webhook UltraMsg
 */
export async function verifyAndConfigureUltraMsgWebhook() {
  try {
    if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_API_KEY) {
      console.error("Impossibile verificare il webhook: credenziali UltraMsg mancanti");
      return {
        success: false,
        error: "Credenziali UltraMsg mancanti"
      };
    }
    
    // URL per la gestione degli hook UltraMsg
    const hookUrl = `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/webhook`;
    
    // 1. Prima verifichiamo la configurazione attuale
    const response = await axios.get(hookUrl, {
      params: {
        token: process.env.ULTRAMSG_API_KEY
      }
    });
    
    console.log("Configurazione webhook attuale:", response.data);
    
    // 2. Determina l'URL del webhook basato sull'ambiente Replit
    const webhookBaseUrl = process.env.REPLIT_SLUG 
      ? `https://${process.env.REPLIT_SLUG}.replit.app` 
      : process.env.BASE_URL || 'http://localhost:5000';
    
    const webhookUrl = `${webhookBaseUrl}/api/whatsapp/webhook`;
    console.log(`URL webhook desiderato: ${webhookUrl}`);
    
    // 3. Controlla se il webhook attualmente configurato corrisponde
    const currentWebhook = response.data?.webhook;
    const webHookInstance = response.data?.instance_id;
    
    if (currentWebhook === webhookUrl) {
      console.log("✅ Il webhook UltraMsg è già configurato correttamente");
      return {
        success: true,
        message: "Il webhook UltraMsg è già configurato correttamente",
        webhook_url: webhookUrl,
        instance_id: webHookInstance
      };
    }
    
    // 4. Se necessario, configura il webhook
    console.log(`⚠️ Il webhook attuale (${currentWebhook}) non corrisponde al desiderato (${webhookUrl})`);
    
    // Nota: questo passaggio è disabilitato per sicurezza - in un ambiente di produzione,
    // dovrebbe essere abilitato solo dopo un'adeguata verifica
    /*
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
      return {
        success: true,
        message: "Webhook UltraMsg aggiornato con successo",
        webhook_url: webhookUrl
      };
    } else {
      console.error("❌ Errore nell'aggiornamento del webhook:", updateResponse.data);
      return {
        success: false,
        error: "Errore nell'aggiornamento del webhook",
        details: updateResponse.data
      };
    }
    */
    
    return {
      success: true,
      message: "Verifica webhook completata, richiede aggiornamento manuale",
      current_webhook: currentWebhook,
      desired_webhook: webhookUrl,
      instance_id: webHookInstance
    };
    
  } catch (error: any) {
    console.error("Errore nella verifica del webhook UltraMsg:", error);
    return {
      success: false,
      error: "Errore nella verifica del webhook",
      details: error.message || "Errore sconosciuto",
      axios_error: error.response?.data
    };
  }
}