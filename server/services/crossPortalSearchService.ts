import { db } from '../db';
import { properties, sharedProperties } from '@shared/schema';
import { sql, or, and, gte, lte } from 'drizzle-orm';

export interface CrossPortalMatch {
  id: number;
  address: string;
  price: number | null;
  size: number | null;
  portalSource: string;
  externalLink: string | null;
  agencyName?: string | null;
  ownerPhone?: string | null;
  matchScore: number;
  matchReason: string;
}

export interface CrossPortalSearchResult {
  sourceProperty: {
    address: string;
    price: number | null;
    size: number | null;
    portalSource: string;
  };
  matchingListings: CrossPortalMatch[];
  totalAgencies: number;
  uniqueAgencies: string[];
  classification: 'privato' | 'monocondiviso' | 'pluricondiviso' | 'privato+agenzia';
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStreetAndNumber(address: string): { street: string; number: string | null } {
  const normalized = normalizeAddress(address);
  const numberMatch = normalized.match(/(\d+)/);
  const number = numberMatch ? numberMatch[1] : null;
  const street = normalized.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  return { street, number };
}

function calculateMatchScore(
  source: { address: string; price: number | null; size: number | null },
  candidate: { address: string; price: number | null; size: number | null }
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  
  const sourceAddr = extractStreetAndNumber(source.address);
  const candidateAddr = extractStreetAndNumber(candidate.address);
  
  // Street name matching - filter out generic words like "viale", "via", "piazza"
  const genericWords = ['viale', 'via', 'piazza', 'corso', 'largo', 'piazzale', 'vicolo'];
  const streetWords = sourceAddr.street.split(' ').filter(w => w.length > 2 && !genericWords.includes(w));
  const candidateWords = candidateAddr.street.split(' ').filter(w => !genericWords.includes(w));
  const matchingWords = streetWords.filter(w => candidateWords.includes(w));
  
  // Only count as street match if we have meaningful word matches (not just generic prefixes)
  if (matchingWords.length > 0 && streetWords.length > 0) {
    const streetScore = Math.min(40, (matchingWords.length / streetWords.length) * 40);
    score += streetScore;
    reasons.push(`Via: ${matchingWords.join(', ')}`);
    
    // Bonus for same civic number when street matches
    if (sourceAddr.number && candidateAddr.number && sourceAddr.number === candidateAddr.number) {
      score += 30;
      reasons.push(`Civico ${sourceAddr.number}`);
    }
  }
  
  if (source.price && candidate.price) {
    const priceDiff = Math.abs(source.price - candidate.price) / source.price;
    if (priceDiff < 0.03) {
      score += 20;
      reasons.push('Stesso prezzo');
    } else if (priceDiff < 0.10) {
      score += 10;
      reasons.push('Prezzo simile');
    }
  }
  
  if (source.size && candidate.size) {
    const sizeDiff = Math.abs(source.size - candidate.size);
    if (sizeDiff === 0) {
      score += 10;
      reasons.push('Stessa metratura');
    } else if (sizeDiff <= 3) {
      score += 5;
      reasons.push('Metratura simile');
    }
  }
  
  return { score, reason: reasons.join(', ') || 'Corrispondenza parziale' };
}

export async function searchCrossPortalListings(
  sourceData: {
    address: string;
    price: number | null;
    size: number | null;
    portalSource: string;
    url: string;
  }
): Promise<CrossPortalSearchResult> {
  console.log(`[CROSS-PORTAL] Searching for: ${sourceData.address}, price: ${sourceData.price}, size: ${sourceData.size}`);
  
  const { street, number } = extractStreetAndNumber(sourceData.address);
  const genericWords = ['viale', 'via', 'piazza', 'corso', 'largo', 'piazzale', 'vicolo'];
  const streetWords = street.split(' ').filter(w => w.length > 3 && !genericWords.includes(w));
  
  const matchingListings: CrossPortalMatch[] = [];
  const seenIds = new Set<string>();
  
  const priceMin = sourceData.price ? Math.floor(sourceData.price * 0.95) : 0;
  const priceMax = sourceData.price ? Math.ceil(sourceData.price * 1.05) : 999999999;
  const sizeMin = sourceData.size ? sourceData.size - 5 : 0;
  const sizeMax = sourceData.size ? sourceData.size + 5 : 999999;
  
  // STRATEGY 1: Search by PRICE + SIZE (primary criteria for cross-portal matching)
  // This catches same property even when addresses differ across portals
  if (sourceData.price && sourceData.size) {
    console.log(`[CROSS-PORTAL] Strategy 1: Searching by price (${priceMin}-${priceMax}) + size (${sizeMin}-${sizeMax})`);
    
    const [propsResultsByPriceSize, sharedResultsByPriceSize] = await Promise.all([
      db.select({
        id: properties.id,
        address: properties.address,
        price: properties.price,
        size: properties.size,
        externalLink: properties.externalLink,
        agencyName: properties.agencyName,
        ownerPhone: properties.ownerPhone
      })
      .from(properties)
      .where(
        and(
          gte(properties.price, priceMin),
          lte(properties.price, priceMax),
          gte(properties.size, sizeMin),
          lte(properties.size, sizeMax)
        )
      )
      .limit(100),
      
      db.select({
        id: sharedProperties.id,
        address: sharedProperties.address,
        price: sharedProperties.price,
        size: sharedProperties.size,
        externalLink: sharedProperties.externalLink,
        portalSource: sharedProperties.portalSource,
        ownerPhone: sharedProperties.ownerPhone
      })
      .from(sharedProperties)
      .where(
        and(
          gte(sharedProperties.price, priceMin),
          lte(sharedProperties.price, priceMax),
          gte(sharedProperties.size, sizeMin),
          lte(sharedProperties.size, sizeMax)
        )
      )
      .limit(100)
    ]);
    
    console.log(`[CROSS-PORTAL] Strategy 1 found: ${propsResultsByPriceSize.length} properties, ${sharedResultsByPriceSize.length} shared`);
    
    for (const prop of propsResultsByPriceSize) {
      if (prop.externalLink === sourceData.url) continue;
      const key = `prop-${prop.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      
      const { score, reason } = calculateMatchScore(sourceData, {
        address: prop.address,
        price: prop.price,
        size: prop.size
      });
      
      // Lower threshold for price+size matches (25 instead of 40)
      if (score >= 25) {
        let portalSource = 'Altro';
        if (prop.externalLink?.includes('immobiliare.it')) portalSource = 'Immobiliare.it';
        else if (prop.externalLink?.includes('idealista.it')) portalSource = 'Idealista';
        else if (prop.externalLink?.includes('casa.it')) portalSource = 'Casa.it';
        
        matchingListings.push({
          id: prop.id,
          address: prop.address,
          price: prop.price,
          size: prop.size,
          portalSource,
          externalLink: prop.externalLink,
          agencyName: prop.agencyName,
          ownerPhone: prop.ownerPhone,
          matchScore: score,
          matchReason: reason
        });
      }
    }
    
    for (const prop of sharedResultsByPriceSize) {
      if (prop.externalLink === sourceData.url) continue;
      const key = `shared-${prop.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      
      const { score, reason } = calculateMatchScore(sourceData, {
        address: prop.address,
        price: prop.price,
        size: prop.size
      });
      
      if (score >= 25) {
        matchingListings.push({
          id: prop.id,
          address: prop.address,
          price: prop.price,
          size: prop.size,
          portalSource: prop.portalSource || 'Altro',
          externalLink: prop.externalLink,
          ownerPhone: prop.ownerPhone,
          matchScore: score,
          matchReason: reason
        });
      }
    }
  }
  
  // STRATEGY 2: Search by street name (for additional matches)
  if (streetWords.length > 0) {
    // Use multiple street words for better matching
    const searchPatterns = streetWords.slice(0, 3).map(w => `%${w}%`);
    console.log(`[CROSS-PORTAL] Strategy 2: Searching by street patterns: ${searchPatterns.join(', ')}`);
    
    const streetConditions = searchPatterns.map(pattern => 
      sql`LOWER(${properties.address}) LIKE ${pattern.toLowerCase()}`
    );
    const sharedStreetConditions = searchPatterns.map(pattern => 
      sql`LOWER(${sharedProperties.address}) LIKE ${pattern.toLowerCase()}`
    );
    
    const [propsResults, sharedResults] = await Promise.all([
      db.select({
        id: properties.id,
        address: properties.address,
        price: properties.price,
        size: properties.size,
        externalLink: properties.externalLink,
        agencyName: properties.agencyName,
        ownerPhone: properties.ownerPhone
      })
      .from(properties)
      .where(or(...streetConditions))
      .limit(50),
      
      db.select({
        id: sharedProperties.id,
        address: sharedProperties.address,
        price: sharedProperties.price,
        size: sharedProperties.size,
        externalLink: sharedProperties.externalLink,
        portalSource: sharedProperties.portalSource,
        ownerPhone: sharedProperties.ownerPhone
      })
      .from(sharedProperties)
      .where(or(...sharedStreetConditions))
      .limit(50)
    ]);
    
    console.log(`[CROSS-PORTAL] Strategy 2 found: ${propsResults.length} properties, ${sharedResults.length} shared`);
    
    for (const prop of propsResults) {
      if (prop.externalLink === sourceData.url) continue;
      const key = `prop-${prop.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      
      const { score, reason } = calculateMatchScore(sourceData, {
        address: prop.address,
        price: prop.price,
        size: prop.size
      });
      
      if (score >= 40) {
        let portalSource = 'Altro';
        if (prop.externalLink?.includes('immobiliare.it')) portalSource = 'Immobiliare.it';
        else if (prop.externalLink?.includes('idealista.it')) portalSource = 'Idealista';
        else if (prop.externalLink?.includes('casa.it')) portalSource = 'Casa.it';
        
        matchingListings.push({
          id: prop.id,
          address: prop.address,
          price: prop.price,
          size: prop.size,
          portalSource,
          externalLink: prop.externalLink,
          agencyName: prop.agencyName,
          ownerPhone: prop.ownerPhone,
          matchScore: score,
          matchReason: reason
        });
      }
    }
    
    for (const prop of sharedResults) {
      if (prop.externalLink === sourceData.url) continue;
      const key = `shared-${prop.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      
      const { score, reason } = calculateMatchScore(sourceData, {
        address: prop.address,
        price: prop.price,
        size: prop.size
      });
      
      if (score >= 40) {
        matchingListings.push({
          id: prop.id,
          address: prop.address,
          price: prop.price,
          size: prop.size,
          portalSource: prop.portalSource || 'Altro',
          externalLink: prop.externalLink,
          ownerPhone: prop.ownerPhone,
          matchScore: score,
          matchReason: reason
        });
      }
    }
  }
  
  matchingListings.sort((a, b) => b.matchScore - a.matchScore);
  
  const uniqueAgencies = Array.from(new Set(
    matchingListings
      .map(l => l.agencyName)
      .filter((name): name is string => !!name && name.length > 0)
  ));
  
  const hasPrivatePhone = matchingListings.some(l => 
    l.ownerPhone && l.ownerPhone.startsWith('3') && !l.agencyName
  );
  
  let classification: 'privato' | 'monocondiviso' | 'pluricondiviso' | 'privato+agenzia';
  if (hasPrivatePhone && uniqueAgencies.length > 0) {
    classification = 'privato+agenzia';
  } else if (uniqueAgencies.length === 0) {
    classification = 'privato';
  } else if (uniqueAgencies.length === 1) {
    classification = 'monocondiviso';
  } else {
    classification = 'pluricondiviso';
  }
  
  console.log(`[CROSS-PORTAL] Found ${matchingListings.length} matches, ${uniqueAgencies.length} agencies, classification: ${classification}`);
  
  return {
    sourceProperty: {
      address: sourceData.address,
      price: sourceData.price,
      size: sourceData.size,
      portalSource: sourceData.portalSource
    },
    matchingListings: matchingListings.slice(0, 20),
    totalAgencies: uniqueAgencies.length,
    uniqueAgencies,
    classification
  };
}
