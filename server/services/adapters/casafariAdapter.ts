import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';
import type { FeedPayload, Data, Result } from 'casafari';

const CASAFARI_BASE_URL = 'https://app.casafari.com';

export class CasafariAdapter implements PortalAdapter {
  name = 'Casafari API';
  portalId = 'casafari';
  private client: any = null;
  private clientPromise: Promise<any> | null = null;
  private feedCache: Map<string, number> = new Map();

  private async getClient() {
    if (this.client) {
      return this.client;
    }
    
    if (!this.clientPromise) {
      this.clientPromise = this.initializeClient();
    }
    
    return this.clientPromise;
  }

  private async initializeClient() {
    const token = process.env.CASAFARI_API_TOKEN;
    if (!token) {
      throw new Error('[CASAFARI] CASAFARI_API_TOKEN not found - set environment variable');
    }
    
    // Dynamic import for CommonJS module
    const { default: casafari } = await import('casafari');
    this.client = casafari(`Token ${token}`);
    return this.client;
  }

  async search(criteria: SearchCriteria & { privateOnly?: boolean; sourceFilter?: string }): Promise<PropertyListing[]> {
    try {
      const client = await this.getClient();
      console.log('[CASAFARI] Searching with criteria:', criteria);

      // Create or get existing feed for this search
      const feedId = await this.getOrCreateFeed(criteria);
      
      // Paginate through all results
      const allListings: PropertyListing[] = [];
      let offset = 0;
      const batchSize = 100;
      let hasMore = true;

      while (hasMore) {
        const data: Data = await client.getFeed(feedId, {
          limit: batchSize,
          offset,
          order_by: 'alert_id'
        });

        console.log(`[CASAFARI] Batch ${offset / batchSize + 1}: ${data.results.length} listings (${data.count} total available)`);

        // Transform Casafari results to our PropertyListing format
        let batchListings: PropertyListing[] = data.results
          .filter(r => r.operations.includes('sale')) // Only sale listings
          .map(result => this.transformResult(result));

        // Additional client-side filters (if not supported by API)
        if (criteria.privateOnly) {
          const beforeFilter = batchListings.length;
          batchListings = batchListings.filter(listing => listing.ownerType === 'private');
          console.log(`[CASAFARI] Private filter: ${beforeFilter} → ${batchListings.length} listings`);
        }

        if (criteria.sourceFilter) {
          const beforeFilter = batchListings.length;
          const sourceFilter = criteria.sourceFilter.toLowerCase();
          batchListings = batchListings.filter(listing => 
            listing.url?.toLowerCase().includes(sourceFilter)
          );
          console.log(`[CASAFARI] Source filter (${criteria.sourceFilter}): ${beforeFilter} → ${batchListings.length} listings`);
        }

        allListings.push(...batchListings);

        // Check if we need to fetch more
        hasMore = data.results.length === batchSize && allListings.length < data.count;
        offset += batchSize;

        // Safety limit: max 500 results per zone to avoid excessive API calls
        if (allListings.length >= 500) {
          console.log(`[CASAFARI] Reached safety limit of 500 results for this zone`);
          break;
        }
      }

      console.log(`[CASAFARI] Total fetched: ${allListings.length} listings`);
      return allListings;
    } catch (error) {
      console.error('[CASAFARI] Search failed:', error);
      return [];
    }
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    // Casafari provides all details in the initial response
    return null;
  }

  async cleanup(): Promise<void> {
    // Delete all feeds created by this adapter to prevent accumulation
    try {
      const client = await this.getClient();
      
      // Get all feed IDs from cache
      const feedIds = Array.from(this.feedCache.values());
      
      console.log(`[CASAFARI] Cleaning up ${feedIds.length} temporary feeds`);
      
      // Delete each feed
      for (const feedId of feedIds) {
        try {
          await client.deleteFeed(feedId);
          console.log(`[CASAFARI] Deleted feed #${feedId}`);
        } catch (error) {
          console.warn(`[CASAFARI] Failed to delete feed #${feedId}:`, error);
        }
      }
      
      this.feedCache.clear();
    } catch (error) {
      console.error('[CASAFARI] Cleanup failed:', error);
      this.feedCache.clear();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getClient();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch user's saved properties from Casafari using Apify scraping
   */
  async getSavedProperties(): Promise<PropertyListing[]> {
    try {
      console.log('[CASAFARI] Fetching saved properties via Apify scraper...');
      
      // Use Apify to scrape Casafari saved properties page
      const { getApifyService } = await import('../apifyService');
      const apifyService = getApifyService();
      
      // Scrape Casafari saved properties
      // This would use a custom Apify actor or web scraper to get the saved list
      const savedProps = await this.scrapeCasafariSavedProperties(apifyService);
      
      console.log(`[CASAFARI] Found ${savedProps.length} saved properties via Apify`);
      return savedProps.slice(0, 100);

    } catch (error) {
      console.error('[CASAFARI] Error fetching saved properties:', error);
      return [];
    }
  }

  /**
   * Fetch user's saved searches/alerts from Casafari using Apify
   */
  async getAlerts(): Promise<any[]> {
    try {
      console.log('[CASAFARI] Fetching user alerts via Apify scraper...');
      
      const { getApifyService } = await import('../apifyService');
      const apifyService = getApifyService();
      
      // Scrape Casafari alerts/searches page
      const alerts = await this.scrapeCasafariAlerts(apifyService);
      
      console.log(`[CASAFARI] Found ${alerts.length} alerts via Apify`);
      return alerts.slice(0, 50);

    } catch (error) {
      console.error('[CASAFARI] Error fetching alerts:', error);
      return [];
    }
  }

  /**
   * Get properties matching an alert/saved search using Apify
   */
  async getAlertProperties(alertId: number): Promise<PropertyListing[]> {
    try {
      console.log(`[CASAFARI] Fetching properties for alert ${alertId} via Apify...`);

      const { getApifyService } = await import('../apifyService');
      const apifyService = getApifyService();
      
      // Scrape alert properties
      const props = await this.scrapeCasafariAlertProperties(apifyService, alertId);
      
      console.log(`[CASAFARI] Found ${props.length} properties for alert via Apify`);
      return props.slice(0, 100);

    } catch (error) {
      console.error(`[CASAFARI] Error fetching alert properties:`, error);
      return [];
    }
  }

  /**
   * Scrape Casafari saved properties using Apify web scraper
   */
  private async scrapeCasafariSavedProperties(apifyService: any): Promise<PropertyListing[]> {
    try {
      // Use a generic web scraper or Cheerio-based Apify actor
      // This scrapes the user's saved properties list from Casafari
      const input = {
        startUrls: [
          { url: 'https://app.casafari.com/my-properties' }
        ],
        pageFunction: `
          async function pageFunction(context) {
            const { $ } = context;
            const properties = [];
            
            // Parse saved properties from the page
            $('[data-test="saved-property"]').each((i, elem) => {
              const address = $(elem).find('[data-test="address"]').text();
              const price = $(elem).find('[data-test="price"]').text();
              const size = $(elem).find('[data-test="size"]').text();
              const bedrooms = $(elem).find('[data-test="bedrooms"]').text();
              const url = $(elem).find('a').attr('href');
              
              if (address) {
                properties.push({ address, price, size, bedrooms, url });
              }
            });
            
            return properties;
          }
        `,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        maxRequestsPerCrawl: 1,
        customData: {
          title: 'Casafari Saved Properties'
        }
      };

      // Run with timeout to avoid hanging
      const results = await Promise.race([
        this.runApifyWebScraper(apifyService, input),
        new Promise<PropertyListing[]>((_, reject) => 
          setTimeout(() => reject(new Error('Apify scraper timeout')), 60000)
        )
      ]);

      return results;
    } catch (error) {
      console.error('[CASAFARI-SCRAPER] Error scraping saved properties:', error);
      return [];
    }
  }

  /**
   * Scrape Casafari alerts/saved searches using Apify
   */
  private async scrapeCasafariAlerts(apifyService: any): Promise<any[]> {
    try {
      const input = {
        startUrls: [
          { url: 'https://app.casafari.com/my-searches' }
        ],
        pageFunction: `
          async function pageFunction(context) {
            const { $ } = context;
            const alerts = [];
            
            $('[data-test="saved-search"]').each((i, elem) => {
              const name = $(elem).find('[data-test="name"]').text();
              const criteria = $(elem).find('[data-test="criteria"]').text();
              const propertyCount = $(elem).find('[data-test="count"]').text();
              const url = $(elem).find('a').attr('href');
              
              if (name) {
                alerts.push({ name, criteria, propertyCount, url, id: i });
              }
            });
            
            return alerts;
          }
        `,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        maxRequestsPerCrawl: 1
      };

      const results = await Promise.race([
        this.runApifyWebScraper(apifyService, input),
        new Promise<any[]>((_, reject) => 
          setTimeout(() => reject(new Error('Apify alerts scraper timeout')), 60000)
        )
      ]);

      return results;
    } catch (error) {
      console.error('[CASAFARI-SCRAPER] Error scraping alerts:', error);
      return [];
    }
  }

  /**
   * Scrape properties for a specific alert using Apify
   */
  private async scrapeCasafariAlertProperties(apifyService: any, alertId: number): Promise<PropertyListing[]> {
    try {
      const input = {
        startUrls: [
          { url: `https://app.casafari.com/my-searches/${alertId}` }
        ],
        pageFunction: `
          async function pageFunction(context) {
            const { $ } = context;
            const properties = [];
            
            $('[data-test="property-card"]').each((i, elem) => {
              const address = $(elem).find('[data-test="address"]').text();
              const price = $(elem).find('[data-test="price"]').text();
              const size = $(elem).find('[data-test="size"]').text();
              const bedrooms = $(elem).find('[data-test="bedrooms"]').text();
              const url = $(elem).find('a').attr('href');
              
              if (address) {
                properties.push({ address, price, size, bedrooms, url });
              }
            });
            
            return properties;
          }
        `,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        maxRequestsPerCrawl: 1
      };

      const results = await Promise.race([
        this.runApifyWebScraper(apifyService, input),
        new Promise<PropertyListing[]>((_, reject) => 
          setTimeout(() => reject(new Error('Apify alert properties scraper timeout')), 60000)
        )
      ]);

      return results;
    } catch (error) {
      console.error('[CASAFARI-SCRAPER] Error scraping alert properties:', error);
      return [];
    }
  }

  /**
   * Generic Apify web scraper runner
   */
  private async runApifyWebScraper(apifyService: any, input: any): Promise<PropertyListing[]> {
    try {
      // Use a generic web scraper actor or Cheerio actor
      const actorId = 'apify/web-scraper'; // or any web scraper actor
      
      const run = await apifyService.client.actor(actorId).call(input);
      const { items } = await apifyService.client.dataset(run.defaultDatasetId).listItems({ limit: 100 });
      
      console.log(`[CASAFARI-SCRAPER] Scraped ${items.length} items from Casafari`);
      
      return items
        .filter((item: any) => item.address)
        .map((item: any) => ({
          externalId: `casafari-${item.url}`,
          title: item.address,
          address: item.address,
          city: 'Milano',
          price: parseInt(item.price?.replace(/\D/g, '')) || 0,
          size: parseInt(item.size?.replace(/\D/g, '')) || 0,
          bedrooms: parseInt(item.bedrooms?.replace(/\D/g, '')) || undefined,
          type: 'apartment',
          url: item.url,
          description: `${item.address} - ${item.price} - ${item.size}`,
          ownerType: 'agency' as const
        }));
    } catch (error) {
      console.error('[CASAFARI-SCRAPER] Web scraper error:', error);
      return [];
    }
  }

  private async getOrCreateFeed(criteria: SearchCriteria & { privateOnly?: boolean }): Promise<number> {
    const client = await this.getClient();

    // Generate a cache key from search criteria
    const cacheKey = this.getCacheKey(criteria);
    
    // Check if we already have a feed for this search
    if (this.feedCache.has(cacheKey)) {
      console.log(`[CASAFARI] Reusing cached feed for ${criteria.zone || criteria.city}`);
      return this.feedCache.get(cacheKey)!;
    }

    // NOTE: Casafari API limitation - custom_locations not supported in current SDK version
    // The API returns 400 errors when trying to use geographic filters
    // This means we get results from all of Italy, not just specific Milano zones
    // Future improvement: investigate Casafari location_ids or upgrade to newer API version
    
    // Create new feed
    const feedPayload: FeedPayload = {
      name: `Auto: ${criteria.city} ${criteria.zone || ''} (${criteria.propertyType || 'any'})${criteria.privateOnly ? ' [PRIVATE ONLY]' : ''}`,
      filter: {
        operation: 'sale',
        types: [criteria.propertyType === 'house' ? 'house' : 'apartment'],
        ...(criteria.maxPrice && { price_to: criteria.maxPrice }),
        ...(criteria.minPrice && { price_from: criteria.minPrice }),
        ...(criteria.minSize && { total_area_from: criteria.minSize }),
        ...(criteria.maxSize && { total_area_to: criteria.maxSize }),
        ...(criteria.bedrooms && { bedrooms_from: criteria.bedrooms }),
        // Add private seller filter if requested
        ...(criteria.privateOnly && { is_private_property: true })
        // Geographic filtering not available - searches all of Italy
      }
    };

    console.log(`[CASAFARI] Creating feed for ${criteria.zone || criteria.city}${criteria.privateOnly ? ' (PRIVATE ONLY)' : ''} (no geographic filter available)`);
    const feed = await client.createFeed(feedPayload);
    console.log(`[CASAFARI] Created feed #${feed.id}: ${feed.name}`);

    // Cache the feed ID
    this.feedCache.set(cacheKey, feed.id);

    return feed.id;
  }

  private getCacheKey(criteria: SearchCriteria & { privateOnly?: boolean; sourceFilter?: string }): string {
    return JSON.stringify({
      city: criteria.city,
      zone: criteria.zone,
      type: criteria.propertyType,
      priceMin: criteria.minPrice,
      priceMax: criteria.maxPrice,
      sizeMin: criteria.minSize,
      sizeMax: criteria.maxSize,
      bedrooms: criteria.bedrooms,
      privateOnly: criteria.privateOnly,
      sourceFilter: criteria.sourceFilter
    });
  }

  private transformResult(result: Result): PropertyListing {
    return {
      externalId: `casafari-${result.listing_id}`,
      title: `${result.type} - ${result.address}`,
      address: result.address,
      city: result.location.name,
      price: result.sale_price || 0,
      size: result.total_area || result.living_area || 0,
      bedrooms: result.bedrooms || undefined,
      type: this.mapPropertyType(result.type),
      url: result.property_url || result.listing_url,
      description: result.description || `${result.type} in ${result.location.name}`,
      ownerType: result.is_private_property ? 'private' : 'agency',
      imageUrls: result.pictures?.length > 0 ? result.pictures : (result.thumbnails || undefined),
      agencyName: result.agency || undefined,
      floor: result.features?.floor || undefined,
      bathrooms: result.bathrooms || undefined
    };
  }

  private mapPropertyType(casafariType: string): 'apartment' | 'house' | 'land' | 'commercial' | 'other' {
    const type = casafariType.toLowerCase();
    if (['apartment', 'studio', 'duplex', 'penthouse'].includes(type)) {
      return 'apartment';
    }
    if (['house', 'villa', 'townhouse', 'country_house', 'chalet', 'bungalow'].includes(type)) {
      return 'house';
    }
    if (['plot', 'country_estate'].includes(type)) {
      return 'land';
    }
    if (['retail', 'office', 'industrial', 'warehouse', 'hotel', 'building'].includes(type)) {
      return 'commercial';
    }
    return 'other';
  }

  private extractFeatures(result: Result): string[] {
    const features: string[] = [];
    
    if (result.features?.characteristics) {
      features.push(...result.features.characteristics);
    }
    
    if (result.is_new_development_property) {
      features.push('new_development');
    }
    
    if (result.features?.views && result.features.views.length > 0) {
      features.push(...result.features.views.map(v => `view_${v}`));
    }
    
    return features;
  }
}
