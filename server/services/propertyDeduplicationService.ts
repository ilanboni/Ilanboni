/**
 * Property Deduplication Service
 * 
 * Analizza gli immobili nel database per trovare duplicati
 * utilizzando image hashing e fuzzy matching dei dati
 */

import { Property } from '@shared/schema';
import { calculateImageHashes, clusterSimilarImages, ImageHash } from './imageHashService';
import { geocodingService } from './geocodingService';
// @ts-ignore - deprecated but functional
import stringSimilarity from 'string-similarity';

export interface PropertyCluster {
  properties: Property[];
  clusterSize: number;
  isMultiagency: boolean;
  exclusivityHint: boolean;
  matchScore: number;
  matchReasons: string[];
}

export interface DeduplicationResult {
  totalProperties: number;
  clustersFound: number;
  multiagencyProperties: number;
  exclusiveProperties: number;
  clusters: PropertyCluster[];
}

const FUZZY_MATCH_THRESHOLD = 0.65; // Lowered from 0.75 to catch more similar addresses
const IMAGE_SIMILARITY_THRESHOLD = 5;

/**
 * Verifica se un indirizzo è troppo generico per essere usato nel matching
 */
function isGenericAddress(address: string): boolean {
  if (!address || address.trim().length === 0) return true;
  
  const normalized = address.toLowerCase().trim();
  
  // Blacklist: indirizzi troppo generici
  const genericAddresses = [
    'milano',
    'roma',
    'torino',
    'firenze',
    'bologna',
    'napoli',
    'genova',
    'venezia',
    'italy',
    'italia'
  ];
  
  if (genericAddresses.includes(normalized)) {
    return true;
  }
  
  // Un indirizzo valido deve contenere almeno un numero (civico)
  const hasNumber = /\d/.test(address);
  if (!hasNumber) {
    return true;
  }
  
  // Un indirizzo troppo corto è probabilmente generico
  if (normalized.length < 5) {
    return true;
  }
  
  return false;
}

/**
 * Normalizza un indirizzo per il confronto
 */
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/via\s+/g, 'v. ')
    .replace(/viale\s+/g, 'vle ')
    .replace(/corso\s+/g, 'c.so ')
    .replace(/piazza\s+/g, 'p.za ')
    .replace(/[,\.]/g, '')
    .trim();
}

/**
 * Calcola score di similarità tra due immobili basato su prezzo, mq, piano, indirizzo
 * Con supporto per fuzzy matching geografico (tolleranza 500m)
 */
function calculatePropertySimilarity(prop1: Property, prop2: Property): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let totalScore = 0;
  let maxScore = 0;
  
  const isDebugPair = (prop1.id === 185 && prop2.id === 186) || (prop1.id === 186 && prop2.id === 185);
  if (isDebugPair) {
    console.log(`[DEBUG] Confronto #${prop1.id} vs #${prop2.id}`);
    console.log(`[DEBUG] Address: "${prop1.address}" vs "${prop2.address}"`);
    console.log(`[DEBUG] Price: ${prop1.price} vs ${prop2.price}`);
    console.log(`[DEBUG] Size: ${prop1.size} vs ${prop2.size}`);
    console.log(`[DEBUG] Coordinates: (${prop1.latitude},${prop1.longitude}) vs (${prop2.latitude},${prop2.longitude})`);
  }
  
  // CRITICAL VALIDATION: Properties MUST have BOTH valid addresses
  // Even if coordinates exist, we don't trust them without a specific address
  // This prevents false positives from matching properties with generic addresses
  const hasValidAddress1 = prop1.address && !isGenericAddress(prop1.address);
  const hasValidAddress2 = prop2.address && !isGenericAddress(prop2.address);
  
  if (!hasValidAddress1 || !hasValidAddress2) {
    // Cannot reliably match without specific addresses - return 0 score
    if (isDebugPair) {
      console.log(`[DEBUG] BLOCKED: Generic or missing address`);
      console.log(`[DEBUG] Address 1: "${prop1.address}" - valid: ${hasValidAddress1}`);
      console.log(`[DEBUG] Address 2: "${prop2.address}" - valid: ${hasValidAddress2}`);
    }
    return { score: 0, reasons: ['Match impossibile: indirizzo generico o assente'] };
  }
  
  // Now check if we have coordinates for geographic matching
  const hasValidCoordinates = prop1.latitude && prop1.longitude && prop2.latitude && prop2.longitude;
  
  // Geographic fuzzy matching (500m tolerance) - PREFERRED method
  if (hasValidCoordinates) {
    maxScore += 40;
    const distance = geocodingService.calculateDistance(
      prop1.latitude!, 
      prop1.longitude!, 
      prop2.latitude!, 
      prop2.longitude!
    );
    
    // 500m tolerance for same property
    if (distance <= 500) {
      const points = Math.max(0, 40 * (1 - distance / 500)); // Full points at 0m, 0 points at 500m
      totalScore += points;
      reasons.push(`Distanza geografica: ${Math.round(distance)}m`);
    }
  } 
  // Fallback to string-based address matching if no coordinates
  else if (prop1.address && prop2.address) {
    // CRITICAL FIX: Skip matching on generic/invalid addresses
    const isGeneric1 = isGenericAddress(prop1.address);
    const isGeneric2 = isGenericAddress(prop2.address);
    
    if (isGeneric1 || isGeneric2) {
      // Don't award points for generic addresses - they're not reliable for matching
      if (isDebugPair) {
        console.log(`[DEBUG] SKIPPED: Generic address detected`);
        console.log(`[DEBUG] Address 1 generic: ${isGeneric1}, Address 2 generic: ${isGeneric2}`);
      }
      // Don't add to maxScore either - we can't use this for matching
    } else {
      maxScore += 40;
      const addr1 = normalizeAddress(prop1.address);
      const addr2 = normalizeAddress(prop2.address);
      const addressScore = stringSimilarity.compareTwoStrings(addr1, addr2);
      
      if (isDebugPair) {
        console.log(`[DEBUG] Normalized: "${addr1}" vs "${addr2}"`);
        console.log(`[DEBUG] Address similarity: ${(addressScore * 100).toFixed(1)}%`);
        console.log(`[DEBUG] Threshold: ${(FUZZY_MATCH_THRESHOLD * 100).toFixed(0)}%`);
      }
      
      if (addressScore > FUZZY_MATCH_THRESHOLD) {
        const points = addressScore * 40;
        totalScore += points;
        reasons.push(`Indirizzo simile (${(addressScore * 100).toFixed(0)}%)`);
        if (isDebugPair) console.log(`[DEBUG] Address points added: ${points}`);
      }
    }
  }
  
  if (prop1.price && prop2.price) {
    maxScore += 20;
    const priceDiff = Math.abs(prop1.price - prop2.price);
    const avgPrice = (prop1.price + prop2.price) / 2;
    const priceDiffPercent = priceDiff / avgPrice;
    
    if (priceDiffPercent < 0.05) {
      totalScore += 20;
      reasons.push(`Prezzo molto simile (diff ${(priceDiffPercent * 100).toFixed(1)}%)`);
    } else if (priceDiffPercent < 0.10) {
      totalScore += 15;
      reasons.push(`Prezzo simile (diff ${(priceDiffPercent * 100).toFixed(1)}%)`);
    }
  }
  
  if (prop1.size && prop2.size) {
    maxScore += 20;
    const sizeDiff = Math.abs(prop1.size - prop2.size);
    
    if (sizeDiff <= 5) {
      totalScore += 20;
      reasons.push(`Metratura identica (${prop1.size} vs ${prop2.size} mq)`);
    } else if (sizeDiff <= 10) {
      totalScore += 15;
      reasons.push(`Metratura simile (${prop1.size} vs ${prop2.size} mq)`);
    }
  }
  
  if (prop1.floor !== null && prop2.floor !== null && prop1.floor !== undefined && prop2.floor !== undefined) {
    maxScore += 10;
    if (prop1.floor === prop2.floor) {
      totalScore += 10;
      reasons.push(`Piano identico (${prop1.floor})`);
    }
  }
  
  if (prop1.bedrooms && prop2.bedrooms) {
    maxScore += 10;
    if (prop1.bedrooms === prop2.bedrooms) {
      totalScore += 10;
      reasons.push(`Numero camere identico (${prop1.bedrooms})`);
    }
  }
  
  const finalScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  
  if (isDebugPair) {
    console.log(`[DEBUG] Final: totalScore=${totalScore}, maxScore=${maxScore}, finalScore=${finalScore.toFixed(1)}%`);
    console.log(`[DEBUG] Match threshold: 70%`);
    console.log(`[DEBUG] Is match: ${finalScore >= 70}`);
  }
  
  return { score: finalScore, reasons };
}

/**
 * Analizza le foto di due immobili per trovare similarità
 * NOTA: Per ora disabilitato perché Property non ha campo photos
 * Può essere abilitato quando il campo viene aggiunto allo schema
 */
async function comparePropertyImages(prop1: Property, prop2: Property): Promise<boolean> {
  // TODO: Abilitare quando Property.photos sarà disponibile
  return false;
}

/**
 * Trova i cluster di immobili duplicati
 */
export async function findPropertyClusters(properties: Property[]): Promise<PropertyCluster[]> {
  const clusters: Map<number, Property[]> = new Map();
  const propertyToCluster: Map<number, number> = new Map();
  let clusterIndex = 0;
  
  console.log(`[PropertyDedup] Analisi ${properties.length} immobili...`);
  
  for (let i = 0; i < properties.length; i++) {
    for (let j = i + 1; j < properties.length; j++) {
      const prop1 = properties[i];
      const prop2 = properties[j];
      
      const { score, reasons } = calculatePropertySimilarity(prop1, prop2);
      
      const hasSimilarImages = await comparePropertyImages(prop1, prop2);
      
      const isMatch = score >= 70 || hasSimilarImages;
      
      if (isMatch) {
        console.log(`[PropertyDedup] Match trovato: #${prop1.id} <-> #${prop2.id} (score: ${score.toFixed(0)}%, foto: ${hasSimilarImages})`);
        
        const cluster1 = propertyToCluster.get(prop1.id);
        const cluster2 = propertyToCluster.get(prop2.id);
        
        if (cluster1 !== undefined && cluster2 !== undefined) {
          if (cluster1 !== cluster2) {
            const arr2 = clusters.get(cluster2)!;
            const arr1 = clusters.get(cluster1)!;
            arr2.forEach(p => {
              arr1.push(p);
              propertyToCluster.set(p.id, cluster1);
            });
            clusters.delete(cluster2);
          }
        } else if (cluster1 !== undefined) {
          clusters.get(cluster1)!.push(prop2);
          propertyToCluster.set(prop2.id, cluster1);
        } else if (cluster2 !== undefined) {
          clusters.get(cluster2)!.push(prop1);
          propertyToCluster.set(prop1.id, cluster2);
        } else {
          clusters.set(clusterIndex, [prop1, prop2]);
          propertyToCluster.set(prop1.id, clusterIndex);
          propertyToCluster.set(prop2.id, clusterIndex);
          clusterIndex++;
        }
      }
    }
  }
  
  const result: PropertyCluster[] = [];
  
  // Aggiungi cluster per proprietà duplicate (2+ immobili)
  for (const [_, props] of Array.from(clusters.entries())) {
    const clusterSize = props.length;
    const isMultiagency = clusterSize > 1;
    
    let totalScore = 0;
    const allReasons: string[] = [];
    
    for (let i = 0; i < props.length; i++) {
      for (let j = i + 1; j < props.length; j++) {
        const { score, reasons } = calculatePropertySimilarity(props[i], props[j]);
        totalScore += score;
        allReasons.push(...reasons);
      }
    }
    
    const avgScore = props.length > 1 ? totalScore / ((props.length * (props.length - 1)) / 2) : 0;
    
    result.push({
      properties: props,
      clusterSize,
      isMultiagency,
      exclusivityHint: false, // I duplicati non sono mai esclusivi
      matchScore: avgScore,
      matchReasons: Array.from(new Set(allReasons))
    });
  }
  
  // Controlla immobili singoli per exclusivityHint
  const clusterPropertyIds = new Set(Array.from(clusters.values()).flat().map(p => p.id));
  const singleProperties = properties.filter(p => !clusterPropertyIds.has(p.id));
  
  for (const prop of singleProperties) {
    const hasExclusivityKeyword = 
      (prop.description?.toLowerCase().includes('esclusiva') || false) ||
      (prop.description?.toLowerCase().includes('esclusività') || false);
    
    if (hasExclusivityKeyword) {
      console.log(`[PropertyDedup] Immobile #${prop.id} ha keyword esclusività`);
      result.push({
        properties: [prop],
        clusterSize: 1,
        isMultiagency: false,
        exclusivityHint: true,
        matchScore: 0,
        matchReasons: ['Parola chiave "esclusiva" trovata nella descrizione']
      });
    }
  }
  
  return result;
}

/**
 * Esegue la deduplicazione completa
 */
export async function deduplicateProperties(properties: Property[]): Promise<DeduplicationResult> {
  console.log(`[PropertyDedup] Inizio deduplicazione di ${properties.length} immobili`);
  
  const clusters = await findPropertyClusters(properties);
  
  const multiagencyProperties = clusters.filter(c => c.isMultiagency).reduce((sum, c) => sum + c.properties.length, 0);
  const exclusiveProperties = clusters.filter(c => c.exclusivityHint).reduce((sum, c) => sum + c.properties.length, 0);
  
  console.log(`[PropertyDedup] Trovati ${clusters.length} cluster, ${multiagencyProperties} immobili pluricondivisi, ${exclusiveProperties} potenzialmente esclusivi`);
  
  return {
    totalProperties: properties.length,
    clustersFound: clusters.length,
    multiagencyProperties,
    exclusiveProperties,
    clusters
  };
}
