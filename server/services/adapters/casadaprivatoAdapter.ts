import { chromium } from 'playwright';
import type { PropertyListing } from '../portalIngestionService';

const BASE_URL = 'https://www.casadaprivato.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export class CasaDaPrivatoAdapter {
  name = 'CasaDaPrivato.it';
  portalId = 'casadaprivato';

  async search(params: { city?: string; maxItems?: number }): Promise<PropertyListing[]> {
    console.log('[CASADAPRIVATO] 🔍 Scraping CasaDaPrivato with Playwright (JavaScript-capable)');
    const listings: PropertyListing[] = [];
    let browser = null;

    try {
      const city = params.city || 'milano';
      const url = `${BASE_URL}/annunci-vendita/immobili/${city}-${city}`;
      
      console.log(`[CASADAPRIVATO] 🌐 Opening: ${url}`);
      
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: USER_AGENT,
      });
      const page = await context.newPage();
      
      // Navigate and wait for content to load
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for property cards to appear (up to 10 seconds)
      await page.waitForSelector('div[class*="listing"], div[class*="annuncio"], div[class*="property"]', { timeout: 10000 }).catch(() => {
        console.log('[CASADAPRIVATO] ⚠️ Property selector not found, continuing with available content');
      });
      
      // Extract all property items using multiple selector strategies
      const properties = await page.evaluate(() => {
        const items: any[] = [];
        
        // Strategy 1: Find by common property listing classes
        const selectors = [
          'div[class*="listing-item"]',
          'div[class*="annuncio"]',
          'div[class*="property-card"]',
          'article[class*="listing"]',
          'div.listing-item',
          'div.annuncio'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} items with selector: ${selector}`);
            
            elements.forEach((el: any) => {
              try {
                const titleEl = el.querySelector('h2, h3, [class*="title"], a[class*="title"]');
                const priceEl = el.querySelector('[class*="price"], span:contains("€")');
                const addressEl = el.querySelector('[class*="address"], [class*="location"], .address');
                const sizeEl = el.querySelector('[class*="size"], [class*="mq"]');
                const linkEl = el.querySelector('a[href]');
                
                const item = {
                  title: titleEl?.textContent?.trim() || '',
                  price: priceEl?.textContent?.trim() || '',
                  address: addressEl?.textContent?.trim() || '',
                  size: sizeEl?.textContent?.trim() || '',
                  url: linkEl?.getAttribute('href') || '',
                };
                
                if (item.title || item.price) {
                  items.push(item);
                }
              } catch (e) {
                // Skip items with extraction errors
              }
            });
            
            if (items.length > 0) break;
          }
        }
        
        return items;
      });
      
      console.log(`[CASADAPRIVATO] 📊 Found ${properties.length} property items`);
      
      // Parse and convert to PropertyListing format
      let count = 0;
      for (const prop of properties) {
        if (count >= (params.maxItems || 100)) break;
        
        try {
          // Extract price as number
          const priceStr = prop.price.match(/[\d.,]+/)?.[0] || '0';
          const price = parseInt(priceStr.replace(/\D/g, '')) || 0;
          
          // Extract size as number
          const sizeMatch = prop.size.match(/(\d+)/);
          const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
          
          // Clean URL
          let fullUrl = prop.url;
          if (fullUrl && !fullUrl.startsWith('http')) {
            fullUrl = BASE_URL + fullUrl;
          }
          
          if (price > 0 || prop.title) {
            const listing: PropertyListing = {
              externalId: `casa-${count}`,
              title: prop.title,
              address: prop.address,
              city,
              price,
              size,
              url: fullUrl,
              description: prop.title,
              portal: 'casadaprivato',
              ownerType: 'private',
              source: 'casadaprivato',
            };
            
            listings.push(listing);
            count++;
          }
        } catch (e) {
          console.warn('[CASADAPRIVATO] ⚠️ Failed to parse item:', e);
        }
      }
      
      console.log(`[CASADAPRIVATO] ✅ Successfully parsed ${listings.length} PRIVATE properties`);
    } catch (error) {
      console.error('[CASADAPRIVATO] ❌ Error scraping:', error instanceof Error ? error.message : error);
    } finally {
      if (browser) {
        await browser.close().catch(e => console.error('[CASADAPRIVATO] Error closing browser:', e));
      }
    }

    return listings;
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    try {
      const url = `${BASE_URL}/annunci/${externalId}`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000,
      });

      const html = response.data;
      const phoneMatch = html.match(/tel:\s*(\+?[0-9\s\-()]+)/i);
      const emailMatch = html.match(/email:\s*([^\s<]+@[^\s<]+)/i);

      return {
        externalId,
        ownerPhone: phoneMatch ? phoneMatch[1].trim() : '',
        ownerEmail: emailMatch ? emailMatch[1].trim() : '',
      } as PropertyListing;
    } catch (error) {
      console.error(`[CASADAPRIVATO] ❌ Error fetching details:`, error);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.head(BASE_URL, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
