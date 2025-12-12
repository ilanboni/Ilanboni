import OpenAI from 'openai';
import { Buyer, SharedProperty, Client, Property, Match, InsertMatch } from '@shared/schema';

const openai = new OpenAI();

export interface MatchResult {
  score: number;
  reasoning: string;
}

export interface MatchInput {
  client: Client;
  buyer: Buyer;
  property: SharedProperty | Property;
  propertyType: 'shared' | 'private';
}

export async function calculateMatchScore(input: MatchInput): Promise<MatchResult> {
  const { client, buyer, property } = input;

  const buyerPreferences = [
    buyer.elevator ? 'Ascensore richiesto' : null,
    buyer.balconyOrTerrace ? 'Balcone/Terrazzo richiesto' : null,
    buyer.parking ? 'Parcheggio richiesto' : null,
    buyer.garden ? 'Giardino richiesto' : null,
  ].filter(Boolean).join(', ') || 'Nessuna preferenza specifica';

  const zonesText = Array.isArray(buyer.zones) 
    ? buyer.zones.join(', ') 
    : typeof buyer.zones === 'string' 
      ? buyer.zones 
      : 'Non specificata';

  const prompt = `Sei un esperto agente immobiliare italiano. Valuta la compatibilità tra questa richiesta cliente e questo immobile.

RICHIESTA CLIENTE (${client.firstName} ${client.lastName}):
- Zone di interesse: ${zonesText}
- Prezzo massimo: ${buyer.maxPrice ? `€${buyer.maxPrice.toLocaleString('it-IT')}` : 'Non specificato'}
- Superficie minima: ${buyer.minSize ? `${buyer.minSize} mq` : 'Non specificata'}
- Locali richiesti: ${buyer.rooms || 'Non specificati'}
- Bagni richiesti: ${buyer.bathrooms || 'Non specificati'}
- Tipologia: ${buyer.propertyType || 'Non specificata'}
- Note di ricerca: ${buyer.searchNotes || 'Nessuna'}
- Preferenze: ${buyerPreferences}

IMMOBILE:
- Indirizzo: ${property.address}, ${property.city || 'Milano'}
- Prezzo: €${property.price?.toLocaleString('it-IT') || 'Non indicato'}
- Superficie: ${property.size ? `${property.size} mq` : 'Non indicata'}
- Locali: ${property.bedrooms || 'Non indicati'}
- Bagni: ${property.bathrooms || 'Non indicati'}
- Piano: ${property.floor || 'Non indicato'}
- Descrizione: ${(property.description || '').substring(0, 600)}

ISTRUZIONI:
1. Valuta la compatibilità su una scala da 0 a 100
2. Considera: zona, prezzo, superficie, locali, preferenze specifiche
3. Penalizza se il prezzo supera il budget (max -30 punti)
4. Penalizza se la superficie è inferiore al minimo richiesto (max -20 punti)
5. Bonus se la zona corrisponde esattamente (+10 punti)
6. Spiega brevemente in italiano il punteggio

Rispondi SOLO con un JSON valido:
{"score": <numero 0-100>, "reasoning": "<spiegazione in italiano, max 200 caratteri>"}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200
    });

    const content = response.choices[0].message.content;
    if (!content) {
      console.error('[AI-MATCHER] Empty response from OpenAI');
      return { score: 0, reasoning: 'Errore: risposta vuota da AI' };
    }

    const result = JSON.parse(content);
    
    const score = Math.max(0, Math.min(100, Math.round(result.score || 0)));
    const reasoning = (result.reasoning || 'Nessuna spiegazione').substring(0, 500);

    console.log(`[AI-MATCHER] Score: ${score} - ${reasoning.substring(0, 50)}...`);
    
    return { score, reasoning };
  } catch (error) {
    console.error('[AI-MATCHER] Error calculating match score:', error);
    return { score: 0, reasoning: 'Errore nel calcolo del punteggio AI' };
  }
}

export async function calculateMatchScoreBatch(
  inputs: MatchInput[]
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>();
  
  const batchSize = 5;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const promises = batch.map(async (input) => {
      const key = `${input.buyer.id}-${input.propertyType === 'shared' ? 's' : 'p'}${input.property.id}`;
      const result = await calculateMatchScore(input);
      return { key, result };
    });
    
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ key, result }) => {
      results.set(key, result);
    });
    
    if (i + batchSize < inputs.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

export function quickMatchScore(buyer: Buyer, property: SharedProperty | Property): number {
  let score = 100;
  
  if (buyer.maxPrice && property.price) {
    if (property.price > buyer.maxPrice) {
      const overBudgetPercent = ((property.price - buyer.maxPrice) / buyer.maxPrice) * 100;
      if (overBudgetPercent > 20) return 0;
      score -= Math.min(40, overBudgetPercent * 2);
    }
  }
  
  if (buyer.minSize && property.size) {
    if (property.size < buyer.minSize) {
      const underSizePercent = ((buyer.minSize - property.size) / buyer.minSize) * 100;
      if (underSizePercent > 30) return 0;
      score -= Math.min(30, underSizePercent);
    }
  }
  
  if (buyer.rooms && property.bedrooms) {
    const roomDiff = Math.abs(buyer.rooms - property.bedrooms);
    score -= roomDiff * 5;
  }
  
  return Math.max(0, Math.round(score));
}
