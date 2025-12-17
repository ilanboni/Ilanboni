import axios from 'axios';

interface WebhookSettings {
  webhookUrl: string;
  webhookMessageReceived: boolean;
  webhookMessageCreate: boolean;
  webhookMessageAck: boolean;
}

export async function getUltraMsgSettings(): Promise<any> {
  if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_API_KEY) {
    return { success: false, error: "Credenziali UltraMsg mancanti" };
  }
  
  try {
    const response = await axios.get(
      `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/instance/settings`,
      { params: { token: process.env.ULTRAMSG_API_KEY } }
    );
    return { success: true, settings: response.data };
  } catch (error: any) {
    return { success: false, error: error.response?.data || error.message };
  }
}

export async function configureUltraMsgWebhook(settings: Partial<WebhookSettings>): Promise<any> {
  if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_API_KEY) {
    return { success: false, error: "Credenziali UltraMsg mancanti" };
  }
  
  try {
    const params = new URLSearchParams();
    
    if (settings.webhookUrl) {
      params.append('webhookUrl', settings.webhookUrl);
    }
    if (settings.webhookMessageReceived !== undefined) {
      params.append('webhookMessageReceived', settings.webhookMessageReceived ? 'true' : 'false');
    }
    if (settings.webhookMessageCreate !== undefined) {
      params.append('webhookMessageCreate', settings.webhookMessageCreate ? 'true' : 'false');
    }
    if (settings.webhookMessageAck !== undefined) {
      params.append('webhookMessageAck', settings.webhookMessageAck ? 'true' : 'false');
    }
    
    const response = await axios.post(
      `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/instance/settings`,
      params,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        params: { token: process.env.ULTRAMSG_API_KEY }
      }
    );
    
    console.log('[ULTRAMSG-CONFIG] Risposta configurazione:', response.data);
    return { success: true, result: response.data };
  } catch (error: any) {
    console.error('[ULTRAMSG-CONFIG] Errore:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

export async function verifyAndConfigureUltraMsgWebhook() {
  try {
    if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_API_KEY) {
      console.error("Impossibile verificare il webhook: credenziali UltraMsg mancanti");
      return { success: false, error: "Credenziali UltraMsg mancanti" };
    }
    
    const webhookBaseUrl = process.env.REPLIT_SLUG 
      ? `https://${process.env.REPLIT_SLUG}.replit.app` 
      : process.env.BASE_URL || 'http://localhost:5000';
    
    const webhookUrl = `${webhookBaseUrl}/api/whatsapp/webhook`;
    console.log(`[ULTRAMSG-CONFIG] URL webhook desiderato: ${webhookUrl}`);
    
    const currentSettings = await getUltraMsgSettings();
    console.log('[ULTRAMSG-CONFIG] Impostazioni attuali:', currentSettings);
    
    return {
      success: true,
      message: "Verifica completata",
      desired_webhook: webhookUrl,
      current_settings: currentSettings.settings,
      instructions: {
        it: "Per abilitare la registrazione di TUTTI i messaggi WhatsApp (inviati e ricevuti), configura UltraMsg con:",
        settings: {
          webhookUrl: webhookUrl,
          webhookMessageReceived: true,
          webhookMessageCreate: true,
          webhookMessageAck: true
        }
      }
    };
    
  } catch (error: any) {
    console.error("Errore nella verifica del webhook UltraMsg:", error);
    return {
      success: false,
      error: "Errore nella verifica del webhook",
      details: error.message || "Errore sconosciuto"
    };
  }
}

export async function enableOutboundWebhooks(): Promise<any> {
  console.log('[ULTRAMSG-CONFIG] Abilitazione webhook per messaggi in uscita...');
  
  const webhookBaseUrl = process.env.REPLIT_SLUG 
    ? `https://${process.env.REPLIT_SLUG}.replit.app` 
    : process.env.BASE_URL || 'http://localhost:5000';
  
  const webhookUrl = `${webhookBaseUrl}/api/whatsapp/webhook`;
  
  return configureUltraMsgWebhook({
    webhookUrl,
    webhookMessageReceived: true,
    webhookMessageCreate: true,
    webhookMessageAck: true
  });
}
