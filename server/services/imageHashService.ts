/**
 * Image Hash Service
 * 
 * Gestisce il calcolo di perceptual hash (pHash) per le immagini
 * e il confronto per trovare immagini duplicate o molto simili
 */

import sharp from 'sharp';
import sharpPhash from 'sharp-phash';
import axios from 'axios';

export interface ImageHash {
  url: string;
  hash: string;
  error?: string;
}

export interface ImageSimilarity {
  url1: string;
  url2: string;
  distance: number;
  isSimilar: boolean;
}

const SIMILARITY_THRESHOLD = 5;

/**
 * Calcola il pHash di un'immagine da URL
 */
export async function calculateImageHash(imageUrl: string): Promise<string> {
  try {
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const buffer = Buffer.from(response.data);
    const hashValue = await sharpPhash(buffer);
    
    return hashValue;
  } catch (error) {
    console.error(`[ImageHash] Errore calcolo hash per ${imageUrl}:`, error instanceof Error ? error.message : error);
    throw new Error(`Failed to calculate hash for ${imageUrl}`);
  }
}

/**
 * Calcola gli hash per un array di URL immagini
 */
export async function calculateImageHashes(imageUrls: string[]): Promise<ImageHash[]> {
  const results: ImageHash[] = [];
  
  for (const url of imageUrls) {
    try {
      const hashValue = await calculateImageHash(url);
      results.push({ url, hash: hashValue });
    } catch (error) {
      results.push({ 
        url, 
        hash: '', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  return results;
}

/**
 * Confronta due hash di immagini e calcola la distanza di Hamming
 */
export function compareImageHashes(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

/**
 * Determina se due immagini sono simili in base alla soglia
 */
export function areImagesSimilar(hash1: string, hash2: string, threshold: number = SIMILARITY_THRESHOLD): boolean {
  const distance = compareImageHashes(hash1, hash2);
  return distance <= threshold;
}

/**
 * Trova tutte le coppie di immagini simili in un set di hash
 */
export function findSimilarImages(imageHashes: ImageHash[], threshold: number = SIMILARITY_THRESHOLD): ImageSimilarity[] {
  const similarities: ImageSimilarity[] = [];
  
  for (let i = 0; i < imageHashes.length; i++) {
    for (let j = i + 1; j < imageHashes.length; j++) {
      const hash1 = imageHashes[i];
      const hash2 = imageHashes[j];
      
      if (!hash1.hash || !hash2.hash || hash1.error || hash2.error) {
        continue;
      }
      
      const distance = compareImageHashes(hash1.hash, hash2.hash);
      const isSimilar = distance <= threshold;
      
      if (isSimilar) {
        similarities.push({
          url1: hash1.url,
          url2: hash2.url,
          distance,
          isSimilar
        });
      }
    }
  }
  
  return similarities;
}

/**
 * Crea cluster di immagini simili
 * Ritorna un array di cluster, dove ogni cluster è un array di URL di immagini simili
 */
export function clusterSimilarImages(imageHashes: ImageHash[], threshold: number = SIMILARITY_THRESHOLD): string[][] {
  const clusters: Map<number, Set<string>> = new Map();
  let clusterIndex = 0;
  const urlToCluster: Map<string, number> = new Map();
  
  for (let i = 0; i < imageHashes.length; i++) {
    for (let j = i + 1; j < imageHashes.length; j++) {
      const hash1 = imageHashes[i];
      const hash2 = imageHashes[j];
      
      if (!hash1.hash || !hash2.hash || hash1.error || hash2.error) {
        continue;
      }
      
      const distance = compareImageHashes(hash1.hash, hash2.hash);
      
      if (distance <= threshold) {
        const cluster1 = urlToCluster.get(hash1.url);
        const cluster2 = urlToCluster.get(hash2.url);
        
        if (cluster1 !== undefined && cluster2 !== undefined) {
          if (cluster1 !== cluster2) {
            const set2 = clusters.get(cluster2)!;
            const set1 = clusters.get(cluster1)!;
            set2.forEach(url => {
              set1.add(url);
              urlToCluster.set(url, cluster1);
            });
            clusters.delete(cluster2);
          }
        } else if (cluster1 !== undefined) {
          clusters.get(cluster1)!.add(hash2.url);
          urlToCluster.set(hash2.url, cluster1);
        } else if (cluster2 !== undefined) {
          clusters.get(cluster2)!.add(hash1.url);
          urlToCluster.set(hash1.url, cluster2);
        } else {
          const newCluster = new Set<string>([hash1.url, hash2.url]);
          clusters.set(clusterIndex, newCluster);
          urlToCluster.set(hash1.url, clusterIndex);
          urlToCluster.set(hash2.url, clusterIndex);
          clusterIndex++;
        }
      }
    }
  }
  
  return Array.from(clusters.values()).map(set => Array.from(set));
}
