import { ApifyClient } from 'apify-client';
import type { PropertyListing } from './portalIngestionService';

export interface ApifyScraperConfig {
  searchUrls: string[];
  maxItems?: number;
  proxyConfiguration?: {
    useApifyProxy: boolean;
    apifyProxyGroups?: string[];
  };
}

export class ApifyService {
  private client: ApifyClient;
  private actorId = 'igolaizola/immobiliare-it-scraper'; // New actor with 1-day trial

  constructor(apiToken: string) {
    this.client = new ApifyClient({ token: apiToken });
    console.log('[APIFY] Service initialized with actor:', this.actorId);
  }

  /**
   * Scrapes Immobiliare.it using Apify actor
   */
  async scrapeImmobiliare(config: ApifyScraperConfig): Promise<PropertyListing[]> {
    console.log(`[APIFY] Starting scrape with ${config.searchUrls.length} URLs`);
    
    // New actor format: igolaizola/immobiliare-it-scraper
    const input = {
      municipality: 'milano',
      category: 'vendita',
      maxItems: config.maxItems || 1000,
      proxyConfiguration: config.proxyConfiguration || {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };

    try {
      // Run the actor
      const run = await this.client.actor(this.actorId).call(input);
      console.log(`[APIFY] Actor run completed: ${run.id}`);
      console.log(`[APIFY] Dataset: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`);

      // Fetch results from dataset
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      console.log(`[APIFY] Fetched ${items.length} items from dataset`);

      // Debug: Log first item structure
      if (items.length > 0) {
        console.log('[APIFY] Sample item structure:', JSON.stringify(items[0], null, 2));
        console.log('[APIFY] Sample item keys:', Object.keys(items[0]));
      }

      // Transform Apify results to PropertyListing format
      const listings = this.transformApifyResults(items);
      console.log(`[APIFY] Transformed ${listings.length} listings`);

      return listings;
    } catch (error) {
      console.error('[APIFY] Scraping failed:', error);
      throw error;
    }
  }

  /**
   * Scrapes all properties in Milano (complete automation)
   * Uses geographic center (Duomo: 45.464, 9.190) with specific zones
   */
  async scrapeAllMilano(): Promise<PropertyListing[]> {
    console.log('[APIFY] 🔍 Starting complete Milano scrape...');
    
    // Multiple search URLs with Milano-specific zones (Centro Storico, Porta Venezia, etc.)
    const searchUrls = [
      // Centro Storico (Duomo area - id: 10100)
      'https://www.immobiliare.it/vendita-case/milano/centro-storico-10100/',
      // Porta Venezia / Indipendenza
      'https://www.immobiliare.it/vendita-case/milano/porta-venezia-10101/',
      // Brera
      'https://www.immobiliare.it/vendita-case/milano/brera-10102/',
      // Porta Romana / Cadore
      'https://www.immobiliare.it/vendita-case/milano/porta-romana-10109/',
      // Generic Milano fallback
      'https://www.immobiliare.it/vendita-case/milano/'
    ];

    return this.scrapeImmobiliare({
      searchUrls,
      maxItems: 2000, // Max per URL
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    });
  }

  /**
   * Calculate distance between two points in kilometers using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
   * Transform Apify raw data (azzouzana format) to our PropertyListing format
   * Filters: Only Milano properties within 5km from Duomo (45.464, 9.190)
   */
  private transformApifyResults(items: any[]): PropertyListing[] {
    const DUOMO_LAT = 45.464;
    const DUOMO_LON = 9.190;
    const MAX_DISTANCE_KM = 5;

    console.log(`[APIFY] Processing ${items.length} raw items from Apify...`);

    return items
      .filter(item => {
        if (!item || !item.directLink || !item.properties?.[0]) {
          console.log(`[APIFY] Filtered out: missing required fields`);
          return false;
        }
        
        const location = item.properties[0].location;
        if (!location) {
          console.log(`[APIFY] Filtered out: no location data`);
          return false;
        }

        // Filter 1: Must be Milano
        const city = location.city?.toLowerCase() || '';
        if (city !== 'milano') {
          console.log(`[APIFY] ❌ ${location.address} - Wrong city: ${location.city}`);
          return false;
        }

        // Filter 2: Must have valid coordinates
        const lat = location.latitude;
        const lon = location.longitude;
        if (!lat || !lon) {
          console.log(`[APIFY] ❌ ${location.address} - No coordinates`);
          return false;
        }

        // Filter 3: Must be within 5km from Duomo
        const distance = this.calculateDistance(DUOMO_LAT, DUOMO_LON, lat, lon);
        if (distance > MAX_DISTANCE_KM) {
          console.log(`[APIFY] ❌ ${location.address} - Too far: ${distance.toFixed(2)}km`);
          return false;
        }

        console.log(`[APIFY] ✅ ${location.address} - Distance: ${distance.toFixed(2)}km`);
        return true;
      })
      .map(item => {
        const prop = item.properties[0];
        const location = prop.location || {};
        
        const externalId = String(item.id || Date.now());
        const floor = prop.floor?.abbreviation || prop.floor?.floorOnlyValue;

        let type = 'apartment';
        const typologyName = item.typology?.name?.toLowerCase() || '';
        if (typologyName.includes('villa')) type = 'villa';
        else if (typologyName.includes('attico')) type = 'penthouse';
        else if (typologyName.includes('loft')) type = 'loft';

        const agencyName = item.advertiser?.agency?.displayName || 
                          item.advertiser?.supervisor?.displayName || 
                          'Unknown';

        const surfaceStr = prop.surface || '';
        const sizeMatch = surfaceStr.match(/(\d+)/);
        const size = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

        const photos = prop.multimedia?.photos || [];
        const imageUrls = photos
          .map((p: any) => p.urls?.large || p.urls?.medium || p.urls?.small)
          .filter((url: string) => url)
          .slice(0, 10);

        const address = location.address || 'Indirizzo non disponibile';
        const city = location.city || 'Milano';

        return {
          externalId,
          title: item.title || prop.caption || 'Untitled',
          address,
          city,
          price: item.price?.value || 0,
          size,
          bedrooms: prop.bedRoomsNumber ? parseInt(prop.bedRoomsNumber) : undefined,
          bathrooms: prop.bathrooms ? parseInt(prop.bathrooms) : undefined,
          floor,
          type,
          description: prop.caption || item.title || '',
          url: item.directLink,
          imageUrls,
          ownerType: item.advertiser?.agency ? 'agency' : 'private',
          agencyName
        } as PropertyListing;
      });
  }

  /**
   * Test connection and actor availability
   */
  async testConnection(): Promise<boolean> {
    try {
      const actorInfo = await this.client.actor(this.actorId).get();
      console.log(`[APIFY] ✅ Actor available: ${actorInfo?.name || this.actorId}`);
      return true;
    } catch (error) {
      console.error('[APIFY] ❌ Connection test failed:', error);
      return false;
    }
  }
}

// Singleton instance
let apifyService: ApifyService | null = null;

export function getApifyService(): ApifyService {
  const apiToken = process.env.APIFY_API_TOKEN;
  
  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  if (!apifyService) {
    apifyService = new ApifyService(apiToken);
  }

  return apifyService;
}
