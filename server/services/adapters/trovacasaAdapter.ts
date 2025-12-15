import { chromium } from 'playwright';
import type { PropertyListing } from '../portalIngestionService';

const BASE_URL = 'https://www.trovacasa.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function extractAddressFromText(text: string): string | null {
  if (!text) return null;
  
  const addressPatterns = [
    /(?:via|viale|corso|piazza|largo|vicolo|piazzale)\s+[A-Za-zÀ-ÿ\s]+(?:\s+\d+)?(?:\/[A-Za-z])?/gi
  ];
  
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match && match[0] && match[0].length > 8) {
      return match[0].trim();
    }
  }
  
  return null;
}

export class TrovaCasaAdapter {
  name = 'TrovaCasa.it';
  portalId = 'trovacasa';

  async search(params: { city?: string; maxItems?: number }): Promise<PropertyListing[]> {
    console.log('[TROVACASA] 🔍 Scraping TrovaCasa (private section) with Playwright');
    const listings: PropertyListing[] = [];
    let browser = null;

    try {
      const city = params.city || 'milano';
      const urls = [
        `${BASE_URL}/vendita/appartamenti/${city}/privati`,
        `${BASE_URL}/vendita-appartamenti-${city}-privati.html`,
        `${BASE_URL}/annunci/vendita/appartamenti/${city}?proprietario=privato`,
        `${BASE_URL}/annunci-vendita/${city}/privati`,
      ];
      
      let allProperties: any[] = [];
      
      for (const url of urls) {
        console.log(`[TROVACASA] 🌐 Trying: ${url}`);
        
        try {
          browser = await chromium.launch({ headless: true });
          const context = await browser.newContext({ userAgent: USER_AGENT });
          const page = await context.newPage();
          
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            await page.waitForSelector('.listing, .annuncio, [class*="property"], [class*="immobile"]', { timeout: 10000 }).catch(() => {});
            
            const propertyUrls = await page.evaluate(() => {
              const urls: string[] = [];
              const links = document.querySelectorAll('a[href*="/annuncio/"], a[href*="/immobile/"], a[href*="/appartamento/"], .listing a, .annuncio a');
              
              links.forEach((link: any) => {
                const href = link.getAttribute('href');
                if (href && !urls.includes(href)) {
                  urls.push(href);
                }
              });
              
              return urls;
            });
            
            console.log(`[TROVACASA] 📋 Found ${propertyUrls.length} property URLs`);
            
            const properties: any[] = [];
            const maxToScrape = Math.min(propertyUrls.length, params.maxItems || 50);
            
            for (let i = 0; i < maxToScrape; i++) {
              let propUrl = propertyUrls[i];
              if (!propUrl.startsWith('http')) {
                propUrl = BASE_URL + propUrl;
              }
              
              try {
                console.log(`[TROVACASA] 🔍 Scraping detail ${i + 1}/${maxToScrape}: ${propUrl}`);
                const detailPage = await context.newPage();
                await detailPage.goto(propUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                
                const details = await detailPage.evaluate(() => {
                  let address = '';
                  let title = '';
                  let price = '';
                  let size = '';
                  let description = '';
                  let phone = '';
                  let email = '';
                  let isPrivate = false;
                  
                  const h1 = document.querySelector('h1');
                  if (h1) title = h1.textContent?.trim() || '';
                  
                  const descriptionSelectors = ['.description', '.descrizione', '[class*="description"]', '.annuncio-text', 'article p', '.detail-description'];
                  for (const sel of descriptionSelectors) {
                    const descEl = document.querySelector(sel);
                    if (descEl && descEl.textContent && descEl.textContent.length > 50) {
                      description = descEl.textContent.trim();
                      break;
                    }
                  }
                  
                  const allText = document.body?.textContent || '';
                  
                  isPrivate = /privato|da privato|proprietario/i.test(allText);
                  
                  const addressPatterns = ['Via ', 'Viale ', 'Corso ', 'Piazza ', 'Largo ', 'Vicolo '];
                  for (const pattern of addressPatterns) {
                    const regex = new RegExp(`(${pattern}[A-Za-zÀ-ÿ\\s]+(?:\\d+)?(?:\\/[A-Za-z])?)[,\\s\\n]`, 'i');
                    const match = allText.match(regex);
                    if (match && match[1]) {
                      address = match[1].trim();
                      break;
                    }
                  }
                  
                  if (!address) {
                    const locationEl = document.querySelector('[class*="location"], [class*="address"], [class*="zona"], [class*="indirizzo"]');
                    if (locationEl) address = locationEl.textContent?.trim() || '';
                  }
                  
                  const priceSelectors = ['.price', '.prezzo', '[class*="price"]', '[class*="prezzo"]'];
                  for (const sel of priceSelectors) {
                    const priceEl = document.querySelector(sel);
                    if (priceEl && priceEl.textContent?.includes('€')) {
                      price = priceEl.textContent.trim();
                      break;
                    }
                  }
                  
                  const sizeMatch = allText.match(/(\d+)\s*m[²q]/i);
                  if (sizeMatch) size = sizeMatch[1];
                  
                  const phoneMatch = allText.match(/(?:tel|telefono|cell)[:\s]*([+\d\s\-()]{8,})/i);
                  if (phoneMatch) phone = phoneMatch[1].trim();
                  
                  const emailMatch = allText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                  if (emailMatch) email = emailMatch[1];
                  
                  return { title, address, price, size, description, phone, email, isPrivate };
                });
                
                await detailPage.close();
                
                if ((details.title || details.price) && details.isPrivate) {
                  properties.push({ ...details, url: propUrl });
                }
                
                await new Promise(r => setTimeout(r, 500));
              } catch (detailError) {
                console.log(`[TROVACASA] ⚠️ Failed to scrape detail: ${propUrl}`);
              }
            }
            
            if (properties.length > 0) {
              console.log(`[TROVACASA] 📊 Found ${properties.length} private properties`);
              allProperties = properties;
              await page.close();
              break;
            }
            
            await page.close();
          } finally {
            if (browser) await browser.close().catch(() => {});
          }
        } catch (urlError) {
          console.log(`[TROVACASA] ⚠️ URL ${url} failed, trying next...`);
          if (browser) await browser.close().catch(() => {});
        }
      }
      
      console.log(`[TROVACASA] 📊 Found ${allProperties.length} property items`);
      
      let count = 0;
      for (const prop of allProperties) {
        if (count >= (params.maxItems || 100)) break;
        
        try {
          const priceStr = prop.price?.match(/[\d.,]+/)?.[0] || '0';
          const price = parseInt(priceStr.replace(/\D/g, '')) || 0;
          
          const sizeMatch = prop.size?.match(/(\d+)/);
          const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
          
          let fullUrl = prop.url;
          if (fullUrl && !fullUrl.startsWith('http')) {
            fullUrl = BASE_URL + fullUrl;
          }
          
          if (price > 0 || prop.title) {
            const urlIdMatch = fullUrl.match(/(\d{5,})(?:\.html)?$/);
            const externalId = urlIdMatch ? `trovacasa-${urlIdMatch[1]}` : `trovacasa-${Date.now()}-${count}`;
            
            const description = prop.description && prop.description.length > 20 
              ? prop.description.substring(0, 1000)
              : prop.title;
            
            let cleanAddress = prop.address?.trim() || '';
            if (cleanAddress.length < 5) {
              const addressFromDesc = extractAddressFromText(prop.description || prop.title || '');
              if (addressFromDesc) {
                cleanAddress = addressFromDesc;
              } else {
                cleanAddress = 'milano';
              }
            }
            
            const listing: PropertyListing = {
              externalId,
              title: prop.title,
              address: cleanAddress,
              city: 'milano',
              price,
              size,
              url: fullUrl,
              description,
              type: 'apartment',
              ownerType: 'private',
              ownerPhone: prop.phone,
              ownerEmail: prop.email,
              source: 'trovacasa',
            };
            
            listings.push(listing);
            count++;
          }
        } catch (e) {
          console.warn('[TROVACASA] ⚠️ Failed to parse item:', e);
        }
      }
      
      console.log(`[TROVACASA] ✅ Successfully parsed ${listings.length} PRIVATE properties`);
    } catch (error) {
      console.error('[TROVACASA] ❌ Error scraping:', error instanceof Error ? error.message : error);
    } finally {
      if (browser) await browser.close().catch(() => {});
    }

    return listings;
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    return null;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(BASE_URL, {
        method: 'HEAD',
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}
