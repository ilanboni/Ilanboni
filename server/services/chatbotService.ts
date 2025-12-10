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
 * Costruisce system prompt per ChatGPT basato su istruzioni campagna
 * Le istruzioni dell'utente hanno priorità assoluta
 */
function buildSystemPrompt(context: BotContext): string {
  const { campaign, propertyDetails } = context;

  // Le istruzioni dell'utente sono la parte più importante
  const userInstructions = campaign.instructions || "";
  
  const basePrompt = `Sei un assistente virtuale che gestisce conversazioni WhatsApp per conto di un agente immobiliare.

=== ISTRUZIONI DELL'AGENTE (SEGUI QUESTE PRIORITARIAMENTE) ===
${userInstructions || "Nessuna istruzione specifica fornita. Usa buon senso professionale."}
=== FINE ISTRUZIONI AGENTE ===

**Contesto immobile di cui si sta parlando:**
- Indirizzo: ${propertyDetails.address || "Non specificato"}
- Prezzo richiesto: ${propertyDetails.price ? `€${propertyDetails.price.toLocaleString("it-IT")}` : "Da concordare"}
- Dimensione: ${propertyDetails.size ? `${propertyDetails.size}m²` : "Non specificata"}
- Tipologia: ${propertyDetails.type || "Immobile"}

**Regole base (solo se non in contrasto con istruzioni agente):**
1. Rispondi SEMPRE in italiano
2. Messaggi brevi e naturali (stile WhatsApp, max 2-3 frasi)
3. Sii cordiale ma professionale
4. Se non sai rispondere a qualcosa, proponi che l'agente richiami

**Come gestire le obiezioni:**
Segui lo spirito delle istruzioni dell'agente. Se il proprietario:
- Dice "no grazie" / "non interessato" → ringrazia e lascia porta aperta per futuro
- Chiede info su commissioni/costi → rimanda all'agente per dettagli
- È già in trattativa con altri → mostra interesse genuino senza pressare
- Ha dubbi → rassicura gentilmente seguendo tono delle istruzioni

NON fare mai:
- Non inventare informazioni che non hai
- Non essere insistente o aggressivo
- Non fare promesse che l'agente non può mantenere`;

  return basePrompt;
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
