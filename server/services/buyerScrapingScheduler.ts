import * as cron from 'node-cron';

/**
 * Scheduler per scraping automatico COMPLETO di Milano
 * Invece di fare scraping per ogni singolo buyer (inefficiente),
 * fa 1 solo scraping completo di Milano e lascia che il sistema
 * di matching filtri le proprietà per ogni buyer.
 */
export class FullCityScrapingScheduler {
  private scheduledTask: ReturnType<typeof cron.schedule> | null = null;
  private isRunning = false;
  private cronExpression: string;
  private lastRunTime: Date | null = null;

  /**
   * @param cronExpression Cron expression (default: "0 7 * * *" = Ogni giorno alle 7:00 AM)
   */
  constructor(cronExpression: string = '0 7 * * *') {
    this.cronExpression = cronExpression;
  }

  start() {
    if (this.scheduledTask) {
      console.log('[FULL-CITY-SCHEDULER] Already running, skipping start');
      return;
    }

    this.scheduledTask = cron.schedule(this.cronExpression, async () => {
      await this.runScheduledScraping();
    }, {
      timezone: 'Europe/Rome'
    });

    console.log(`[FULL-CITY-SCHEDULER] ⏰ Avviato con cron "${this.cronExpression}" (Ogni giorno alle 7:00 AM Europe/Rome)`);
    console.log(`[FULL-CITY-SCHEDULER] 📊 Sistema ottimizzato: 1 scraping completo invece di N scraping per buyer`);
  }

  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask.destroy();
      this.scheduledTask = null;
      console.log('[FULL-CITY-SCHEDULER] ⏸️ Scheduler fermato');
    }
  }

  async runScheduledScraping(): Promise<void> {
    if (this.isRunning) {
      console.log('[FULL-CITY-SCHEDULER] ⚠️ Scraping già in corso, skip');
      return;
    }

    // Check if already ran in last 12 hours (prevent duplicate runs)
    if (this.lastRunTime) {
      const hoursSinceLastRun = (Date.now() - this.lastRunTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRun < 12) {
        console.log(`[FULL-CITY-SCHEDULER] ⏭️ Skip: ultimo scraping completato ${hoursSinceLastRun.toFixed(1)}h fa`);
        return;
      }
    }

    this.isRunning = true;
    const startTime = Date.now();
    console.log('[FULL-CITY-SCHEDULER] 🚀 Avvio scraping COMPLETO di Milano...');

    try {
      // Import dinamico per evitare dipendenze circolari
      const { getApifyService } = await import('./apifyService');
      const { ingestionService } = await import('./portalIngestionService');
      
      const apifyService = getApifyService();

      // Scrape TUTTA Milano in una sola chiamata
      console.log('[FULL-CITY-SCHEDULER] 📡 Chiamata Apify per scraping completo...');
      const listings = await apifyService.scrapeAllMilano();
      
      console.log(`[FULL-CITY-SCHEDULER] 📥 Ricevuti ${listings.length} immobili da Apify`);

      // Import listings to database using ingestionService (handles type mapping)
      let imported = 0;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const listing of listings) {
        try {
          const result = await ingestionService.importProperty(listing);
          if (result.updated) {
            updated++;
          } else {
            imported++;
          }
        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(errorMsg);
          if (errors.length <= 5) {
            console.error('[FULL-CITY-SCHEDULER] Error importing property:', errorMsg);
          }
        }
      }

      const durationMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      
      console.log('[FULL-CITY-SCHEDULER] ✅ Scraping completato!');
      console.log(`[FULL-CITY-SCHEDULER] 📊 Statistiche:`);
      console.log(`[FULL-CITY-SCHEDULER]   - Totale: ${listings.length}`);
      console.log(`[FULL-CITY-SCHEDULER]   - Nuovi: ${imported}`);
      console.log(`[FULL-CITY-SCHEDULER]   - Aggiornati: ${updated}`);
      console.log(`[FULL-CITY-SCHEDULER]   - Errori: ${failed}`);
      console.log(`[FULL-CITY-SCHEDULER]   - Durata: ${durationMinutes} minuti`);
      
      if (errors.length > 0) {
        console.log(`[FULL-CITY-SCHEDULER] ⚠️ Primi 5 errori: ${errors.slice(0, 5).join(', ')}`);
      }

      this.lastRunTime = new Date();

    } catch (error) {
      console.error('[FULL-CITY-SCHEDULER] ❌ Errore durante scraping completo:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async runManual(): Promise<void> {
    console.log('[FULL-CITY-SCHEDULER] 🔧 Esecuzione manuale richiesta...');
    await this.runScheduledScraping();
  }

  getStatus(): {
    isRunning: boolean;
    cronExpression: string;
    isSchedulerActive: boolean;
    lastRunTime: Date | null;
  } {
    return {
      isRunning: this.isRunning,
      cronExpression: this.cronExpression,
      isSchedulerActive: this.scheduledTask !== null,
      lastRunTime: this.lastRunTime
    };
  }
}

// Istanza singleton: esegui ogni giorno alle 7:00 AM (timezone: Europe/Rome)
// Sistema ottimizzato: 1 solo scraping completo invece di N scraping per buyer
export const fullCityScrapingScheduler = new FullCityScrapingScheduler();
