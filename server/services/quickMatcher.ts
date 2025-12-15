import { storage } from '../storage';
import { calculateMatchScore, quickMatchScore, MatchInput } from './aiMatcher';
import { SharedProperty, Property, Client, InsertMatch } from '@shared/schema';

const SCORE_THRESHOLD = parseInt(process.env.MATCH_SCORE_THRESHOLD || '50');

export interface QuickMatchResult {
  clientId: number;
  clientName: string;
  score: number;
  reasoning: string;
}

export interface QuickMatchSummary {
  propertyId: number;
  propertyType: 'shared' | 'private';
  totalHighRatingBuyers: number;
  matchesFound: number;
  matchesSaved: number;
  results: QuickMatchResult[];
  errors: string[];
}

export async function runQuickMatchingForHighRatingClients(
  property: SharedProperty | Property,
  propertyType: 'shared' | 'private' = 'shared'
): Promise<QuickMatchSummary> {
  console.log(`[QUICK-MATCHER] 🚀 Running quick matching for ${propertyType} property ${property.id}`);
  
  const summary: QuickMatchSummary = {
    propertyId: property.id,
    propertyType,
    totalHighRatingBuyers: 0,
    matchesFound: 0,
    matchesSaved: 0,
    results: [],
    errors: []
  };

  try {
    const allClients = await storage.getClients({ type: 'buyer' });
    
    const highRatingClients: Array<{ client: Client; buyerId: number; rating: number }> = [];
    
    for (const client of allClients) {
      const buyer = await storage.getBuyerByClientId(client.id);
      if (buyer && (buyer.rating === 4 || buyer.rating === 5)) {
        highRatingClients.push({
          client,
          buyerId: buyer.id,
          rating: buyer.rating
        });
      }
    }
    
    summary.totalHighRatingBuyers = highRatingClients.length;
    console.log(`[QUICK-MATCHER] Found ${highRatingClients.length} high-rating buyers (rating 4-5)`);

    if (highRatingClients.length === 0) {
      console.log('[QUICK-MATCHER] No high-rating buyers found, skipping');
      return summary;
    }

    for (const { client, buyerId, rating } of highRatingClients) {
      try {
        const buyer = await storage.getBuyerByClientId(client.id);
        if (!buyer) continue;

        const quickScore = quickMatchScore(buyer, property);
        
        if (quickScore < SCORE_THRESHOLD) {
          continue;
        }

        summary.matchesFound++;

        let finalScore = quickScore;
        let reasoning = `Match algoritmico: ${quickScore}% (rating ${rating})`;
        let isAiGenerated = false;

        if (quickScore >= 60) {
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
          } catch (aiError) {
            console.error(`[QUICK-MATCHER] AI matching failed for client ${client.id}:`, aiError);
            summary.errors.push(`AI error for ${client.firstName} ${client.lastName}`);
          }
        }

        if (finalScore >= SCORE_THRESHOLD) {
          const matchData: InsertMatch = {
            clientId: client.id,
            buyerId: buyerId,
            propertyId: propertyType === 'private' ? property.id : null,
            sharedPropertyId: propertyType === 'shared' ? property.id : null,
            score: finalScore,
            reasoning,
            isAiGenerated
          };

          await storage.createMatch(matchData);
          summary.matchesSaved++;
          
          summary.results.push({
            clientId: client.id,
            clientName: `${client.firstName} ${client.lastName}`,
            score: finalScore,
            reasoning
          });

          console.log(`[QUICK-MATCHER] ✓ Match saved: ${client.firstName} ${client.lastName} (score: ${finalScore}, rating: ${rating})`);
        }
      } catch (clientError) {
        const errorMsg = clientError instanceof Error ? clientError.message : String(clientError);
        console.error(`[QUICK-MATCHER] Error processing client ${client.id}:`, errorMsg);
        summary.errors.push(`Error for client ${client.id}: ${errorMsg}`);
      }
    }

    console.log(`[QUICK-MATCHER] ✅ Completed: ${summary.matchesSaved}/${summary.matchesFound} matches saved for ${summary.totalHighRatingBuyers} high-rating buyers`);
    return summary;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[QUICK-MATCHER] Critical error:', errorMsg);
    summary.errors.push(`Critical error: ${errorMsg}`);
    return summary;
  }
}

export async function runQuickMatchingAfterImport(
  properties: Array<SharedProperty | Property>,
  propertyType: 'shared' | 'private' = 'shared'
): Promise<{ total: number; matched: number; results: QuickMatchSummary[] }> {
  console.log(`[QUICK-MATCHER] 🔄 Running batch matching for ${properties.length} ${propertyType} properties`);
  
  const allResults: QuickMatchSummary[] = [];
  let totalMatched = 0;

  for (const property of properties) {
    const result = await runQuickMatchingForHighRatingClients(property, propertyType);
    allResults.push(result);
    totalMatched += result.matchesSaved;
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`[QUICK-MATCHER] ✅ Batch completed: ${totalMatched} total matches for ${properties.length} properties`);
  
  return {
    total: properties.length,
    matched: totalMatched,
    results: allResults
  };
}
