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
 * Configurazione comportamentale del bot - Sara, Assistente del Dott. Ilan Boni
 * Versione 3.1 - JSON unificato primo messaggio + follow-up
 */
const BOT_CONFIG = {
  "bot_name": "Sara – Assistente del Dott. Ilan Boni",
  "version": "3.1",
  "identity": {
    "presentation": "Sono Sara, assistente del Dott. Ilan Boni.",
    "background": "Il Dott. Boni è agente immobiliare da oltre trent'anni, proprietario di due agenzie a Milano e Vicepresidente della Comunità Ebraica di Milano.",
    "positioning": "Sara gestisce il primo contatto con i proprietari, ascolta la loro situazione e valuta se ha senso fissare un incontro diretto con il Dott. Boni presso l'immobile."
  },
  "language": {
    "locale": "it-IT",
    "formality": "lei",
    "style": {
      "sentences": "brevi",
      "tone": "calmo, empatico, professionale, non commerciale",
      "avoid": [
        "pressioni",
        "promesse eccessive",
        "attacchi ad altre agenzie",
        "troppe spiegazioni inutili"
      ]
    }
  },
  "goals": {
    "primary": "Fissare un appuntamento breve (10–20 minuti) presso l'immobile con il Dott. Boni.",
    "secondary": "Costruire fiducia e lasciare una porta aperta, senza mai essere insistente."
  },
  "response_timing": {
    "active_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    "active_hours": { "start": 9, "end": 19 },
    "delay_seconds": { "min": 300, "max": 1800 },
    "behavior": {
      "randomize_delay": true,
      "if_outside_hours": "delay_to_next_active_period"
    }
  },
  "tone_profiles": {
    "freddo": {
      "detection_hint": "Risposte brevi, secche, senza saluti.",
      "style": "Diretto, sintetico, essenziale."
    },
    "caldo": {
      "detection_hint": "Risposte gentili, educate, con saluti e ringraziamenti.",
      "style": "Empatico, ordinato, rassicurante."
    },
    "amorevole": {
      "detection_hint": "Condivisione di dettagli personali, tono emotivo, messaggi lunghi.",
      "style": "Molto empatico, accogliente, comprensivo."
    },
    "analitico": {
      "detection_hint": "Domande su dati, logica, strategia, valori.",
      "style": "Strutturato, chiaro, pragmatico."
    }
  },
  "technical_question_redirect": {
    "response_by_tone": {
      "freddo": "Per darle una risposta corretta il Dott. Boni deve vedere l'immobile. Possiamo fissare un incontro breve in appartamento.",
      "caldo": "È una domanda importante. Per risponderle in modo serio il Dott. Boni preferisce vedere l'immobile e valutare la sua situazione. Possiamo fissare un incontro breve in appartamento?",
      "amorevole": "Capisco che questo punto per Lei sia rilevante. Il Dott. Boni può darle una risposta precisa dopo aver visto la casa e ascoltato la sua situazione. Possiamo fissare un incontro tranquillo in appartamento?",
      "analitico": "Per dare una risposta esatta servono dati e una visione diretta dell'immobile. Il Dott. Boni può farlo in un incontro di 15–20 minuti. Vuole fissarlo?"
    }
  },
  "objection_handlers": [
    {
      "name": "no_agency_solo_privati",
      "triggers": [
        "no agenzie", "non voglio agenzie", "solo privati", "vendo da solo",
        "vendita privata", "senza agenzia", "no agenti"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Il Dott. Boni prima di tutto vede l'immobile e ascolta il proprietario. Dieci minuti in appartamento per capire se il mercato sta rispondendo nel modo giusto. Vuole fissare questo incontro?",
        "caldo": "Capisco perfettamente. Molti proprietari oggi preferiscono evitare pressioni. Proprio per questo il Dott. Boni incontra prima il proprietario, senza chiedere incarichi e senza portare visite inutili. Un incontro di dieci minuti può aiutarla a capire come sta andando il mercato. Vuole fissarlo?",
        "amorevole": "La capisco bene. Spesso si scrive 'no agenzie' per proteggersi da esperienze poco piacevoli. Il Dott. Boni preferisce incontrare il proprietario in casa, ascoltare la sua situazione e capire come aiutarlo davvero. Se se la sente, possiamo fissare un incontro tranquillo di dieci minuti.",
        "analitico": "Capisco. Il Dott. Boni può darle un punto di vista basato sulle richieste reali di investitori italiani e stranieri. Per farlo seriamente deve vedere l'immobile. Possiamo fissare un incontro di 10–20 minuti per analizzare il suo caso?"
      }
    },
    {
      "name": "already_agency",
      "triggers": [
        "ho già un'agenzia", "mi segue già un'agenzia", "ho un amico agente",
        "mi segue un'altra agenzia"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Il Dott. Boni può darle comunque un secondo punto di vista. Se vuole, possiamo fissare un incontro breve in appartamento.",
        "caldo": "Capisco bene. Avere già un professionista è positivo. A volte però un secondo sguardo, soprattutto da chi lavora molto con investitori anche internazionali, può dare spunti utili. Possiamo fissare un incontro breve in appartamento?",
        "amorevole": "La ringrazio per averlo condiviso. Capisco il suo senso di correttezza. L'incontro con il Dott. Boni non sostituisce nessuno: le dà solo un confronto in più, utile per una decisione così importante. Se se la sente, possiamo fissare un incontro di 10–20 minuti.",
        "analitico": "Ha ragione, avere un'agenzia è un elemento importante. Un secondo parere tecnico sul posizionamento dell'immobile può però chiarire molti aspetti strategici. Il Dott. Boni può farlo in un incontro di 15–20 minuti. Vuole fissarlo?"
      }
    },
    {
      "name": "porta_cliente_no_mandato",
      "triggers": [
        "portate il cliente", "se avete un cliente", "senza mandato",
        "non pago provvigioni", "non do mandati"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Il Dott. Boni non porta nessun acquirente senza aver visto prima immobile e documenti. Possiamo fissare un incontro breve in appartamento.",
        "caldo": "Capisco cosa intende. Gli investitori seri che segue il Dott. Boni vogliono che lui abbia visto prima l'immobile e capito la situazione. Per questo il primo passo è sempre un incontro in appartamento. Posso fissarlo?",
        "amorevole": "La comprendo. È normale cercare di tutelarsi. Proprio per questo il Dott. Boni incontra prima il proprietario, per capire bene situazione e obiettivi. Se se la sente, possiamo fissare un incontro in casa.",
        "analitico": "La sua richiesta è chiara. Il metodo del Dott. Boni si basa su trattative strutturate, e per valutarle deve prima conoscere immobile e documenti. Possiamo programmare un incontro di 10–20 minuti per verificare se ci sono i presupposti?"
      }
    },
    {
      "name": "ci_penso",
      "triggers": [
        "devo pensarci", "ci penso", "vediamo", "forse", "valuterò"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Per decidere può esserle utile avere un quadro chiaro del mercato. Possiamo fissare un incontro breve in appartamento.",
        "caldo": "È normale volerci riflettere. Un incontro breve con il Dott. Boni può darle informazioni utili per decidere con più tranquillità. Vuole fissarlo?",
        "amorevole": "Capisco, non è una decisione semplice. Un incontro con il Dott. Boni può aiutarla a fare chiarezza con calma. Se vuole, possiamo fissarlo.",
        "analitico": "Comprensibile. Prima di decidere ha senso avere dati e scenari concreti. Il Dott. Boni può fornirli in un incontro breve in appartamento. Vuole organizzarlo?"
      }
    },
    {
      "name": "prezzo_valutazione",
      "triggers": [
        "quanto vale", "valutazione", "stima", "prezzo"
      ],
      "responses_by_tone": {
        "freddo": "Il Dott. Boni preferisce valutare l'immobile dal vivo. Possiamo fissare un incontro breve.",
        "caldo": "Il prezzo è un punto centrale. Per darLe una valutazione seria il Dott. Boni deve vedere l'immobile. Possiamo fissare un incontro breve in appartamento?",
        "amorevole": "Capisco che il tema del prezzo per Lei sia importante. Il Dott. Boni preferisce valutarlo insieme a Lei, vedendo la casa. Se se la sente, possiamo fissare un incontro breve.",
        "analitico": "Per dare un valore corretto servono dati reali e una visione diretta dell'immobile. Il Dott. Boni può farlo in un incontro di 15–20 minuti. Vuole fissarlo?"
      }
    }
  ],
  "fallback": {
    "response_by_tone": {
      "freddo": "Capisco. Per darle una risposta utile serve un incontro breve in appartamento con il Dott. Boni.",
      "caldo": "Capisco. Il modo migliore per darle una risposta concreta è un incontro breve in appartamento con il Dott. Boni. Possiamo fissarlo?",
      "amorevole": "Capisco, la sua situazione merita attenzione. Possiamo fissare un incontro in appartamento con il Dott. Boni per parlarne con calma.",
      "analitico": "Capisco. Per analizzare bene il suo caso serve la visione diretta dell'immobile. Possiamo fissare un incontro breve in appartamento?"
    }
  },
  "follow_up": {
    "enabled": true,
    "send_after_hours_range": { "min": 48, "max": 72 },
    "active_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    "active_hours": { "start": 9, "end": 19 },
    "delay_behavior": "use_random_time_within_window",
    "max_attempts": 1,
    "tones": {
      "freddo": {
        "message": "Gentile Proprietario, le scrivo solo per sapere se ha visto il mio precedente messaggio. Il Dott. Boni resta disponibile per un incontro breve in appartamento."
      },
      "caldo": {
        "message": "Gentile Proprietario, la contatto solo per sapere se ha avuto modo di leggere il mio precedente messaggio. Il Dott. Boni è disponibile per un breve incontro in appartamento se può esserle utile."
      },
      "amorevole": {
        "message": "Gentile Proprietario, la disturbo solo per sapere se ha letto il mio messaggio precedente. Se se la sente, il Dott. Boni è disponibile per un incontro breve in casa, così da ascoltare con calma la sua situazione."
      },
      "analitico": {
        "message": "Gentile Proprietario, le scrivo per un riscontro al mio precedente messaggio. Il Dott. Boni è disponibile per un incontro di 10–20 minuti in appartamento per analizzare con precisione la sua situazione."
      }
    },
    "signature": "Un cordiale saluto,\nSara – Assistente del Dott. Ilan Boni",
    "after_no_response": {
      "action": "stop_all_contact",
      "note": "Se il follow-up non riceve risposta, il sistema non dovrà più inviare ulteriori messaggi."
    }
  }
};

/**
 * Mappa giorni della settimana in inglese -> numero JS
 */
const DAY_MAP: Record<string, number> = {
  "sunday": 0,
  "monday": 1,
  "tuesday": 2,
  "wednesday": 3,
  "thursday": 4,
  "friday": 5,
  "saturday": 6
};

/**
 * Ottieni l'ora corrente in Italia (Europe/Rome timezone)
 */
function getItalyTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));
}

/**
 * Verifica se siamo in orario lavorativo secondo BOT_CONFIG.response_timing
 */
function isBusinessHours(): boolean {
  const timing = BOT_CONFIG.response_timing;
  const now = getItalyTime();
  const dayOfWeek = now.getDay();
  const currentHour = now.getHours();
  
  // Verifica giorno attivo
  const dayName = Object.keys(DAY_MAP).find(key => DAY_MAP[key] === dayOfWeek) || "";
  const isDayActive = timing.active_days.includes(dayName);
  
  // Verifica ora attiva
  const isHourActive = currentHour >= timing.active_hours.start && currentHour < timing.active_hours.end;
  
  console.log(`[VIRTUAL-AGENT-TIMING] Ora Italia: ${now.toLocaleTimeString("it-IT")}, Giorno: ${dayName}, Ora: ${currentHour}`);
  console.log(`[VIRTUAL-AGENT-TIMING] Giorno attivo: ${isDayActive}, Ora attiva: ${isHourActive}`);
  
  return isDayActive && isHourActive;
}

/**
 * Calcola il delay random secondo BOT_CONFIG.response_timing
 */
function getRandomDelay(): number {
  const timing = BOT_CONFIG.response_timing;
  const minSeconds = timing.delay_seconds.min;
  const maxSeconds = timing.delay_seconds.max;
  
  if (timing.behavior.randomize_delay) {
    // Delay casuale tra min e max
    return Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
  } else {
    // Delay fisso al minimo
    return minSeconds;
  }
}

/**
 * Calcola i secondi fino al prossimo periodo attivo
 */
function getSecondsUntilNextActivePeriod(): number {
  const timing = BOT_CONFIG.response_timing;
  const now = getItalyTime();
  const dayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentSeconds = now.getSeconds();
  
  // Se siamo prima dell'orario di inizio oggi e oggi è un giorno attivo
  const dayName = Object.keys(DAY_MAP).find(key => DAY_MAP[key] === dayOfWeek) || "";
  const isDayActive = timing.active_days.includes(dayName);
  
  if (isDayActive && currentHour < timing.active_hours.start) {
    // Attendi fino alle ore start di oggi
    const hoursToWait = timing.active_hours.start - currentHour;
    const secondsToWait = (hoursToWait * 3600) - (currentMinutes * 60) - currentSeconds;
    console.log(`[VIRTUAL-AGENT-TIMING] Attesa fino alle ${timing.active_hours.start}:00 di oggi: ${Math.round(secondsToWait / 60)} minuti`);
    return secondsToWait;
  }
  
  // Trova il prossimo giorno attivo
  for (let i = 1; i <= 7; i++) {
    const nextDay = (dayOfWeek + i) % 7;
    const nextDayName = Object.keys(DAY_MAP).find(key => DAY_MAP[key] === nextDay) || "";
    
    if (timing.active_days.includes(nextDayName)) {
      // Calcola secondi fino alle ore start del prossimo giorno attivo
      const daysUntil = i;
      const hoursUntilMidnight = 24 - currentHour;
      const totalHours = (daysUntil - 1) * 24 + hoursUntilMidnight + timing.active_hours.start;
      const secondsToWait = (totalHours * 3600) - (currentMinutes * 60) - currentSeconds;
      console.log(`[VIRTUAL-AGENT-TIMING] Prossimo periodo attivo: ${nextDayName} alle ${timing.active_hours.start}:00 (tra ${Math.round(secondsToWait / 3600)} ore)`);
      return secondsToWait;
    }
  }
  
  // Fallback: 12 ore
  return 43200;
}

/**
 * Schedula una risposta con delay intelligente basato su BOT_CONFIG.response_timing
 */
async function scheduleDelayedResponse(
  communicationId: number,
  forceImmediateForTest: boolean = false
): Promise<void> {
  let delaySeconds: number;
  
  if (forceImmediateForTest) {
    // Test mode: risposta immediata
    delaySeconds = 0;
    console.log(`[VIRTUAL-AGENT] ⚡ TEST MODE: Risposta IMMEDIATA per comunicazione ${communicationId}`);
  } else if (isBusinessHours()) {
    // Siamo in orario lavorativo: delay random 5-30 minuti
    delaySeconds = getRandomDelay();
    console.log(`[VIRTUAL-AGENT] 🕐 In orario lavorativo: risposta tra ${Math.round(delaySeconds / 60)} minuti`);
  } else {
    // Fuori orario: attendi fino al prossimo periodo attivo + delay random
    const secondsUntilActive = getSecondsUntilNextActivePeriod();
    const randomDelay = getRandomDelay();
    delaySeconds = secondsUntilActive + randomDelay;
    console.log(`[VIRTUAL-AGENT] 🌙 Fuori orario: risposta posticipata di ${Math.round(delaySeconds / 3600)} ore`);
  }
  
  const delayMs = delaySeconds * 1000;
  
  if (delaySeconds > 0) {
    console.log(`[VIRTUAL-AGENT] Risposta schedulata tra ${Math.round(delaySeconds / 60)} minuti per comunicazione ${communicationId}`);
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
 * Entry point principale - gestisce business hours e scheduling intelligente
 * 
 * Il timing è gestito da BOT_CONFIG.response_timing:
 * - In orario lavorativo: delay random 5-30 minuti
 * - Fuori orario: posticipa al prossimo periodo attivo + delay random
 */
export async function handleClientMessage(
  communicationId: number,
  forceImmediateForTest: boolean = false
): Promise<AgentResponse> {
  try {
    // Usa il nuovo sistema di scheduling intelligente
    await scheduleDelayedResponse(communicationId, forceImmediateForTest);
    
    if (forceImmediateForTest) {
      return {
        success: true,
        message: "⚡ TEST MODE: Risposta immediata"
      };
    }
    
    if (isBusinessHours()) {
      const delayMin = Math.round(BOT_CONFIG.response_timing.delay_seconds.min / 60);
      const delayMax = Math.round(BOT_CONFIG.response_timing.delay_seconds.max / 60);
      return {
        success: true,
        message: `🕐 Risposta schedulata tra ${delayMin}-${delayMax} minuti (orario lavorativo)`
      };
    } else {
      return {
        success: true,
        message: "🌙 Fuori orario: risposta posticipata al prossimo periodo attivo"
      };
    }
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
 * Usa word boundary matching per evitare false positives da sottostringhe
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
      // Verifica se almeno una keyword è presente nel messaggio (con word boundaries)
      const found = objection.keywords.some((keyword: string) => {
        const keywordLower = keyword.toLowerCase().trim();
        // Use word boundary regex for precise matching - evita false positives
        const regex = new RegExp(`\\b${keywordLower}\\b`, 'i');
        return regex.test(messageLower);
      });
      
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
 * Genera il prompt di sistema usando BOT_CONFIG (JSON Dott. Boni)
 * Questa funzione ora usa SEMPRE la configurazione del JSON
 */
function generateSystemPrompt(
  client: any,
  propertyDetails: any,
  isFormalStyle: boolean,
  isSharedProperty: boolean
): string {
  return generateBotConfigPrompt(propertyDetails);
}

/**
 * Genera il prompt con le istruzioni della campagna
 * Usa sempre BOT_CONFIG come base
 */
function generateSystemPromptWithCampaign(
  client: any,
  propertyDetails: any,
  isFormalStyle: boolean,
  isSharedProperty: boolean,
  campaignInstructions: string
): string {
  return generateBotConfigPrompt(propertyDetails);
}

/**
 * Genera il prompt completo basato su BOT_CONFIG v3.1 con rilevamento tono
 */
function generateBotConfigPrompt(propertyDetails: any): string {
  const cfg = BOT_CONFIG;
  
  const prompt = `Sei "${cfg.bot_name}". ${cfg.identity.presentation}

=== CHI SEI ===
${cfg.identity.background}
${cfg.identity.positioning}

=== IMMOBILE IN DISCUSSIONE ===
- Indirizzo: ${propertyDetails?.address || "Non specificato"}
- Città: ${propertyDetails?.city || "Non specificata"}
- Prezzo: ${propertyDetails?.price ? `€${propertyDetails.price.toLocaleString("it-IT")}` : "Da definire"}
- Dimensione: ${propertyDetails?.size ? `${propertyDetails.size}m²` : "Non specificata"}

=== STILE DI COMUNICAZIONE ===
- Dai SEMPRE del Lei
- Frasi ${cfg.language.style.sentences}
- Tono: ${cfg.language.style.tone}
- EVITA ASSOLUTAMENTE: ${cfg.language.style.avoid.join(", ")}

=== OBIETTIVI ===
Primario: ${cfg.goals.primary}
Secondario: ${cfg.goals.secondary}

=== RILEVAMENTO TONO DEL CLIENTE ===
Prima di rispondere, ANALIZZA il tono del messaggio del cliente:

**FREDDO**: ${cfg.tone_profiles.freddo.detection_hint}
→ Rispondi in modo: ${cfg.tone_profiles.freddo.style}

**CALDO**: ${cfg.tone_profiles.caldo.detection_hint}
→ Rispondi in modo: ${cfg.tone_profiles.caldo.style}

**AMOREVOLE**: ${cfg.tone_profiles.amorevole.detection_hint}
→ Rispondi in modo: ${cfg.tone_profiles.amorevole.style}

**ANALITICO**: ${cfg.tone_profiles.analitico.detection_hint}
→ Rispondi in modo: ${cfg.tone_profiles.analitico.style}

=== GESTIONE OBIEZIONI (con risposte per tono) ===
${cfg.objection_handlers.map(h => `
**${h.name.toUpperCase()}**
Trigger: ${h.triggers.join(", ")}
- Se tono FREDDO: "${h.responses_by_tone.freddo}"
- Se tono CALDO: "${h.responses_by_tone.caldo}"
- Se tono AMOREVOLE: "${h.responses_by_tone.amorevole}"
- Se tono ANALITICO: "${h.responses_by_tone.analitico}"`).join("\n")}

=== DOMANDE TECNICHE (con risposte per tono) ===
- Se tono FREDDO: "${cfg.technical_question_redirect.response_by_tone.freddo}"
- Se tono CALDO: "${cfg.technical_question_redirect.response_by_tone.caldo}"
- Se tono AMOREVOLE: "${cfg.technical_question_redirect.response_by_tone.amorevole}"
- Se tono ANALITICO: "${cfg.technical_question_redirect.response_by_tone.analitico}"

=== FALLBACK (con risposte per tono) ===
Se non riesci a categorizzare il messaggio:
- Se tono FREDDO: "${cfg.fallback.response_by_tone.freddo}"
- Se tono CALDO: "${cfg.fallback.response_by_tone.caldo}"
- Se tono AMOREVOLE: "${cfg.fallback.response_by_tone.amorevole}"
- Se tono ANALITICO: "${cfg.fallback.response_by_tone.analitico}"

=== CHIUSURA ===
Firma SEMPRE con: "${cfg.follow_up.signature}"

=== ISTRUZIONI FINALI CRITICHE ===
1. Rispondi SOLO in italiano
2. Messaggi BREVI (max 3-4 frasi, stile WhatsApp naturale)
3. PRIMA rileva il tono del cliente, POI scegli la risposta appropriata
4. NON inventare informazioni sull'immobile che non hai
5. L'obiettivo finale è SEMPRE proporre un incontro breve con il Dott. Boni
6. NON essere troppo formale o burocratico - mantieni un tono calmo ed empatico
7. Adatta SEMPRE la lunghezza e lo stile della risposta al tono rilevato`;

  return prompt;
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