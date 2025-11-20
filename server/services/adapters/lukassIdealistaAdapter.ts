import { ApifyClient } from 'apify-client';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

const IDEALISTA_PRIVATE_BASE_URL = 'https://www.idealista.it/vendita-case/milano-milano/?ordine=da-privati-asc';
const REQUEST_DELAY_MS = 5000;

export class LukassIdealistaAdapter implements PortalAdapter {
  name = 'Idealista Private (Lukass)';
  portalId = 'idealista-private';
  private lastRequestTime = 0;
  private client: ApifyClient;

  constructor() {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      throw new Error('APIFY_API_TOKEN environment variable is required');
    }
    this.client = new ApifyClient({ token });
  }

  async search(criteria: SearchCriteria & { maxItems?: number }): Promise<PropertyListing[]> {
    console.log(`[LUKASS-IDEALISTA] Searching for PRIVATE properties only`);

    await this.respectRateLimit();

    try {
      // Build custom URL with private-only filter
      const startUrl = this.buildPrivateUrl(criteria);
      
      const input = {
        startUrl: startUrl, // Custom URL with da-privati-asc filter
        maxItems: criteria.maxItems || 100,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'] // Use residential proxies to avoid blocks
        }
      };

      console.log(`[LUKASS-IDEALISTA] Starting lukass/idealista-scraper with URL: ${startUrl}`);

      const run = await this.client.actor('lukass/idealista-scraper').call(input);
      
      console.log(`[LUKASS-IDEALISTA] Run ID: ${run.id}, Status: ${run.status}`);
      
      // Get run details for debugging
      try {
        const runDetails: any = await this.client.run(run.id).get();
        console.log('[LUKASS-IDEALISTA] Run completed:', {
          status: runDetails?.status,
          itemsCount: runDetails?.stats?.itemCount,
          failedRequests: runDetails?.stats?.requestsFailed,
          finishedAt: runDetails?.finishedAt
        });
      } catch (detailsError: any) {
        console.log('[LUKASS-IDEALISTA] Could not fetch run details:', detailsError?.message);
      }
      
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      console.log(`[LUKASS-IDEALISTA] Dataset returned ${items.length} items (all should be PRIVATE)`);
      if (items.length > 0) {
        console.log('[LUKASS-IDEALISTA] First item sample:', JSON.stringify(items[0], null, 2));
      }

      // Transform lukass/idealista-scraper results to PropertyListings
      const listings: PropertyListing[] = [];
      for (const item of items) {
        try {
          const itemData: any = item;
          
          // Extract basic info
          const price = Number(itemData.price || itemData.priceValue) || 0;
          const size = Number(itemData.size || itemData.surface) || 0;
          const rooms = itemData.rooms ? Number(itemData.rooms) : undefined;
          const address = String(itemData.address || itemData.location || '');
          const url = String(itemData.url || itemData.link || '');
          const propertyId = String(itemData.id || itemData.propertyCode || '');
          
          // Extract coordinates
          const latitude = itemData.latitude ? parseFloat(String(itemData.latitude)) : undefined;
          const longitude = itemData.longitude ? parseFloat(String(itemData.longitude)) : undefined;
          
          // IMPORTANT: All properties from this scraper are PRIVATE by design
          // (because we used the da-privati-asc filter in the URL)
          const ownerType = 'private';
          
          if (url && price > 0) {
            listings.push({
              externalId: propertyId,
              title: String(itemData.title || itemData.propertyTitle || `Proprietà privata - ${address}`),
              address: address,
              city: criteria.city || 'Milano',
              price: price,
              size: size,
              bedrooms: rooms,
              type: 'apartment',
              url: url,
              description: String(itemData.description || ''),
              latitude: latitude && !isNaN(latitude) ? latitude : undefined,
              longitude: longitude && !isNaN(longitude) ? longitude : undefined,
              ownerType: ownerType, // Always 'private' from this source
              agencyName: undefined // No agency for private properties
            });
            
            console.log(`[LUKASS-IDEALISTA] ✅ Added PRIVATE property: ${propertyId} - ${address} (€${price})`);
          }
        } catch (itemError) {
          console.error('[LUKASS-IDEALISTA] Failed to transform item:', itemError);
        }
      }

      console.log(`[LUKASS-IDEALISTA] ✅ Found ${listings.length} PRIVATE listings`);
      return listings;
    } catch (error) {
      console.error('[LUKASS-IDEALISTA] Search failed:', error);
      return [];
    }
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    return null;
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for Apify client
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.APIFY_API_TOKEN;
  }

  private buildPrivateUrl(criteria: SearchCriteria): string {
    // Start with private-only base URL
    let url = IDEALISTA_PRIVATE_BASE_URL;
    
    const params: string[] = [];
    
    // Add price filter
    if (criteria.maxPrice) {
      params.push(`prezzoMassimo=${criteria.maxPrice}`);
    }
    
    // Add size filter
    if (criteria.minSize) {
      params.push(`superficieMinima=${criteria.minSize}`);
    }
    
    // Add bedrooms filter
    if (criteria.bedrooms) {
      params.push(`numeroDiCamere=${criteria.bedrooms}`);
    }
    
    // Append additional params
    if (params.length > 0) {
      url += '&' + params.join('&');
    }
    
    return url;
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < REQUEST_DELAY_MS) {
      const delay = REQUEST_DELAY_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }
}
