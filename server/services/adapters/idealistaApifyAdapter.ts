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
    const searchUrl = this.buildSearchUrl(criteria);
    console.log(`[IDEALISTA-APIFY] Searching: ${searchUrl}`);

    await this.respectRateLimit();

    try {
      // Use Apify Web Scraper with Chrome to render JavaScript
      const input = {
        startUrls: [{ url: searchUrl }],
        globs: [{ glob: searchUrl }],
        useChrome: true,
        waitUntil: ['networkidle'],
        pageFunction: `async function pageFunction(context) {
          const { request, log, jQuery } = context;
          const $ = jQuery;
          
          // DEBUG: Log page info
          log.info('Page URL: ' + request.url);
          log.info('Page title: ' + $('title').text());
          log.info('Body length: ' + $('body').html().length);
          
          // Try to find any listing-like elements
          const possibleSelectors = [
            'article.item',
            'article[data-adid]',
            '[class*="item"]',
            '[class*="card"]',
            'article',
            'li[data-adid]'
          ];
          
          log.info('Testing selectors...');
          for (const sel of possibleSelectors) {
            const count = $(sel).length;
            if (count > 0) {
              log.info(\`Selector "\${sel}" found \${count} elements\`);
            }
          }
          
          const listings = [];
          
          const $items = $('article.item');
          if ($items.length === 0) {
            log.warning('No items found with selector article.item!');
            log.info('Sample HTML: ' + $('body').html().substring(0, 1000));
          } else {
            log.info(\`Found \${$items.length} items with selector article.item\`);
          }
          
          // Extract listings from Idealista search results
          $items.each((i, el) => {
            const $el = $(el);
            const id = $el.attr('data-adid');
            const href = $el.find('a.item-link').attr('href');
            const title = $el.find('a.item-link').text().trim();
            const address = $el.find('span.item-detail').first().text().trim();
            const priceText = $el.find('span.item-price').text().trim();
            const detailsText = $el.text();
            
            // Extract agency name - try multiple selectors
            let agency = $el.find('.item-advertiser, .advertiser-name, .item-agency, [class*="agency"]').first().text().trim();
            // Fallback: check for "Privato" or "Agenzia" in text
            if (!agency) {
              if (detailsText.includes('Privato')) {
                agency = 'Privato';
              }
            }
            
            // Extract price
            const priceMatch = priceText.match(/([\\d\\.]+)/);
            const price = priceMatch ? parseInt(priceMatch[1].replace(/\\./g, '')) : 0;
            
            // Extract size
            const sizeMatch = detailsText.match(/(\\d+)\\s*m²/);
            const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
            
            // Extract bedrooms
            const roomsMatch = detailsText.match(/(\\d+)\\s*locale/i);
            const bedrooms = roomsMatch ? parseInt(roomsMatch[1]) : undefined;
            
            if (id && href) {
              listings.push({
                id,
                url: href.startsWith('http') ? href : '${IDEALISTA_BASE_URL}' + href,
                title,
                address,
                price,
                size,
                bedrooms,
                agency: agency || undefined
              });
            }
          });
          
          return listings;
        }`,
        proxyConfiguration: {
          useApifyProxy: true
        },
        maxRequestsPerCrawl: 1,
        maxConcurrency: 1
      };

      const run = await this.client.actor('apify/web-scraper').call(input);
      
      // Retrieve run logs for debugging
      console.log(`[IDEALISTA-APIFY] Run ID: ${run.id}, Status: ${run.status}`);
      try {
        const logText = await this.client.run(run.id).log().get();
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
            line.includes('Failed')
          ).slice(0, 100); // First 100 relevant lines
          
          if (relevantLogs.length > 0) {
            console.log('[IDEALISTA-APIFY] Actor logs:');
            relevantLogs.forEach(line => console.log('  ' + line));
          } else {
            // Show last 20 lines if no relevant logs found
            console.log('[IDEALISTA-APIFY] Last 20 log lines:');
            lines.slice(-20).forEach(line => console.log('  ' + line));
          }
        }
      } catch (logError) {
        console.log('[IDEALISTA-APIFY] Could not fetch logs:', logError.message);
      }
      
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      console.log(`[IDEALISTA-APIFY] Dataset returned ${items.length} items`);
      if (items.length > 0) {
        console.log('[IDEALISTA-APIFY] First item structure:', JSON.stringify(items[0], null, 2));
      }

      // Transform Apify results to PropertyListings
      const listings: PropertyListing[] = [];
      for (const item of items) {
        // Extract listings from pageFunctionResult (Apify Web Scraper format)
        const results = item.pageFunctionResult || item;
        console.log(`[IDEALISTA-APIFY] Results type: ${Array.isArray(results) ? 'array' : typeof results}, length: ${Array.isArray(results) ? results.length : 'N/A'}`);
        if (Array.isArray(results)) {
          for (const listing of results) {
            if (listing.id) {
              // Detect owner type: private vs agency
              const isPrivate = listing.agency && (
                listing.agency.toLowerCase().includes('privat') ||
                listing.agency.toLowerCase().includes('propri')
              );
              
              listings.push({
                externalId: listing.id,
                title: listing.title || 'Appartamento',
                address: listing.address || '',
                city: 'Milano',
                price: listing.price || 0,
                size: listing.size || 0,
                bedrooms: listing.bedrooms,
                type: 'apartment',
                url: listing.url,
                description: listing.title || '',
                ownerType: isPrivate ? 'private' : 'agency',
                agencyName: listing.agency || undefined
              });
            }
          }
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
