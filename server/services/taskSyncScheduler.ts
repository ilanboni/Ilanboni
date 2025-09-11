import { backfillInboundTasks } from './inboundTaskManager';

interface SyncSchedulerOptions {
  intervalMinutes?: number;
  enabled?: boolean;
}

class TaskSyncScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalMs: number;
  private enabled: boolean;

  constructor(options: SyncSchedulerOptions = {}) {
    this.intervalMs = (options.intervalMinutes || 5) * 60 * 1000; // Default 5 minuti
    this.enabled = options.enabled !== false; // Default abilitato
  }

  /**
   * Avvia la sincronizzazione automatica ogni 5 minuti
   */
  start(): void {
    if (!this.enabled) {
      console.log('[TASK-SYNC] ⏸️ Scheduler disabilitato');
      return;
    }

    if (this.intervalId) {
      console.log('[TASK-SYNC] ⚠️ Scheduler già avviato');
      return;
    }

    console.log(`[TASK-SYNC] 🚀 Avvio sincronizzazione automatica ogni ${this.intervalMs / 60000} minuti`);

    // Esegui immediatamente la prima sincronizzazione
    this.syncNow();

    // Imposta il timer per le sincronizzazioni periodiche
    this.intervalId = setInterval(() => {
      this.syncNow();
    }, this.intervalMs);

    console.log('[TASK-SYNC] ✅ Scheduler avviato con successo');
  }

  /**
   * Ferma la sincronizzazione automatica
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[TASK-SYNC] ⏹️ Scheduler fermato');
    }
  }

  /**
   * Esegue immediatamente una sincronizzazione manuale
   */
  async syncNow(): Promise<void> {
    try {
      const startTime = Date.now();
      console.log('[TASK-SYNC] 🔄 Inizio sincronizzazione task e contatti...');

      // Esegui backfill dei task per le comunicazioni in ingresso
      await backfillInboundTasks();

      const duration = Date.now() - startTime;
      console.log(`[TASK-SYNC] ✅ Sincronizzazione completata in ${duration}ms`);

    } catch (error) {
      console.error('[TASK-SYNC] ❌ Errore durante sincronizzazione:', error);
    }
  }

  /**
   * Restituisce lo stato corrente dello scheduler
   */
  getStatus(): { running: boolean; intervalMinutes: number; enabled: boolean } {
    return {
      running: this.intervalId !== null,
      intervalMinutes: this.intervalMs / 60000,
      enabled: this.enabled
    };
  }

  /**
   * Aggiorna l'intervallo di sincronizzazione (richiede restart)
   */
  setInterval(minutes: number): void {
    this.intervalMs = minutes * 60 * 1000;
    
    if (this.intervalId) {
      console.log(`[TASK-SYNC] 🔄 Aggiornamento intervallo a ${minutes} minuti (riavvio necessario)`);
      this.stop();
      this.start();
    }
  }
}

// Istanza singleton dello scheduler
export const taskSyncScheduler = new TaskSyncScheduler({
  intervalMinutes: 5, // Sincronizzazione ogni 5 minuti
  enabled: true
});

// Avvia automaticamente lo scheduler quando il modulo viene importato
taskSyncScheduler.start();

export default taskSyncScheduler;