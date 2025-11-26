/**
 * Servizio di geocoding retroattivo per proprietà esistenti senza coordinate GPS
 * Aggiorna in batch tutte le proprietà nel database che hanno location = NULL
 */

import { db } from '../db';
import { sharedProperties } from '@shared/schema';
import { geocodeAddress } from '../lib/geocoding';
import { isNull, sql } from 'drizzle-orm';

/**
 * Delay helper per rispettare rate limits di Nominatim (1 req/sec)
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface RetroGeocodingStats {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: number; address: string; error: string }>;
}

/**
 * Processa un batch di proprietà per geocoding retroattivo
 * @param limit Numero massimo di proprietà da processare (default: tutti)
 * @param onProgress Callback per aggiornamenti di progresso
 */
export async function retroactiveGeocodingBatch(
  limit?: number,
  onProgress?: (stats: RetroGeocodingStats) => void
): Promise<RetroGeocodingStats> {
  
  const stats: RetroGeocodingStats = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  try {
    // 1. Recupera tutte le proprietà senza coordinate
    console.log('[RETRO-GEOCODING] Recupero proprietà senza coordinate...');
    
    let query = db
      .select({
        id: sharedProperties.id,
        address: sharedProperties.address,
        city: sharedProperties.city,
        location: sharedProperties.location
      })
      .from(sharedProperties)
      .where(isNull(sharedProperties.location));

    if (limit) {
      query = query.limit(limit) as any;
    }

    const properties = await query;
    
    stats.total = properties.length;
    console.log(`[RETRO-GEOCODING] Trovate ${stats.total} proprietà senza coordinate`);

    if (stats.total === 0) {
      console.log('[RETRO-GEOCODING] Nessuna proprietà da geocodificare');
      return stats;
    }

    // 2. Processa ogni proprietà con rate limiting
    for (const property of properties) {
      try {
        // Skip se non c'è indirizzo
        if (!property.address) {
          console.log(`[RETRO-GEOCODING] Property ${property.id}: indirizzo mancante - SKIP`);
          stats.skipped++;
          stats.processed++;
          continue;
        }

        // Costruisci query di geocoding completa
        const fullAddress = property.city 
          ? `${property.address}, ${property.city}, Italia`
          : `${property.address}, Milano, Italia`; // Default Milano per indirizzi senza città

        console.log(`[RETRO-GEOCODING] [${stats.processed + 1}/${stats.total}] Geocoding: ${property.address}`);

        // Chiamata API Nominatim
        const results = await geocodeAddress(fullAddress);

        if (results && results.length > 0) {
          const bestResult = results[0]; // Prendi il primo risultato (più rilevante)
          
          // Aggiorna database con le coordinate (oggetto JSON, non stringa!)
          await db
            .update(sharedProperties)
            .set({
              location: {
                lat: bestResult.lat,
                lng: bestResult.lng
              }
            })
            .where(sql`${sharedProperties.id} = ${property.id}`);

          console.log(`[RETRO-GEOCODING] ✅ Property ${property.id}: geocoded to (${bestResult.lat}, ${bestResult.lng})`);
          stats.successful++;
        } else {
          console.log(`[RETRO-GEOCODING] ⚠️ Property ${property.id}: nessun risultato trovato`);
          stats.failed++;
          stats.errors.push({
            id: property.id,
            address: property.address,
            error: 'Nessun risultato da Nominatim'
          });
        }

        stats.processed++;

        // Rate limiting: 1 req/sec per Nominatim
        // Aggiungiamo un piccolo buffer per sicurezza (1100ms)
        await delay(1100);

        // Callback di progresso ogni 10 proprietà
        if (onProgress && stats.processed % 10 === 0) {
          onProgress(stats);
        }

      } catch (error: any) {
        console.error(`[RETRO-GEOCODING] ❌ Property ${property.id}: ${error.message}`);
        stats.failed++;
        stats.processed++;
        stats.errors.push({
          id: property.id,
          address: property.address,
          error: error.message || 'Errore sconosciuto'
        });

        // Continua anche in caso di errore
        await delay(1100);
      }
    }

    // Report finale
    console.log('[RETRO-GEOCODING] ========================================');
    console.log(`[RETRO-GEOCODING] COMPLETATO!`);
    console.log(`[RETRO-GEOCODING] Totale: ${stats.total}`);
    console.log(`[RETRO-GEOCODING] Processate: ${stats.processed}`);
    console.log(`[RETRO-GEOCODING] Successo: ${stats.successful} (${Math.round(stats.successful / stats.total * 100)}%)`);
    console.log(`[RETRO-GEOCODING] Fallite: ${stats.failed}`);
    console.log(`[RETRO-GEOCODING] Saltate: ${stats.skipped}`);
    console.log('[RETRO-GEOCODING] ========================================');

    if (onProgress) {
      onProgress(stats);
    }

    return stats;

  } catch (error: any) {
    console.error('[RETRO-GEOCODING] Errore critico nel batch:', error);
    throw error;
  }
}

/**
 * Verifica quante proprietà necessitano geocoding
 */
export async function getPropertiesNeedingGeocodingCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(sharedProperties)
    .where(isNull(sharedProperties.location));
  
  return Number(result[0]?.count || 0);
}
