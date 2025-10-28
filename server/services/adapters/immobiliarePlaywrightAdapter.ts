import { chromium, Browser, Page } from 'playwright';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

const IMMOBILIARE_BASE_URL = 'https://www.immobiliare.it';
const REQUEST_DELAY_MS = 3000;
const PAGE_TIMEOUT = 30000;

export class ImmobiliarePlaywrightAdapter implements PortalAdapter {
  name = 'Immobiliare.it (Playwright)';
  portalId = 'immobiliare';
  private lastRequestTime = 0;
  private browser: Browser | null = null;

  async search(criteria: SearchCriteria): Promise<PropertyListing[]> {
    const searchUrl = this.buildSearchUrl(criteria);
    console.log(`[IMMOBILIARE-PW] Searching: ${searchUrl}`);

    await this.respectRateLimit();

    let page: Page | null = null;
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_TIMEOUT
      });

      await page.waitForTimeout(2000);

      const acceptCookies = page.locator('button:has-text("Accetta")').first();
      if (await acceptCookies.count() > 0) {
        await acceptCookies.click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      const listings = await this.extractListings(page);
      console.log(`[IMMOBILIARE-PW] Found ${listings.length} listings`);

      return listings;
    } catch (error) {
      console.error('[IMMOBILIARE-PW] Search failed:', error);
      return [];
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    return null;
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }
      const page = await this.browser.newPage();
      await page.goto(IMMOBILIARE_BASE_URL, { timeout: 10000 });
      const title = await page.title();
      await page.close();
      return title.includes('Immobiliare');
    } catch (error) {
      console.error('[IMMOBILIARE-PW] Availability check failed:', error);
      return false;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private buildSearchUrl(criteria: SearchCriteria): string {
    const parts: string[] = [IMMOBILIARE_BASE_URL];
    
    parts.push('vendita-case');
    
    if (criteria.city) {
      parts.push(criteria.city.toLowerCase().replace(/\s+/g, '-'));
    }
    
    if (criteria.zone) {
      parts.push(criteria.zone.toLowerCase().replace(/\s+/g, '-'));
    }

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

  private async extractListings(page: Page): Promise<PropertyListing[]> {
    const listings: PropertyListing[] = [];

    try {
      await page.waitForSelector('li.in-realEstateResults__item, article.in-card', {
        timeout: 10000
      }).catch(() => {
        console.log('[IMMOBILIARE-PW] No listings found on page');
      });

      const items = await page.$$('li.in-realEstateResults__item, article.in-card');
      
      console.log(`[IMMOBILIARE-PW] Found ${items.length} item elements`);

      for (const item of items.slice(0, 20)) {
        try {
          const listing = await this.extractListingFromElement(page, item);
          if (listing) {
            listings.push(listing);
          }
        } catch (error) {
          console.error('[IMMOBILIARE-PW] Failed to extract listing:', error);
        }
      }
    } catch (error) {
      console.error('[IMMOBILIARE-PW] Failed to extract listings:', error);
    }

    return listings;
  }

  private async extractListingFromElement(page: Page, element: any): Promise<PropertyListing | null> {
    try {
      const idAttr = await element.getAttribute('data-id');
      const externalId = idAttr || String(Date.now());

      const linkEl = await element.$('a[href*="/annunci/"]');
      const href = linkEl ? await linkEl.getAttribute('href') : null;
      const url = href?.startsWith('http') ? href : (href ? IMMOBILIARE_BASE_URL + href : '');

      const titleEl = await element.$('.in-realEstateListCard__title, .in-card__title');
      const title = titleEl ? await titleEl.textContent() : 'Appartamento';

      const addressEl = await element.$('.in-realEstateListCard__location, .in-card__location');
      const addressText = addressEl ? await addressEl.textContent() : '';
      const address = addressText?.trim() || '';

      const priceEl = await element.$('.in-realEstateListCard__price, .in-card__price');
      const priceText = priceEl ? await priceEl.textContent() : '0';
      const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;

      const featuresText = await element.textContent();
      const sizeMatch = featuresText?.match(/(\d+)\s*m²/);
      const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;

      const roomsMatch = featuresText?.match(/(\d+)\s*local/i);
      const bedrooms = roomsMatch ? parseInt(roomsMatch[1]) : undefined;

      const bathroomsMatch = featuresText?.match(/(\d+)\s*bagn/i);
      const bathrooms = bathroomsMatch ? parseInt(bathroomsMatch[1]) : undefined;

      const floorMatch = featuresText?.match(/Piano\s+(\d+|T|S)/i);
      const floor = floorMatch ? floorMatch[1] : undefined;

      const cityMatch = address.match(/,\s*([^,]+)$/);
      const city = cityMatch?.[1]?.trim() || 'Milano';

      if (!externalId || !url || size === 0) {
        return null;
      }

      return {
        externalId,
        title: title?.trim() || 'Appartamento',
        address,
        city,
        price,
        size,
        bedrooms,
        bathrooms,
        floor,
        type: 'apartment',
        url,
        description: title?.trim(),
        ownerType: 'agency'
      };
    } catch (error) {
      console.error('[IMMOBILIARE-PW] Error extracting listing:', error);
      return null;
    }
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
