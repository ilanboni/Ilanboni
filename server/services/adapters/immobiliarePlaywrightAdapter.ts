import { chromium } from 'playwright-extra';
import type { Browser, Page } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

// Add stealth plugin to avoid CAPTCHA detection
chromium.use(StealthPlugin());

const IMMOBILIARE_BASE_URL = 'https://www.immobiliare.it';
const REQUEST_DELAY_MS = 3000;
const PAGE_TIMEOUT = 30000;

export class ImmobiliarePlaywrightAdapter implements PortalAdapter {
  name = 'Immobiliare.it (Playwright Stealth)';
  portalId = 'immobiliare';
  private lastRequestTime = 0;
  private browser: Browser | null = null;

  async search(criteria: SearchCriteria): Promise<PropertyListing[]> {
    const searchUrl = this.buildSearchUrl(criteria);
    console.log(`[IMMOBILIARE-PW] Searching: ${searchUrl}`);

    await this.respectRateLimit();

    let page: Page | null = null;
    let browserCreated = false;
    try {
      // Always create a fresh browser for each search to avoid "browser closed" errors
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
    
    // TEMPORARY: Skip zone to test if scraping works at all
    // TODO: Implement locality-normalization layer to map AI zones to portal slugs
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

  private async extractListings(page: Page): Promise<PropertyListing[]> {
    const listings: PropertyListing[] = [];

    try {
      // Wait for page to load
      await page.waitForTimeout(3000);

      // Take screenshot for debugging
      const screenshotPath = `/tmp/immobiliare-debug-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`[IMMOBILIARE-PW] Screenshot saved: ${screenshotPath}`);

      // Try multiple selectors (Immobiliare.it may have changed structure)
      const selectors = [
        'li.in-realEstateResults__item',
        'article.in-card',
        'div.in-searchList__item',
        'li.in-card',
        'div.nd-card',
        '[data-testid="search-result-card"]',
        'div.search-results-list li',
        'li.nd-list__item'
      ];

      let items: any[] = [];
      for (const selector of selectors) {
        items = await page.$$(selector);
        if (items.length > 0) {
          console.log(`[IMMOBILIARE-PW] Found ${items.length} items with selector: ${selector}`);
          break;
        }
      }

      if (items.length === 0) {
        console.log('[IMMOBILIARE-PW] No listings found with any selector. Checking page content...');
        const html = await page.content();
        console.log(`[IMMOBILIARE-PW] Page HTML length: ${html.length} chars`);
        
        // Log page title and URL to debug
        const title = await page.title();
        const url = page.url();
        console.log(`[IMMOBILIARE-PW] Page title: "${title}"`);
        console.log(`[IMMOBILIARE-PW] Current URL: ${url}`);
        
        // Check if page contains actual content or error
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
        console.log(`[IMMOBILIARE-PW] Body preview: ${bodyText}`);
        
        // Log first few class names for debugging
        const classes = await page.$$eval('[class]', els => 
          els.slice(0, 20).map(el => el.className).filter(c => c && c.includes('list') || c.includes('card') || c.includes('result'))
        );
        console.log(`[IMMOBILIARE-PW] Found classes: ${JSON.stringify(classes.slice(0, 10))}`);
      }

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
      // New Immobiliare.it 2025 structure uses different selectors
      const idAttr = await element.getAttribute('data-id') || await element.getAttribute('id');
      const externalId = idAttr || String(Date.now() + Math.random());

      // Try multiple link selectors
      const linkSelectors = ['a[href*="/annunci/"]', 'a.nd-card__link', 'a.nd-mediaObject', 'a[title]'];
      let href: string | null = null;
      for (const selector of linkSelectors) {
        const linkEl = await element.$(selector);
        if (linkEl) {
          href = await linkEl.getAttribute('href');
          if (href) break;
        }
      }
      const url = href?.startsWith('http') ? href : (href ? IMMOBILIARE_BASE_URL + href : '');

      // Try multiple title selectors
      const titleSelectors = [
        '.in-realEstateListCard__title',
        '.in-card__title',
        '.nd-card__title',
        'h2.nd-text',
        'a[title]'
      ];
      let title = '';
      for (const selector of titleSelectors) {
        const titleEl = await element.$(selector);
        if (titleEl) {
          title = await titleEl.textContent() || '';
          if (title) break;
        }
      }
      // Fallback to link title attribute
      if (!title && href) {
        for (const selector of linkSelectors) {
          const linkEl = await element.$(selector);
          if (linkEl) {
            title = await linkEl.getAttribute('title') || '';
            if (title) break;
          }
        }
      }

      // Try multiple address selectors
      const addressSelectors = [
        '.in-realEstateListCard__location',
        '.in-card__location',
        '.nd-card__location',
        '.nd-text--secondary'
      ];
      let address = '';
      for (const selector of addressSelectors) {
        const addressEl = await element.$(selector);
        if (addressEl) {
          address = await addressEl.textContent() || '';
          if (address) break;
        }
      }

      // Try multiple price selectors and fallbacks
      const priceSelectors = [
        '.in-realEstateListCard__price',
        '.in-card__price',
        '.nd-card__price',
        '.nd-text--size-l',
        '[class*="price"]',
        '[class*="Price"]',
        'strong',
        'span[class*="text"]'
      ];
      let priceText = '';
      for (const selector of priceSelectors) {
        const priceEls = await element.$$(selector);
        for (const priceEl of priceEls) {
          const text = await priceEl.textContent() || '';
          // Look for text with € symbol
          if (text.includes('€') || /\d{1,3}[.,]\d{3}/.test(text)) {
            priceText = text;
            break;
          }
        }
        if (priceText) break;
      }
      
      // Final fallback: search entire element text for price pattern
      if (!priceText) {
        const fullText = await element.textContent() || '';
        const priceMatch = fullText.match(/€\s*([\d.,]+)/);
        if (priceMatch) {
          priceText = priceMatch[1];
        }
      }
      
      const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;

      // Extract features from full text
      const featuresText = await element.textContent() || '';
      const sizeMatch = featuresText.match(/(\d+)\s*m²/);
      const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;

      const roomsMatch = featuresText.match(/(\d+)\s*local/i);
      const bedrooms = roomsMatch ? parseInt(roomsMatch[1]) : undefined;

      const bathroomsMatch = featuresText.match(/(\d+)\s*bagn/i);
      const bathrooms = bathroomsMatch ? parseInt(bathroomsMatch[1]) : undefined;

      const floorMatch = featuresText.match(/Piano\s+(\d+|T|S)/i);
      const floor = floorMatch ? floorMatch[1] : undefined;

      const cityMatch = address.match(/,\s*([^,]+)$/);
      const city = cityMatch?.[1]?.trim() || 'Milano';

      // Extract main image URL
      const imageSelectors = [
        'img[src*="idealista"]',
        'img[src*="immobiliare"]',
        'img.nd-media__img',
        'img[class*="card"]',
        'picture img',
        'img[loading="lazy"]',
        'img'
      ];
      let imageUrl: string | undefined;
      for (const selector of imageSelectors) {
        const imgEl = await element.$(selector);
        if (imgEl) {
          const src = await imgEl.getAttribute('src');
          const dataSrc = await imgEl.getAttribute('data-src');
          imageUrl = src || dataSrc || undefined;
          if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('//'))) {
            // Ensure absolute URL
            if (imageUrl.startsWith('//')) {
              imageUrl = 'https:' + imageUrl;
            }
            break;
          }
        }
      }

      // Relaxed validation: only require URL, title, and price
      // Size is optional as many listings don't provide it
      if (!url || !title || price === 0) {
        console.log(`[IMMOBILIARE-PW] Skipping invalid listing - URL:${!!url} Title:${!!title} Size:${size} Price:${price}`);
        return null;
      }

      return {
        externalId,
        title: title.trim(),
        address: address.trim() || 'Milano',
        city,
        price,
        size: size || undefined,
        bedrooms,
        bathrooms,
        floor,
        type: 'apartment',
        url,
        description: title.trim(),
        ownerType: 'agency',
        images: imageUrl ? [imageUrl] : undefined
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
