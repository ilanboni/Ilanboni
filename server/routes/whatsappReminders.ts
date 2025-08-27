import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { communications, clients } from "@shared/schema";
import { eq, and, isNull, desc, or } from "drizzle-orm";
import { sendWhatsAppMessage } from "../lib/ultramsg";

const router = Router();

// Schema per validazione
const sendResponseSchema = z.object({
  phone: z.string().min(1, "Numero di telefono richiesto"),
  message: z.string().min(1, "Messaggio richiesto"),
});

// GET /api/whatsapp/reminders - Ottieni messaggi non risposti
router.get("/reminders", async (req, res) => {
  try {
    // Query per trovare messaggi WhatsApp in entrata che necessitano risposta
    const reminders = await db
      .select({
        id: communications.id,
        phone: communications.subject, // Il numero di telefono viene salvato in subject per WhatsApp
        lastMessage: communications.content,
        lastMessageAt: communications.createdAt,
        needsResponse: communications.needsResponse,
        clientId: communications.clientId,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
      })
      .from(communications)
      .leftJoin(clients, eq(communications.clientId, clients.id))
      .where(
        and(
          eq(communications.type, "whatsapp"),
          eq(communications.direction, "inbound"),
          eq(communications.needsResponse, true),
          isNull(communications.respondedAt)
        )
      )
      .orderBy(desc(communications.createdAt))
      .limit(10);

    // Formatta i risultati
    const formattedReminders = reminders.map((reminder) => ({
      id: reminder.id,
      phone: reminder.phone,
      clientName: reminder.clientFirstName 
        ? `${reminder.clientFirstName} ${reminder.clientLastName || ''}`.trim()
        : null,
      lastMessage: reminder.lastMessage || "Nessun contenuto",
      lastMessageAt: reminder.lastMessageAt,
      needsResponse: reminder.needsResponse,
    }));

    res.json(formattedReminders);
  } catch (error) {
    console.error("Errore nel recupero dei promemoria WhatsApp:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/whatsapp/conversation/:phone - Ottieni storico conversazione
router.get("/conversation/:phone", async (req, res) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    
    // Trova tutti i messaggi per questo numero di telefono
    const messages = await db
      .select({
        id: communications.id,
        content: communications.content,
        direction: communications.direction,
        createdAt: communications.createdAt,
        externalId: communications.externalId,
      })
      .from(communications)
      .where(
        and(
          eq(communications.type, "whatsapp"),
          eq(communications.subject, phone) // Il numero è salvato nel campo subject
        )
      )
      .orderBy(communications.createdAt)
      .limit(50); // Ultimi 50 messaggi

    res.json(messages);
  } catch (error) {
    console.error("Errore nel recupero della conversazione:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/whatsapp/send-response - Invia risposta a messaggio WhatsApp
router.post("/send-response", async (req, res) => {
  try {
    // Valida i dati
    const validation = sendResponseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Dati non validi",
        details: validation.error.issues
      });
    }

    const { phone, message } = validation.data;

    // Normalizza il numero di telefono per WhatsApp
    const normalizedPhone = phone.replace(/\+/g, '').replace(/\s/g, '');
    const whatsappNumber = `${normalizedPhone}@c.us`;

    console.log(`[WHATSAPP-RESPONSE] Invio risposta a ${phone}: ${message.substring(0, 50)}...`);

    // Invia il messaggio tramite UltraMsg
    const result = await sendWhatsAppMessage(whatsappNumber, message);

    if (!result.success) {
      console.error(`[WHATSAPP-RESPONSE] Errore invio:`, result.error);
      return res.status(500).json({ 
        error: "Errore nell'invio del messaggio",
        details: result.error
      });
    }

    console.log(`[WHATSAPP-RESPONSE] ✅ Messaggio inviato con successo. External ID: ${result.data?.id}`);

    // Trova il cliente associato al numero di telefono
    const client = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        or(
          eq(clients.phone, normalizedPhone),
          eq(clients.phone, `+${normalizedPhone}`),
          eq(clients.phone, phone)
        )
      )
      .limit(1);

    // Salva la risposta nel database
    const [newCommunication] = await db
      .insert(communications)
      .values({
        clientId: client.length > 0 ? client[0].id : null,
        type: "whatsapp",
        subject: phone, // Salva il numero originale
        content: message,
        direction: "outbound",
        externalId: result.data?.id?.toString() || null,
        status: "completed",
        managementStatus: "managed",
      })
      .returning({ id: communications.id });

    // Marca tutti i messaggi precedenti di questo numero come risposti
    await db
      .update(communications)
      .set({ 
        needsResponse: false,
        respondedAt: new Date()
      })
      .where(
        and(
          eq(communications.type, "whatsapp"),
          eq(communications.subject, phone),
          eq(communications.direction, "inbound"),
          eq(communications.needsResponse, true),
          isNull(communications.respondedAt)
        )
      );

    console.log(`[WHATSAPP-RESPONSE] ✅ Promemoria aggiornati per ${phone}`);

    res.json({ 
      success: true, 
      messageId: newCommunication.id,
      externalId: result.data?.id
    });

  } catch (error) {
    console.error("Errore nell'invio della risposta WhatsApp:", error);
    res.status(500).json({ 
      error: "Errore interno del server",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/whatsapp/sync - Forza sincronizzazione immediata messaggi
router.post("/sync", async (req, res) => {
  try {
    console.log(`[WHATSAPP-SYNC] 🔄 Forzando sincronizzazione immediata messaggi...`);
    
    // Importa la funzione per verificare i messaggi
    const { fetchRecentWhatsAppMessages } = await import("../lib/ultramsgApi.js");
    
    // Retry fino a 3 volte in caso di errori di rete
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[WHATSAPP-SYNC] Tentativo ${attempt}/3...`);
        
        // Esegui controllo immediato
        const result = await fetchRecentWhatsAppMessages();
        
        console.log(`[WHATSAPP-SYNC] ✅ Sincronizzazione completata - ${result.processedCount} nuovi messaggi elaborati`);
        
        return res.json({ 
          success: true,
          message: "Sincronizzazione completata con successo",
          processedCount: result.processedCount,
          ignoredCount: result.ignoredCount,
          attempt: attempt
        });
      } catch (attemptError) {
        lastError = attemptError;
        console.warn(`[WHATSAPP-SYNC] ⚠️ Tentativo ${attempt} fallito:`, attemptError instanceof Error ? attemptError.message : String(attemptError));
        
        // Aspetta 2 secondi prima del prossimo tentativo (eccetto l'ultimo)
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // Se tutti i tentativi falliscono
    throw lastError;
    
  } catch (error) {
    console.error("[WHATSAPP-SYNC] ❌ Errore nella sincronizzazione dopo 3 tentativi:", error);
    
    // Diagnosi dell'errore per l'utente
    let userMessage = "Errore nella sincronizzazione";
    if (error instanceof Error) {
      if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT')) {
        userMessage = "Errore di connessione con UltraMsg. Riprova tra qualche secondo.";
      } else if (error.message.includes('401') || error.message.includes('403')) {
        userMessage = "Errore di autenticazione UltraMsg. Verifica le credenziali API.";
      } else if (error.message.includes('429')) {
        userMessage = "Limite di velocità UltraMsg raggiunto. Riprova tra un minuto.";
      }
    }
    
    res.status(500).json({ 
      error: userMessage,
      technical: error instanceof Error ? error.message : String(error),
      retries: 3
    });
  }
});

export default router;