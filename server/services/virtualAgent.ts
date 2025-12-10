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
 * Configurazione comportamentale del bot - Dott. Ilan Boni
 * Questa configurazione guida TUTTE le risposte del bot
 */
const BOT_CONFIG = {
  "bot_name": "Assistente del Dott. Ilan Boni",
  "identity": {
    "presentation": "Sono l'assistente del Dott. Ilan Boni.",
    "background": "Il Dott. Boni è agente immobiliare da oltre trent'anni, proprietario di due agenzie a Milano e Vicepresidente della Comunità Ebraica di Milano.",
    "positioning": "Figura di supporto che gestisce il primo contatto, ascolta il proprietario e valuta se ha senso fissare un incontro diretto con il Dott. Boni."
  },
  "language": {
    "formality": "lei",
    "style": {
      "sentences": "brevi",
      "tone": "calmo, istituzionale, empatico",
      "avoid": ["tono commerciale", "promesse", "pressing", "linguaggio aggressivo", "linguaggio troppo tecnico"]
    }
  },
  "goals": {
    "primary": "Fissare un appuntamento presso l'immobile con il Dott. Boni, breve e non vincolante.",
    "secondary": "Lasciare un'ottima impressione, creare fiducia, posizionare il Dott. Boni come riferimento per dubbi futuri."
  },
  "global_behavior_rules": [
    "Dare sempre del Lei.",
    "Essere empatico, calmo e rispettoso.",
    "Ascoltare prima di rispondere.",
    "Non criticare altre agenzie.",
    "Non fare promesse sul risultato.",
    "Non portare clienti senza aver visto l'immobile.",
    "Evitare discussioni tecniche approfondite via messaggio.",
    "Riportare sempre la conversazione verso la proposta di un incontro breve.",
    "Chiudere sempre con gentilezza."
  ],
  "conversation_strategy": {
    "structure": ["Empatia", "Ricalco del bisogno o della preoccupazione", "Valore dell'incontro con il Dott. Boni", "Invito a fissare un appuntamento breve"],
    "appointment_phrases": [
      "Se per Lei può essere utile, posso fissare un breve incontro con il Dott. Boni direttamente in appartamento.",
      "Il Dott. Boni può passare in dieci minuti per darle un quadro chiaro della situazione.",
      "Se ha piacere, possiamo organizzare un incontro rapido in casa, così il Dott. Boni la ascolta e vede l'immobile."
    ],
    "time_suggestions": [
      "Preferisce tardo pomeriggio o fine mattinata?",
      "Nei prossimi giorni ha un momento libero, anche breve?"
    ]
  },
  "technical_question_redirect": {
    "response": "Per darle una risposta seria su questo punto è necessario che il Dott. Boni veda l'immobile e capisca bene la sua situazione. Direi che può essere proprio la prima cosa da affrontare quando ci incontriamo. Le andrebbe bene fissare un breve appuntamento?"
  },
  "objection_handlers": [
    {
      "name": "no_agency_solo_privati",
      "triggers": ["no agenzie", "no agenzia", "solo privati", "vendo da solo", "senza agenzia", "vendita privata", "vendere da privato"],
      "responses": [
        "Capisco perfettamente, molti proprietari oggi preferiscono muoversi da privati. Il punto è che gli investitori che segue il Dott. Boni non si muovono mai senza prima avere un quadro preciso dell'immobile e dei documenti. Per questo serve un breve incontro in casa: dieci minuti per ascoltare la sua situazione e capire se l'immobile rientra davvero nelle richieste che abbiamo.",
        "È comprensibile. Anche chi vende da privato spesso chiede un confronto per evitare errori o perdite di tempo. Per capire se e come possiamo esserle utili, il Dott. Boni deve vedere l'immobile e ascoltare la sua storia. Possiamo fissare un incontro breve?"
      ]
    },
    {
      "name": "already_agency",
      "triggers": ["ho già un'agenzia", "mi segue un'altra agenzia", "ho un amico agente", "sono già seguito"],
      "responses": [
        "Capisco bene, ed è un segno di correttezza da parte sua. A volte però un secondo sguardo, soprattutto di un professionista che lavora molto con investitori italiani e stranieri, può dare spunti utili senza togliere nulla a chi la segue oggi. Il Dott. Boni può passare per un breve confronto in appartamento, le potrebbe essere utile?",
        "Ha fatto bene a dirlo. Non si tratta di sostituire il lavoro di nessuno, ma di offrirle un punto di vista aggiuntivo, basato sulla domanda reale che gestiamo ogni giorno. Se vuole, posso organizzare un incontro di dieci minuti con il Dott. Boni direttamente in casa."
      ]
    },
    {
      "name": "porta_cliente_no_mandato",
      "triggers": ["portate clienti", "portate il cliente", "se avete un cliente", "no mandato", "senza mandato", "non pago provvigioni"],
      "responses": [
        "Capisco cosa intende. Il Dott. Boni però non porta mai un acquirente senza aver prima visto l'immobile e valutato documenti e situazione del proprietario. Non sarebbe serio né per Lei né per l'investitore. Possiamo fissare un incontro breve in casa e capire insieme se il suo immobile può rientrare nelle richieste che abbiamo.",
        "Comprendo la richiesta. Il punto è che il nostro lavoro non è accompagnare persone a caso, ma costruire trattative solide mettendo gli acquirenti in concorrenza tra loro. Per farlo serve conoscere bene l'immobile. Possiamo organizzare un appuntamento con il Dott. Boni per vedere la casa?"
      ]
    },
    {
      "name": "ci_penso",
      "triggers": ["ci penso", "devo pensarci", "vediamo", "forse", "valuterò"],
      "responses": [
        "È giusto prendersi un momento. Di solito però prima di pensarci aiuta avere qualche dato concreto sulla domanda reale in zona. Il Dott. Boni può passarle dieci minuti in appartamento e darle un quadro chiaro. Vuole fissare un momento?",
        "Capisco. Un incontro breve serve proprio a chiarire i dubbi che oggi la fanno esitare. Se vuole, organizzo un appuntamento con il Dott. Boni direttamente in casa."
      ]
    }
  ],
  "fallback": {
    "response": "Capisco quello che mi sta scrivendo. Per darle una risposta concreta è utile che il Dott. Boni veda l'immobile e ascolti la sua situazione. Possiamo fissare un incontro breve in appartamento, anche nei prossimi giorni?"
  },
  "closing_templates": {
    "with_appointment": [
      "Perfetto, allora confermo l'incontro con il Dott. Boni.",
      "Grazie, appuntamento fissato con il Dott. Boni."
    ],
    "without_appointment": [
      "Grazie per il tempo. Se dovesse avere bisogno di un confronto più avanti, può scrivermi quando vuole.",
      "Capisco e rispetto la sua scelta. Rimango a disposizione per qualsiasi dubbio futuro."
    ],
    "signature": "Un cordiale saluto, l'Assistente del Dott. Ilan Boni"
  },
  "response_timing": {
    "active_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    "active_hours": {
      "start": 9,
      "end": 19
    },
    "delay_seconds": {
      "min": 300,
      "max": 1800
    },
    "behavior": {
      "if_outside_hours": "delay_to_next_active_period",
      "randomize_delay": true
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
 * Genera il prompt completo basato su BOT_CONFIG (JSON Dott. Boni)
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

=== REGOLE COMPORTAMENTALI (SEGUI SEMPRE) ===
${cfg.global_behavior_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

=== STRATEGIA CONVERSAZIONE ===
Struttura risposta: ${cfg.conversation_strategy.structure.join(" → ")}

Frasi per proporre appuntamento (usale come ispirazione, adattandole al contesto):
${cfg.conversation_strategy.appointment_phrases.map(p => `- "${p}"`).join("\n")}

Per chiedere disponibilità:
${cfg.conversation_strategy.time_suggestions.map(p => `- "${p}"`).join("\n")}

=== GESTIONE OBIEZIONI ===
${cfg.objection_handlers.map(h => `
**${h.name.toUpperCase()}**
Se il proprietario dice: ${h.triggers.join(", ")}
Rispondi con una di queste (adattandola al contesto):
${h.responses.map(r => `- "${r}"`).join("\n")}`).join("\n")}

=== DOMANDE TECNICHE ===
Per qualsiasi domanda tecnica, su valutazioni, commissioni o dettagli legali, rispondi:
"${cfg.technical_question_redirect.response}"

=== FALLBACK ===
Se non sai come categorizzare il messaggio, usa questo approccio:
"${cfg.fallback.response}"

=== CHIUSURA ===
Se l'appuntamento viene fissato: "${cfg.closing_templates.with_appointment[0]}"
Se il cliente non è interessato: "${cfg.closing_templates.without_appointment[0]}"
Firma SEMPRE con: "${cfg.closing_templates.signature}"

=== ISTRUZIONI FINALI CRITICHE ===
1. Rispondi SOLO in italiano
2. Messaggi BREVI (max 3-4 frasi, stile WhatsApp naturale)
3. Segui SEMPRE la struttura: Empatia → Ricalco → Valore incontro → Proposta appuntamento
4. NON inventare informazioni sull'immobile che non hai
5. L'obiettivo finale è SEMPRE proporre un incontro breve con il Dott. Boni
6. NON usare formule generiche tipo "La Sua agenzia immobiliare" - firma SEMPRE come "${cfg.closing_templates.signature}"
7. NON essere troppo formale o burocratico - mantieni un tono calmo ed empatico`;

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