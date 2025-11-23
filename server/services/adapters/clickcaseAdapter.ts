import { chromium } from 'playwright';
import type { PropertyListing } from '../portalIngestionService';

const BASE_URL = 'https://www.clickcase.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export class ClickCaseAdapter {
  name = 'ClickCase.it';
  portalId = 'clickcase';

  async search(params: { city?: string; maxItems?: number }): Promise<PropertyListing[]> {
    console.log('[CLICKCASE] 🔍 Scraping ClickCase with Playwright (JavaScript-capable)');
    const listings: PropertyListing[] = [];
    let browser = null;

    try {
      const city = params.city || 'milano';
      const searchUrl = `${BASE_URL}/annunci/cercocase-lombardia-${city}.html`;
      
      console.log(`[CLICKCASE] 🌐 Opening: ${searchUrl}`);
      
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: USER_AGENT,
      });
      const page = await context.newPage();
      
      // Navigate and wait for content to load
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for property listings to load
      await page.waitForSelector('h3 a', { timeout: 10000 }).catch(() => {
        console.log('[CLICKCASE] ⚠️ Property selector not found, continuing with available content');
      });
      
      // Extract all property items using DOM
      const properties = await page.evaluate(() => {
        const items: any[] = [];
        
        // ClickCase structure: each property is a section with h3 > a (title), price div, and details
        const propertyContainers = document.querySelectorAll('h3');
        
        propertyContainers.forEach((h3: any) => {
          try {
            const titleLink = h3.querySelector('a');
            const title = titleLink?.textContent?.trim() || '';
            const url = titleLink?.getAttribute('href') || '';
            
            // Get the parent container
            let container = h3.closest('article') || h3.closest('div[class*="card"]') || h3.parentElement?.parentElement;
            if (!container) container = h3;
            
            // Find price - usually after h3 or in sibling divs
            let priceText = '';
            const priceEl = container?.querySelector('[class*="price"]') || 
                           Array.from(container?.querySelectorAll('*') || []).find((el: any) => 
                             el.textContent?.includes('€')
                           );
            if (priceEl) priceText = priceEl.textContent?.trim() || '';
            
            // Find address - look for zone/location text
            let address = '';
            const addressPattern = container?.textContent?.match(/Milano[\s\S]*?(?=\n|$|classe|Classe)/i);
            if (addressPattern) address = addressPattern[0].replace(/^Milano\s*[-–]\s*/, '').trim();
            
            // Find size - look for m² pattern
            const sizeMatch = container?.textContent?.match(/(\d+)\s*m²/);
            const size = sizeMatch ? sizeMatch[1] : '';
            
            const item = {
              title,
              price: priceText,
              address,
              size,
              url,
            };
            
            if (title && priceText) {
              items.push(item);
            }
          } catch (e) {
            // Skip items with extraction errors
          }
        });
        
        return items;
      });
      
      console.log(`[CLICKCASE] 📊 Found ${properties.length} property items`);
      
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
              externalId: `click-${count}`,
              title: prop.title,
              address: prop.address,
              city,
              price,
              size,
              url: fullUrl,
              description: prop.title,
              portal: 'clickcase',
              ownerType: 'private',
              source: 'clickcase',
            };
            
            listings.push(listing);
            count++;
          }
        } catch (e) {
          console.warn('[CLICKCASE] ⚠️ Failed to parse item:', e);
        }
      }
      
      console.log(`[CLICKCASE] ✅ Successfully parsed ${listings.length} PRIVATE properties`);
    } catch (error) {
      console.error('[CLICKCASE] ❌ Error scraping:', error instanceof Error ? error.message : error);
    } finally {
      if (browser) {
        await browser.close().catch(e => console.error('[CLICKCASE] Error closing browser:', e));
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
      console.error(`[CLICKCASE] ❌ Error fetching details:`, error);
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
