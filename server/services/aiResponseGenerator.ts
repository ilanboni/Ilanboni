import OpenAI from "openai";
import { db } from "../db";
import { clients, properties } from "@shared/schema";
import { eq, and, like, sql } from "drizzle-orm";

// Inizializza il client OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Tipo per i messaggi di contesto
type ContextMessage = {
  content: string;
  direction: "inbound" | "outbound";
};

// Risultato dell'analisi del messaggio
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
  contextMessages: ContextMessage[] = []
): Promise<MessageAnalysisResult> {
  try {
    // Ottieni informazioni sul cliente
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId));

    if (!client) {
      throw new Error(`Cliente con ID ${clientId} non trovato`);
    }

    // Determina lo stile di comunicazione basato su se il cliente è un amico o meno
    const isFormal = !client.isFriend;
    const salutationPrefix = client.salutation || (isFormal ? "Egregio" : "Ciao");
    const clientName = `${client.firstName} ${client.lastName}`;

    // Prepara il contesto per il prompt
    const messageHistory = contextMessages
      .map(msg => `${msg.direction === "inbound" ? "Cliente" : "Agente"}: ${msg.content}`)
      .join("\n");

    // Estrai potenziali riferimenti a indirizzi dal messaggio
    const addressKeywords = extractAddressKeywords(messageContent);

    // Ottieni immobili potenzialmente menzionati nel messaggio
    const properties = await findRelevantProperties(addressKeywords);
    const propertyIds = properties.map(p => p.id);
    const propertyMentions = properties
      .map(p => `- ${p.address}, ${p.city} (ID: ${p.id})`)
      .join("\n");

    // Crea un prompt per l'analisi del messaggio e la generazione della risposta
    const prompt = `
Sei un assistente immobiliare italiano che risponde a un messaggio di un cliente. 
Analizza il messaggio e genera una risposta appropriata.

DATI DEL CLIENTE:
Nome: ${clientName}
Salutation: ${salutationPrefix}
È un amico: ${client.isFriend ? "Sì" : "No"}

CONTESTO DELLA CONVERSAZIONE:
${messageHistory.length > 0 ? messageHistory : "Nessun messaggio precedente"}

ULTIMO MESSAGGIO DEL CLIENTE:
${messageContent}

${propertyMentions.length > 0 ? `IMMOBILI POTENZIALMENTE RILEVANTI:\n${propertyMentions}` : ""}

COMPITI:
1. Analizza il messaggio e identifica a quale argomento si riferisce. Se parla di un immobile specifico, identifica quale tra quelli elencati.
2. Genera una risposta professionale e cortese che:
   - Utilizzi lo stile ${isFormal ? "formale" : "informale"} appropriato
   - Inizi con il saluto corretto (${salutationPrefix} ${clientName})
   - Risponda alle domande o preoccupazioni del cliente
   - Se riguarda un immobile specifico, conferma e fornisci dettagli pertinenti
3. Non inventare informazioni, resta sui fatti
4. Tieni la risposta concisa ma completa

Rispondi con un oggetto JSON nel seguente formato:
{
  "threadName": "Nome breve per questo thread di conversazione",
  "properties": [ID degli immobili menzionati, se presenti],
  "sentiment": "positive/neutral/negative",
  "sentimentScore": numero da 0 a 100,
  "response": "La tua risposta al cliente"
}
`;

    // Chiamata a OpenAI per generare la risposta
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // il modello più recente di OpenAI rilasciato il 13 maggio 2024
      messages: [
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    // Estrai la risposta e analizza il JSON
    const responseContent = response.choices[0].message.content || "{}";
    const parsedResponse = JSON.parse(responseContent);
    
    return {
      aiResponse: parsedResponse.response || "Mi dispiace, non sono riuscito a generare una risposta.",
      detectedPropertyIds: parsedResponse.properties || [],
      threadName: parsedResponse.threadName || "Conversazione generale",
      sentiment: parsedResponse.sentiment || "neutral",
      sentimentScore: parsedResponse.sentimentScore || 50
    };
  } catch (error) {
    console.error("Errore durante l'analisi del messaggio:", error);
    return {
      aiResponse: "Mi dispiace, si è verificato un errore durante l'elaborazione del messaggio.",
      detectedPropertyIds: [],
      threadName: "Conversazione generale",
      sentiment: "neutral",
      sentimentScore: 50
    };
  }
}

/**
 * Estrae parole chiave relative a indirizzi dal messaggio
 */
function extractAddressKeywords(message: string): string[] {
  // Lista di parole chiave comuni negli indirizzi italiani
  const addressIndicators = [
    "via", "viale", "piazza", "corso", "largo", "vicolo", 
    "strada", "borgo", "contrada", "galleria"
  ];
  
  // Trova possibili riferimenti a indirizzi nel messaggio
  const words = message.toLowerCase().split(/\s+/);
  const keywords: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (addressIndicators.includes(word) && i + 1 < words.length) {
      // Aggiungi la parola indicatore e la parola successiva
      keywords.push(`${word} ${words[i + 1]}`);
      
      // Se c'è anche un numero civico, aggiungi anche quello
      if (i + 2 < words.length && /^\d+\w*$/.test(words[i + 2])) {
        keywords.push(`${word} ${words[i + 1]} ${words[i + 2]}`);
      }
    }
  }
  
  return keywords;
}

/**
 * Trova immobili rilevanti in base alle parole chiave estratte
 */
async function findRelevantProperties(addressKeywords: string[]): Promise<{ id: number; address: string; city: string }[]> {
  if (addressKeywords.length === 0) {
    return [];
  }
  
  // Crea una query semplificata che confronta ogni parola chiave
  let matchingProperties: { id: number; address: string; city: string }[] = [];
  
  // Esegui una query per ogni parola chiave
  for (const keyword of addressKeywords) {
    const keywordMatches = await db
      .select({
        id: properties.id,
        address: properties.address,
        city: properties.city
      })
      .from(properties)
      .where(sql`${properties.address} ILIKE ${`%${keyword}%`}`)
      .limit(3);
    
    // Aggiungi i risultati all'array (evitando duplicati)
    for (const match of keywordMatches) {
      if (!matchingProperties.some(p => p.id === match.id)) {
        matchingProperties.push(match);
      }
    }
    
    // Limita il numero totale di risultati
    if (matchingProperties.length >= 5) {
      matchingProperties = matchingProperties.slice(0, 5);
      break;
    }
  }
  
  return matchingProperties;
}

/**
 * Crea un thread per la conversazione
 */
export async function createOrUpdateThread(
  clientId: number, 
  name: string
): Promise<number> {
  try {
    // La logica per creare o aggiornare un thread è già implementata nell'API
    // Questa funzione è lasciata qui come punto di estensione per usi futuri
    return 0; // Placeholder
  } catch (error) {
    console.error("Errore nella creazione/aggiornamento del thread:", error);
    throw error;
  }
}