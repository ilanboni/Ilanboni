import OpenAI from "openai";
import { addDays } from "date-fns";
import type { InsertTask } from "@shared/schema";
import { storage } from "../storage";

// Inizializza l'API OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interfaccia per il risultato dell'analisi del sentimento
interface SentimentAnalysisResult {
  sentiment: "positive" | "negative" | "neutral";
  score: number; // 0-100
  keywords: string[];
  shouldFollowUp: boolean;
}

/**
 * Analizza il sentimento di un messaggio utilizzando OpenAI
 * @param text Il testo da analizzare
 * @returns Il risultato dell'analisi del sentimento
 */
export async function analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
  try {
    // Crea la richiesta per OpenAI con istruzioni specifiche per l'analisi del sentimento
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // il modello più recente di OpenAI
      messages: [
        {
          role: "system",
          content: 
            "Sei un esperto di analisi del sentimento nel settore immobiliare. " +
            "Analizza il messaggio del cliente e determina se il tono è positivo, " +
            "negativo o neutro. Valuta anche il livello di interesse all'acquisto " +
            "o affitto. Rispondi con un JSON che include: " +
            "- sentiment: 'positive', 'negative', or 'neutral' " +
            "- score: un numero da 0 a 100 (dove 100 è molto positivo) " +
            "- keywords: array di parole chiave rilevanti " +
            "- shouldFollowUp: true se il messaggio richiede un follow-up, false se è conclusivo"
        },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" }
    });

    // Estrai e restituisci il risultato dell'analisi
    const result = JSON.parse(response.choices[0].message.content) as SentimentAnalysisResult;
    return result;
  } catch (error) {
    console.error("Errore durante l'analisi del sentimento:", error);
    // In caso di errore, restituisci un valore neutro predefinito
    return {
      sentiment: "neutral",
      score: 50,
      keywords: [],
      shouldFollowUp: true
    };
  }
}

/**
 * Crea un task di follow-up automatico se non c'è stata risposta
 * @param communicationId ID della comunicazione originale
 * @param clientId ID del cliente
 * @param propertyId ID della proprietà (opzionale)
 */
export async function createFollowUpTaskIfNeeded(
  communicationId: number, 
  clientId: number, 
  propertyId?: number
): Promise<void> {
  try {
    // Recupera la comunicazione
    const communication = await storage.getCommunication(communicationId);
    if (!communication) {
      throw new Error(`Comunicazione con ID ${communicationId} non trovata`);
    }

    // Recupera il cliente
    const client = await storage.getClient(clientId);
    if (!client) {
      throw new Error(`Cliente con ID ${clientId} non trovato`);
    }

    // Controlla se esiste già una risposta a questa comunicazione
    const responses = await storage.getCommunicationsByResponseToId(communicationId);
    
    // Se non ci sono risposte e non è stato già inviato un follow-up automatico
    if (responses.length === 0 && !communication.autoFollowUpSent) {
      // Crea un task di follow-up per tra 10 giorni
      const followUpDate = addDays(new Date(), 10);
      
      // Prepara i dati del task
      const taskData: InsertTask = {
        type: "followUp",
        title: `Follow-up per ${client.firstName} ${client.lastName}`,
        description: `Nessuna risposta alla comunicazione "${communication.subject}" del ${new Date(communication.createdAt).toLocaleDateString("it-IT")}. Contattare nuovamente il cliente.`,
        clientId,
        propertyId: propertyId || null,
        dueDate: followUpDate,
        status: "pending",
        assignedTo: null
      };
      
      // Crea il task
      await storage.createTask(taskData);
      
      // Aggiorna la comunicazione per indicare che è stato inviato un follow-up automatico
      await storage.updateCommunication(communicationId, {
        autoFollowUpSent: true
      });
      
      console.log(`Task di follow-up creato per la comunicazione ${communicationId} del cliente ${clientId}`);
    }
  } catch (error) {
    console.error("Errore durante la creazione del task di follow-up:", error);
  }
}

/**
 * Elabora una nuova risposta del cliente
 * @param responseText Il testo della risposta
 * @param originalCommunicationId ID della comunicazione originale
 * @param clientId ID del cliente
 * @param propertyId ID della proprietà (opzionale)
 */
export async function processClientResponse(
  responseText: string,
  originalCommunicationId: number,
  clientId: number,
  propertyId?: number
): Promise<void> {
  try {
    // Analizza il sentimento della risposta
    const sentimentResult = await analyzeSentiment(responseText);
    
    // Crea una nuova comunicazione per la risposta
    const responseData = {
      clientId,
      propertyId: propertyId || null,
      sharedPropertyId: null,
      type: "response",
      subject: "Risposta del cliente",
      content: responseText,
      summary: `Sentimento: ${sentimentResult.sentiment}, Punteggio: ${sentimentResult.score}`,
      direction: "inbound",
      createdBy: null,
      needsFollowUp: sentimentResult.shouldFollowUp,
      followUpDate: sentimentResult.shouldFollowUp ? addDays(new Date(), 3) : null,
      status: "completed",
      sentiment: sentimentResult.sentiment,
      sentimentScore: sentimentResult.score,
      responseToId: originalCommunicationId,
      autoFollowUpSent: false
    };
    
    // Salva la comunicazione
    await storage.createCommunication(responseData);
    
    console.log(`Risposta del cliente elaborata con sentimento: ${sentimentResult.sentiment}`);
  } catch (error) {
    console.error("Errore durante l'elaborazione della risposta del cliente:", error);
  }
}