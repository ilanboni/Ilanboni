import { chromium } from 'playwright-extra';
import type { Browser, Page } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

chromium.use(StealthPlugin());

const IDEALISTA_BASE_URL = 'https://www.idealista.it';
const REQUEST_DELAY_MS = 3000;
const PAGE_TIMEOUT = 30000;

export class IdealistaPlaywrightAdapter implements PortalAdapter {
  name = 'Idealista (Playwright Stealth)';
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
        waitUntil: 'networkidle',  // Wait for all network requests to finish
        timeout: PAGE_TIMEOUT
      });

      // Wait longer for JavaScript to execute
      await page.waitForTimeout(5000);

      // Accept cookies if present
      const acceptCookies = page.locator('button:has-text("Accetta")').first();
      if (await acceptCookies.count() > 0) {
        await acceptCookies.click().catch(() => {});
        await page.waitForTimeout(2000);
      }

      // Save HTML for debugging
      const html = await page.content();
      const fs = await import('fs');
      const debugPath = '/tmp/idealista-debug.html';
      fs.writeFileSync(debugPath, html);
      console.log(`[IDEALISTA-PW] Saved page HTML to ${debugPath} (${html.length} chars)`);
      
      // Also save a screenshot
      const screenshotPath = '/tmp/idealista-debug.png';
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[IDEALISTA-PW] Saved screenshot to ${screenshotPath}`);

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
    // Use Idealista's exact URL format for Milano with private-only filter
    // Format: https://www.idealista.it/vendita-case/milano-milano/?ordine=da-privati-asc
    let url = `${IDEALISTA_BASE_URL}/vendita-case/milano-milano/`;

    const params: string[] = [];

    // CRITICAL: Add private-only filter (MUST be first parameter)
    params.push('ordine=da-privati-asc');
    
    if (criteria.maxPrice) {
      params.push(`prezzoMassimo=${criteria.maxPrice}`);
    }
    
    if (criteria.minSize) {
      params.push(`superficieMinima=${criteria.minSize}`);
    }
    
    if (criteria.bedrooms) {
      params.push(`numeroDiCamere=${criteria.bedrooms}`);
    }
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    return url;
  }

  private async extractListings(page: Page): Promise<PropertyListing[]> {
    const listings: PropertyListing[] = [];

    // Idealista uses different selectors than Immobiliare.it
    // Try multiple selectors to find the right one
    const possibleSelectors = [
      'article.item',
      'article.item-multimedia-container',
      'div.item',
      'article',
      '.item-multimedia-container',
      '.item-container'
    ];
    
    let articles: any[] = [];
    let usedSelector = '';
    
    for (const selector of possibleSelectors) {
      const found = await page.$$(selector);
      if (found.length > 0) {
        articles = found;
        usedSelector = selector;
        console.log(`[IDEALISTA-PW] Found ${articles.length} elements with selector: ${selector}`);
        break;
      }
    }
    
    if (articles.length === 0) {
      console.log('[IDEALISTA-PW] No articles found with any selector');
      // Log page HTML for debugging
      const html = await page.content();
      console.log('[IDEALISTA-PW] Page HTML length:', html.length);
      console.log('[IDEALISTA-PW] Page title:', await page.title());
    }

    for (const article of articles) {
      try {
        const linkElement = await article.$('a.item-link');
        const url = linkElement ? await linkElement.getAttribute('href') : null;
        
        if (!url) continue;
        
        const fullUrl = url.startsWith('http') ? url : IDEALISTA_BASE_URL + url;
        const externalId = url.match(/\/immobile\/(\d+)\//)?.[1] || '';
        
        const titleElement = await article.$('.item-info-container .item-link');
        const title = titleElement ? (await titleElement.textContent())?.trim() || '' : '';
        
        const priceElement = await article.$('.item-price');
        const priceText = priceElement ? (await priceElement.textContent())?.trim() || '0' : '0';
        const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
        
        const detailsElement = await article.$('.item-detail');
        const detailsText = detailsElement ? (await detailsElement.textContent())?.trim() || '' : '';
        
        const sizeMatch = detailsText.match(/(\d+)\s*m²/);
        const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
        
        const bedroomsMatch = detailsText.match(/(\d+)\s*loc/);
        const bedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]) : undefined;
        
        const addressElement = await article.$('.item-info-container a.item-link');
        const address = addressElement ? (await addressElement.textContent())?.trim() || '' : '';

        if (price > 0 && externalId) {
          listings.push({
            externalId,
            title,
            address,
            city: 'Milano',
            price,
            size,
            bedrooms,
            type: 'apartment',
            url: fullUrl,
            description: title,
            ownerType: 'private', // Pre-classified as private because we used the private-only filter
            source: 'idealista'
          });
        }
      } catch (itemError) {
        console.error('[IDEALISTA-PW] Failed to extract item:', itemError);
      }
    }

    return listings;
  }

  private async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < REQUEST_DELAY_MS) {
      const delay = REQUEST_DELAY_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }
}
