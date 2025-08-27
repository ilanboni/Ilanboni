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
    // Usa il pool direttamente per evitare problemi di Drizzle
    const { pool } = await import("../db");
    const result = await pool.query(`
      SELECT 
        c.id,
        c.subject as phone,
        c.content as last_message,
        c.created_at as last_message_at,
        c.needs_response,
        c.client_id,
        cl.first_name,
        cl.last_name
      FROM communications c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.type = 'whatsapp' 
        AND c.direction = 'inbound'
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    console.log("Query result:", result.rows);

    // Formatta i risultati
    const formattedReminders = result.rows.map((row: any) => ({
      id: row.id,
      phone: row.phone,
      clientName: row.first_name 
        ? `${row.first_name} ${row.last_name || ''}`.trim()
        : null,
      lastMessage: row.last_message || "Nessun contenuto",
      lastMessageAt: row.last_message_at,
      needsResponse: row.needs_response,
    }));

    console.log("Formatted reminders:", formattedReminders);
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

// POST /api/whatsapp/sync - Aggiorna dashboard con messaggi recenti
router.post("/sync", async (req, res) => {
  try {
    console.log(`[WHATSAPP-SYNC] 🔄 Aggiornamento dashboard WhatsApp...`);
    
    // Conta i messaggi WhatsApp recenti che necessitano risposta
    const recentMessages = await db
      .select({
        id: communications.id,
        clientId: communications.clientId,
        subject: communications.subject,
        content: communications.content,
        createdAt: communications.createdAt,
        direction: communications.direction,
        needsResponse: communications.needsResponse
      })
      .from(communications)
      .where(
        and(
          eq(communications.type, "whatsapp"),
          eq(communications.direction, "inbound"),
          eq(communications.needsResponse, true),
          isNull(communications.respondedAt)
        )
      )
      .orderBy(desc(communications.createdAt));
    
    console.log(`[WHATSAPP-SYNC] ✅ Dashboard aggiornato - ${recentMessages.length} messaggi che necessitano risposta`);
    
    res.json({ 
      success: true,
      message: "Dashboard aggiornato con successo",
      remindersCount: recentMessages.length,
      syncTime: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("[WHATSAPP-SYNC] ❌ Errore nell'aggiornamento dashboard:", error);
    res.status(500).json({ 
      error: "Errore nell'aggiornamento dashboard",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;