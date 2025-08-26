import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { clients, sellers, communications } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { sendWhatsAppMessage } from '../lib/ultramsg';

const router = Router();

// Schema for mail merge request
const mailMergeSchema = z.object({
  appellativo: z.string().min(1, 'Appellativo richiesto'),
  cognome: z.string().min(1, 'Cognome richiesto'),
  indirizzo: z.string().min(1, 'Indirizzo richiesto'),
  telefono: z.string().min(1, 'Telefono richiesto'),
  vistoSu: z.string().min(1, 'Visto su richiesto'),
  caratteristiche: z.string().min(1, 'Caratteristiche richieste'),
  message: z.string().min(1, 'Messaggio richiesto')
});

// Normalize phone number for consistency
function normalizePhone(phone: string): string {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // If starts with +39, keep it
  if (normalized.startsWith('+39')) {
    return normalized;
  }
  
  // If starts with 39, add +
  if (normalized.startsWith('39')) {
    return '+' + normalized;
  }
  
  // If starts with 3 (mobile), add +39
  if (normalized.startsWith('3')) {
    return '+39' + normalized;
  }
  
  // If starts with 0, remove it and add +39
  if (normalized.startsWith('0')) {
    return '+39' + normalized.substring(1);
  }
  
  return normalized;
}

// Send mail merge message
router.post('/send', async (req, res) => {
  try {
    const validatedData = mailMergeSchema.parse(req.body);
    const normalizedPhone = normalizePhone(validatedData.telefono);
    
    console.log(`[MAIL MERGE] Elaborazione richiesta per ${validatedData.appellativo} ${validatedData.cognome}, telefono: ${normalizedPhone}`);
    
    // Check if client already exists by phone
    const existingClients = await db.select()
      .from(clients)
      .where(eq(clients.phone, normalizedPhone))
      .limit(1);
    
    let clientId: number;
    let isNewClient = false;
    
    if (existingClients.length > 0) {
      clientId = existingClients[0].id;
      console.log(`[MAIL MERGE] Cliente esistente trovato: ID ${clientId}`);
      
      // Check if we already sent a message to this client
      const existingCommunications = await db.select()
        .from(communications)
        .where(and(
          eq(communications.clientId, clientId),
          eq(communications.direction, 'outgoing'),
          eq(communications.type, 'whatsapp')
        ))
        .limit(1);
      
      if (existingCommunications.length > 0) {
        console.log(`[MAIL MERGE] Messaggio già inviato al cliente ${clientId}`);
        return res.json({
          success: true,
          isDuplicate: true,
          message: 'Cliente già presente con messaggi inviati in precedenza'
        });
      }
    } else {
      // Create new seller client
      console.log(`[MAIL MERGE] Creazione nuovo cliente seller`);
      
      const [newClient] = await db.insert(clients).values({
        type: 'seller',
        salutation: validatedData.appellativo.toLowerCase().includes('sig') ? 'sig' : 'dott',
        firstName: validatedData.cognome.split(' ')[0], // First word as firstName
        lastName: validatedData.cognome.split(' ').slice(1).join(' ') || '', // Rest as lastName
        phone: normalizedPhone,
        email: null,
        notes: `Cliente creato da mail merge - Visto su: ${validatedData.vistoSu}`
      }).returning();
      
      clientId = newClient.id;
      isNewClient = true;
      
      // Create seller record with property details
      await db.insert(sellers).values({
        clientId: clientId,
        propertyAddress: validatedData.indirizzo,
        propertyDescription: `Proprietà vista su ${validatedData.vistoSu}. Caratteristiche: ${validatedData.caratteristiche}`,
        hasExclusiveContract: false,
        sellingReason: 'Non specificato',
        timeline: 'Non specificato'
      });
      
      console.log(`[MAIL MERGE] Nuovo cliente seller creato: ID ${clientId}`);
    }
    
    // Send WhatsApp message
    try {
      console.log(`[MAIL MERGE] Invio messaggio WhatsApp a ${normalizedPhone}`);
      
      const whatsappResult = await sendWhatsAppMessage(normalizedPhone, validatedData.message);
      
      if (whatsappResult.success) {
        // Save communication record
        await db.insert(communications).values({
          clientId: clientId,
          type: 'whatsapp',
          direction: 'outgoing',
          content: validatedData.message,
          timestamp: new Date(),
          status: 'sent',
          externalId: whatsappResult.messageId?.toString() || null,
          metadata: JSON.stringify({
            mailMerge: true,
            vistoSu: validatedData.vistoSu,
            caratteristiche: validatedData.caratteristiche,
            indirizzo: validatedData.indirizzo
          })
        });
        
        console.log(`[MAIL MERGE] Messaggio inviato con successo a ${validatedData.appellativo} ${validatedData.cognome}`);
        
        res.json({
          success: true,
          isDuplicate: false,
          isNewClient: isNewClient,
          clientId: clientId,
          message: 'Messaggio inviato con successo'
        });
      } else {
        console.error(`[MAIL MERGE] Errore invio WhatsApp:`, whatsappResult.error);
        res.json({
          success: false,
          message: `Errore invio WhatsApp: ${whatsappResult.error}`
        });
      }
    } catch (whatsappError) {
      console.error(`[MAIL MERGE] Errore durante invio WhatsApp:`, whatsappError);
      res.json({
        success: false,
        message: 'Errore durante l\'invio del messaggio WhatsApp'
      });
    }
    
  } catch (error) {
    console.error('[MAIL MERGE] Errore nella richiesta:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Dati non validi',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Errore del server durante l\'elaborazione'
    });
  }
});

export default router;