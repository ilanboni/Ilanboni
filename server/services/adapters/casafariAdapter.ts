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
   * Fetch user's saved properties from Casafari using Apify scraping + auth
   */
  async getSavedProperties(): Promise<PropertyListing[]> {
    try {
      console.log('[CASAFARI] Fetching saved properties via Apify scraper with authentication...');
      
      const { getApifyService } = await import('../apifyService');
      const apifyService = getApifyService();
      
      // Get auth cookies first
      const cookies = await this.loginAndGetCookies();
      if (!cookies || cookies.length === 0) {
        console.warn('[CASAFARI] Failed to authenticate, cannot scrape saved properties');
        return [];
      }
      
      console.log(`[CASAFARI] Successfully authenticated, got ${cookies.length} cookies`);
      
      // Scrape Casafari saved properties with authentication
      const savedProps = await this.scrapeCasafariSavedProperties(apifyService, cookies);
      
      console.log(`[CASAFARI] Found ${savedProps.length} saved properties via Apify`);
      return savedProps.slice(0, 100);

    } catch (error) {
      console.error('[CASAFARI] Error fetching saved properties:', error);
      return [];
    }
  }

  /**
   * Fetch user's saved searches/alerts from Casafari using Apify with auth
   */
  async getAlerts(): Promise<any[]> {
    try {
      console.log('[CASAFARI] Fetching user alerts via Apify scraper with authentication...');
      
      const { getApifyService } = await import('../apifyService');
      const apifyService = getApifyService();
      
      // Get auth cookies first
      const cookies = await this.loginAndGetCookies();
      if (!cookies || cookies.length === 0) {
        console.warn('[CASAFARI] Failed to authenticate, cannot scrape alerts');
        return [];
      }
      
      // Scrape Casafari alerts/searches page with authentication
      const alerts = await this.scrapeCasafariAlerts(apifyService, cookies);
      
      console.log(`[CASAFARI] Found ${alerts.length} alerts via Apify`);
      return alerts.slice(0, 50);

    } catch (error) {
      console.error('[CASAFARI] Error fetching alerts:', error);
      return [];
    }
  }

  /**
   * Get properties matching an alert/saved search using Apify with auth
   */
  async getAlertProperties(alertId: number): Promise<PropertyListing[]> {
    try {
      console.log(`[CASAFARI] Fetching properties for alert ${alertId} via Apify with authentication...`);

      const { getApifyService } = await import('../apifyService');
      const apifyService = getApifyService();
      
      // Get auth cookies first
      const cookies = await this.loginAndGetCookies();
      if (!cookies || cookies.length === 0) {
        console.warn('[CASAFARI] Failed to authenticate, cannot scrape alert properties');
        return [];
      }
      
      // Scrape alert properties with authentication
      const props = await this.scrapeCasafariAlertProperties(apifyService, alertId, cookies);
      
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
  private async scrapeCasafariSavedProperties(apifyService: any, cookies: string): Promise<PropertyListing[]> {
    try {
      // Use a generic web scraper or Cheerio-based Apify actor
      // This scrapes the user's saved properties list from Casafari with authentication
      const input = {
        startUrls: [
          { url: 'https://app.casafari.com/my-properties' }
        ],
        pageFunction: `
          async function pageFunction(context) {
            const { $ } = context;
            const properties = [];
            
            // Parse saved properties from the page - try multiple selectors
            const propertyElements = $('[class*="property"]').length > 0 
              ? $('[class*="property"]') 
              : $('[class*="item"]');
            
            propertyElements.each((i, elem) => {
              const $elem = $(elem);
              const address = $elem.find('[class*="address"]').text() || $elem.find('h3').text() || $elem.text().split('\\n')[0];
              const priceText = $elem.find('[class*="price"]').text() || '';
              const sizeText = $elem.find('[class*="size"]').text() || '';
              const bedroomsText = $elem.find('[class*="bed"]').text() || '';
              const url = $elem.find('a').attr('href') || '';
              
              if (address && address.trim().length > 5) {
                properties.push({ address: address.trim(), price: priceText, size: sizeText, bedrooms: bedroomsText, url });
              }
            });
            
            console.log('Scraped properties count:', properties.length);
            return properties;
          }
        `,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        headerParameters: {
          'Cookie': '${cookies}'
        },
        maxRequestsPerCrawl: 1,
        customData: {
          title: 'Casafari Saved Properties'
        }
      };

      // Run with timeout to avoid hanging
      const results = await Promise.race([
        this.runApifyWebScraper(apifyService, input, cookies),
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
   * Scrape Casafari alerts/saved searches using Apify with auth
   */
  private async scrapeCasafariAlerts(apifyService: any, cookies: string): Promise<any[]> {
    try {
      const input = {
        startUrls: [
          { url: 'https://app.casafari.com/my-searches' }
        ],
        pageFunction: `
          async function pageFunction(context) {
            const { $ } = context;
            const alerts = [];
            
            // Try multiple selectors for saved searches
            const searchElements = $('[class*="search"]').length > 0 
              ? $('[class*="search"]') 
              : $('[class*="alert"]');
            
            searchElements.each((i, elem) => {
              const $elem = $(elem);
              const name = $elem.find('[class*="name"]').text() || $elem.find('h3').text() || '';
              const criteria = $elem.find('[class*="criteria"]').text() || '';
              const propertyCount = $elem.find('[class*="count"]').text() || '';
              const url = $elem.find('a').attr('href') || '';
              
              if (name && name.trim().length > 0) {
                alerts.push({ name: name.trim(), criteria, propertyCount, url, id: i });
              }
            });
            
            return alerts;
          }
        `,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        headerParameters: {
          'Cookie': '${cookies}'
        },
        maxRequestsPerCrawl: 1
      };

      const results = await Promise.race([
        this.runApifyWebScraper(apifyService, input, cookies),
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
   * Scrape properties for a specific alert using Apify with auth
   */
  private async scrapeCasafariAlertProperties(apifyService: any, alertId: number, cookies: string): Promise<PropertyListing[]> {
    try {
      const input = {
        startUrls: [
          { url: `https://app.casafari.com/my-searches/${alertId}` }
        ],
        pageFunction: `
          async function pageFunction(context) {
            const { $ } = context;
            const properties = [];
            
            // Try multiple selectors for property cards
            const propertyElements = $('[class*="property"]').length > 0 
              ? $('[class*="property"]') 
              : $('[class*="card"]');
            
            propertyElements.each((i, elem) => {
              const $elem = $(elem);
              const address = $elem.find('[class*="address"]').text() || $elem.find('h3').text() || '';
              const priceText = $elem.find('[class*="price"]').text() || '';
              const sizeText = $elem.find('[class*="size"]').text() || '';
              const bedroomsText = $elem.find('[class*="bed"]').text() || '';
              const url = $elem.find('a').attr('href') || '';
              
              if (address && address.trim().length > 5) {
                properties.push({ address: address.trim(), price: priceText, size: sizeText, bedrooms: bedroomsText, url });
              }
            });
            
            return properties;
          }
        `,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        headerParameters: {
          'Cookie': '${cookies}'
        },
        maxRequestsPerCrawl: 1
      };

      const results = await Promise.race([
        this.runApifyWebScraper(apifyService, input, cookies),
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
   * Generic Apify web scraper runner with cookies support
   */
  private async runApifyWebScraper(apifyService: any, input: any, cookies?: string): Promise<PropertyListing[]> {
    try {
      // Use a generic web scraper actor or Cheerio actor
      const actorId = 'apify/web-scraper';
      
      // Add cookies to input if provided
      if (cookies) {
        input.headerParameters = input.headerParameters || {};
        input.headerParameters['Cookie'] = cookies;
      }
      
      console.log(`[CASAFARI-SCRAPER] Calling Apify with cookies: ${cookies ? 'YES' : 'NO'}`);
      
      const run = await apifyService.client.actor(actorId).call(input);
      const { items } = await apifyService.client.dataset(run.defaultDatasetId).listItems({ limit: 100 });
      
      console.log(`[CASAFARI-SCRAPER] Scraped ${items.length} items from Casafari`);
      
      return items
        .filter((item: any) => item.address && item.address.trim().length > 0)
        .map((item: any) => ({
          externalId: `casafari-${item.url || item.address}`,
          title: item.address,
          address: item.address,
          city: 'Milano',
          price: parseInt(item.price?.replace(/\D/g, '')) || 0,
          size: parseInt(item.size?.replace(/\D/g, '')) || 0,
          bedrooms: parseInt(item.bedrooms?.replace(/\D/g, '')) || undefined,
          type: 'apartment',
          url: item.url || '',
          description: `${item.address}${item.price ? ' - ' + item.price : ''}${item.size ? ' - ' + item.size : ''}`,
          ownerType: 'agency' as const
        }));
    } catch (error) {
      console.error('[CASAFARI-SCRAPER] Web scraper error:', error);
      return [];
    }
  }

  /**
   * Login to Casafari and get authentication cookies using Playwright
   */
  private async loginAndGetCookies(): Promise<string> {
    try {
      console.log('[CASAFARI-LOGIN] Attempting login with Playwright...');
      
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      try {
        const username = process.env.CASAFARI_USERNAME;
        const password = process.env.CASAFARI_PASSWORD;

        if (!username || !password) {
          throw new Error('CASAFARI_USERNAME or CASAFARI_PASSWORD not configured');
        }

        // Navigate to login page
        console.log('[CASAFARI-LOGIN] Navigating to login page...');
        await page.goto('https://app.casafari.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Fill login form
        console.log('[CASAFARI-LOGIN] Filling login credentials...');
        await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', username);
        await page.fill('input[type="password"], input[name="password"], input[placeholder*="password" i]', password);

        // Click login button
        console.log('[CASAFARI-LOGIN] Clicking login button...');
        await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Accedi")');

        // Wait for navigation - wait until we're on the main app page
        console.log('[CASAFARI-LOGIN] Waiting for login to complete...');
        await page.waitForURL((url: URL) => !url.toString().includes('/login'), { timeout: 30000 });

        // Extract cookies
        const cookies = await page.context().cookies();
        const cookieString = cookies
          .map((c: any) => `${c.name}=${c.value}`)
          .join('; ');

        console.log(`[CASAFARI-LOGIN] ✅ Login successful! Extracted ${cookies.length} cookies`);
        console.log(`[CASAFARI-LOGIN] Cookie names: ${cookies.map((c: any) => c.name).join(', ')}`);

        return cookieString;
      } finally {
        await page.close();
        await browser.close();
      }
    } catch (error) {
      console.error('[CASAFARI-LOGIN] Login failed:', error instanceof Error ? error.message : error);
      return '';
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
