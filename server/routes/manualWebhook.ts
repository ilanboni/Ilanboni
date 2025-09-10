import { Request, Response } from 'express';
import { storage } from '../storage';
// Importiamo il service di analisi sentimento
// import { analyzeMessageSentiment } from '../lib/openai';

interface ManualMessage {
  phoneNumber: string;
  message: string;
  timestamp?: string;
}

/**
 * Endpoint per inserimento manuale messaggi WhatsApp
 * Utile quando il webhook UltraMsg non funziona
 */
export async function manualWebhookHandler(req: Request, res: Response) {
  try {
    const { phoneNumber, message, timestamp }: ManualMessage = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber e message sono obbligatori'
      });
    }

    console.log('[MANUAL-WEBHOOK] Inserimento manuale messaggio:', {
      phoneNumber,
      message: message.substring(0, 50) + '...',
      timestamp
    });

    // Normalizza il numero di telefono
    const normalizedPhone = phoneNumber.replace(/^\+/, '').replace('@c.us', '');
    
    // Cerca o crea il cliente
    let client = await storage.getClientByPhone(normalizedPhone);
    
    if (!client) {
      console.log('[MANUAL-WEBHOOK] Creazione nuovo cliente per numero:', normalizedPhone);
      client = await storage.createClient({
        type: 'buyer',
        salutation: 'Gentile Cliente',
        firstName: 'Cliente',
        lastName: '',
        isFriend: false,
        phone: normalizedPhone,
        notes: `Cliente creato manualmente da messaggio WhatsApp del ${new Date().toISOString().split('T')[0]}`
      });
    }

    // Crea la comunicazione
    const messageTime = timestamp ? new Date(timestamp) : new Date();
    
    const communication = await storage.createCommunication({
      clientId: client.id,
      type: 'whatsapp',
      subject: 'Messaggio WhatsApp',
      content: message,
      direction: 'inbound',
      sentAt: messageTime.toISOString(),
      externalId: `manual_${Date.now()}`
    });

    console.log('[MANUAL-WEBHOOK] Comunicazione creata:', communication.id);

    // ✅ NUOVO: Crea automaticamente un task per questa comunicazione in ingresso
    try {
      const { createInboundTask } = await import('../services/inboundTaskManager');
      await createInboundTask(
        communication.id,
        client.id,
        undefined, // propertyId - sarà determinato successivamente se necessario
        undefined, // sharedPropertyId - sarà determinato successivamente se necessario
        'whatsapp',
        message
      );
      console.log('[MANUAL-WEBHOOK] ✅ Task automatico creato per comunicazione');
    } catch (error) {
      console.error('[MANUAL-WEBHOOK] ❌ Errore creazione task automatico:', error);
    }

    // Analizza il sentimento e crea task se necessario
    try {
      // Usa il servizio di sentiment analysis esistente
      const { processClientResponse } = await import('../services/sentimentAnalysis');
      
      // Trova l'ultima comunicazione in uscita per questo cliente
      const communications = await storage.getCommunicationsByClient(client.id);
      const lastOutboundComm = communications.find(comm => comm.direction === 'outbound');
      
      if (lastOutboundComm) {
        console.log('[MANUAL-WEBHOOK] Analisi sentimento in corso...');
        
        await processClientResponse(
          message,
          lastOutboundComm.id,
          client.id,
          undefined // nessun property ID per ora
        );

        console.log('[MANUAL-WEBHOOK] Analisi sentimento completata');
      }
    } catch (error) {
      console.error('[MANUAL-WEBHOOK] Errore analisi sentimento:', error);
    }

    res.json({
      success: true,
      message: 'Messaggio elaborato con successo',
      clientId: client.id,
      communicationId: communication.id
    });

  } catch (error) {
    console.error('[MANUAL-WEBHOOK] Errore:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nell\'elaborazione del messaggio'
    });
  }
}