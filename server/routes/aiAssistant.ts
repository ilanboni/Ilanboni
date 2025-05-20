import { Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { communications, clients, properties, conversationThreads, communicationProperties } from "@shared/schema";
import { analyzeMessageAndGenerateResponse, createOrUpdateThread } from "../services/aiResponseGenerator";
import { eq, and, desc, sql } from "drizzle-orm";

export async function registerAIAssistantRoutes(app: any) {
  // Endpoint per generare una risposta AI da mostrare nel popup
  app.post("/api/ai/generate-response", async (req: Request, res: Response) => {
    try {
      const { messageId, clientId } = req.body;
      
      if (!messageId) {
        return res.status(400).json({ 
          success: false, 
          message: "ID messaggio mancante" 
        });
      }
      
      if (!clientId) {
        return res.status(400).json({ 
          success: false, 
          message: "ID cliente mancante" 
        });
      }
      
      // Recupera il messaggio dal database
      const [message] = await db
        .select()
        .from(communications)
        .where(eq(communications.id, messageId));
      
      if (!message) {
        return res.status(404).json({ 
          success: false, 
          message: "Messaggio non trovato" 
        });
      }
      
      // Recupera i messaggi precedenti per contesto (ultimi 5)
      const previousMessages = await db
        .select()
        .from(communications)
        .where(
          and(
            eq(communications.clientId, clientId),
            message.threadId ? eq(communications.threadId, message.threadId) : sql`1=1`
          )
        )
        .orderBy(desc(communications.createdAt))
        .limit(5);
      
      // Converti i messaggi nel formato richiesto dall'API di analisi
      const contextMessages = previousMessages
        .map(msg => ({
          content: msg.content || "",
          direction: msg.direction as "inbound" | "outbound"
        }))
        .reverse(); // Ordina dal più vecchio al più recente
      
      // Genera la risposta IA
      const analysisResult = await analyzeMessageAndGenerateResponse(
        message.content || "",
        clientId,
        contextMessages
      );
      
      // Ottieni i dettagli degli immobili rilevati
      let detectedProperties = [];
      if (analysisResult.detectedPropertyIds.length > 0) {
        detectedProperties = await db
          .select({
            id: properties.id,
            address: properties.address
          })
          .from(properties)
          .where(
            sql`${properties.id} IN (${analysisResult.detectedPropertyIds.join(",")})`
          );
      }
      
      // Ottieni o crea il thread di conversazione
      let threadId = message.threadId;
      let threadName = "";
      
      if (threadId) {
        // Ottieni il nome del thread esistente
        const [thread] = await db
          .select()
          .from(conversationThreads)
          .where(eq(conversationThreads.id, threadId));
        
        if (thread) {
          threadName = thread.name || "";
        }
      } else {
        // Crea un nuovo thread
        const [thread] = await db
          .insert(conversationThreads)
          .values({
            clientId: clientId,
            name: analysisResult.threadName,
            lastActivityAt: new Date()
          })
          .returning();
        
        threadId = thread.id;
        threadName = thread.name || "";
        
        // Aggiorna il messaggio con il nuovo thread
        await db
          .update(communications)
          .set({ threadId })
          .where(eq(communications.id, messageId));
      }
      
      // Crea le associazioni con gli immobili rilevati
      for (const propertyId of analysisResult.detectedPropertyIds) {
        await db
          .insert(communicationProperties)
          .values({
            communicationId: messageId,
            propertyId,
            relevance: 3 // Valore predefinito
          })
          .onConflictDoNothing();
      }
      
      // Restituisci i dati necessari per il modal AI
      return res.json({
        success: true,
        generatedResponse: analysisResult.aiResponse,
        properties: detectedProperties,
        conversationThread: threadName,
        threadId: threadId,
        sentiment: analysisResult.sentiment,
        sentimentScore: analysisResult.sentimentScore
      });
    } catch (error: any) {
      console.error("Errore durante la generazione della risposta AI:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Errore durante la generazione della risposta AI",
        error: error.message
      });
    }
  });
  // Endpoint per analizzare un messaggio in entrata e generare una risposta IA
  app.post("/api/ai-assistant/analyze", async (req: Request, res: Response) => {
    try {
      const { messageId } = req.body;
      
      if (!messageId) {
        return res.status(400).json({ 
          success: false, 
          message: "ID messaggio mancante" 
        });
      }
      
      // Recupera il messaggio dal database
      const [message] = await db
        .select()
        .from(communications)
        .where(eq(communications.id, messageId));
      
      if (!message) {
        return res.status(404).json({ 
          success: false, 
          message: "Messaggio non trovato" 
        });
      }
      
      if (!message.clientId) {
        return res.status(400).json({ 
          success: false, 
          message: "Messaggio senza cliente associato" 
        });
      }
      
      // Recupera i messaggi precedenti per contesto (ultimi 5)
      const previousMessages = await db
        .select()
        .from(communications)
        .where(
          and(
            eq(communications.clientId, message.clientId),
            message.threadId ? eq(communications.threadId, message.threadId) : sql`1=1`
          )
        )
        .orderBy(desc(communications.createdAt))
        .limit(5);
      
      // Converti i messaggi nel formato richiesto dall'API di analisi
      const contextMessages = previousMessages
        .map(msg => ({
          content: msg.content || "",
          direction: msg.direction as "inbound" | "outbound"
        }))
        .reverse(); // Ordina dal più vecchio al più recente
      
      // Genera la risposta IA
      const analysisResult = await analyzeMessageAndGenerateResponse(
        message.content || "",
        message.clientId,
        contextMessages
      );
      
      // Ottieni i dettagli degli immobili rilevati
      const detectedProperties = await db
        .select({
          id: properties.id,
          address: properties.address,
          city: properties.city
        })
        .from(properties)
        .where(
          sql`${properties.id} IN (${analysisResult.detectedPropertyIds.join(",")})`
        );
      
      // Crea o aggiorna il thread se necessario
      let threadId = message.threadId;
      if (!threadId) {
        // Crea un nuovo thread
        const [thread] = await db
          .insert(conversationThreads)
          .values({
            clientId: message.clientId,
            name: analysisResult.threadName,
            lastActivityAt: new Date()
          })
          .returning();
        
        threadId = thread.id;
        
        // Aggiorna il messaggio con il nuovo thread
        await db
          .update(communications)
          .set({ threadId })
          .where(eq(communications.id, messageId));
      } else {
        // Aggiorna l'ultimo accesso al thread
        await db
          .update(conversationThreads)
          .set({ lastActivityAt: new Date() })
          .where(eq(conversationThreads.id, threadId));
      }
      
      // Crea le associazioni con gli immobili rilevati
      for (const propertyId of analysisResult.detectedPropertyIds) {
        await db
          .insert(communicationProperties)
          .values({
            communicationId: messageId,
            propertyId,
            relevance: 3 // Valore predefinito
          })
          .onConflictDoNothing();
      }
      
      // Restituisci i risultati
      return res.json({
        success: true,
        aiResponse: analysisResult.aiResponse,
        threadName: analysisResult.threadName,
        threadId,
        detectedProperties,
        sentiment: analysisResult.sentiment,
        sentimentScore: analysisResult.sentimentScore
      });
    } catch (error: any) {
      console.error("Errore durante l'analisi del messaggio:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Errore durante l'analisi del messaggio",
        error: error.message
      });
    }
  });
  
  // Endpoint per mostrare il popup di risposta assistita quando arriva un nuovo messaggio
  app.post("/api/ai-assistant/notify-new-message", async (req: Request, res: Response) => {
    try {
      const { messageId } = req.body;
      
      if (!messageId) {
        return res.status(400).json({ 
          success: false, 
          message: "ID messaggio mancante" 
        });
      }
      
      // Qui puoi implementare la logica per inviare una notifica al frontend
      // Per ora, restituisci solo l'ID del messaggio
      return res.json({
        success: true,
        messageId
      });
    } catch (error: any) {
      console.error("Errore durante la notifica del nuovo messaggio:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Errore durante la notifica del nuovo messaggio",
        error: error.message
      });
    }
  });
}