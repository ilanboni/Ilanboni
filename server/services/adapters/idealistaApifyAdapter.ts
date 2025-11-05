import { ApifyClient } from 'apify-client';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

const IDEALISTA_BASE_URL = 'https://www.idealista.it';
const REQUEST_DELAY_MS = 5000; // Apify needs time to complete

export class IdealistaApifyAdapter implements PortalAdapter {
  name = 'Idealista (Apify)';
  portalId = 'idealista';
  private lastRequestTime = 0;
  private client: ApifyClient;

  constructor() {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      throw new Error('APIFY_API_TOKEN environment variable is required');
    }
    this.client = new ApifyClient({ token });
  }

  async search(criteria: SearchCriteria): Promise<PropertyListing[]> {
    console.log(`[IDEALISTA-APIFY] Searching with criteria:`, criteria);

    await this.respectRateLimit();

    try {
      // Use igolaizola/idealista-scraper - specialized actor for idealista.it
      const location = criteria.city === 'milano' ? 'Milano' : criteria.city;
      
      const input = {
        location: location, // City name or Idealista location ID
        maxItems: 100, // Limit results per zone
        propertyType: 'homes', // apartment/home type
        operation: 'sale', // vendita
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };

      console.log(`[IDEALISTA-APIFY] Input for igolaizola actor:`, JSON.stringify(input, null, 2));

      const run = await this.client.actor('igolaizola/idealista-scraper').call(input);
      
      // Retrieve run details and logs for debugging
      console.log(`[IDEALISTA-APIFY] Run ID: ${run.id}, Status: ${run.status}`);
      
      // Get full run details including statusDetails
      try {
        const runDetails = await this.client.run(run.id).get();
        console.log('[IDEALISTA-APIFY] Full run details:', JSON.stringify({
          status: runDetails?.status,
          statusMessage: runDetails?.statusMessage,
          failedRequestCount: runDetails?.failedRequestCount,
          finishedRequestsCount: runDetails?.finishedRequestsCount,
          startedAt: runDetails?.startedAt,
          finishedAt: runDetails?.finishedAt,
          statusDetails: runDetails?.statusDetails,
          exitCode: runDetails?.exitCode,
          defaultDatasetId: runDetails?.defaultDatasetId
        }, null, 2));
      } catch (detailsError) {
        console.log('[IDEALISTA-APIFY] Could not fetch run details:', detailsError.message);
      }
      
      // Retrieve logs using correct API
      if (run.logId) {
        try {
          const logText = await this.client.log(run.logId).get();
          if (logText) {
            const lines = logText.split('\n');
            const relevantLogs = lines.filter(line => 
              line.includes('Page URL:') || 
              line.includes('Page title:') || 
              line.includes('Testing selectors') ||
              line.includes('Selector') ||
              line.includes('found') ||
              line.includes('No items') ||
              line.includes('ERROR') ||
              line.includes('WARN') ||
              line.includes('Error') ||
              line.includes('Failed') ||
              line.includes('403') ||
              line.includes('CAPTCHA') ||
              line.includes('blocked')
            ).slice(0, 100); // First 100 relevant lines
            
            if (relevantLogs.length > 0) {
              console.log('[IDEALISTA-APIFY] Actor logs (filtered):');
              relevantLogs.forEach(line => console.log('  ' + line));
            } else {
              // Show last 30 lines if no relevant logs found
              console.log('[IDEALISTA-APIFY] Last 30 log lines:');
              lines.slice(-30).forEach(line => console.log('  ' + line));
            }
          }
        } catch (logError) {
          console.log('[IDEALISTA-APIFY] Could not fetch logs:', logError.message);
        }
      } else {
        console.log('[IDEALISTA-APIFY] No logId available in run object');
      }
      
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      console.log(`[IDEALISTA-APIFY] Dataset returned ${items.length} items`);
      if (items.length > 0) {
        console.log('[IDEALISTA-APIFY] First item structure:', JSON.stringify(items[0], null, 2));
      }

      // Transform igolaizola idealista-scraper results to PropertyListings
      const listings: PropertyListing[] = [];
      for (const item of items) {
        try {
          // igolaizola format for idealista
          const price = item.price || 0;
          const size = item.size || 0;
          const rooms = item.rooms;
          const address = item.address || '';
          const url = item.url || '';
          const propertyId = item.propertyCode || item.id || '';
          
          // Get contact/agency info
          const contact = item.contact || '';
          const isPrivate = contact.toLowerCase().includes('privat') || 
                          contact.toLowerCase().includes('propri') ||
                          contact.toLowerCase().includes('particular');
          
          if (url && price > 0) {
            listings.push({
              externalId: propertyId,
              title: item.title || item.description || `Appartamento - ${address}`,
              address: address,
              city: criteria.city || 'Milano',
              price: price,
              size: size,
              bedrooms: rooms,
              type: 'apartment',
              url: url,
              description: item.description || '',
              ownerType: isPrivate ? 'private' : 'agency',
              agencyName: isPrivate ? undefined : (contact || undefined)
            });
          }
        } catch (itemError) {
          console.error('[IDEALISTA-APIFY] Failed to transform item:', itemError);
        }
      }

      console.log(`[IDEALISTA-APIFY] Found ${listings.length} listings`);
      return listings;
    } catch (error) {
      console.error('[IDEALISTA-APIFY] Search failed:', error);
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
    // Apify is always available if API token is set
    return !!process.env.APIFY_API_TOKEN;
  }

  private buildSearchUrl(criteria: SearchCriteria): string {
    const parts: string[] = [IDEALISTA_BASE_URL];
    parts.push('vendita-case');
    
    if (criteria.city) {
      parts.push(criteria.city.toLowerCase().replace(/\s+/g, '-'));
    }
    
    // TEMPORARY: Skip zone until we implement locality-normalization
    // if (criteria.zone) {
    //   parts.push(criteria.zone.toLowerCase().replace(/\s+/g, '-'));
    // }

    let url = parts.join('/') + '/';
    
    const params = new URLSearchParams();
    if (criteria.maxPrice) {
      params.append('prezzoMassimo', criteria.maxPrice.toString());
    }
    if (criteria.minSize) {
      params.append('superficieMinima', criteria.minSize.toString());
    }
    if (criteria.bedrooms) {
      params.append('camere', criteria.bedrooms.toString());
    }

    const queryString = params.toString();
    if (queryString) {
      url += '?' + queryString;
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
