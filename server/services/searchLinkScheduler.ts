import * as cron from 'node-cron';
import { scrapeSearchLinkForHighRatingClients } from './searchLinkScraper';

let schedulerTask: cron.ScheduledTask | null = null;

export function startSearchLinkScheduler() {
  if (schedulerTask) {
    console.log('[SEARCH-LINK-SCHEDULER] Already running, skipping start');
    return;
  }

  // Run at 2:00 AM every day (Europe/Rome timezone)
  schedulerTask = cron.schedule('0 2 * * *', async () => {
    console.log('[SEARCH-LINK-SCHEDULER] ⏰ Starting nightly search link scraping...');
    
    try {
      const result = await scrapeSearchLinkForHighRatingClients();
      
      const totalNew = result.results.reduce((sum, r) => sum + r.newProperties, 0);
      const totalMatches = result.results.reduce((sum, r) => sum + r.matchesCreated, 0);
      
      console.log(`[SEARCH-LINK-SCHEDULER] ✅ Nightly scraping completed:`);
      console.log(`  - Clients processed: ${result.processed}`);
      console.log(`  - New properties: ${totalNew}`);
      console.log(`  - Matches created: ${totalMatches}`);
      
    } catch (error) {
      console.error('[SEARCH-LINK-SCHEDULER] ❌ Error during nightly scraping:', error);
    }
  }, {
    timezone: 'Europe/Rome'
  });

  console.log('[SEARCH-LINK-SCHEDULER] ⏰ Started - runs every night at 2:00 AM (Europe/Rome)');
}

export function stopSearchLinkScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('[SEARCH-LINK-SCHEDULER] ⏹️ Stopped');
  }
}

export function isSearchLinkSchedulerRunning(): boolean {
  return schedulerTask !== null;
}
