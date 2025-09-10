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
        CASE 
          WHEN cl.phone IS NOT NULL AND cl.phone != 'N/D' THEN cl.phone
          ELSE c.subject
        END as phone,
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
    console.log(`[CONVERSATION] Ricerca conversazione per numero: ${phone}`);
    
    // Prima trova il cliente con questo numero di telefono
    const client = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.phone, phone))
      .limit(1);
    
    console.log(`[CONVERSATION] Cliente trovato:`, client);

    let messages;
    
    if (client.length > 0) {
      console.log(`[CONVERSATION] Cercando messaggi per client_id: ${client[0].id} OR subject: ${phone}`);
      // Se esiste un cliente, cerca i messaggi per client_id O per subject con il numero
      messages = await db
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
            or(
              eq(communications.subject, phone),
              eq(communications.clientId, client[0].id)
            )
          )
        )
        .orderBy(communications.createdAt)
        .limit(50);
      console.log(`[CONVERSATION] Messaggi trovati:`, messages.length);
    } else {
      // Se non esiste un cliente, cerca solo per subject
      messages = await db
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
            eq(communications.subject, phone)
          )
        )
        .orderBy(communications.createdAt)
        .limit(50);
    }

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

    // ✅ NUOVO: Marca task di comunicazione come completati quando si invia risposta
    try {
      const { markInboundTaskCompleted } = await import('../services/inboundTaskManager');
      if (client.length > 0) {
        await markInboundTaskCompleted(client[0].id, 'whatsapp');
      }
    } catch (error) {
      console.error('[WHATSAPP-RESPONSE] ❌ Errore marcatura task completati:', error);
    }

    // Marca tutti i messaggi precedenti di questo numero come risposti
    // Cerca sia per subject che per client_id
    const updateConditions = [
      eq(communications.type, "whatsapp"),
      eq(communications.direction, "inbound"),
      eq(communications.needsResponse, true),
      isNull(communications.respondedAt)
    ];

    if (client.length > 0) {
      // Se esiste un cliente, cerca per client_id OR subject
      updateConditions.push(
        or(
          eq(communications.subject, phone),
          eq(communications.clientId, client[0].id)
        )
      );
    } else {
      // Se non esiste un cliente, cerca solo per subject
      updateConditions.push(eq(communications.subject, phone));
    }

    const updateResult = await db
      .update(communications)
      .set({ 
        needsResponse: false,
        respondedAt: new Date()
      })
      .where(and(...updateConditions))
      .returning({ id: communications.id });

    console.log(`[WHATSAPP-RESPONSE] ✅ Promemoria aggiornati per ${phone}. Record aggiornati: ${updateResult.length}`, updateResult.map(r => r.id));

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

// POST /api/whatsapp/generate-ai-response - Genera risposta IA intelligente
router.post("/generate-ai-response", async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: "Numero di telefono richiesto" });
    }

    console.log(`[AI-RESPONSE] 🤖 Generazione risposta IA per ${phone}`);

    // Recupera il cliente dal numero di telefono
    const { pool } = await import("../db");
    const clientResult = await pool.query(`
      SELECT c.*, b.search_area, b.max_price, b.min_size, b.urgency, b.rating, b.search_notes
      FROM clients c
      LEFT JOIN buyers b ON c.id = b.client_id
      WHERE c.phone = $1 OR c.phone = $2 OR c.phone = $3
      LIMIT 1
    `, [phone, phone.replace(/^\+/, ''), phone.replace(/^39/, '0')]);

    // Recupera la conversazione completa
    const conversationResult = await pool.query(`
      SELECT content, direction, created_at, summary
      FROM communications
      WHERE (subject = $1 OR subject = $2) AND type = 'whatsapp'
      ORDER BY created_at ASC
      LIMIT 10
    `, [phone, phone.replace(/^\+/, '')]);

    const client = clientResult.rows[0];
    const conversation = conversationResult.rows;

    // Costruisci il prompt per l'IA
    let prompt = `Sei un agente immobiliare professionale che deve rispondere a un cliente WhatsApp.

INFORMAZIONI CLIENTE:`;

    if (client) {
      prompt += `
- Nome: ${client.first_name} ${client.last_name}
- Tipologia: ${client.type || 'Non specificato'}
- Personalità: ${client.personality || 'Non specificata'}`;
      
      if (client.personality) {
        switch (client.personality.toLowerCase()) {
          case 'emotivo':
            prompt += `\n- STILE COMUNICAZIONE: Usa un tono caloroso, empatico, parla delle emozioni e del "sentirsi a casa"`;
            break;
          case 'analitico':
            prompt += `\n- STILE COMUNICAZIONE: Fornisci dati precisi, caratteristiche tecniche, metrature, prezzi dettagliati`;
            break;
          case 'aperto':
            prompt += `\n- STILE COMUNICAZIONE: Usa un tono amichevole, colloquiale, puoi essere più informale`;
            break;
          default:
            prompt += `\n- STILE COMUNICAZIONE: Mantieni un tono professionale ma cordiale`;
        }
      }

      if (client.search_area) {
        const areas = Array.isArray(client.search_area) ? client.search_area.join(', ') : JSON.stringify(client.search_area);
        prompt += `\n- Zone di interesse: ${areas}`;
      }
      if (client.max_price) {
        prompt += `\n- Budget massimo: €${client.max_price}`;
      }
      if (client.min_size) {
        prompt += `\n- Metratura minima: ${client.min_size}mq`;
      }
      if (client.search_notes) {
        prompt += `\n- Note particolari: ${client.search_notes}`;
      }
    } else {
      prompt += `\n- Cliente sconosciuto, usa un tono professionale ma cordiale`;
    }

    prompt += `

CONVERSAZIONE PRECEDENTE:`;
    
    if (conversation.length > 0) {
      conversation.forEach(msg => {
        const direction = msg.direction === 'inbound' ? 'CLIENTE' : 'AGENTE';
        const time = new Date(msg.created_at).toLocaleString('it-IT');
        prompt += `\n[${time}] ${direction}: ${msg.content}`;
      });
    } else {
      prompt += `\nNessuna conversazione precedente`;
    }

    prompt += `

ISTRUZIONI:
1. Rispondi all'ultimo messaggio del cliente in modo appropriato
2. Mantieni un tono professionale ma cordiale 
3. Se è una richiesta di informazioni, fornisci dettagli utili
4. Se è una richiesta di appuntamento, proponi orari disponibili
5. Personalizza la risposta in base alla personalità del cliente
6. Usa massimo 1-2 frasi, mantieni conciso
7. Firma sempre con "Ilan Boni - Cavour Immobiliare"

Genera una risposta appropriata:`;

    // Chiamata all'IA (assumendo che esista un servizio IA)
    const { generateResponse } = await import("../lib/aiService");
    const aiResponse = await generateResponse(prompt);

    console.log(`[AI-RESPONSE] ✅ Risposta generata per ${phone}: ${aiResponse.substring(0, 50)}...`);

    res.json({ 
      success: true,
      aiResponse: aiResponse,
      clientInfo: client ? {
        name: `${client.first_name} ${client.last_name}`,
        personality: client.personality,
        type: client.type
      } : null
    });

  } catch (error) {
    console.error("[AI-RESPONSE] ❌ Errore nella generazione risposta IA:", error);
    res.status(500).json({ 
      error: "Errore nella generazione risposta IA",
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