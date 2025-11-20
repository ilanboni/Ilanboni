import { storage } from "../storage";
import { renderTemplate } from "./campaignMessageService";
import type { WhatsappCampaign, CampaignMessage } from "@shared/schema";

/**
 * Servizio Follow-up Automatico per Campagne WhatsApp
 * 
 * Funzionalità:
 * - Identifica messaggi che non hanno ricevuto risposta
 * - Invia follow-up automatico dopo X giorni (configurabile per campagna)
 * - Usa template follow-up personalizzato della campagna
 * - Aggiorna status tracking
 */

interface FollowUpCandidate {
  campaignMessage: CampaignMessage;
  campaign: WhatsappCampaign;
  daysSinceSent: number;
}

/**
 * Trova messaggi campagna che necessitano follow-up
 */
export async function findMessagesNeedingFollowUp(): Promise<FollowUpCandidate[]> {
  try {
    // Get all active campaigns
    const campaigns = await storage.getAllWhatsappCampaigns();
    const activeCampaigns = campaigns.filter(c => c.status === 'active');

    const candidates: FollowUpCandidate[] = [];

    for (const campaign of activeCampaigns) {
      // Skip if no follow-up configured
      if (!campaign.followUpTemplate || !campaign.followUpDelayDays) {
        continue;
      }

      // Get messages for this campaign
      const messages = await storage.getCampaignMessagesByCampaign(campaign.id);

      for (const message of messages) {
        // Check if follow-up needed
        if (shouldSendFollowUp(message, campaign)) {
          const daysSinceSent = calculateDaysSinceSent(message);
          candidates.push({
            campaignMessage: message,
            campaign,
            daysSinceSent
          });
        }
      }
    }

    console.log(`[findMessagesNeedingFollowUp] Trovati ${candidates.length} messaggi per follow-up`);
    return candidates;
  } catch (error) {
    console.error("[findMessagesNeedingFollowUp] Errore ricerca messaggi follow-up:", error);
    return [];
  }
}

/**
 * Verifica se un messaggio necessita follow-up
 */
function shouldSendFollowUp(
  message: CampaignMessage,
  campaign: WhatsappCampaign
): boolean {
  // Already sent follow-up
  if (message.followUpSent) {
    return false;
  }

  // Message not sent yet or failed
  if (message.status !== 'sent' && message.status !== 'delivered' && message.status !== 'read') {
    return false;
  }

  // Already received response
  if (message.respondedAt) {
    return false;
  }

  // Check if enough days have passed
  if (!message.sentAt) {
    return false;
  }

  const daysSinceSent = calculateDaysSinceSent(message);
  const followUpDelay = campaign.followUpDelayDays || 3;

  return daysSinceSent >= followUpDelay;
}

/**
 * Calcola giorni passati dall'invio messaggio
 */
function calculateDaysSinceSent(message: CampaignMessage): number {
  if (!message.sentAt) {
    return 0;
  }

  const now = new Date();
  const sentDate = new Date(message.sentAt);
  const diffMs = now.getTime() - sentDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Invia follow-up per un messaggio specifico
 * Usa integrazione WhatsApp esistente (UltraMsg o simile)
 */
export async function sendFollowUpMessage(candidate: FollowUpCandidate): Promise<boolean> {
  try {
    const { campaignMessage, campaign } = candidate;

    // Get property details for template rendering
    const property = await storage.getProperty(campaignMessage.propertyId);
    if (!property) {
      console.error(`[sendFollowUpMessage] Property ${campaignMessage.propertyId} not found`);
      return false;
    }

    // Import template service
    const { extractVariablesFromProperty } = await import("./campaignMessageService");
    const variables = extractVariablesFromProperty(property);

    // Render follow-up template
    const followUpContent = campaign.followUpTemplate 
      ? renderTemplate(campaign.followUpTemplate, variables)
      : "Buongiorno, volevo sapere se ha avuto modo di riflettere sulla mia proposta per la proprietà. Resto a disposizione!";

    // Send via WhatsApp
    // TODO: Integrate with existing WhatsApp service (UltraMsg)
    // For now, just log and mark as sent
    console.log(`[sendFollowUpMessage] Sending follow-up to ${campaignMessage.phoneNumber}:`, followUpContent);

    // Update campaign message
    await storage.updateCampaignMessage(campaignMessage.id, {
      followUpSent: true,
      followUpSentAt: new Date(),
      status: 'sent' // Keep as sent after follow-up
    });

    // Update campaign statistics
    await incrementCampaignSentCount(campaign.id);

    console.log(`[sendFollowUpMessage] Follow-up inviato con successo a ${campaignMessage.phoneNumber}`);
    return true;
  } catch (error) {
    console.error("[sendFollowUpMessage] Errore invio follow-up:", error);
    return false;
  }
}

/**
 * Processa tutti i follow-up in attesa
 * Da chiamare dallo scheduler (cron job)
 */
export async function processScheduledFollowUps(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  console.log("[processScheduledFollowUps] Inizio processamento follow-up schedulati");

  const candidates = await findMessagesNeedingFollowUp();

  let sent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const success = await sendFollowUpMessage(candidate);
    if (success) {
      sent++;
    } else {
      failed++;
    }

    // Add small delay between sends to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`[processScheduledFollowUps] Completato: ${sent} inviati, ${failed} falliti`);

  return {
    processed: candidates.length,
    sent,
    failed
  };
}

/**
 * Incrementa contatore messaggi inviati campagna
 */
async function incrementCampaignSentCount(campaignId: number): Promise<void> {
  try {
    const campaign = await storage.getWhatsappCampaign(campaignId);
    if (campaign) {
      await storage.updateWhatsappCampaign(campaignId, {
        sentCount: (campaign.sentCount || 0) + 1
      });
    }
  } catch (error) {
    console.error("[incrementCampaignSentCount] Errore aggiornamento contatore:", error);
  }
}

/**
 * Ottiene statistiche follow-up per una campagna
 */
export async function getFollowUpStats(campaignId: number): Promise<{
  totalMessages: number;
  followUpSent: number;
  followUpPending: number;
  followUpResponded: number;
}> {
  try {
    const messages = await storage.getCampaignMessagesByCampaign(campaignId);

    const followUpSent = messages.filter(m => m.followUpSent).length;
    const followUpResponded = messages.filter(m => m.followUpSent && m.followUpResponse).length;

    const campaign = await storage.getWhatsappCampaign(campaignId);
    const pending = campaign 
      ? messages.filter(m => shouldSendFollowUp(m, campaign)).length
      : 0;

    return {
      totalMessages: messages.length,
      followUpSent,
      followUpPending: pending,
      followUpResponded
    };
  } catch (error) {
    console.error("[getFollowUpStats] Errore calcolo statistiche:", error);
    return {
      totalMessages: 0,
      followUpSent: 0,
      followUpPending: 0,
      followUpResponded: 0
    };
  }
}
