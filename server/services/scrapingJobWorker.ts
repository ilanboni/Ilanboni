/**
 * Worker persistente per l'esecuzione dei job di scraping
 * 
 * Supporta:
 * - Job per singoli buyer (buyer-specific scraping)
 * - Full-city jobs (scraping completo di Milano da Immobiliare + Idealista)
 * - Batch processing con checkpoint persistenti per resume dopo restart
 * - Multi-portal scraping con tracking separato
 */

import type { IStorage } from '../storage';
import type { ScrapingJob } from '@shared/schema';
import type { PropertyListing } from './portalIngestionService';

interface JobCheckpoint {
  currentPortal: 'immobiliare' | 'idealista' | null;
  offset: number;
  apifyRunIds: {
    immobiliare?: string;
    idealista?: string;
  };
  completedPortals: string[];
}

interface JobResults {
  totalFetched: number;
  imported: number;
  updated: number;
  failed: number;
  errors: string[];
  portalResults?: {
    immobiliare?: { fetched: number; imported: number; updated: number; failed: number };
    idealista?: { fetched: number; imported: number; updated: number; failed: number };
  };
}

interface JobConfig {
  maxItems?: {
    immobiliare: number;
    idealista: number;
  };
  portals?: ('immobiliare' | 'idealista')[];
  batchSize?: number;
}

const BATCH_SIZE = 500; // Process 500 properties at a time
const MAX_ERRORS_PER_JOB = 20; // Store max 20 errors per job

export class ScrapingJobWorker {
  private storage: IStorage;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30000; // 30 secondi
  private readonly STALE_JOB_MINUTES = 30; // Job "running" più vecchi di 30 minuti sono considerati stale

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
   * CRITICAL FIX: usa startedAt invece di createdAt per evitare di marcare job long-running legittimi come stale
   */
  private async cleanupStaleJobs() {
    try {
      const allJobs = await this.storage.getAllScrapingJobs();
      const staleJobs = allJobs.filter((job: ScrapingJob) => {
        if (job.status !== 'running') return false;
        if (!job.startedAt) return false; // Skip se non ha startedAt (non dovrebbe mai accadere)
        
        const ageMinutes = (Date.now() - new Date(job.startedAt).getTime()) / (1000 * 60);
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
    const jobType = (job as any).jobType || 'buyer';
    
    console.log(`[SCRAPING-WORKER] 🔧 Esecuzione job #${job.id} (type: ${jobType})...`);

    try {
      // Marca job come "running" con startedAt
      await this.storage.updateScrapingJob(job.id, { 
        status: 'running',
        startedAt: new Date()
      });

      // Routing based on job type
      if (jobType === 'full-city') {
        await this.executeFullCityJob(job);
      } else {
        await this.executeBuyerJob(job);
      }

    } catch (error) {
      console.error(`[SCRAPING-WORKER] ❌ Job #${job.id} fallito:`, error);
      
      // CRITICAL FIX: Wrap DB update in try-catch to prevent stuck jobs
      try {
        await this.storage.updateScrapingJob(job.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        });
      } catch (updateError) {
        console.error(`[SCRAPING-WORKER] ⚠️ CRITICAL: Failed to mark job #${job.id} as failed in DB:`, updateError);
        console.error(`[SCRAPING-WORKER] ⚠️ Job #${job.id} may be stuck in 'running' state - manual intervention required`);
        // TODO: Send alert to monitoring system
      }
    }
  }

  /**
   * Esegue job per singolo buyer
   */
  private async executeBuyerJob(job: ScrapingJob) {
    // Validate clientId is not null for buyer jobs
    if (!job.clientId) {
      throw new Error('Buyer job requires a valid client ID');
    }

    console.log(`[SCRAPING-WORKER] 👤 Buyer job #${job.id} per client ${job.clientId}`);

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
  }

  /**
   * Esegue full-city scraping (Immobiliare + Idealista) con batch processing e checkpoint
   */
  private async executeFullCityJob(job: ScrapingJob) {
    console.log(`[SCRAPING-WORKER] 🏙️ Full-city job #${job.id} - scraping Milano da ENTRAMBI i portali`);

    const { getApifyService } = await import('./apifyService');
    const apifyService = getApifyService();

    // Load or initialize config, checkpoint, results
    const config: JobConfig = (job as any).config || {
      maxItems: { immobiliare: 20000, idealista: 10000 },
      portals: ['immobiliare', 'idealista'],
      batchSize: BATCH_SIZE
    };

    const checkpoint: JobCheckpoint = (job as any).checkpoint || {
      currentPortal: null,
      offset: 0,
      apifyRunIds: {},
      completedPortals: []
    };

    const results: JobResults = (job as any).results || {
      totalFetched: 0,
      imported: 0,
      updated: 0,
      failed: 0,
      errors: [],
      portalResults: {}
    };

    // Process each portal
    for (const portal of config.portals!) {
      if (checkpoint.completedPortals.includes(portal)) {
        console.log(`[SCRAPING-WORKER] ✓ Portal ${portal} già completato, skip`);
        continue;
      }

      await this.processPortal(job.id, portal, config, checkpoint, results);
    }

    // Trigger deduplication scan
    if (results.imported > 0 || results.updated > 0) {
      try {
        console.log(`[SCRAPING-WORKER] 🔄 Avvio deduplicazione per job #${job.id}...`);
        const { runDeduplicationScan } = await import('./deduplicationScheduler');
        await runDeduplicationScan();
        console.log(`[SCRAPING-WORKER] ✅ Deduplicazione completata`);
      } catch (dedupError) {
        console.error(`[SCRAPING-WORKER] ⚠️ Deduplicazione fallita:`, dedupError);
      }
    }

    // Mark job as completed
    await this.storage.updateScrapingJob(job.id, {
      status: 'completed',
      completedAt: new Date(),
      results: results as any
    });

    console.log(`[SCRAPING-WORKER] ✅ Full-city job #${job.id} completato: ${results.imported} imported, ${results.updated} updated, ${results.failed} failed`);
  }

  /**
   * Processa un singolo portal con batch processing e checkpoint
   */
  private async processPortal(
    jobId: number,
    portal: 'immobiliare' | 'idealista',
    config: JobConfig,
    checkpoint: JobCheckpoint,
    results: JobResults
  ) {
    console.log(`[SCRAPING-WORKER] 📡 Processing portal: ${portal}`);

    const { getApifyService } = await import('./apifyService');
    const apifyService = getApifyService();

    // Initialize portal results
    if (!results.portalResults![portal]) {
      results.portalResults![portal] = {
        fetched: 0,
        imported: 0,
        updated: 0,
        failed: 0
      };
    }

    // Scrape from portal
    let listings: PropertyListing[];
    
    if (portal === 'immobiliare') {
      listings = await apifyService.scrapeImmobiliare({
        maxItems: config.maxItems!.immobiliare,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      });
    } else {
      // Use Apify for Idealista (now with correct country parameter)
      listings = await apifyService.scrapeIdealista({
        maxItems: config.maxItems!.idealista
      });
    }

    console.log(`[SCRAPING-WORKER] 🎯 ${portal}: fetched ${listings.length} listings`);
    results.portalResults![portal]!.fetched = listings.length;
    results.totalFetched += listings.length;

    // Process in batches
    for (let i = 0; i < listings.length; i += config.batchSize!) {
      const batch = listings.slice(i, i + config.batchSize!);
      await this.processBatch(jobId, portal, batch, checkpoint, results);
      
      // Save checkpoint after each batch
      checkpoint.offset = i + config.batchSize!;
      await this.saveCheckpoint(jobId, checkpoint, results);
      
      console.log(`[SCRAPING-WORKER] 💾 Checkpoint saved: ${portal} offset ${checkpoint.offset}/${listings.length}`);
    }

    // Mark portal as completed
    checkpoint.completedPortals.push(portal);
    checkpoint.currentPortal = null;
    checkpoint.offset = 0;
    await this.saveCheckpoint(jobId, checkpoint, results);

    console.log(`[SCRAPING-WORKER] ✅ ${portal} completato: ${results.portalResults![portal]!.imported} imported, ${results.portalResults![portal]!.updated} updated`);
  }

  /**
   * Processa un batch di listings
   */
  private async processBatch(
    jobId: number,
    portal: string,
    batch: PropertyListing[],
    checkpoint: JobCheckpoint,
    results: JobResults
  ) {
    console.log(`[SCRAPING-WORKER] 📦 Processing batch of ${batch.length} listings from ${portal}...`);

    for (const listing of batch) {
      try {
        // Check if property already exists
        const existingProp = await this.storage.getPropertyByExternalId(listing.externalId);

        if (existingProp) {
          // Update existing property
          await this.storage.updateProperty(existingProp.id, {
            title: listing.title,
            price: listing.price,
            size: listing.size,
            bedrooms: listing.bedrooms as any,
            bathrooms: listing.bathrooms as any,
            description: listing.description,
            imageUrls: listing.imageUrls,
            ownerType: listing.ownerType,
            agencyName: listing.agencyName,
            ownerName: listing.ownerName,
            ownerPhone: listing.ownerPhone,
            ownerEmail: listing.ownerEmail,
            latitude: listing.latitude,
            longitude: listing.longitude
          });

          results.updated++;
          results.portalResults![portal as 'immobiliare' | 'idealista']!.updated++;
        } else {
          // Insert new property
          await this.storage.createProperty({
            externalId: listing.externalId,
            title: listing.title,
            address: listing.address,
            city: listing.city || 'Milano',
            price: listing.price,
            size: listing.size,
            bedrooms: listing.bedrooms as any,
            bathrooms: listing.bathrooms as any,
            floor: listing.floor,
            type: listing.type,
            url: listing.url,
            externalLink: listing.url,
            description: listing.description,
            imageUrls: listing.imageUrls,
            latitude: listing.latitude,
            longitude: listing.longitude,
            ownerType: listing.ownerType,
            agencyName: listing.agencyName,
            ownerName: listing.ownerName,
            ownerPhone: listing.ownerPhone,
            ownerEmail: listing.ownerEmail,
            source: portal  // Use portal name: 'immobiliare' or 'idealista'
          });

          results.imported++;
          results.portalResults![portal as 'immobiliare' | 'idealista']!.imported++;
        }
      } catch (error) {
        results.failed++;
        results.portalResults![portal as 'immobiliare' | 'idealista']!.failed++;
        
        const errorMsg = `Failed to import ${listing.address}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        
        // Trim errors array if too long
        if (results.errors.length > MAX_ERRORS_PER_JOB) {
          results.errors = results.errors.slice(-MAX_ERRORS_PER_JOB);
        }
      }
    }
  }

  /**
   * Salva checkpoint nel database con retry logic (CRITICAL per resume capability)
   */
  private async saveCheckpoint(jobId: number, checkpoint: JobCheckpoint, results: JobResults) {
    const MAX_RETRIES = 3;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.storage.updateScrapingJob(jobId, {
          checkpoint: checkpoint as any,
          results: results as any
        });
        return; // Success
        
      } catch (error) {
        console.error(`[SCRAPING-WORKER] ⚠️ Failed to save checkpoint (attempt ${attempt}/${MAX_RETRIES}):`, error);
        
        if (attempt === MAX_RETRIES) {
          console.error(`[SCRAPING-WORKER] ❌ CRITICAL: Failed to save checkpoint after ${MAX_RETRIES} attempts - job may be lost on restart`);
          throw new Error(`Failed to save checkpoint after ${MAX_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Exponential backoff before retry (1s, 2s, 4s)
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`[SCRAPING-WORKER] 🔄 Retrying checkpoint save in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
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
