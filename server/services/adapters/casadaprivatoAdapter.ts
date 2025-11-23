import { chromium } from 'playwright';
import type { PropertyListing } from '../portalIngestionService';
import axios from 'axios';

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
      // Try multiple URL patterns - CasaDaPrivato likely uses various patterns
      const urls = [
        `${BASE_URL}/annunci-immobili-vendita/${city}/`,
        `${BASE_URL}/annunci-vendita/${city}/`,
        `${BASE_URL}/immobili-vendita/${city}/`,
        `${BASE_URL}/annunci/vendita/${city}/`,
      ];
      
      let foundProperties: any[] = [];
      
      for (const url of urls) {
        console.log(`[CASADAPRIVATO] 🌐 Trying: ${url}`);
        
        try {
          browser = await chromium.launch({ headless: true });
          const context = await browser.newContext({
            userAgent: USER_AGENT,
          });
          const page = await context.newPage();
          
          try {
            // Navigate and wait for content to load
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Wait for property listings (similar to ClickCase which uses h3 a)
            await page.waitForSelector('h3 a, h2 a, [class*="annuncio"] a', { timeout: 10000 }).catch(() => {
              // Ignore timeout, continue anyway
            });
            
            // Extract all property items using DOM
            const properties = await page.evaluate(() => {
              const items: any[] = [];
              
              // Try h3 pattern first (works for ClickCase)
              let propertyContainers = document.querySelectorAll('h3');
              if (propertyContainers.length === 0) {
                propertyContainers = document.querySelectorAll('h2');
              }
              if (propertyContainers.length === 0) {
                propertyContainers = document.querySelectorAll('a[class*="annuncio"], article');
              }
              
              propertyContainers.forEach((heading: any) => {
                try {
                  const titleLink = heading.querySelector?.('a') || heading;
                  const title = titleLink?.textContent?.trim() || '';
                  const propUrl = titleLink?.getAttribute?.('href') || '';
                  
                  // Get the container
                  let container = heading.closest('article') || heading.closest('div[class*="card"]') || heading.parentElement?.parentElement;
                  if (!container) container = heading;
                  
                  // Find price
                  let priceText = '';
                  const priceEl = container?.querySelector('[class*="price"]') || 
                                 Array.from(container?.querySelectorAll('*') || []).find((el: any) => 
                                   el.textContent?.includes('€')
                                 );
                  if (priceEl) priceText = priceEl.textContent?.trim() || '';
                  
                  // Find address - extract zone from title if available
                  let address = '';
                  const zoneMatch = title.match(/zona\s+([^\/,]+)|([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
                  if (zoneMatch) {
                    address = (zoneMatch[1] || zoneMatch[2] || '').trim();
                  }
                  
                  // Find size - look for m² pattern
                  const sizeMatch = container?.textContent?.match(/(\d+)\s*m²/);
                  const size = sizeMatch ? sizeMatch[1] : '';
                  
                  const item = {
                    title,
                    price: priceText,
                    address,
                    size,
                    url: propUrl,
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
            
            if (properties.length > 0) {
              console.log(`[CASADAPRIVATO] 📊 Found ${properties.length} properties at: ${url}`);
              foundProperties = properties;
              await page.close();
              break; // Exit URL loop if we found properties
            }
            
            await page.close();
          } finally {
            if (browser) {
              await browser.close().catch(e => {
                // Silently ignore browser close errors
              });
            }
          }
        } catch (urlError) {
          console.log(`[CASADAPRIVATO] ⚠️ URL ${url} failed, trying next...`);
          if (browser) {
            await browser.close().catch(() => {
              // Silently ignore
            });
          }
        }
      }
      
      console.log(`[CASADAPRIVATO] 📊 Found ${foundProperties.length} property items`);
      
      // Parse and convert to PropertyListing format
      let count = 0;
      for (const prop of foundProperties) {
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
              city: 'milano',
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
