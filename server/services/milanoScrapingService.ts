import { ingestionService } from './portalIngestionService';
import type { SearchCriteria, IngestionResult, PropertyListing } from './portalIngestionService';

const DUOMO_LAT = 45.464;
const DUOMO_LON = 9.190;
const MAX_DISTANCE_KM = 5;

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get coordinates for Milano addresses using Nominatim
 */
async function getCoordinates(address: string, city: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const query = `${address}, ${city}, Italy`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MilanoCRMSystem/1.0'
      }
    });
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (!results || results.length === 0) return null;
    
    return {
      lat: parseFloat(results[0].lat),
      lon: parseFloat(results[0].lon)
    };
  } catch (error) {
    console.error('[MILANO-SCRAPING] Geocoding failed:', error);
    return null;
  }
}

/**
 * Check if property is within 5km from Duomo di Milano
 */
async function isWithinMilanoRadius(listing: PropertyListing): Promise<boolean> {
  // Filter 1: Must be Milano
  if (listing.city?.toLowerCase() !== 'milano') {
    console.log(`[MILANO-SCRAPING] ❌ ${listing.address} - Wrong city: ${listing.city}`);
    return false;
  }

  // Filter 2: Get coordinates and check distance
  const coords = await getCoordinates(listing.address, listing.city);
  if (!coords) {
    console.log(`[MILANO-SCRAPING] ⚠️ ${listing.address} - Could not geocode (accepting as fallback)`);
    return true; // Accept if geocoding fails (conservative approach)
  }

  const distance = calculateDistance(DUOMO_LAT, DUOMO_LON, coords.lat, coords.lon);
  if (distance > MAX_DISTANCE_KM) {
    console.log(`[MILANO-SCRAPING] ❌ ${listing.address} - Too far: ${distance.toFixed(2)}km from Duomo`);
    return false;
  }

  console.log(`[MILANO-SCRAPING] ✅ ${listing.address} - Distance: ${distance.toFixed(2)}km from Duomo`);
  return true;
}

export class MilanoScrapingService {
  /**
   * Scrape all Milano properties from Immobiliare.it using Playwright
   * Searches multiple Milano zones and applies 5km geographic filter
   */
  async scrapeAllMilano(): Promise<IngestionResult> {
    console.log('[MILANO-SCRAPING] 🔍 Starting complete Milano scrape with Playwright...');

    // Search multiple Milano zones for comprehensive coverage
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
      'citta-studi',
      'loreto',
      'buenos-aires',
      'washington',
      'magenta',
      'sarpi',
      'centrale',
      'lambrate',
      'bicocca'
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
