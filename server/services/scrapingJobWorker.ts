/**
 * Worker persistente per l'esecuzione dei job di scraping
 * 
 * Risolve il problema dei setImmediate che si perdono ai restart:
 * - Controlla periodicamente i job "queued"
 * - Esegue i job in background
 * - All'avvio, marca come "failed" i job "running" vecchi >5 minuti
 */

import type { IStorage } from '../storage';
import type { ScrapingJob } from '@shared/schema';

export class ScrapingJobWorker {
  private storage: IStorage;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30000; // 30 secondi
  private readonly STALE_JOB_MINUTES = 5; // Job "running" più vecchi di 5 minuti sono considerati stale

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async start() {
    console.log('[SCRAPING-WORKER] 🚀 Avvio worker per job di scraping...');
    
    // All'avvio, marca come failed i job "running" troppo vecchi (persi durante restart)
    await this.cleanupStaleJobs();
    
    // Avvia il polling periodico
    this.pollInterval = setInterval(() => {
      this.processQueuedJobs();
    }, this.POLL_INTERVAL_MS);
    
    // Esegui immediatamente il primo check
    this.processQueuedJobs();
    
    console.log(`[SCRAPING-WORKER] ✅ Worker avviato (polling ogni ${this.POLL_INTERVAL_MS / 1000}s)`);
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[SCRAPING-WORKER] ⏸️ Worker fermato');
    }
  }

  /**
   * All'avvio, trova i job "running" vecchi e marcali come failed
   * (probabilmente persi durante un restart del server)
   */
  private async cleanupStaleJobs() {
    try {
      const allJobs = await this.storage.getAllScrapingJobs();
      const staleJobs = allJobs.filter((job: ScrapingJob) => {
        if (job.status !== 'running') return false;
        
        const ageMinutes = (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60);
        return ageMinutes > this.STALE_JOB_MINUTES;
      });

      if (staleJobs.length > 0) {
        console.log(`[SCRAPING-WORKER] 🧹 Trovati ${staleJobs.length} job stale da pulire`);
        
        for (const job of staleJobs) {
          await this.storage.updateScrapingJob(job.id, {
            status: 'failed',
            completedAt: new Date(),
            results: {
              error: 'Job perso durante restart del server (timeout dopo 5 minuti)'
            }
          });
          console.log(`[SCRAPING-WORKER] ❌ Job #${job.id} marcato come failed (stale)`);
        }
      }
    } catch (error) {
      console.error('[SCRAPING-WORKER] Errore durante cleanup job stale:', error);
    }
  }

  /**
   * Controlla i job in coda e li esegue
   */
  private async processQueuedJobs() {
    if (this.isRunning) {
      console.log('[SCRAPING-WORKER] ⚠️ Processing già in corso, skip');
      return;
    }

    this.isRunning = true;

    try {
      const allJobs = await this.storage.getAllScrapingJobs();
      const queuedJobs = allJobs.filter((job: ScrapingJob) => job.status === 'queued');

      if (queuedJobs.length === 0) {
        return; // Nessun job in coda
      }

      console.log(`[SCRAPING-WORKER] 📋 Trovati ${queuedJobs.length} job in coda`);

      // Esegui il primo job in coda
      const job = queuedJobs[0];
      await this.executeJob(job);

    } catch (error) {
      console.error('[SCRAPING-WORKER] Errore durante processing job:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Esegue un singolo job di scraping
   */
  private async executeJob(job: ScrapingJob) {
    console.log(`[SCRAPING-WORKER] 🔧 Esecuzione job #${job.id} per client ${job.clientId}...`);

    try {
      // Marca job come "running"
      await this.storage.updateScrapingJob(job.id, { status: 'running' });

      // Import dinamico per evitare dipendenze circolari
      const { getApifyService } = await import('./apifyService');
      const { ingestionService } = await import('./portalIngestionService');
      const apifyService = getApifyService();

      // Get buyer criteria
      const buyer = await this.storage.getBuyerByClientId(job.clientId);
      if (!buyer) {
        throw new Error('Buyer criteria non trovati');
      }

      // Scrape con criteri del buyer
      const listings = await apifyService.scrapeForBuyer({
        propertyType: buyer.propertyType || undefined,
        minSize: buyer.minSize || undefined,
        maxPrice: buyer.maxPrice || undefined,
        rooms: buyer.rooms || undefined,
        bathrooms: buyer.bathrooms || undefined
      });

      console.log(`[SCRAPING-WORKER] 📥 Trovati ${listings.length} annunci per job #${job.id}`);

      // Import listings nel database
      let imported = 0;
      let updated = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const listing of listings) {
        try {
          const result = await ingestionService.importProperty(listing, job.clientId);
          if (result.updated) updated++;
          else imported++;
        } catch (error) {
          failed++;
          errors.push({
            url: listing.url,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`[SCRAPING-WORKER] ✅ Job #${job.id} completato: ${imported} nuovi, ${updated} aggiornati, ${failed} errori`);

      // Trigger deduplication scan se necessario
      if (imported > 0 || updated > 0) {
        try {
          console.log(`[SCRAPING-WORKER] 🔄 Avvio deduplicazione per job #${job.id}...`);
          const { runDeduplicationScan } = await import('./deduplicationScheduler');
          await runDeduplicationScan();
          console.log(`[SCRAPING-WORKER] ✅ Deduplicazione completata per job #${job.id}`);
        } catch (dedupError) {
          console.error(`[SCRAPING-WORKER] ⚠️ Deduplicazione fallita per job #${job.id}:`, dedupError);
        }
      }

      // Aggiorna job con risultati
      await this.storage.updateScrapingJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        results: {
          totalFetched: listings.length,
          imported,
          updated,
          failed,
          errors: errors.length > 0 ? errors : undefined
        }
      });

    } catch (error) {
      console.error(`[SCRAPING-WORKER] ❌ Job #${job.id} fallito:`, error);
      
      // Marca job come fallito
      await this.storage.updateScrapingJob(job.id, {
        status: 'failed',
        completedAt: new Date(),
        results: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
}

// Singleton instance
let workerInstance: ScrapingJobWorker | null = null;

export function getScrapingJobWorker(storage: IStorage): ScrapingJobWorker {
  if (!workerInstance) {
    workerInstance = new ScrapingJobWorker(storage);
  }
  return workerInstance;
}
