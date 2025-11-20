import OpenAI from "openai";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { communications, properties, clients, sharedProperties, whatsappCampaigns, campaignMessages } from "@shared/schema";
import { sendWhatsAppMessage } from "../lib/ultramsgApi";
import { ChatCompletionMessageParam } from "openai/resources";

// Inizializza OpenAI con Replit AI Integrations (crediti Replit)
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Il modello più recente di OpenAI è "gpt-4o", rilasciato il 13 maggio 2024
const MODEL = "gpt-4o";

/**
 * Verifica se siamo in orario lavorativo (Lun-Sab)
 */
function isBusinessHours(): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = domenica, 1 = lunedì, ... 6 = sabato
  
  // Domenica = disattivato
  if (dayOfWeek === 0) {
    return false;
  }
  
  // Lunedì-Sabato = attivo
  return true;
}

/**
 * Schedula una risposta ritardata (0 secondi in fase di beta test)
 */
async function scheduleDelayedResponse(
  communicationId: number,
  delayMinutes: number = 0  // ⚡ BETA TEST: risposta immediata
): Promise<void> {
  const delayMs = delayMinutes * 60 * 1000;
  
  if (delayMinutes === 0) {
    console.log(`[VIRTUAL-AGENT] ⚡ BETA TEST: Risposta IMMEDIATA per comunicazione ${communicationId}`);
  } else {
    console.log(`[VIRTUAL-AGENT] Risposta schedulata tra ${delayMinutes} minuti per comunicazione ${communicationId}`);
  }
  
  setTimeout(async () => {
    try {
      console.log(`[VIRTUAL-AGENT] Esecuzione risposta per comunicazione ${communicationId}`);
      await executeDelayedResponse(communicationId);
    } catch (error) {
      console.error(`[VIRTUAL-AGENT] Errore risposta:`, error);
    }
  }, delayMs);
}

interface AgentResponse {
  message: string;
  success: boolean;
}

/**
 * Esegue la risposta ritardata (chiamata dopo 10 minuti)
 */
async function executeDelayedResponse(communicationId: number): Promise<void> {
  const result = await generateAndSendResponse(communicationId);
  if (result.success) {
    console.log(`[VIRTUAL-AGENT] ✅ Risposta inviata: ${result.message}`);
  } else {
    console.error(`[VIRTUAL-AGENT] ❌ Errore: ${result.message}`);
  }
}

/**
 * Genera e invia una risposta automatica a un messaggio del cliente
 * Entry point principale - gestisce business hours e scheduling
 */
export async function handleClientMessage(
  communicationId: number
): Promise<AgentResponse> {
  try {
    // Verifica business hours (Lun-Sab)
    if (!isBusinessHours()) {
      console.log(`[VIRTUAL-AGENT] Fuori orario (Domenica) - risposta posticipata a Lunedì`);
      return {
        success: true,
        message: "Messaggio ricevuto. Risposta verrà inviata Lunedì (orario lavorativo)."
      };
    }
    
    // ⚡ BETA TEST: Risposta IMMEDIATA (0 minuti di delay)
    await scheduleDelayedResponse(communicationId, 0);
    
    return {
      success: true,
      message: "⚡ BETA TEST: Risposta IMMEDIATA"
    };
  } catch (error: any) {
    console.error("Errore durante scheduling risposta:", error);
    return {
      success: false,
      message: `Errore: ${error.message || "Errore sconosciuto"}`,
    };
  }
}

/**
 * Verifica se il messaggio contiene un'obiezione configurata nella campagna
 */
function checkForObjection(
  userMessage: string,
  objectionHandling: any
): { keywords: string[]; response: string } | null {
  if (!objectionHandling || !Array.isArray(objectionHandling)) {
    return null;
  }

  const messageLower = userMessage.toLowerCase();
  
  for (const objection of objectionHandling) {
    if (objection.keywords && Array.isArray(objection.keywords)) {
      // Verifica se almeno una keyword è presente nel messaggio
      const found = objection.keywords.some((keyword: string) => 
        messageLower.includes(keyword.toLowerCase())
      );
      
      if (found && objection.response) {
        console.log(`[VIRTUAL-AGENT-OBJECTION] ✅ Rilevata obiezione con keywords: ${objection.keywords.join(', ')}`);
        return objection;
      }
    }
  }
  
  return null;
}

/**
 * Genera e invia effettivamente la risposta (chiamata dopo il ritardo)
 */
async function generateAndSendResponse(
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

    // STEP 1: Verifica se il messaggio proviene da una campagna WhatsApp con obiezioni configurate
    let campaign: any = null;
    if (communication.sharedPropertyId && client.phone) {
      // Cerca se questa shared property ha una campagna associata
      const campaignMessageResult = await db
        .select({
          campaign: whatsappCampaigns
        })
        .from(campaignMessages)
        .innerJoin(whatsappCampaigns, eq(campaignMessages.campaignId, whatsappCampaigns.id))
        .where(
          and(
            eq(campaignMessages.propertyId, communication.sharedPropertyId),
            eq(campaignMessages.phoneNumber, client.phone)
          )
        )
        .limit(1);
      
      if (campaignMessageResult.length > 0) {
        campaign = campaignMessageResult[0].campaign;
        console.log(`[VIRTUAL-AGENT] Campagna trovata: ${campaign.name} (ID: ${campaign.id})`);
      }
    }

    // STEP 2: Verifica se c'è un'obiezione configurata
    let responseText: string | null = null;
    
    if (campaign && campaign.objectionHandling && communication.content) {
      const objection = checkForObjection(
        communication.content,
        campaign.objectionHandling
      );
      
      if (objection) {
        console.log(`[VIRTUAL-AGENT-OBJECTION] ✅ Uso risposta preconfigurata per obiezione`);
        responseText = objection.response;
      }
    }

    // STEP 3: Se non c'è obiezione, usa OpenAI per generare risposta intelligente
    if (!responseText) {
      console.log(`[VIRTUAL-AGENT] Nessuna obiezione rilevata, uso OpenAI per risposta personalizzata`);
      
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
      
      // Costruisci il prompt per OpenAI (usa istruzioni campagna se disponibili)
      const systemPrompt = campaign && campaign.instructions
        ? generateSystemPromptWithCampaign(client, propertyDetails, isFormalStyle, isSharedProperty, campaign.instructions)
        : generateSystemPrompt(client, propertyDetails, isFormalStyle, isSharedProperty);

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

      responseText = response.choices[0].message.content;

      if (!responseText) {
        return { success: false, message: "Impossibile generare una risposta" };
      }
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
7. Firma come "Il tuo agente immobiliare" o "La Sua agenzia immobiliare" in base allo stile.`;
}

/**
 * Genera il prompt con le istruzioni della campagna
 */
function generateSystemPromptWithCampaign(
  client: any,
  propertyDetails: any,
  isFormalStyle: boolean,
  isSharedProperty: boolean,
  campaignInstructions: string
): string {
  const salutation = getSalutation(client);
  
  const propertyInfo = isSharedProperty
    ? `immobile in ${propertyDetails.address}, ${propertyDetails.city}, ${propertyDetails.size} mq, al prezzo di €${propertyDetails.price}`
    : `${propertyDetails.type} in ${propertyDetails.address}, ${propertyDetails.city}, ${propertyDetails.size} mq, ${propertyDetails.bedrooms ? propertyDetails.bedrooms + ' locali' : ''}, ${propertyDetails.bathrooms ? propertyDetails.bathrooms + ' bagni' : ''}, al prezzo di €${propertyDetails.price}`;

  return `Sei un assistente immobiliare virtuale che rappresenta un'agenzia immobiliare italiana. Stai comunicando con ${client.firstName} ${client.lastName}.
  
Informazioni sul cliente:
- Nome completo: ${client.firstName} ${client.lastName}
- Stile di comunicazione: ${isFormalStyle ? 'formale' : 'informale'}
- Saluto appropriato: "${salutation}" 
  
Informazioni sull'immobile:
${propertyInfo}

ISTRUZIONI SPECIFICHE DELLA CAMPAGNA:
${campaignInstructions}

Il tuo compito è rispondere alle domande del cliente riguardo all'immobile seguendo le istruzioni specifiche fornite sopra.

Segui queste linee guida generali:
1. Usa uno stile di comunicazione ${isFormalStyle ? 'formale (con "Lei")' : 'informale (con "tu")'}.
2. Sii conciso ma esauriente, rispondendo alle domande specifiche del cliente.
3. Non inventare dettagli sull'immobile che non sono stati forniti.
4. Aggiungi sempre un saluto iniziale e una chiusura professionale.
5. Firma come "Il tuo agente immobiliare" o "La Sua agenzia immobiliare" in base allo stile.
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