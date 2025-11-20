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
 * Verifica se il messaggio contiene un'obiezione configurata
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
        console.log(`[BOT-OBJECTION] Rilevata obiezione con keywords: ${objection.keywords.join(', ')}`);
        return objection;
      }
    }
  }
  
  return null;
}

/**
 * Genera risposta bot usando ChatGPT
 */
export async function generateBotResponse(
  userMessage: string,
  context: BotContext
): Promise<BotResponse> {
  try {
    // STEP 1: Verifica se c'è un'obiezione configurata
    const objection = checkForObjection(
      userMessage,
      (context.campaign as any).objectionHandling
    );
    
    if (objection) {
      console.log(`[BOT-OBJECTION] Uso risposta configurata per obiezione`);
      return {
        message: objection.response,
        intent: 'objection_handled',
        confidence: 100,
        shouldEndConversation: false,
        suggestedActions: ['Monitorare risposta cliente', 'Follow-up tra qualche giorno']
      };
    }
    
    // STEP 2: Nessuna obiezione configurata, usa ChatGPT
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
 */
function buildSystemPrompt(context: BotContext): string {
  const { campaign, propertyDetails } = context;

  const basePrompt = `Sei un assistente AI che aiuta agenti immobiliari a gestire conversazioni WhatsApp con proprietari privati di immobili.

**Contesto immobile:**
- Indirizzo: ${propertyDetails.address || "Non specificato"}
- Prezzo: ${propertyDetails.price ? `€${propertyDetails.price.toLocaleString("it-IT")}` : "Da concordare"}
- Dimensione: ${propertyDetails.size ? `${propertyDetails.size}m²` : "Non specificata"}
- Tipologia: ${propertyDetails.type || "Immobile"}

**Il tuo ruolo:**
1. Rispondi in modo professionale ma amichevole
2. Mantieni conversazioni brevi e concise (max 100 parole)
3. NON prendere impegni definitivi senza conferma agente
4. Suggerisci sempre il contatto con l'agente per dettagli importanti
5. Rispondi SEMPRE in italiano

**Obiettivi conversazione:**
- Raccogliere informazioni sul proprietario e sulla proprietà
- Confermare disponibilità per appuntamento/chiamata
- Capire motivazione vendita e tempistiche
- Identificare se immobile è ancora disponibile

**Istruzioni specifiche campagna:**
${campaign.instructions || "Nessuna istruzione specifica - usa buon senso professionale."}

**Cosa NON fare:**
- Non dare valutazioni definitive di prezzo
- Non promettere vendita rapida senza verifiche
- Non discutere commissioni o costi
- Non essere insistente o pressante`;

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
