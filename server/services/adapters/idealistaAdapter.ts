import { chromium, Browser, Page } from 'playwright';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

const IDEALISTA_BASE_URL = 'https://www.idealista.it';
const REQUEST_DELAY_MS = 3000;
const PAGE_TIMEOUT = 30000;

export class IdealistaAdapter implements PortalAdapter {
  name = 'Idealista (Playwright)';
  portalId = 'idealista';
  private lastRequestTime = 0;
  private browser: Browser | null = null;

  async search(criteria: SearchCriteria): Promise<PropertyListing[]> {
    const searchUrl = this.buildSearchUrl(criteria);
    console.log(`[IDEALISTA-PW] Searching: ${searchUrl}`);

    await this.respectRateLimit();

    let page: Page | null = null;
    let browserCreated = false;
    try {
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (e) {
          // Ignore close errors
        }
      }
      
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      browserCreated = true;

      page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_TIMEOUT
      });

      await page.waitForTimeout(2000);

      const acceptCookies = page.locator('button:has-text("Accetta"), button:has-text("Accetto")').first();
      if (await acceptCookies.count() > 0) {
        await acceptCookies.click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      const listings = await this.extractListings(page);
      console.log(`[IDEALISTA-PW] Found ${listings.length} listings`);

      return listings;
    } catch (error) {
      console.error('[IDEALISTA-PW] Search failed:', error);
      return [];
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
      if (browserCreated && this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
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
      await page.goto(IDEALISTA_BASE_URL, { timeout: 10000 });
      const title = await page.title();
      await page.close();
      return title.includes('idealista');
    } catch (error) {
      console.error('[IDEALISTA-PW] Availability check failed:', error);
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
    const parts: string[] = [IDEALISTA_BASE_URL];
    parts.push('vendita-case');
    
    if (criteria.city) {
      parts.push(criteria.city.toLowerCase().replace(/\s+/g, '-'));
    }
    
    // TEMPORARY: Skip zone to test if scraping works at all
    // TODO: Implement locality-normalization layer to map AI zones to portal slugs
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

  private async extractListings(page: Page): Promise<PropertyListing[]> {
    const listings: PropertyListing[] = [];

    try {
      const html = await page.content();
      const title = await page.title();
      const url = page.url();
      
      const articleRegex = /<article[^>]*class="[^"]*item[^"]*"[^>]*>(.*?)<\/article>/gs;
      const articles = html.match(articleRegex) || [];

      console.log(`[IDEALISTA-PW] Page HTML length: ${html.length} chars`);
      console.log(`[IDEALISTA-PW] Page title: "${title}"`);
      console.log(`[IDEALISTA-PW] Current URL: ${url}`);
      console.log(`[IDEALISTA-PW] Found ${articles.length} article matches`);
      
      if (articles.length === 0) {
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
        console.log(`[IDEALISTA-PW] Body preview: ${bodyText}`);
      }

      for (const article of articles.slice(0, 20)) {
        try {
          const listing = this.parseArticle(article);
          if (listing) {
            listings.push(listing);
          }
        } catch (error) {
          console.error('[IDEALISTA-PW] Failed to parse article:', error);
        }
      }
    } catch (error) {
      console.error('[IDEALISTA-PW] Failed to extract listings:', error);
    }

    return listings;
  }


  private parseArticle(article: string): PropertyListing | null {
    const idMatch = article.match(/data-adid="(\d+)"/);
    const urlMatch = article.match(/href="([^"]+immobile\/\d+[^"]*)"/);
    const priceMatch = article.match(/<span class="[^"]*item-price[^"]*">([^<]+)<\/span>/);
    const titleMatch = article.match(/<a[^>]*class="[^"]*item-link[^"]*"[^>]*>([^<]+)<\/a>/);
    const addressMatch = article.match(/<span class="[^"]*item-detail[^"]*">([^<]+)<\/span>/);
    const sizeMatch = article.match(/(\d+)\s*m²/);
    const roomsMatch = article.match(/(\d+)\s*locale/i);

    if (!idMatch || !urlMatch) {
      return null;
    }

    const externalId = idMatch[1];
    let url = urlMatch[1];
    if (!url.startsWith('http')) {
      url = IDEALISTA_BASE_URL + url;
    }

    const priceText = priceMatch?.[1] || '0';
    const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;

    const sizeText = sizeMatch?.[1] || '0';
    const size = parseInt(sizeText) || 0;

    const roomsText = roomsMatch?.[1] || '0';
    const bedrooms = parseInt(roomsText) || undefined;

    const title = titleMatch?.[1]?.trim() || 'Appartamento';
    const address = addressMatch?.[1]?.trim() || '';

    const cityMatch = address.match(/,\s*([^,]+)$/);
    const city = cityMatch?.[1]?.trim() || 'Milano';

    return {
      externalId,
      title,
      address,
      city,
      price,
      size,
      bedrooms,
      type: 'apartment',
      url,
      description: title,
      ownerType: 'agency'
    };
  }

  private parseDetailPage(html: string, externalId: string): PropertyListing | null {
    return null;
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
