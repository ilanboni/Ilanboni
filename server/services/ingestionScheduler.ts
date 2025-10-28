import { ingestionService } from './portalIngestionService';
import { deduplicationScheduler } from './deduplicationScheduler';

export class IngestionScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private scheduleDays: number;

  constructor(scheduleDays: number = 1) {
    this.scheduleDays = scheduleDays;
  }

  start() {
    if (this.intervalId) {
      console.log('[INGESTION-SCHEDULER] Already running, skipping start');
      return;
    }

    const intervalMs = this.scheduleDays * 24 * 60 * 60 * 1000;
    
    console.log(`[INGESTION-SCHEDULER] ⏰ Avviato con intervallo di ${this.scheduleDays} giorn${this.scheduleDays === 1 ? 'o' : 'i'}`);

    this.intervalId = setInterval(async () => {
      await this.runScheduledIngestion();
    }, intervalMs);

    console.log(`[INGESTION-SCHEDULER] 🔄 Prossima esecuzione automatica tra ${this.scheduleDays} giorn${this.scheduleDays === 1 ? 'o' : 'i'}`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[INGESTION-SCHEDULER] ⏸️ Scheduler fermato');
    }
  }

  async runScheduledIngestion(): Promise<void> {
    if (this.isRunning) {
      console.log('[INGESTION-SCHEDULER] ⚠️ Ingestion già in corso, skip');
      return;
    }

    this.isRunning = true;
    console.log('[INGESTION-SCHEDULER] 🚀 Avvio ingestion automatica...');

    try {
      const criteria = {
        city: 'milano',
        minPrice: 300000,
        maxPrice: 3000000,
        minSize: 60
      };

      const results = await ingestionService.importFromAllPortals(criteria);
      
      const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

      console.log(`[INGESTION-SCHEDULER] ✅ Ingestion completata: ${totalImported} importati, ${totalFailed} falliti`);

      if (totalImported > 0) {
        console.log('[INGESTION-SCHEDULER] 🔍 Avvio deduplicazione automatica...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await deduplicationScheduler.runManualScan();
        
        console.log('[INGESTION-SCHEDULER] ✅ Deduplicazione completata');
      } else {
        console.log('[INGESTION-SCHEDULER] ℹ️ Nessun nuovo immobile importato, skip deduplicazione');
      }

    } catch (error) {
      console.error('[INGESTION-SCHEDULER] ❌ Errore durante ingestion automatica:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async runManual(): Promise<{
    totalImported: number;
    totalFailed: number;
    results: any[];
  }> {
    console.log('[INGESTION-SCHEDULER] 🔧 Esecuzione manuale richiesta...');
    
    await this.runScheduledIngestion();
    
    return {
      totalImported: 0,
      totalFailed: 0,
      results: []
    };
  }

  getStatus(): {
    isRunning: boolean;
    scheduleDays: number;
    isSchedulerActive: boolean;
  } {
    return {
      isRunning: this.isRunning,
      scheduleDays: this.scheduleDays,
      isSchedulerActive: this.intervalId !== null
    };
  }
}

export const ingestionScheduler = new IngestionScheduler(1);
