import OpenAI from "openai";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { communications, properties, clients, sharedProperties } from "@shared/schema";
import { sendWhatsAppMessage } from "../lib/ultramsgApi";
import { ChatCompletionMessageParam } from "openai/resources";

// Inizializza OpenAI con la chiave API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Il modello più recente di OpenAI è "gpt-4o", rilasciato il 13 maggio 2024
const MODEL = "gpt-4o";

interface AgentResponse {
  message: string;
  success: boolean;
}

/**
 * Genera e invia una risposta automatica a un messaggio del cliente
 */
export async function handleClientMessage(
  communicationId: number
): Promise<AgentResponse> {
  try {
    // Recupera la comunicazione
    const [communication] = await db
      .select()
      .from(communications)
      .where(eq(communications.id, communicationId));

    if (!communication) {
      return { success: false, message: "Comunicazione non trovata" };
    }

    // Verifica che sia una comunicazione in ingresso
    if (communication.direction !== "inbound") {
      return {
        success: false,
        message: "Non è possibile rispondere a una comunicazione in uscita",
      };
    }

    // Recupera il cliente
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, communication.clientId!));

    if (!client) {
      return { success: false, message: "Cliente non trovato" };
    }

    // Recupera l'immobile (normale o condiviso)
    let propertyDetails: any = null;
    let isSharedProperty = false;

    if (communication.propertyId) {
      [propertyDetails] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, communication.propertyId));
    } else if (communication.sharedPropertyId) {
      [propertyDetails] = await db
        .select()
        .from(sharedProperties)
        .where(eq(sharedProperties.id, communication.sharedPropertyId!));
      isSharedProperty = true;
    }

    if (!propertyDetails) {
      return { success: false, message: "Immobile non trovato" };
    }

    // Recupera le comunicazioni precedenti con questo cliente sullo stesso immobile
    const previousCommunications = await db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.clientId, client.id),
          communication.propertyId
            ? eq(communications.propertyId, communication.propertyId)
            : eq(communications.sharedPropertyId, communication.sharedPropertyId!)
        )
      )
      .orderBy(desc(communications.createdAt))
      .limit(10);

    // Prepara la conversazione per OpenAI
    const conversationHistory = previousCommunications
      .reverse()
      .map((comm) => {
        const role = comm.direction === "inbound" ? "user" : "assistant";
        return {
          role,
          content: comm.content,
        };
      });

    // Determina lo stile di comunicazione in base al cliente
    const isFormalStyle = !client.isFriend;
    
    // Costruisci il prompt per OpenAI
    const systemPrompt = generateSystemPrompt(client, propertyDetails, isFormalStyle, isSharedProperty);

    // Genera la risposta con OpenAI
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt }
    ];
    
    // Aggiungi la storia delle conversazioni
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content as string
      });
    }
    
    // Richiesta a OpenAI
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = response.choices[0].message.content;

    if (!responseText) {
      return { success: false, message: "Impossibile generare una risposta" };
    }

    // Salva la risposta come nuova comunicazione
    const insertResult = await db
      .insert(communications)
      .values({
        clientId: client.id,
        propertyId: communication.propertyId,
        sharedPropertyId: communication.sharedPropertyId,
        type: "whatsapp",
        subject: "Risposta automatica",
        content: responseText,
        summary: "Risposta generata dall'assistente virtuale",
        direction: "outbound",
        createdBy: null,
        needsFollowUp: false,
        status: "pending",
        responseToId: communication.id,
        autoFollowUpSent: false,
      })
      .returning();
    
    const newCommunication = Array.isArray(insertResult) && insertResult.length > 0 
      ? insertResult[0] 
      : null;

    // Invia la risposta via WhatsApp
    const phoneNumber = client.phone;
    if (phoneNumber && phoneNumber.length > 0) {
      await sendWhatsAppMessage(phoneNumber, responseText);
    }

    return {
      success: true,
      message: "Risposta generata e inviata con successo",
    };
  } catch (error: any) {
    console.error("Errore durante la generazione della risposta:", error);
    return {
      success: false,
      message: `Errore: ${error.message || "Errore sconosciuto"}`,
    };
  }
}

/**
 * Genera il prompt di sistema per OpenAI in base alle informazioni del cliente e dell'immobile
 */
function generateSystemPrompt(
  client: any,
  propertyDetails: any,
  isFormalStyle: boolean,
  isSharedProperty: boolean
): string {
  // Ottieni il saluto appropriato in base al tipo di cliente
  const salutation = getSalutation(client);
  
  // Informazioni sull'immobile
  const propertyInfo = isSharedProperty
    ? `immobile in ${propertyDetails.address}, ${propertyDetails.city}, ${propertyDetails.size} mq, al prezzo di €${propertyDetails.price}`
    : `${propertyDetails.type} in ${propertyDetails.address}, ${propertyDetails.city}, ${propertyDetails.size} mq, ${propertyDetails.bedrooms ? propertyDetails.bedrooms + ' locali' : ''}, ${propertyDetails.bathrooms ? propertyDetails.bathrooms + ' bagni' : ''}, al prezzo di €${propertyDetails.price}`;

  // Costruisci il prompt
  return `Sei un assistente immobiliare virtuale che rappresenta un'agenzia immobiliare italiana. Stai comunicando con ${client.firstName} ${client.lastName}.
  
Informazioni sul cliente:
- Nome completo: ${client.firstName} ${client.lastName}
- Stile di comunicazione: ${isFormalStyle ? 'formale' : 'informale'}
- Saluto appropriato: "${salutation}" 
  
Informazioni sull'immobile:
${propertyInfo}

Il tuo compito è rispondere alle domande del cliente riguardo all'immobile, organizzare visite, fornire dettagli aggiuntivi e mantenere un tono professionale.

Segui queste linee guida:
1. Usa uno stile di comunicazione ${isFormalStyle ? 'formale (con "Lei")' : 'informale (con "tu")'}.
2. Sii conciso ma esauriente, rispondendo alle domande specifiche del cliente.
3. Offri di organizzare visite o fornire ulteriori informazioni quando appropriato.
4. Non inventare dettagli sull'immobile che non sono stati forniti.
5. Se il cliente mostra interesse per l'immobile, promuovi una visita sul posto.
6. Aggiungi sempre un saluto iniziale e una chiusura professionale.
7. Firma come "Il tuo agente immobiliare" o "La Sua agenzia immobiliare" in base allo stile.
8. Mantieni un tono cordiale e professionale.`;
}

/**
 * Determina il saluto appropriato in base al tipo di cliente
 */
function getSalutation(client: any): string {
  const firstName = client.firstName;
  
  if (!client.isFriend) {
    // Formale
    switch(client.salutation) {
      case 'egr_dott':
        return `Egregio Dott. ${firstName}`;
      case 'gent_sig_ra':
        return `Gentile Sig.ra ${firstName}`;
      case 'egr_avvto':
        return `Egregio Avv.to ${firstName}`;
      default:
        return `Gentile ${firstName}`;
    }
  } else {
    // Informale
    return `Ciao ${firstName}`;
  }
}

/**
 * Configurazione del sistema di risposta automatica
 */
export async function configureAutoResponseSystem(enabled: boolean = true): Promise<boolean> {
  // Qui potresti implementare un sistema di configurazione per abilitare/disabilitare le risposte automatiche
  console.log(`Sistema di risposta automatica ${enabled ? 'abilitato' : 'disabilitato'}`);
  return true;
}