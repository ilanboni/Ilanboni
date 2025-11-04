import { ApifyClient } from 'apify-client';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

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
    const searchUrl = this.buildSearchUrl(criteria);
    console.log(`[IMMOBILIARE-APIFY] Searching: ${searchUrl}`);

    await this.respectRateLimit();

    try {
      // Use Apify Web Scraper to bypass anti-bot
      const input = {
        startUrls: [{ url: searchUrl }],
        globs: [{ glob: searchUrl }],
        pageFunction: `async function pageFunction(context) {
          const { request, log, jQuery } = context;
          const $ = jQuery;
          
          const listings = [];
          
          // Extract listings from Immobiliare.it search results
          // Try multiple selectors for compatibility
          const selectors = [
            'li.in-realEstateResults__item',
            'article.in-card',
            'div.in-searchList__item',
            'li.in-card'
          ];
          
          let $items = $();
          for (const selector of selectors) {
            $items = $(selector);
            if ($items.length > 0) {
              log.info(\`Found \${$items.length} items with selector: \${selector}\`);
              break;
            }
          }
          
          $items.each((i, el) => {
            const $el = $(el);
            const id = $el.attr('data-id') || $el.attr('id') || String(Date.now() + i);
            const $link = $el.find('a[href*="/annunci/"]').first();
            const href = $link.attr('href');
            const title = $link.attr('title') || $el.find('.in-card__title, h2').text().trim();
            const address = $el.find('.in-realEstateListCard__location, .in-card__location').text().trim();
            const priceText = $el.find('.in-realEstateListCard__price, .in-card__price').text().trim();
            const detailsText = $el.text();
            
            // Extract agency name - try multiple selectors
            let agency = $el.find('.in-realEstateListCard__agency, .in-card__agency, .in-agencyInfo__name, [class*="agency"]').first().text().trim();
            // Also check for portal label (e.g., "immobiliare.it - Agency Name")
            if (!agency) {
              const portalMatch = title.match(/immobiliare\\.it\\s*-\\s*(.+?)$/i);
              if (portalMatch) {
                agency = portalMatch[1].trim();
              }
            }
            
            // Extract price
            const priceMatch = priceText.match(/([\\d\\.]+)/);
            const price = priceMatch ? parseInt(priceMatch[1].replace(/\\./g, '')) : 0;
            
            // Extract size
            const sizeMatch = detailsText.match(/(\\d+)\\s*m²/);
            const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
            
            // Extract bedrooms
            const roomsMatch = detailsText.match(/(\\d+)\\s*local/i);
            const bedrooms = roomsMatch ? parseInt(roomsMatch[1]) : undefined;
            
            if (href) {
              listings.push({
                id,
                url: href.startsWith('http') ? href : '${IMMOBILIARE_BASE_URL}' + href,
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
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      // Transform Apify results to PropertyListings
      const listings: PropertyListing[] = [];
      for (const item of items) {
        if (Array.isArray(item)) {
          for (const listing of item) {
            if (listing.url) {
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
                ownerType: 'agency',
                agencyName: listing.agency || undefined
              });
            }
          }
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
