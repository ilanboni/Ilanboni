import OpenAI from "openai";
import { addDays } from "date-fns";
import type { InsertTask } from "@shared/schema";
import { storage } from "../storage";

// Inizializza l'API OpenAI con Replit AI Integrations (crediti Replit)
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Interfaccia per il risultato dell'analisi del sentimento
interface SentimentAnalysisResult {
  sentiment: "positive" | "negative" | "neutral";
  score: number; // 0-100
  keywords: string[];
  shouldFollowUp: boolean;
  suggestedResponse?: string;
  taskSuggestion?: {
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    dueDate: number; // giorni entro cui completare il task
  };
}

/**
 * Analizza il sentimento di un messaggio utilizzando OpenAI
 * @param text Il testo da analizzare
 * @param clientName Nome del cliente per personalizzazione
 * @param propertyInfo Informazioni sulla proprietà (opzionale)
 * @returns Il risultato dell'analisi del sentimento
 */
export async function analyzeSentiment(
  text: string, 
  clientName: string = "", 
  propertyInfo: { address?: string, type?: string } = {}
): Promise<SentimentAnalysisResult> {
  try {
    // Crea la richiesta per OpenAI con istruzioni specifiche per l'analisi del sentimento
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // il modello più recente di OpenAI (rilasciato dopo maggio 2023)
      messages: [
        {
          role: "system",
          content: 
            "Sei un esperto di analisi del sentimento nel settore immobiliare italiano. " +
            "Analizza il messaggio del cliente e fornisci un'analisi dettagliata. " +
            "Valuta anche il livello di interesse all'acquisto o affitto e se ci sono richieste specifiche. " +
            "Rispondi con un JSON che include: " +
            "- sentiment: 'positive', 'negative', o 'neutral' " +
            "- score: un numero da 0 a 100 (dove 100 è molto positivo) " +
            "- keywords: array di parole chiave rilevanti " +
            "- shouldFollowUp: true se il messaggio richiede un follow-up, false se è conclusivo " +
            "- suggestedResponse: una risposta personalizzata da inviare al cliente, che utilizzi il mirroring del suo linguaggio e tono comunicativo " +
            "- taskSuggestion: un oggetto con suggerimenti per un task di follow-up che include: " +
            "  - title: titolo breve e chiaro del task " +
            "  - description: descrizione dettagliata di ciò che l'agente deve fare " +
            "  - priority: 'high', 'medium', o 'low' in base all'urgenza " +
            "  - dueDate: numero di giorni entro cui completare il task (1-7 in base all'urgenza)"
        },
        { 
          role: "user", 
          content: `Messaggio del cliente: "${text}"
                   ${clientName ? `Nome cliente: ${clientName}` : ""}
                   ${propertyInfo.address ? `Indirizzo proprietà: ${propertyInfo.address}` : ""}
                   ${propertyInfo.type ? `Tipologia: ${propertyInfo.type}` : ""}`
        }
      ],
      response_format: { type: "json_object" }
    });

    // Estrai e restituisci il risultato dell'analisi
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Risposta vuota da OpenAI");
    }
    const result = JSON.parse(content) as SentimentAnalysisResult;
    
    // Log dei risultati per debug
    console.log("[SENTIMENT ANALYSIS] Risultato:", {
      sentiment: result.sentiment,
      score: result.score,
      keywords: result.keywords,
      shouldFollowUp: result.shouldFollowUp,
      taskSuggestion: result.taskSuggestion ? {
        title: result.taskSuggestion.title,
        priority: result.taskSuggestion.priority,
        dueDate: result.taskSuggestion.dueDate
      } : "Nessun task suggerito"
    });
    
    return result;
  } catch (error) {
    console.error("Errore durante l'analisi del sentimento:", error);
    // In caso di errore, restituisci un valore neutro predefinito
    return {
      sentiment: "neutral",
      score: 50,
      keywords: [],
      shouldFollowUp: true,
      suggestedResponse: "Mi scuso, non sono riuscito ad elaborare correttamente la sua richiesta. Potrebbe ripeterla, per favore?",
      taskSuggestion: {
        title: "Rispondere al cliente",
        description: "Il sistema non è riuscito ad analizzare correttamente il messaggio. Rivedere manualmente e rispondere.",
        priority: "high",
        dueDate: 1
      }
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
      const createdAtDate = communication.createdAt ? communication.createdAt : new Date();
      const createdDate = new Date(createdAtDate).toLocaleDateString("it-IT");
      const taskData: InsertTask = {
        type: "followUp",
        title: `Follow-up per ${client.firstName} ${client.lastName}`,
        description: `Nessuna risposta alla comunicazione "${communication.subject}" del ${createdDate}. Contattare nuovamente il cliente.`,
        clientId,
        propertyId: propertyId ?? null,
        dueDate: followUpDate.toISOString().substring(0, 10), // Converte in formato stringa YYYY-MM-DD
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
    console.log(`[SENTIMENT] Elaborazione risposta cliente (ID: ${clientId}) alla comunicazione ${originalCommunicationId}`);
    
    // Ottieni informazioni del cliente
    const client = await storage.getClient(clientId);
    if (!client) {
      throw new Error(`Cliente con ID ${clientId} non trovato`);
    }
    
    // Ottieni informazioni sulla proprietà, se presente
    let propertyInfo: { address?: string, type?: string } = {};
    if (propertyId) {
      const property = await storage.getProperty(propertyId);
      if (property) {
        propertyInfo = {
          address: property.address,
          type: property.type
        };
      }
    }
    
    // Ottieni la comunicazione originale
    const originalComm = await storage.getCommunication(originalCommunicationId);
    
    // Nome completo del cliente
    const clientName = `${client.firstName} ${client.lastName}`;
    
    // Analizza il sentimento della risposta con informazioni contestuali
    const sentimentResult = await analyzeSentiment(
      responseText,
      clientName,
      propertyInfo
    );
    
    // Calcoliamo la data di follow-up, se necessario
    const followUpDate = sentimentResult.shouldFollowUp ? 
      addDays(new Date(), sentimentResult.taskSuggestion?.dueDate || 3).toISOString().substring(0, 10) : null;
    
    // Prepara la descrizione per il riassunto
    let summaryText = `Sentimento: ${sentimentResult.sentiment}, Punteggio: ${sentimentResult.score}`;
    if (sentimentResult.keywords && sentimentResult.keywords.length > 0) {
      summaryText += `, Parole chiave: ${sentimentResult.keywords.join(', ')}`;
    }
    
    // Crea una nuova comunicazione per la risposta
    const responseData = {
      clientId,
      propertyId: propertyId ?? null,
      sharedPropertyId: null,
      type: "response",
      subject: "Risposta del cliente",
      content: responseText,
      summary: summaryText,
      direction: "inbound",
      createdBy: null,
      needsFollowUp: sentimentResult.shouldFollowUp,
      followUpDate,
      status: "completed",
      sentiment: sentimentResult.sentiment,
      sentimentScore: sentimentResult.score,
      responseToId: originalCommunicationId,
      autoFollowUpSent: false,
      externalId: null
    };
    
    // Salva la comunicazione
    const savedCommunication = await storage.createCommunication(responseData);
    
    // Se l'analisi suggerisce un task, crealo automaticamente
    if (sentimentResult.taskSuggestion) {
      const priorityToScore = {
        "high": 1,
        "medium": 2,
        "low": 3
      };
      
      // Verifica se il cliente è amico per determinare il linguaggio appropriato
      const isFriend = client.isFriend || false;
      const salutation = client.salutation || "egr_dott";
      
      // Crea il task con la risposta suggerita
      const taskData: InsertTask = {
        type: "followUp",
        title: sentimentResult.taskSuggestion.title,
        description: `${sentimentResult.taskSuggestion.description}\n\n` +
                    `Cliente: ${client.firstName} ${client.lastName}\n` +
                    `${propertyId ? `Proprietà: ${propertyInfo.address || 'ID: ' + propertyId}\n` : ''}` +
                    `Messaggio originale: "${responseText}"\n\n` +
                    `Risposta suggerita: "${sentimentResult.suggestedResponse || 'Nessuna risposta suggerita'}"`,
        clientId,
        propertyId: propertyId ?? null,
        dueDate: addDays(new Date(), sentimentResult.taskSuggestion.dueDate || 3).toISOString().substring(0, 10),
        status: "pending",
        priority: priorityToScore[sentimentResult.taskSuggestion.priority] || 2,
        assignedTo: null
      };
      
      const createdTask = await storage.createTask(taskData);
      
      console.log(`[SENTIMENT] Task creato automaticamente (ID: ${createdTask.id}) con priorità ${sentimentResult.taskSuggestion.priority}`);
    }
    
    console.log(`[SENTIMENT] Risposta del cliente elaborata con successo: sentimento=${sentimentResult.sentiment}, score=${sentimentResult.score}`);
    if (sentimentResult.suggestedResponse) {
      console.log(`[SENTIMENT] Risposta suggerita: "${sentimentResult.suggestedResponse}"`);
    }
  } catch (error) {
    console.error("Errore durante l'elaborazione della risposta del cliente:", error);
  }
}