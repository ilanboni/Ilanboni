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
   * Transform Apify raw data (igolaizola/immobiliare-it-scraper format) to our PropertyListing format
   * New actor format: flat structure with direct fields
   */
  private transformApifyResults(items: any[]): PropertyListing[] {
    console.log(`[APIFY] Processing ${items.length} raw items from Apify (igolaizola format)...`);

    // Log first item structure for debugging
    if (items.length > 0) {
      console.log('[APIFY] Sample item keys:', Object.keys(items[0]));
      console.log('[APIFY] Sample item:', JSON.stringify(items[0], null, 2).substring(0, 500));
    }

    return items
      .filter(item => {
        if (!item) {
          console.log(`[APIFY] Filtered out: null item`);
          return false;
        }

        // Basic validation - must have city and it must be Milano/Milan
        const city = item.city || item.City || item.municipality || '';
        const cityNorm = city.toLowerCase();
        if (!cityNorm.includes('milan') && !cityNorm.includes('milano')) {
          console.log(`[APIFY] ❌ Filtered out: wrong city (${city})`);
          return false;
        }

        console.log(`[APIFY] ✅ Accepted: ${item.address || 'no address'} in ${city}`);
        return true;
      })
      .map(item => {
        // Extract fields from flat structure (igolaizola format)
        const externalId = String(item.id || item.ID || item.propertyId || Date.now());
        const price = parseInt(item.price || item.Price || item.priceValue || 0);
        const size = parseInt(item.size || item.Size || item.surface || item.Surface || 0);
        const address = item.address || item.Address || item.street || 'Indirizzo non disponibile';
        const city = item.city || item.City || item.municipality || 'Milano';
        const postalCode = item.postalCode || item.PostalCode || item.cap || '';
        
        // Type mapping
        let type = 'apartment';
        const typeStr = (item.type || item.Type || item.propertyType || '').toLowerCase();
        if (typeStr.includes('villa')) type = 'villa';
        else if (typeStr.includes('attico') || typeStr.includes('penthouse')) type = 'penthouse';
        else if (typeStr.includes('loft')) type = 'loft';

        // Build full address
        const fullAddress = postalCode 
          ? `${address}, ${postalCode}` 
          : address;

        // Agency info
        const agencyName = item.agency || item.Agency || item.advertiser || item.agencyName || 'Unknown';

        // URL construction
        const url = item.url || item.URL || item.link || item.directLink || 
                   `https://www.immobiliare.it/annunci/${externalId}/`;

        return {
          externalId,
          title: item.title || item.Title || `${type} in vendita`,
          address: fullAddress,
          city,
          price,
          size,
          bedrooms: parseInt(item.rooms || item.Rooms || item.bedrooms || item.Bedrooms || 0) || undefined,
          bathrooms: parseInt(item.bathrooms || item.Bathrooms || item.baths || 0) || undefined,
          floor: item.floor || item.Floor || undefined,
          type,
          description: item.description || item.Description || '',
          url,
          imageUrls: item.images || item.Images || item.photos || [],
          ownerType: agencyName && agencyName !== 'Unknown' ? 'agency' : 'private',
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
