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
      const searchUrl = `${BASE_URL}/annunci/vendita-appartamenti-privati-${city}.html`;
      
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
      
      // First get all property URLs from the listing page
      const propertyUrls = await page.evaluate(() => {
        const urls: string[] = [];
        
        // Find all property links
        const links = document.querySelectorAll('h3 a, h2 a, a[href*="/annuncio/"], a[href*="/immobile/"]');
        
        links.forEach((link: any) => {
          const href = link.getAttribute('href');
          if (href && !urls.includes(href)) {
            urls.push(href);
          }
        });
        
        return urls;
      });
      
      console.log(`[CLICKCASE] 📋 Found ${propertyUrls.length} property URLs to scrape`);
      
      // Now visit each property detail page to get full address
      const properties: any[] = [];
      const maxToScrape = Math.min(propertyUrls.length, params.maxItems || 50);
      
      for (let i = 0; i < maxToScrape; i++) {
        let propUrl = propertyUrls[i];
        if (!propUrl.startsWith('http')) {
          propUrl = BASE_URL + propUrl;
        }
        
        try {
          console.log(`[CLICKCASE] 🔍 Scraping detail ${i + 1}/${maxToScrape}: ${propUrl}`);
          const detailPage = await context.newPage();
          await detailPage.goto(propUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          
          // Extract details from the property page
          const details = await detailPage.evaluate(() => {
            let address = '';
            let title = '';
            let price = '';
            let size = '';
            
            // Title usually in h1 or main heading
            const h1 = document.querySelector('h1');
            if (h1) title = h1.textContent?.trim() || '';
            
            // Look for address in various places
            const addressPatterns = [
              'Via ', 'Viale ', 'Corso ', 'Piazza ', 'Largo ', 'Vicolo ',
              'via ', 'viale ', 'corso ', 'piazza ', 'largo ', 'vicolo '
            ];
            
            // Search in all text content for address patterns
            const allText = document.body?.textContent || '';
            for (const pattern of addressPatterns) {
              const regex = new RegExp(`(${pattern}[A-Za-zÀ-ÿ\\s]+(?:\\d+)?(?:\\/[A-Za-z])?)[,\\s\\n]`, 'i');
              const match = allText.match(regex);
              if (match && match[1]) {
                address = match[1].trim();
                break;
              }
            }
            
            // If no specific address found, look for location/zone
            if (!address) {
              const locationEl = document.querySelector('[class*="location"], [class*="address"], [class*="zona"]');
              if (locationEl) address = locationEl.textContent?.trim() || '';
            }
            
            // Extract from title if still no address
            if (!address && title) {
              const zoneMatch = title.match(/zona\s+([^\/,\-]+)/i);
              if (zoneMatch) address = zoneMatch[1].trim();
              else {
                // Try to extract neighborhood name
                const neighborhoodMatch = title.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
                if (neighborhoodMatch) address = neighborhoodMatch[1].trim();
              }
            }
            
            // Find price
            const priceEls = Array.from(document.querySelectorAll('*')).filter((el: any) => 
              el.textContent?.includes('€') && el.textContent.length < 50
            );
            if (priceEls.length > 0) {
              price = priceEls[0].textContent?.trim() || '';
            }
            
            // Find size
            const sizeMatch = allText.match(/(\d+)\s*m[²q]/i);
            if (sizeMatch) size = sizeMatch[1];
            
            // Check if it's a rental
            const isRental = title.toLowerCase().includes('affitto') || 
                            allText.toLowerCase().includes('affitto') ||
                            price.toLowerCase().includes('/mese');
            
            return { title, address, price, size, isRental };
          });
          
          await detailPage.close();
          
          // Skip rentals
          if (!details.isRental && (details.title || details.price)) {
            properties.push({
              ...details,
              url: propUrl
            });
          }
          
          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 500));
          
        } catch (detailError) {
          console.log(`[CLICKCASE] ⚠️ Failed to scrape detail: ${propUrl}`);
        }
      }
      
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
