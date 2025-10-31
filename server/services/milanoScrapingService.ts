import { ingestionService } from './portalIngestionService';
import type { SearchCriteria, IngestionResult, PropertyListing } from './portalIngestionService';

/**
 * Check if property is in Milano city
 * NOTE: Geographic filter removed - now accepts all properties within Milano comune
 */
function isInMilano(listing: PropertyListing): boolean {
  if (!listing.city) {
    console.log(`[MILANO-SCRAPING] ⚠️ ${listing.address || listing.url} - No city specified, accepting`);
    return true;
  }
  
  const city = listing.city.toLowerCase().trim();
  const isMilano = city === 'milano' || city.includes('milan');
  
  if (!isMilano) {
    console.log(`[MILANO-SCRAPING] ❌ ${listing.address} - Wrong city: ${listing.city}`);
  }
  
  return isMilano;
}

export class MilanoScrapingService {
  /**
   * Scrape all Milano city using full-city search (NO zone filtering, NO geographic limits)
   * More efficient: single search covers entire Milano comune
   */
  async scrapeFullCity(): Promise<IngestionResult> {
    console.log('[MILANO-SCRAPING] 🔍 Starting FULL Milano city scrape (no zone/distance filters)...');

    const criteria: SearchCriteria = {
      city: 'milano',
      // No zone = search entire city
    };

    const result = await ingestionService.importFromPortal('immobiliare', criteria);
    
    console.log(`[MILANO-SCRAPING] ✅ Full city: ${result.imported} imported, ${result.failed} failed from ${result.totalFetched} total`);
    
    return result;
  }

  /**
   * Scrape all Milano properties by zones (legacy method for comprehensive coverage)
   * Searches all major Milano zones - accepts all properties from Milano city
   */
  async scrapeAllMilano(): Promise<IngestionResult> {
    console.log('[MILANO-SCRAPING] 🔍 Starting zone-based Milano scrape with Playwright...');

    // Search all major Milano zones for comprehensive coverage
    const zones = [
      'centro-storico',
      'porta-venezia',
      'brera',
      'porta-romana',
      'navigli',
      'isola',
      'porta-garibaldi',
      'sempione',
      'bovisa',
      'dergano',
      'citta-studi',
      'lambrate',
      'loreto',
      'buenos-aires',
      'washington',
      'magenta',
      'sarpi',
      'centrale',
      'affori',
      'niguarda',
      'bicocca',
      'certosa',
      'quarto-oggiaro',
      'gallaratese',
      'san-siro',
      'lorenteggio',
      'vigentino',
      'corvetto',
      'romana',
      'ticinese'
    ];

    let totalFetched = 0;
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const zone of zones) {
      try {
        console.log(`[MILANO-SCRAPING] Searching zone: ${zone}`);
        
        const criteria: SearchCriteria = {
          city: 'milano',
          zone: zone
        };

        // Use existing Playwright adapter through ingestionService
        const result = await ingestionService.importFromPortal('immobiliare', criteria);
        
        totalFetched += result.totalFetched;
        imported += result.imported;
        failed += result.failed;
        errors.push(...result.errors);

        console.log(`[MILANO-SCRAPING] Zone ${zone}: ${result.imported} imported`);

        // Rate limiting between zones
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Zone ${zone}: ${errorMsg}`);
        console.error(`[MILANO-SCRAPING] Zone ${zone} failed:`, error);
      }
    }

    console.log(`[MILANO-SCRAPING] ✅ Completed: ${imported} imported, ${failed} failed from ${totalFetched} total`);

    return {
      portal: 'Immobiliare.it (Playwright Milano)',
      totalFetched,
      imported,
      updated: 0,
      skippedDuplicate: 0,
      failed,
      errors: errors.slice(0, 10) // Limit errors to avoid huge responses
    };
  }

  /**
   * Scrape specific Milano zone
   */
  async scrapeZone(zone: string): Promise<IngestionResult> {
    console.log(`[MILANO-SCRAPING] 🔍 Scraping Milano zone: ${zone}`);

    const criteria: SearchCriteria = {
      city: 'milano',
      zone: zone
    };

    const result = await ingestionService.importFromPortal('immobiliare', criteria);
    
    console.log(`[MILANO-SCRAPING] ✅ Zone ${zone}: ${result.imported} imported, ${result.failed} failed`);
    
    return result;
  }
}

export const milanoScrapingService = new MilanoScrapingService();
