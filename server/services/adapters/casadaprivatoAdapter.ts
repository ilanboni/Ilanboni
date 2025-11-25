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
      // Try multiple URL patterns - correct CasaDaPrivato URL is /annunci-vendita/immobili/{city}-{city}
      const urls = [
        `${BASE_URL}/annunci-vendita/immobili/${city}-${city}`,
        `${BASE_URL}/annunci/vendita-appartamenti-privati-${city}.html`,
        `${BASE_URL}/annunci-immobili-vendita/${city}/`,
      ];
      
      let allProperties: any[] = [];
      
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
            
            // Extract all property items using DOM - get URLs for detail pages
            const propertyUrls = await page.evaluate(() => {
              const urls: string[] = [];
              
              // Find all property links
              const links = document.querySelectorAll('a[href*="/annuncio/"], a[href*="/immobile/"], h3 a, h2 a');
              
              links.forEach((link: any) => {
                const href = link.getAttribute('href');
                if (href && !urls.includes(href)) {
                  urls.push(href);
                }
              });
              
              return urls;
            });
            
            console.log(`[CASADAPRIVATO] 📋 Found ${propertyUrls.length} property URLs to scrape`);
            
            // Now visit each property detail page to get full address
            const properties: any[] = [];
            const maxToScrape = Math.min(propertyUrls.length, params.maxItems || 50);
            
            for (let i = 0; i < maxToScrape; i++) {
              let propUrl = propertyUrls[i];
              if (!propUrl.startsWith('http')) {
                propUrl = BASE_URL + propUrl;
              }
              
              try {
                console.log(`[CASADAPRIVATO] 🔍 Scraping detail ${i + 1}/${maxToScrape}: ${propUrl}`);
                const detailPage = await context.newPage();
                await detailPage.goto(propUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                
                // Extract details from the property page
                const details = await detailPage.evaluate(() => {
                  // Try to find the address - look for common patterns
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
                  
                  return { title, address, price, size };
                });
                
                await detailPage.close();
                
                if (details.title || details.price) {
                  properties.push({
                    ...details,
                    url: propUrl
                  });
                }
                
                // Small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 500));
                
              } catch (detailError) {
                console.log(`[CASADAPRIVATO] ⚠️ Failed to scrape detail: ${propUrl}`);
              }
            }
            
            if (properties.length > 0) {
              console.log(`[CASADAPRIVATO] 📊 Found ${properties.length} properties at: ${url}`);
              allProperties = properties;
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
      
      console.log(`[CASADAPRIVATO] 📊 Found ${allProperties.length} property items`);
      
      // Parse and convert to PropertyListing format
      let count = 0;
      for (const prop of allProperties) {
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
