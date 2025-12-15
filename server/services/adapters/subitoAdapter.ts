import { chromium } from 'playwright';
import type { PropertyListing } from '../portalIngestionService';

const BASE_URL = 'https://www.subito.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

export class SubitoAdapter {
  name = 'Subito.it';
  portalId = 'subito';

  async search(params: { city?: string; maxItems?: number }): Promise<PropertyListing[]> {
    console.log('[SUBITO] 🔍 Scraping Subito.it real estate section with Playwright');
    const listings: PropertyListing[] = [];
    let browser = null;

    try {
      const url = `${BASE_URL}/annunci-lombardia/vendita/appartamenti/?cities=7`;
      
      console.log(`[SUBITO] 🌐 Loading: ${url}`);
      
      browser = await chromium.launch({ 
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
      });
      const context = await browser.newContext({ 
        userAgent: USER_AGENT,
        viewport: { width: 1920, height: 1080 },
        javaScriptEnabled: true,
        locale: 'it-IT'
      });
      const page = await context.newPage();
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      });
      
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      
      await page.waitForTimeout(3000);
      
      const pageContent = await page.content();
      if (pageContent.includes('Access Denied') || pageContent.includes('blocked')) {
        console.log('[SUBITO] ⚠️ Access denied, trying alternative approach...');
        await page.waitForTimeout(5000);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
      }
      
      await page.waitForSelector('a[href*="subito.it"]', { timeout: 30000 }).catch(() => {});
      
      const propertyUrls = await page.evaluate(() => {
        const urls: string[] = [];
        const links = document.querySelectorAll('a[href*="subito.it/immobili"], a[href*="/immobili/vendita"], a[class*="link"]');
        
        links.forEach((link: any) => {
          const href = link.getAttribute('href');
          if (href && href.includes('subito.it') && href.includes('immobili') && !urls.includes(href)) {
            urls.push(href);
          }
        });
        
        if (urls.length === 0) {
          const allLinks = document.querySelectorAll('a[href]');
          allLinks.forEach((link: any) => {
            const href = link.getAttribute('href');
            if (href && (href.includes('appartamento') || href.includes('immobili')) && href.includes('subito.it') && !urls.includes(href)) {
              urls.push(href);
            }
          });
        }
        
        return urls.slice(0, 50);
      });
      
      console.log(`[SUBITO] 📋 Found ${propertyUrls.length} property URLs`);
      
      const allProperties: any[] = [];
      const maxToScrape = Math.min(propertyUrls.length, params.maxItems || 30);
      
      for (let i = 0; i < maxToScrape; i++) {
        let propUrl = propertyUrls[i];
        if (!propUrl.startsWith('http')) {
          propUrl = BASE_URL + propUrl;
        }
        
        try {
          console.log(`[SUBITO] 🔍 Scraping detail ${i + 1}/${maxToScrape}: ${propUrl}`);
          const detailPage = await context.newPage();
          await detailPage.goto(propUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await detailPage.waitForTimeout(2000);
          
          const details = await detailPage.evaluate(() => {
            let address = '';
            let title = '';
            let price = '';
            let size = '';
            let description = '';
            let phone = '';
            let isPrivate = true;
            let zone = '';
            
            const h1 = document.querySelector('h1');
            if (h1) title = h1.textContent?.trim() || '';
            
            const descriptionSelectors = [
              '[class*="description"]', '[class*="Description"]',
              '.description', '.descrizione', 
              '[data-testid="description"]',
              'article p', '.detail-text'
            ];
            for (const sel of descriptionSelectors) {
              const descEl = document.querySelector(sel);
              if (descEl && descEl.textContent && descEl.textContent.length > 50) {
                description = descEl.textContent.trim();
                break;
              }
            }
            
            const allText = document.body?.textContent || '';
            
            isPrivate = !/agenzia|immobiliare|agency|real estate/i.test(allText) ||
                        /privato|da privato|proprietario/i.test(allText);
            
            const zoneSelectors = ['[class*="location"]', '[class*="Location"]', '[class*="zona"]', '[class*="city"]', '[class*="geo"]'];
            for (const sel of zoneSelectors) {
              const zoneEl = document.querySelector(sel);
              if (zoneEl && zoneEl.textContent) {
                zone = zoneEl.textContent.trim();
                break;
              }
            }
            
            const addressPatterns = ['Via ', 'Viale ', 'Corso ', 'Piazza ', 'Largo ', 'Vicolo '];
            for (const pattern of addressPatterns) {
              const regex = new RegExp(`(${pattern}[A-Za-zÀ-ÿ\\s]+(?:\\d+)?(?:\\/[A-Za-z])?)[,\\s\\n]`, 'i');
              const match = allText.match(regex);
              if (match && match[1]) {
                address = match[1].trim();
                break;
              }
            }
            
            if (!address && zone) {
              address = zone;
            }
            
            const priceSelectors = [
              '[class*="price"]', '[class*="Price"]',
              '.price', '.prezzo',
              '[data-testid="price"]'
            ];
            for (const sel of priceSelectors) {
              const priceEl = document.querySelector(sel);
              if (priceEl && priceEl.textContent && (priceEl.textContent.includes('€') || /\d/.test(priceEl.textContent))) {
                price = priceEl.textContent.trim();
                break;
              }
            }
            
            const sizeMatch = allText.match(/(\d+)\s*m[²q]/i);
            if (sizeMatch) size = sizeMatch[1];
            
            const phoneMatch = allText.match(/(?:tel|telefono|cell)[:\s]*([+\d\s\-()]{8,})/i);
            if (phoneMatch) phone = phoneMatch[1].trim();
            
            return { title, address, price, size, description, phone, isPrivate, zone };
          });
          
          await detailPage.close();
          
          if ((details.title || details.price) && details.isPrivate) {
            allProperties.push({ ...details, url: propUrl });
          } else if (details.title && !details.isPrivate) {
            console.log(`[SUBITO] ⏭️ Skipping agency listing: ${details.title.substring(0, 50)}`);
          }
          
          await new Promise(r => setTimeout(r, 800));
        } catch (detailError) {
          console.log(`[SUBITO] ⚠️ Failed to scrape detail: ${propUrl}`);
        }
      }
      
      await page.close();
      
      console.log(`[SUBITO] 📊 Found ${allProperties.length} property items`);
      
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
          
          const urlIdMatch = fullUrl.match(/(\d{6,})/) || fullUrl.match(/-(\d+)\.htm/);
          const externalId = urlIdMatch ? `subito-${urlIdMatch[1]}` : `subito-${Date.now()}-${count}`;
          
          const description = prop.description && prop.description.length > 20 
            ? prop.description.substring(0, 1000)
            : prop.title;
          
          let cleanAddress = prop.address?.trim() || '';
          if (cleanAddress.length < 5) {
            const addressFromDesc = extractAddressFromText(prop.description || prop.title || '');
            if (addressFromDesc) {
              cleanAddress = addressFromDesc;
            } else if (prop.zone) {
              cleanAddress = prop.zone;
            } else {
              cleanAddress = 'milano';
            }
          }
          
          if (price > 0 || prop.title) {
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
              ownerType: prop.isPrivate ? 'private' : 'agency',
              ownerPhone: prop.phone,
              source: 'subito',
            };
            
            listings.push(listing);
            count++;
          }
        } catch (e) {
          console.warn('[SUBITO] ⚠️ Failed to parse item:', e);
        }
      }
      
      console.log(`[SUBITO] ✅ Successfully parsed ${listings.length} properties`);
    } catch (error) {
      console.error('[SUBITO] ❌ Error scraping:', error instanceof Error ? error.message : error);
    } finally {
      if (browser) await browser.close().catch(() => {});
    }

    return listings;
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    return null;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
