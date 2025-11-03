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
   * New actor format: nested structure with geography.municipality.name
   */
  private transformApifyResults(items: any[]): PropertyListing[] {
    console.log(`[APIFY] Processing ${items.length} raw items from Apify (igolaizola format)...`);

    return items
      .filter(item => {
        if (!item || !item.geography) {
          console.log(`[APIFY] ❌ Filtered out: missing geography data`);
          return false;
        }

        // City is in geography.municipality.name
        const city = item.geography.municipality?.name || '';
        const cityNorm = city.toLowerCase();
        
        if (!cityNorm.includes('milan') && !cityNorm.includes('milano')) {
          console.log(`[APIFY] ❌ Filtered out: wrong city (${city})`);
          return false;
        }

        const address = item.geography.street || '';
        console.log(`[APIFY] ✅ Accepted: ${address} in ${city}`);
        return true;
      })
      .map(item => {
        const geography = item.geography || {};
        const topology = item.topology || {};
        const priceData = item.price || {};
        const analytics = item.analytics || {};
        const mediaData = item.media || {};
        const contacts = item.contacts || {};
        
        // Extract fields from nested structure
        const externalId = String(item.id || Date.now());
        const price = priceData.raw || 0;
        const size = topology.surface?.size || 0;
        const address = geography.street || 'Indirizzo non disponibile';
        const city = geography.municipality?.name || 'Milano';
        const postalCode = geography.zipcode || '';
        const latitude = geography.geolocation?.latitude;
        const longitude = geography.geolocation?.longitude;
        
        // Type mapping from topology.typology.name
        let type = 'apartment';
        const typologyName = (topology.typology?.name || '').toLowerCase();
        if (typologyName.includes('villa')) type = 'villa';
        else if (typologyName.includes('attico') || typologyName.includes('penthouse')) type = 'penthouse';
        else if (typologyName.includes('loft')) type = 'loft';

        // Build full address
        const fullAddress = postalCode 
          ? `${address}, ${postalCode}` 
          : address;

        // Agency info from analytics or contacts
        const agencyName = analytics.agencyName || contacts.agencyName || 'Unknown';

        // URL construction
        const url = `https://www.immobiliare.it/annunci/${externalId}/`;

        // Extract images from media.images array
        const images = mediaData.images || [];
        const imageUrls = images
          .map((img: any) => img.hd || img.sd || '')
          .filter((url: string) => url)
          .slice(0, 10);

        return {
          externalId,
          title: item.title || `${type} in vendita`,
          address: fullAddress,
          city,
          price,
          size,
          bedrooms: parseInt(topology.rooms || '0') || undefined,
          bathrooms: parseInt(topology.bathrooms || '0') || undefined,
          floor: topology.floor || undefined,
          type,
          description: '', // No description field in this format
          url,
          imageUrls,
          latitude,
          longitude,
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
