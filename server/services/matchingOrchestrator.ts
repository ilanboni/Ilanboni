import { storage } from '../storage';
import { calculateMatchScore, quickMatchScore, MatchInput } from './aiMatcher';
import { Buyer, SharedProperty, Property, Client, InsertMatch } from '@shared/schema';

const SCORE_THRESHOLD = parseInt(process.env.MATCH_SCORE_THRESHOLD || '50');
const AI_MATCHING_ENABLED = true;

export interface MatchOrchestrationResult {
  totalMatches: number;
  aiProcessed: number;
  savedMatches: number;
  errors: string[];
}

export async function triggerMatchingForProperty(
  property: SharedProperty | Property,
  propertyType: 'shared' | 'private'
): Promise<MatchOrchestrationResult> {
  console.log(`[MATCH-ORCHESTRATOR] Triggering matching for ${propertyType} property ${property.id}`);
  
  const result: MatchOrchestrationResult = {
    totalMatches: 0,
    aiProcessed: 0,
    savedMatches: 0,
    errors: []
  };

  try {
    const clients = await storage.getClients({ type: 'buyer' });
    const buyerClients = clients;
    
    console.log(`[MATCH-ORCHESTRATOR] Found ${buyerClients.length} buyer clients to match`);

    for (const client of buyerClients) {
      try {
        const buyer = await storage.getBuyerByClientId(client.id);
        if (!buyer) continue;

        const quickScore = quickMatchScore(buyer, property);
        
        if (quickScore < SCORE_THRESHOLD) {
          continue;
        }

        result.totalMatches++;

        let finalScore = quickScore;
        let reasoning = `Match algoritmico: ${quickScore}%`;
        let isAiGenerated = false;

        if (AI_MATCHING_ENABLED && quickScore >= 60) {
          try {
            const aiResult = await calculateMatchScore({
              client,
              buyer,
              property,
              propertyType
            });
            finalScore = aiResult.score;
            reasoning = aiResult.reasoning;
            isAiGenerated = true;
            result.aiProcessed++;
          } catch (aiError) {
            console.error(`[MATCH-ORCHESTRATOR] AI matching failed for client ${client.id}:`, aiError);
            result.errors.push(`AI error for client ${client.id}`);
          }
        }

        if (finalScore >= SCORE_THRESHOLD) {
          const matchData: InsertMatch = {
            clientId: client.id,
            buyerId: buyer.id,
            propertyId: propertyType === 'private' ? property.id : null,
            sharedPropertyId: propertyType === 'shared' ? property.id : null,
            score: finalScore,
            reasoning,
            isAiGenerated
          };

          await storage.createMatch(matchData);
          result.savedMatches++;
          console.log(`[MATCH-ORCHESTRATOR] Saved match: client ${client.id} <-> property ${property.id} (score: ${finalScore})`);
        }
      } catch (clientError) {
        console.error(`[MATCH-ORCHESTRATOR] Error processing client ${client.id}:`, clientError);
        result.errors.push(`Client ${client.id} error`);
      }
    }

    console.log(`[MATCH-ORCHESTRATOR] Completed: ${result.savedMatches} matches saved, ${result.aiProcessed} AI processed`);
    return result;
  } catch (error) {
    console.error('[MATCH-ORCHESTRATOR] Critical error:', error);
    result.errors.push('Critical orchestration error');
    return result;
  }
}

export async function triggerMatchingForBuyer(
  clientId: number
): Promise<MatchOrchestrationResult> {
  console.log(`[MATCH-ORCHESTRATOR] Triggering matching for buyer (client ${clientId})`);
  
  const result: MatchOrchestrationResult = {
    totalMatches: 0,
    aiProcessed: 0,
    savedMatches: 0,
    errors: []
  };

  try {
    const client = await storage.getClient(clientId);
    if (!client || client.type !== 'buyer') {
      console.log(`[MATCH-ORCHESTRATOR] Client ${clientId} is not a buyer`);
      return result;
    }

    const buyer = await storage.getBuyerByClientId(clientId);
    if (!buyer) {
      console.log(`[MATCH-ORCHESTRATOR] No buyer record for client ${clientId}`);
      return result;
    }

    await storage.deleteMatchesByClientId(clientId);
    console.log(`[MATCH-ORCHESTRATOR] Cleared existing matches for client ${clientId}`);

    const sharedProperties = await storage.getSharedProperties();
    console.log(`[MATCH-ORCHESTRATOR] Checking ${sharedProperties.length} shared properties`);

    for (const property of sharedProperties) {
      try {
        const quickScore = quickMatchScore(buyer, property);
        
        if (quickScore < SCORE_THRESHOLD) {
          continue;
        }

        result.totalMatches++;

        let finalScore = quickScore;
        let reasoning = `Match algoritmico: ${quickScore}%`;
        let isAiGenerated = false;

        if (AI_MATCHING_ENABLED && quickScore >= 60) {
          try {
            const aiResult = await calculateMatchScore({
              client,
              buyer,
              property,
              propertyType: 'shared'
            });
            finalScore = aiResult.score;
            reasoning = aiResult.reasoning;
            isAiGenerated = true;
            result.aiProcessed++;
          } catch (aiError) {
            console.error(`[MATCH-ORCHESTRATOR] AI matching failed for property ${property.id}:`, aiError);
            result.errors.push(`AI error for property ${property.id}`);
          }
        }

        if (finalScore >= SCORE_THRESHOLD) {
          const matchData: InsertMatch = {
            clientId: client.id,
            buyerId: buyer.id,
            sharedPropertyId: property.id,
            score: finalScore,
            reasoning,
            isAiGenerated
          };

          await storage.createMatch(matchData);
          result.savedMatches++;
        }
      } catch (propError) {
        console.error(`[MATCH-ORCHESTRATOR] Error processing property ${property.id}:`, propError);
        result.errors.push(`Property ${property.id} error`);
      }
    }

    console.log(`[MATCH-ORCHESTRATOR] Completed for buyer ${clientId}: ${result.savedMatches} matches saved`);
    return result;
  } catch (error) {
    console.error('[MATCH-ORCHESTRATOR] Critical error:', error);
    result.errors.push('Critical orchestration error');
    return result;
  }
}

export async function getMatchesForClient(clientId: number): Promise<Array<{
  match: any;
  property: SharedProperty | Property | null;
}>> {
  const matches = await storage.getMatchesByClientId(clientId);
  
  const enrichedMatches = await Promise.all(
    matches.map(async (match) => {
      let property: SharedProperty | Property | null = null;
      
      if (match.sharedPropertyId) {
        property = await storage.getSharedProperty(match.sharedPropertyId);
      } else if (match.propertyId) {
        property = await storage.getProperty(match.propertyId);
      }
      
      return { match, property };
    })
  );

  return enrichedMatches
    .filter(m => m.property !== null)
    .sort((a, b) => (b.match.score || 0) - (a.match.score || 0));
}
