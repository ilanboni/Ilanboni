import OpenAI from "openai";
import { storage } from "../storage";
import type { WhatsappCampaign, CampaignMessage, BotConversationLog } from "@shared/schema";

/**
 * Servizio Bot Conversazionale con OpenAI/ChatGPT
 * 
 * Funzionalità:
 * - Gestione conversazioni automatiche con proprietari privati
 * - Context-aware responses basate su istruzioni campagna
 * - Intent recognition (appuntamento, prezzo, non interessato, etc.)
 * - Logging conversazioni per analisi e miglioramento
 */

interface BotContext {
  campaign: WhatsappCampaign;
  campaignMessage: CampaignMessage;
  conversationHistory: BotConversationLog[];
  propertyDetails: {
    address?: string;
    price?: number;
    size?: number;
    type?: string;
  };
}

interface BotResponse {
  message: string;
  intent: string | null;
  confidence: number | null;
  shouldEndConversation: boolean;
  suggestedActions: string[];
}

/**
 * Genera risposta bot usando ChatGPT con istruzioni generali
 * L'AI gestisce autonomamente qualsiasi tipo di messaggio/obiezione
 */
export async function generateBotResponse(
  userMessage: string,
  context: BotContext
): Promise<BotResponse> {
  try {
    console.log(`[BOT-AI] Generazione risposta AI per messaggio: "${userMessage.substring(0, 50)}..."`);
    
    // Usa ChatGPT con istruzioni generali della campagna
    // Usa Replit AI Integrations (crediti Replit)
    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });

    // Build conversation history for context
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: buildSystemPrompt(context)
      }
    ];

    // Add previous conversation turns
    for (const log of context.conversationHistory) {
      messages.push(
        { role: "user", content: log.userMessage },
        { role: "assistant", content: log.botResponse }
      );
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    // Call ChatGPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 200,
      functions: [
        {
          name: "analyze_intent",
          description: "Analyze user intent from their message",
          parameters: {
            type: "object",
            properties: {
              intent: {
                type: "string",
                enum: [
                  "schedule_visit",
                  "ask_price",
                  "ask_details",
                  "not_interested",
                  "already_sold",
                  "wants_callback",
                  "negotiation",
                  "general_question",
                  "unclear"
                ],
                description: "The detected intent from the user's message"
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 100,
                description: "Confidence score from 0 to 100"
              },
              should_end: {
                type: "boolean",
                description: "Whether the conversation should end (e.g., not interested, already sold)"
              },
              suggested_actions: {
                type: "array",
                items: { type: "string" },
                description: "Suggested follow-up actions for the agent"
              }
            },
            required: ["intent", "confidence", "should_end", "suggested_actions"]
          }
        }
      ],
      function_call: { name: "analyze_intent" }
    });

    const responseMessage = completion.choices[0]?.message;
    const functionCall = responseMessage?.function_call;

    let intent: string | null = null;
    let confidence: number | null = null;
    let shouldEnd = false;
    let suggestedActions: string[] = [];

    if (functionCall && functionCall.arguments) {
      try {
        const analysis = JSON.parse(functionCall.arguments);
        intent = analysis.intent || null;
        confidence = analysis.confidence || null;
        shouldEnd = analysis.should_end || false;
        suggestedActions = analysis.suggested_actions || [];
      } catch (e) {
        console.error("[generateBotResponse] Failed to parse function call:", e);
      }
    }

    // Generate actual response text
    const textCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const botMessage = textCompletion.choices[0]?.message?.content?.trim() || "Grazie per il messaggio. Un nostro agente ti contatterà a breve.";

    return {
      message: botMessage,
      intent,
      confidence,
      shouldEndConversation: shouldEnd,
      suggestedActions
    };
  } catch (error) {
    console.error("[generateBotResponse] Errore generazione risposta bot:", error);
    
    // Fallback response
    return {
      message: "Grazie per il messaggio. Un nostro agente ti contatterà a breve per discutere della tua proprietà.",
      intent: "unclear",
      confidence: null,
      shouldEndConversation: false,
      suggestedActions: ["Contatto manuale richiesto"]
    };
  }
}

/**
 * Configurazione comportamentale del bot - Dott. Ilan Boni
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
  }
};

/**
 * Costruisce system prompt per ChatGPT basato sulla configurazione del bot
 */
function buildSystemPrompt(context: BotContext): string {
  const { propertyDetails } = context;
  const cfg = BOT_CONFIG;

  const prompt = `Sei "${cfg.bot_name}". ${cfg.identity.presentation}

=== CHI SEI ===
${cfg.identity.background}
${cfg.identity.positioning}

=== IMMOBILE IN DISCUSSIONE ===
- Indirizzo: ${propertyDetails.address || "Non specificato"}
- Prezzo: ${propertyDetails.price ? `€${propertyDetails.price.toLocaleString("it-IT")}` : "Da definire"}
- Dimensione: ${propertyDetails.size ? `${propertyDetails.size}m²` : "Non specificata"}

=== STILE DI COMUNICAZIONE ===
- Dai SEMPRE del Lei
- Frasi ${cfg.language.style.sentences}
- Tono: ${cfg.language.style.tone}
- EVITA: ${cfg.language.style.avoid.join(", ")}

=== OBIETTIVI ===
Primario: ${cfg.goals.primary}
Secondario: ${cfg.goals.secondary}

=== REGOLE COMPORTAMENTALI (SEGUI SEMPRE) ===
${cfg.global_behavior_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

=== STRATEGIA CONVERSAZIONE ===
Struttura risposta: ${cfg.conversation_strategy.structure.join(" → ")}

Frasi per proporre appuntamento (usale come ispirazione):
${cfg.conversation_strategy.appointment_phrases.map(p => `- "${p}"`).join("\n")}

Per chiedere disponibilità:
${cfg.conversation_strategy.time_suggestions.map(p => `- "${p}"`).join("\n")}

=== GESTIONE OBIEZIONI ===
${cfg.objection_handlers.map(h => `
**${h.name.toUpperCase()}**
Se il proprietario dice: ${h.triggers.join(", ")}
Rispondi con una di queste (adattandola):
${h.responses.map(r => `- "${r}"`).join("\n")}`).join("\n")}

=== DOMANDE TECNICHE ===
Per qualsiasi domanda tecnica o delicata, rispondi:
"${cfg.technical_question_redirect.response}"

=== FALLBACK ===
Se non sai come rispondere:
"${cfg.fallback.response}"

=== CHIUSURA ===
Se l'appuntamento è fissato: "${cfg.closing_templates.with_appointment[0]}"
Se non interessato: "${cfg.closing_templates.without_appointment[0]}"
Firma: "${cfg.closing_templates.signature}"

=== ISTRUZIONI FINALI ===
1. Rispondi SOLO in italiano
2. Messaggi BREVI (max 3-4 frasi, stile WhatsApp)
3. Segui SEMPRE la struttura: Empatia → Ricalco → Valore incontro → Proposta appuntamento
4. NON inventare informazioni
5. L'obiettivo finale è SEMPRE proporre un incontro breve con il Dott. Boni`;

  return prompt;
}

/**
 * Processa messaggio utente e genera risposta
 * Include logging automatico nel database
 */
export async function processChatbotMessage(
  campaignMessageId: number,
  phoneNumber: string,
  userMessage: string
): Promise<string> {
  try {
    // Load campaign message and related data
    const campaignMessage = await storage.getCampaignMessage(campaignMessageId);
    if (!campaignMessage) {
      throw new Error(`Campaign message ${campaignMessageId} not found`);
    }

    // Load campaign
    const campaign = await storage.getWhatsappCampaign(campaignMessage.campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignMessage.campaignId} not found`);
    }

    // Load conversation history
    const conversationHistory = await storage.getBotConversationLogs(campaignMessageId);

    // Load property details
    const property = await storage.getProperty(campaignMessage.propertyId);
    const propertyDetails = property ? {
      address: property.address,
      price: property.price,
      size: property.size || undefined,
      type: property.type
    } : {};

    // Build context
    const context: BotContext = {
      campaign,
      campaignMessage,
      conversationHistory,
      propertyDetails
    };

    // Generate bot response
    const botResponse = await generateBotResponse(userMessage, context);

    // Log conversation
    await storage.createBotConversationLog({
      campaignMessageId,
      phoneNumber,
      userMessage,
      botResponse: botResponse.message,
      intent: botResponse.intent,
      confidence: botResponse.confidence,
      metadata: {
        shouldEndConversation: botResponse.shouldEndConversation,
        suggestedActions: botResponse.suggestedActions
      }
    });

    // Update campaign message
    const updates: any = {
      response: userMessage,
      respondedAt: new Date(),
      lastBotMessage: botResponse.message,
      lastBotMessageAt: new Date()
    };

    if (botResponse.shouldEndConversation) {
      updates.conversationActive = false;
    }

    await storage.updateCampaignMessage(campaignMessageId, updates);

    // Update contact tracking - mark as responded
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    const existingTracking = await storage.getPrivateContactTracking(normalizedPhone);
    if (existingTracking) {
      await storage.updatePrivateContactTracking(normalizedPhone, {
        status: 'responded',
        metadata: {
          ...(existingTracking.metadata as any || {}),
          lastResponse: userMessage,
          respondedAt: new Date().toISOString()
        }
      });
    }

    return botResponse.message;
  } catch (error) {
    console.error("[processChatbotMessage] Errore processamento messaggio bot:", error);
    throw error;
  }
}

/**
 * Verifica se bot conversazionale è attivo per un messaggio
 */
export async function isBotActiveForMessage(campaignMessageId: number): Promise<boolean> {
  const campaignMessage = await storage.getCampaignMessage(campaignMessageId);
  return campaignMessage?.conversationActive || false;
}

/**
 * Attiva bot conversazionale per un messaggio
 */
export async function activateBotForMessage(campaignMessageId: number): Promise<void> {
  await storage.updateCampaignMessage(campaignMessageId, {
    conversationActive: true
  });
}

/**
 * Disattiva bot conversazionale per un messaggio
 */
export async function deactivateBotForMessage(campaignMessageId: number): Promise<void> {
  await storage.updateCampaignMessage(campaignMessageId, {
    conversationActive: false
  });
}
