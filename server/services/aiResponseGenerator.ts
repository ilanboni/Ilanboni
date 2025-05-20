import OpenAI from "openai";
import { db } from "../db";
import { properties } from "@shared/schema";
import { eq, like, ilike } from "drizzle-orm";
import { storage } from "../storage";

// Inizializza OpenAI con la chiave API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interfaccia per il risultato dell'analisi
interface MessageAnalysisResult {
  aiResponse: string;
  detectedPropertyIds: number[];
  threadName: string;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
}

/**
 * Analizza un messaggio in arrivo, genera una risposta e identifica immobili e thread
 */
export async function analyzeMessageAndGenerateResponse(
  messageContent: string,
  clientId: number,
  previousMessages: Array<{ content: string; direction: "inbound" | "outbound" }>
): Promise<MessageAnalysisResult> {
  // Ottieni informazioni sul cliente
  const client = await storage.getClient(clientId);
  if (!client) {
    throw new Error(`Cliente con ID ${clientId} non trovato`);
  }

  // Determina il tono formale/informale in base al cliente
  const isFormal = !client.isFriend;
  const salutation = client.salutation || "";
  
  // Cerca gli immobili nel database che potrebbero essere menzionati nel messaggio
  const allProperties = await db.select().from(properties);
  
  // Estrai parole chiave dal messaggio (indirizzi, vie, città, etc.)
  const addressKeywords = extractAddressKeywords(messageContent);
  
  // Trova gli immobili che corrispondono alle parole chiave
  const matchedProperties = allProperties.filter(property => {
    // Controlla se l'indirizzo o la città dell'immobile è menzionato nel messaggio
    return addressKeywords.some(keyword => 
      property.address.toLowerCase().includes(keyword.toLowerCase()) ||
      property.city.toLowerCase().includes(keyword.toLowerCase())
    );
  });

  // Prepara il contesto della conversazione per l'AI
  const conversationContext = previousMessages.map(msg => ({
    role: msg.direction === "outbound" ? "assistant" : "user",
    content: msg.content
  }));

  // Se non ci sono messaggi precedenti, aggiungi un messaggio di sistema per contestualizzare
  if (conversationContext.length === 0) {
    conversationContext.unshift({
      role: "system",
      content: `Sei un assistente di un'agenzia immobiliare che sta rispondendo a un messaggio di ${client.firstName} ${client.lastName}.`
    });
  }

  // Crea il prompt per l'analisi del messaggio
  const analysisPrompt = [
    {
      role: "system",
      content: 
        `Analizza il seguente messaggio di un cliente immobiliare e fornisci:
        1. Una risposta appropriata che rispecchi lo stile e il tono del cliente (${isFormal ? 'formale' : 'informale'})
        2. Un nome appropriato per questa conversazione (es. "Richiesta Via Roma", "Informazioni Vendita", etc.)
        3. Il sentiment del messaggio (positivo, neutro, negativo) con un punteggio da 0 a 100
        
        Il cliente ha il seguente saluto preferito: "${salutation}"
        ${matchedProperties.length > 0 ? 'Nel messaggio sono menzionati i seguenti immobili: ' + matchedProperties.map(p => p.address).join(', ') : 'Non sono stati identificati immobili specifici nel messaggio'}
        
        Rispondi in formato JSON con i seguenti campi:
        {
          "aiResponse": "La risposta generata",
          "threadName": "Nome del thread",
          "sentiment": "positive|neutral|negative",
          "sentimentScore": 0-100
        }`
    },
    ...conversationContext,
    {
      role: "user",
      content: messageContent
    }
  ];

  try {
    // Chiama l'API di OpenAI per l'analisi
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // il newest OpenAI model è "gpt-4o" rilasciato il 13 Maggio 2024
      messages: analysisPrompt as any,
      response_format: { type: "json_object" }
    });

    // Estrai il risultato dell'analisi
    const analysisResult = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      aiResponse: analysisResult.aiResponse || "Mi dispiace, non sono riuscito a generare una risposta.",
      detectedPropertyIds: matchedProperties.map(p => p.id),
      threadName: analysisResult.threadName || "Nuova conversazione",
      sentiment: analysisResult.sentiment || "neutral",
      sentimentScore: analysisResult.sentimentScore || 50
    };
  } catch (error) {
    console.error("Errore durante l'analisi del messaggio:", error);
    return {
      aiResponse: "Mi dispiace, non sono riuscito a elaborare il messaggio. Un operatore umano ti risponderà al più presto.",
      detectedPropertyIds: matchedProperties.map(p => p.id),
      threadName: "Nuova conversazione",
      sentiment: "neutral",
      sentimentScore: 50
    };
  }
}

/**
 * Estrae parole chiave relative a indirizzi dal messaggio
 */
function extractAddressKeywords(message: string): string[] {
  // Lista di prefissi comuni per vie e indirizzi in italiano
  const addressPrefixes = ['via', 'viale', 'corso', 'piazza', 'piazzale', 'largo', 'vicolo'];
  
  // Normalizza il messaggio
  const normalizedMessage = message.toLowerCase();
  const words = normalizedMessage.split(/\s+/);
  
  // Trova potenziali indirizzi
  const keywords: string[] = [];
  
  // Cerca parole che iniziano con i prefissi
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (addressPrefixes.includes(word) && i + 1 < words.length) {
      // Aggiungi il prefisso e la parola successiva come potenziale indirizzo
      keywords.push(`${word} ${words[i+1]}`);
      
      // Se ci sono più parole dopo, aggiungi anche la combinazione più lunga
      if (i + 2 < words.length) {
        keywords.push(`${word} ${words[i+1]} ${words[i+2]}`);
      }
    }
  }
  
  // Aggiungi anche parole che potrebbero essere nomi di città o quartieri
  // Qui potresti aggiungere logica più sofisticata, come un elenco di città italiane
  
  return keywords;
}

/**
 * Crea un thread per la conversazione
 */
export async function createOrUpdateThread(
  clientId: number,
  propertyIds: number[],
  threadName: string,
  messageId: number
): Promise<number> {
  // In una implementazione reale, qui gestiresti la creazione o aggiornamento del thread nel database
  // Per ora, ritorniamo semplicemente l'ID del messaggio come ID del thread
  return messageId;
}