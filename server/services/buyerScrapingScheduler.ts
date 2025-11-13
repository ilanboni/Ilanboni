import * as cron from 'node-cron';
import { db } from '../db';
import { buyers, scrapingJobs } from '../../shared/schema';
import { eq, isNotNull } from 'drizzle-orm';

export class BuyerScrapingScheduler {
  private scheduledTask: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;
  private cronExpression: string;

  /**
   * @param cronExpression Cron expression (default: "0 2 * * 2,5" = Martedì e Venerdì alle 2:00 AM)
   */
  constructor(cronExpression: string = '0 2 * * 2,5') {
    this.cronExpression = cronExpression;
  }

  start() {
    if (this.scheduledTask) {
      console.log('[BUYER-SCRAPING-SCHEDULER] Already running, skipping start');
      return;
    }

    this.scheduledTask = cron.schedule(this.cronExpression, async () => {
      await this.runScheduledScraping();
    });

    console.log(`[BUYER-SCRAPING-SCHEDULER] ⏰ Avviato con cron "${this.cronExpression}" (Martedì e Venerdì alle 2:00 AM)`);
  }

  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask.destroy();
      this.scheduledTask = null;
      console.log('[BUYER-SCRAPING-SCHEDULER] ⏸️ Scheduler fermato');
    }
  }

  async runScheduledScraping(): Promise<void> {
    if (this.isRunning) {
      console.log('[BUYER-SCRAPING-SCHEDULER] ⚠️ Scraping già in corso, skip');
      return;
    }

    this.isRunning = true;
    console.log('[BUYER-SCRAPING-SCHEDULER] 🚀 Avvio scraping automatico per tutti i buyer...');

    try {
      // Recupera tutti i buyer attivi con almeno un criterio definito
      const activeBuyers = await db
        .select()
        .from(buyers)
        .where(isNotNull(buyers.propertyType));

      console.log(`[BUYER-SCRAPING-SCHEDULER] 📋 Trovati ${activeBuyers.length} buyer attivi`);

      if (activeBuyers.length === 0) {
        console.log('[BUYER-SCRAPING-SCHEDULER] ℹ️ Nessun buyer attivo da processare');
        this.isRunning = false;
        return;
      }

      // Crea un job per ogni buyer
      const jobs = [];
      for (const buyer of activeBuyers) {
        try {
          // Verifica se c'è già un job completato con successo nelle ultime 24 ore
          const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentSuccessfulJobs = await db
            .select()
            .from(scrapingJobs)
            .where(
              eq(scrapingJobs.clientId, buyer.clientId)
            )
            .orderBy(scrapingJobs.createdAt)
            .limit(5);

          const hasRecentSuccess = recentSuccessfulJobs.some(
            job => job.status === 'completed' && new Date(job.createdAt) > last24h
          );

          if (hasRecentSuccess) {
            console.log(`[BUYER-SCRAPING-SCHEDULER] ⏭️ Skip buyer ${buyer.clientId}: job completato nelle ultime 24h`);
            continue;
          }

          // Crea il job
          const buyerCriteria = {
            propertyType: buyer.propertyType || undefined,
            rooms: buyer.rooms || undefined,
            bathrooms: buyer.bathrooms || undefined,
            zones: buyer.zones || undefined,
            minSize: buyer.minSize || undefined,
            maxPrice: buyer.maxPrice || undefined,
            balconyOrTerrace: buyer.balconyOrTerrace || undefined,
            elevator: buyer.elevator || undefined,
            parking: buyer.parking || undefined,
            garden: buyer.garden || undefined,
          };

          const [job] = await db
            .insert(scrapingJobs)
            .values({
              clientId: buyer.clientId,
              status: 'queued',
              buyerCriteria,
              createdAt: new Date(),
            })
            .returning();

          jobs.push(job);
          console.log(`[BUYER-SCRAPING-SCHEDULER] ✅ Job creato per buyer ${buyer.clientId}: job ${job.id}`);

          // Avvia il processo in background
          this.processJobInBackground(job.id, buyer.clientId, buyerCriteria);

        } catch (error) {
          console.error(`[BUYER-SCRAPING-SCHEDULER] ❌ Errore creazione job per buyer ${buyer.clientId}:`, error);
        }

        // Pausa tra un buyer e l'altro per non sovraccaricare Apify
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      console.log(`[BUYER-SCRAPING-SCHEDULER] ✅ Completato: ${jobs.length} job creati`);

    } catch (error) {
      console.error('[BUYER-SCRAPING-SCHEDULER] ❌ Errore durante scraping automatico:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async processJobInBackground(jobId: number, clientId: number, buyerCriteria: any) {
    setImmediate(async () => {
      try {
        // Import dinamico per evitare dipendenze circolari
        const { storage } = await import('../storage');
        const { getApifyService } = await import('./apifyService');
        const { ingestionService } = await import('./portalIngestionService');

        // Update job status to running
        await storage.updateScrapingJob(jobId, { status: 'running' });

        const apifyService = getApifyService();

        // Scrape with buyer's specific criteria
        // Note: zones filtering is not supported by Apify API - filtering happens after ingestion
        const listings = await apifyService.scrapeForBuyer({
          propertyType: buyerCriteria.propertyType,
          rooms: buyerCriteria.rooms,
          bathrooms: buyerCriteria.bathrooms,
          minSize: buyerCriteria.minSize,
          maxPrice: buyerCriteria.maxPrice,
        });

        console.log(`[BUYER-SCRAPING-SCHEDULER] Found ${listings.length} listings for buyer ${clientId}`);

        // Ingest all listings
        let imported = 0;
        let updated = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const listing of listings) {
          try {
            const result = await ingestionService.importProperty(listing, clientId);
            if (result.updated) {
              updated++;
            } else {
              imported++;
            }
          } catch (error) {
            failed++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(errorMsg);
            console.error('[BUYER-SCRAPING-SCHEDULER] Error ingesting property:', error);
          }
        }

        // Update job status to completed
        await storage.updateScrapingJob(jobId, {
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

        console.log(`[BUYER-SCRAPING-SCHEDULER] ✅ Job ${jobId} completato: ${imported} imported, ${updated} updated, ${failed} failed`);

      } catch (bgError) {
        console.error(`[BUYER-SCRAPING-SCHEDULER] Background task failed for job ${jobId}:`, bgError);
        const { storage } = await import('../storage');
        
        // Update job status to failed
        await storage.updateScrapingJob(jobId, {
          status: 'failed',
          completedAt: new Date(),
          results: {
            error: bgError instanceof Error ? bgError.message : 'Unknown error'
          }
        });
      }
    });
  }

  async runManual(): Promise<void> {
    console.log('[BUYER-SCRAPING-SCHEDULER] 🔧 Esecuzione manuale richiesta...');
    await this.runScheduledScraping();
  }

  getStatus(): {
    isRunning: boolean;
    cronExpression: string;
    isSchedulerActive: boolean;
  } {
    return {
      isRunning: this.isRunning,
      cronExpression: this.cronExpression,
      isSchedulerActive: this.scheduledTask !== null
    };
  }
}

// Istanza singleton: esegui Martedì e Venerdì alle 2:00 AM (timezone: Europe/Rome)
export const buyerScrapingScheduler = new BuyerScrapingScheduler('0 2 * * 2,5');
