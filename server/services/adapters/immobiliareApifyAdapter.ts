import { ApifyClient } from 'apify-client';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';
import { classifyFromApifyImmobiliare } from '../../lib/ownerClassification';

const IMMOBILIARE_BASE_URL = 'https://www.immobiliare.it';
const REQUEST_DELAY_MS = 5000; // Apify needs time to complete

export class ImmobiliareApifyAdapter implements PortalAdapter {
  name = 'Immobiliare.it (Apify)';
  portalId = 'immobiliare';
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
    console.log(`[IMMOBILIARE-APIFY] Searching with criteria:`, criteria);

    await this.respectRateLimit();

    try {
      // Use igolaizola/immobiliare-it-scraper - specialized actor for immobiliare.it
      // Province must be 2-letter code (e.g., MI for Milano, RM for Roma)
      const provinceCode = criteria.city === 'milano' ? 'MI' : '';
      
      // Map property types: our format → actor format
      // Actor accepts: "", "apartment", "house", "commercialProperty", "land"
      const propertyTypeMap: Record<string, string> = {
        'apartment': 'apartment',
        'house': 'house',
        'villa': 'house',
        'commercial': 'commercialProperty',
        'land': 'land'
      };
      const actorPropertyType = propertyTypeMap[criteria.propertyType || 'apartment'] || 'apartment';
      
      const input = {
        province: provinceCode,
        municipality: criteria.city === 'milano' ? 'Milano' : criteria.city,
        maxItems: 2000, // Increased from 100 to capture more listings
        propertyType: actorPropertyType,
        operation: 'buy', // buy = vendita ("sale" is invalid)
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };

      // Add price filter if specified
      if (criteria.maxPrice) {
        input['maxPrice'] = criteria.maxPrice;
      }

      // Add size filter if specified
      if (criteria.minSize) {
        input['minSurface'] = criteria.minSize;
      }

      console.log(`[IMMOBILIARE-APIFY] Input for igolaizola actor:`, JSON.stringify(input, null, 2));

      const run = await this.client.actor('igolaizola/immobiliare-it-scraper').call(input);
      
      // Retrieve run details and logs for debugging
      console.log(`[IMMOBILIARE-APIFY] Run ID: ${run.id}, Status: ${run.status}`);
      
      // Get full run details including statusDetails
      try {
        const runDetails = await this.client.run(run.id).get();
        console.log('[IMMOBILIARE-APIFY] Full run details:', JSON.stringify({
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
        console.log('[IMMOBILIARE-APIFY] Could not fetch run details:', detailsError.message);
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
              console.log('[IMMOBILIARE-APIFY] Actor logs (filtered):');
              relevantLogs.forEach(line => console.log('  ' + line));
            } else {
              // Show last 30 lines if no relevant logs found
              console.log('[IMMOBILIARE-APIFY] Last 30 log lines:');
              lines.slice(-30).forEach(line => console.log('  ' + line));
            }
          }
        } catch (logError) {
          console.log('[IMMOBILIARE-APIFY] Could not fetch logs:', logError.message);
        }
      } else {
        console.log('[IMMOBILIARE-APIFY] No logId available in run object');
      }
      
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      console.log(`[IMMOBILIARE-APIFY] Dataset returned ${items.length} items`);
      if (items.length > 0) {
        console.log('[IMMOBILIARE-APIFY] First item structure:', JSON.stringify(items[0], null, 2));
      }

      // Transform igolaizola immobiliare-it-scraper results to PropertyListings
      const listings: PropertyListing[] = [];
      for (const item of items) {
        try {
          // igolaizola format: direct object with analytics, topology, geography, price, etc.
          // Price is in price.raw (number) or price.value (formatted string)
          const priceRaw = item.price?.raw || item.analytics?.price || 0;
          const price = typeof priceRaw === 'number' ? priceRaw : parseInt(String(priceRaw).replace(/[^\d]/g, ''), 10) || 0;
          
          // Surface is in topology.surface.size (number)
          const surface = item.topology?.surface?.size || item.topology?.surface || item.surface || 0;
          const rooms = item.topology?.rooms || item.rooms;
          
          // Address from geography.street or geography.macrozone/microzone
          const street = item.geography?.street || '';
          const zipcode = item.geography?.zipcode || '';
          const macrozone = item.geography?.macrozone?.name || '';
          const microzone = item.geography?.microzone?.name || '';
          const address = street || `${microzone}, ${macrozone}`.replace(/^, |, $/g, '') || zipcode;
          
          // Property ID and URL construction
          const propertyId = String(item.id || item.propertyId || '');
          // Build URL from ID: https://www.immobiliare.it/annunci/ID/
          const url = propertyId ? `https://www.immobiliare.it/annunci/${propertyId}/` : '';
          
          // Extract GPS coordinates from geography.geolocation (igolaizola format)
          const rawLat = item.geography?.geolocation?.latitude || item.geography?.location?.latitude || item.geography?.lat || item.lat;
          const rawLng = item.geography?.geolocation?.longitude || item.geography?.location?.longitude || item.geography?.lng || item.lng || item.geography?.lon || item.lon;
          
          // Convert to number safely
          const latitude = rawLat ? (typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat))) : undefined;
          const longitude = rawLng ? (typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng))) : undefined;
          
          // Classify owner type using shared helper
          const classification = classifyFromApifyImmobiliare(item);
          
          // Log classification for debugging (only for private or low confidence)
          if (classification.ownerType === 'private' || classification.confidence !== 'high') {
            console.log(`[IMMOBILIARE-CLASSIFY] ID ${propertyId}: ${classification.ownerType} (${classification.confidence}) - ${classification.reasoning}`);
          }
          
          if (propertyId && price > 0) {
            listings.push({
              externalId: propertyId,
              title: item.title || `${item.topology?.typology?.name || 'Appartamento'} - ${address}`,
              address: address,
              city: criteria.city || 'Milano',
              price: price,
              size: surface,
              bedrooms: rooms,
              type: 'apartment',
              url: url,
              description: item.description || '',
              latitude: latitude && !isNaN(latitude) ? latitude : undefined,
              longitude: longitude && !isNaN(longitude) ? longitude : undefined,
              ownerType: classification.ownerType,
              agencyName: classification.agencyName || undefined
            });
          }
        } catch (itemError) {
          console.error('[IMMOBILIARE-APIFY] Failed to transform item:', itemError);
        }
      }

      console.log(`[IMMOBILIARE-APIFY] Found ${listings.length} listings`);
      return listings;
    } catch (error) {
      console.error('[IMMOBILIARE-APIFY] Search failed:', error);
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
    const parts: string[] = [IMMOBILIARE_BASE_URL];
    
    parts.push('vendita-case');
    
    if (criteria.city) {
      parts.push(criteria.city.toLowerCase().replace(/\s+/g, '-'));
    }
    
    // TEMPORARY: Skip zone until we implement locality-normalization
    // if (criteria.zone) {
    //   parts.push(criteria.zone.toLowerCase().replace(/\s+/g, '-'));
    // }

    let url = parts.join('/') + '/';
    
    const params: string[] = [];
    
    if (criteria.minPrice) {
      params.push(`prezzoMinimo=${criteria.minPrice}`);
    }
    if (criteria.maxPrice) {
      params.push(`prezzoMassimo=${criteria.maxPrice}`);
    }
    if (criteria.minSize) {
      params.push(`superficieMinima=${criteria.minSize}`);
    }
    if (criteria.maxSize) {
      params.push(`superficieMassima=${criteria.maxSize}`);
    }
    if (criteria.bedrooms) {
      params.push(`locali=${criteria.bedrooms}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
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
