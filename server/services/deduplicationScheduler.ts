import { deduplicateProperties } from './propertyDeduplicationService';
import { db } from '../db';
import { properties, sharedProperties } from '../../shared/schema';
import { and, eq, sql } from 'drizzle-orm';

// Flag globale per prevenire esecuzioni concorrenti
let isScanRunning = false;

/**
 * Esegue la scansione e deduplicazione di tutte le proprietà
 * @returns Risultato della scansione
 */
export async function runDeduplicationScan() {
  // Previeni esecuzioni concorrenti
  if (isScanRunning) {
    console.log('[DEDUP-SCHEDULER] ⏭️ Scansione già in corso, skip');
    throw new Error('Scansione già in corso');
  }
  
  isScanRunning = true;
  
  try {
    console.log('[DEDUP-SCHEDULER] 🔍 Avvio scansione deduplicazione automatica...');
    
    const startTime = Date.now();
    
    // Recupera tutte le proprietà disponibili
    const allProperties = await db
      .select()
      .from(properties)
      .where(eq(properties.status, 'available'));
    
    console.log(`[DEDUP-SCHEDULER] ${allProperties.length} proprietà totali nel database`);
    
    // CRITICAL DIAGNOSTIC: Warn if no properties found (likely status field not set during import)
    if (allProperties.length === 0) {
      console.warn(`[DEDUP-SCHEDULER] ⚠️ NESSUNA proprietà trovata con status='available'!`);
      console.warn(`[DEDUP-SCHEDULER] ⚠️ Verifica che PortalIngestionService e /api/import-casafari impostino status='available' durante l'import`);
      console.warn(`[DEDUP-SCHEDULER] ⚠️ Esegui: UPDATE properties SET status='available' WHERE status IS NULL;`);
    }
    
    // Esegue la deduplicazione
    const result = await deduplicateProperties(allProperties);
    
    console.log(`[DEDUP-SCHEDULER] Deduplicazione completata: ${result.clustersFound} cluster trovati`);
    
    // Contatori
    let propertiesUpdated = 0;
    let sharedPropertiesCreated = 0;
    
    // Aggiorna isShared e crea schede proprietà condivise
    for (const cluster of result.clusters) {
      if (cluster.isMultiagency && cluster.properties.length >= 2) {
        const firstProperty = cluster.properties[0];
        
        // Raccogli portali/agenzie con i link alle proprietà originali
        const agencies = cluster.properties.map(p => ({
          name: p.portal || 'Agenzia Sconosciuta',
          link: p.externalLink || '',
          sourcePropertyId: p.id
        }));
        
        // Normalizza l'indirizzo per il confronto (rimuove virgole, punti, spazi multipli)
        const normalizedAddress = firstProperty.address
          .toLowerCase()
          .replace(/[,.]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Verifica se esiste già una scheda per questo indirizzo (usando normalizzazione fuzzy)
        const allSharedProps = await db
          .select()
          .from(sharedProperties)
          .where(eq(sharedProperties.isAcquired, false));
        
        const existing = allSharedProps.find(sp => {
          const spNormalized = sp.address
            .toLowerCase()
            .replace(/[,.]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          return spNormalized === normalizedAddress;
        });
        
        if (!existing) {
          // Crea nuova scheda proprietà condivisa
          await db.insert(sharedProperties).values({
            address: firstProperty.address,
            city: firstProperty.city,
            size: firstProperty.size,
            type: firstProperty.type,
            price: firstProperty.price,
            floor: firstProperty.floor || null,
            agencies: agencies, // JSONB array con agenzie complete (name, link, sourcePropertyId)
            rating: 4,
            stage: 'result',
            stageResult: 'multiagency',
            isAcquired: false,
            matchBuyers: true,
            ownerName: firstProperty.ownerName || null,
            ownerPhone: firstProperty.ownerPhone || null
          });
          
          sharedPropertiesCreated++;
          console.log(`[DEDUP-SCHEDULER] ✅ Creata scheda proprietà condivisa per: ${firstProperty.address}`);
        } else {
          // Aggiorna scheda esistente con nuove agenzie (se ce ne sono)
          const existingAgencies = Array.isArray(existing.agencies) ? existing.agencies : [];
          
          // Converti esistenti a oggetti se sono stringhe (legacy data)
          const existingAgencyObjects = existingAgencies.map(a => 
            typeof a === 'string' ? { name: a, link: '', sourcePropertyId: null } : a
          );
          
          // Trova nuove agenzie non già presenti (confronta per sourcePropertyId)
          const existingPropertyIds = new Set(
            existingAgencyObjects
              .map(a => a.sourcePropertyId)
              .filter(id => id !== null)
          );
          
          const newAgencies = agencies.filter(a => !existingPropertyIds.has(a.sourcePropertyId));
          
          if (newAgencies.length > 0) {
            const updatedAgencies = [...existingAgencyObjects, ...newAgencies];
            await db
              .update(sharedProperties)
              .set({ agencies: updatedAgencies })
              .where(eq(sharedProperties.id, existing.id));
            
            console.log(`[DEDUP-SCHEDULER] 🔄 Aggiornate agenzie per: ${existing.address} (+${newAgencies.length})`);
          }
        }
        
        // Aggiorna isShared per ogni proprietà nel cluster
        for (const prop of cluster.properties) {
          await db
            .update(properties)
            .set({ isShared: true, isMultiagency: true })
            .where(eq(properties.id, prop.id));
          
          propertiesUpdated++;
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    const scanResult = {
      ok: true,
      totalProperties: result.totalProperties,
      clustersFound: result.clustersFound,
      multiagencyProperties: result.multiagencyProperties,
      exclusiveProperties: result.exclusiveProperties,
      propertiesUpdated,
      sharedPropertiesCreated,
      duration,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[DEDUP-SCHEDULER] ✅ Scansione completata in ${duration}ms`);
    console.log(`[DEDUP-SCHEDULER] 📊 Risultati: ${scanResult.multiagencyProperties} multi-agency, ${scanResult.exclusiveProperties} esclusive, ${sharedPropertiesCreated} schede create`);
    
    return scanResult;
    
  } catch (error) {
    console.error('[DEDUP-SCHEDULER] ❌ Errore durante la scansione:', error);
    throw error;
  } finally {
    isScanRunning = false;
  }
}

/**
 * Classe per gestire lo scheduler di deduplicazione automatica
 */
class DeduplicationScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalDays: number;
  private enabled: boolean;
  
  constructor(options: { intervalDays?: number; enabled?: boolean } = {}) {
    this.intervalDays = options.intervalDays || 7; // Default: 7 giorni
    this.enabled = options.enabled !== false; // Default: abilitato
  }
  
  /**
   * Avvia lo scheduler per scansioni periodiche
   */
  start(): void {
    if (!this.enabled) {
      console.log('[DEDUP-SCHEDULER] ⏸️ Scheduler disabilitato');
      return;
    }
    
    if (this.intervalId) {
      console.log('[DEDUP-SCHEDULER] ⚠️ Scheduler già avviato');
      return;
    }
    
    const intervalMs = this.intervalDays * 24 * 60 * 60 * 1000;
    console.log(`[DEDUP-SCHEDULER] 🚀 Avvio scheduler: scansione ogni ${this.intervalDays} giorni`);
    
    // Esegui la prima scansione dopo 1 minuto (per non sovraccaricare all'avvio)
    setTimeout(() => {
      this.runScan();
    }, 60 * 1000);
    
    // Imposta il timer per le scansioni periodiche
    this.intervalId = setInterval(() => {
      this.runScan();
    }, intervalMs);
    
    console.log('[DEDUP-SCHEDULER] ✅ Scheduler avviato con successo');
  }
  
  /**
   * Ferma lo scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[DEDUP-SCHEDULER] ⏹️ Scheduler fermato');
    }
  }
  
  /**
   * Esegue una scansione manuale
   */
  async runScan() {
    try {
      await runDeduplicationScan();
    } catch (error) {
      console.error('[DEDUP-SCHEDULER] Errore durante scansione programmata:', error);
    }
  }
  
  /**
   * Restituisce lo stato corrente dello scheduler
   */
  getStatus(): { running: boolean; intervalDays: number; enabled: boolean } {
    return {
      running: this.intervalId !== null,
      intervalDays: this.intervalDays,
      enabled: this.enabled
    };
  }
}

// Esporta un'istanza singleton dello scheduler
export const deduplicationScheduler = new DeduplicationScheduler({
  intervalDays: parseInt(process.env.DEDUP_SCAN_INTERVAL_DAYS || '7'),
  enabled: process.env.DEDUP_SCHEDULER_ENABLED !== 'false'
});
