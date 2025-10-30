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
  private actorId = 'azzouzana/immobiliare-it-listing-page-scraper-by-search-url';

  constructor(apiToken: string) {
    this.client = new ApifyClient({ token: apiToken });
    console.log('[APIFY] Service initialized');
  }

  /**
   * Scrapes Immobiliare.it using Apify actor
   */
  async scrapeImmobiliare(config: ApifyScraperConfig): Promise<PropertyListing[]> {
    console.log(`[APIFY] Starting scrape with ${config.searchUrls.length} URLs`);
    
    const input = {
      startUrls: config.searchUrls,
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
   */
  async scrapeAllMilano(): Promise<PropertyListing[]> {
    console.log('[APIFY] 🔍 Starting complete Milano scrape...');
    
    // Multiple search URLs to cover all Milano
    const searchUrls = [
      'https://www.immobiliare.it/vendita-case/milano/',
      'https://www.immobiliare.it/vendita-appartamenti/milano/',
      'https://www.immobiliare.it/vendita-case/milano/?prezzoMassimo=500000',
      'https://www.immobiliare.it/vendita-case/milano/?prezzoMinimo=500000&prezzoMassimo=1000000',
      'https://www.immobiliare.it/vendita-case/milano/?prezzoMinimo=1000000'
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
   * Transform Apify raw data to our PropertyListing format
   */
  private transformApifyResults(items: any[]): PropertyListing[] {
    return items
      .filter(item => item && item.url) // Filter invalid items
      .map(item => {
        // Extract external ID from URL
        const urlMatch = item.url?.match(/\/(\d+)\//);
        const externalId = urlMatch ? urlMatch[1] : String(Date.now());

        // Extract floor number
        let floor: string | undefined;
        if (item.floor) {
          floor = String(item.floor);
        } else if (item.description?.toLowerCase().includes('piano')) {
          const floorMatch = item.description.match(/piano\s+(\d+)/i);
          floor = floorMatch ? floorMatch[1] : undefined;
        }

        // Determine property type
        let type = 'apartment';
        if (item.title?.toLowerCase().includes('villa')) type = 'villa';
        else if (item.title?.toLowerCase().includes('attico')) type = 'penthouse';
        else if (item.title?.toLowerCase().includes('loft')) type = 'loft';

        // Extract agency name from contact info
        const agencyName = item.agency || item.advertiser || 'Unknown';

        return {
          externalId,
          title: item.title || 'Untitled',
          address: item.address || item.location || 'Milano',
          city: 'Milano',
          price: parseFloat(item.price) || 0,
          size: parseFloat(item.surface) || parseFloat(item.size) || 0,
          bedrooms: parseInt(item.rooms) || parseInt(item.bedrooms) || undefined,
          bathrooms: parseInt(item.bathrooms) || undefined,
          floor,
          type,
          description: item.description || item.title || '',
          url: item.url,
          imageUrls: Array.isArray(item.images) ? item.images.slice(0, 10) : [],
          ownerType: item.isPrivate ? 'private' : 'agency',
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
