import { chromium } from 'playwright';
import type { PropertyListing } from '../portalIngestionService';

const BASE_URL = 'https://www.bakeca.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const MIN_PRICE = 250000;
const MAX_DISTANCE_KM = 4;
const DUOMO_LAT = 45.464211;
const DUOMO_LON = 9.191383;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

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

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Milano, Italia')}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Milano-PropertyScraper/1.0' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any[];
    if (!data || !data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export class BakecaAdapter {
  name = 'Bakeca.it';
  portalId = 'bakeca';

  async search(params: { city?: string; maxItems?: number }): Promise<PropertyListing[]> {
    console.log(`[BAKECA] 🔍 Scraping Bakeca with filters: price > €${MIN_PRICE}, within ${MAX_DISTANCE_KM}km of Duomo`);
    const listings: PropertyListing[] = [];
    let browser = null;

    try {
      const city = params.city || 'milano';
      const urls = [
        `${BASE_URL}/annunci/vendita-appartamenti/${city}/`,
        `${BASE_URL}/annunci-immobiliari/vendita/appartamenti/${city}/`,
        `${BASE_URL}/immobili/vendita/appartamenti/${city}/`,
      ];
      
      let allProperties: any[] = [];
      
      for (const url of urls) {
        console.log(`[BAKECA] 🌐 Trying: ${url}`);
        
        try {
          browser = await chromium.launch({ headless: true });
          const context = await browser.newContext({ userAgent: USER_AGENT });
          const page = await context.newPage();
          
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            await page.waitForSelector('.annuncio, .listing, [class*="annuncio"], [class*="listing"]', { timeout: 10000 }).catch(() => {});
            
            const propertyUrls = await page.evaluate(() => {
              const urls: string[] = [];
              const links = document.querySelectorAll('a[href*="/annuncio/"], a[href*="/dettaglio/"], .annuncio a, .listing a');
              
              links.forEach((link: any) => {
                const href = link.getAttribute('href');
                if (href && !urls.includes(href)) {
                  urls.push(href);
                }
              });
              
              return urls;
            });
            
            console.log(`[BAKECA] 📋 Found ${propertyUrls.length} property URLs to check`);
            
            const properties: any[] = [];
            const maxToScrape = Math.min(propertyUrls.length, params.maxItems || 100);
            
            for (let i = 0; i < maxToScrape; i++) {
              let propUrl = propertyUrls[i];
              if (!propUrl.startsWith('http')) {
                propUrl = BASE_URL + propUrl;
              }
              
              try {
                console.log(`[BAKECA] 🔍 Scraping detail ${i + 1}/${maxToScrape}: ${propUrl}`);
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
                  
                  const descriptionSelectors = ['.description', '.descrizione', '[class*="description"]', '.annuncio-text', 'article p', '.detail-text'];
                  for (const sel of descriptionSelectors) {
                    const descEl = document.querySelector(sel);
                    if (descEl && descEl.textContent && descEl.textContent.length > 50) {
                      description = descEl.textContent.trim();
                      break;
                    }
                  }
                  
                  const allText = document.body?.textContent || '';
                  
                  isPrivate = /privato|da privato|proprietario|no agenzie/i.test(allText) && 
                              !/agenzia|immobiliare|agency/i.test(allText);
                  
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
                    const locationEl = document.querySelector('[class*="location"], [class*="address"], [class*="zona"]');
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
                  
                  if (!price) {
                    const priceMatch = allText.match(/€\s*([\d.,]+)/);
                    if (priceMatch) price = priceMatch[0];
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
                
                const priceStr = details.price?.match(/[\d.,]+/)?.[0] || '0';
                const priceNum = parseInt(priceStr.replace(/\D/g, '')) || 0;
                
                if ((details.title || details.price) && priceNum >= MIN_PRICE) {
                  properties.push({ ...details, url: propUrl, priceNum });
                }
                
                await new Promise(r => setTimeout(r, 500));
              } catch (detailError) {
                console.log(`[BAKECA] ⚠️ Failed to scrape detail: ${propUrl}`);
              }
            }
            
            if (properties.length > 0) {
              console.log(`[BAKECA] 📊 Found ${properties.length} properties with price >= €${MIN_PRICE}`);
              allProperties = properties;
              await page.close();
              break;
            }
            
            await page.close();
          } finally {
            if (browser) await browser.close().catch(() => {});
          }
        } catch (urlError) {
          console.log(`[BAKECA] ⚠️ URL ${url} failed, trying next...`);
          if (browser) await browser.close().catch(() => {});
        }
      }
      
      console.log(`[BAKECA] 📊 Pre-filter: ${allProperties.length} properties`);
      
      let count = 0;
      for (const prop of allProperties) {
        if (count >= (params.maxItems || 100)) break;
        
        try {
          const price = prop.priceNum || 0;
          
          if (price < MIN_PRICE) {
            console.log(`[BAKECA] ⏭️ Skipping: price €${price} < €${MIN_PRICE}`);
            continue;
          }
          
          const sizeMatch = prop.size?.match(/(\d+)/);
          const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
          
          let fullUrl = prop.url;
          if (fullUrl && !fullUrl.startsWith('http')) {
            fullUrl = BASE_URL + fullUrl;
          }
          
          let cleanAddress = prop.address?.trim() || '';
          if (cleanAddress.length < 5) {
            const addressFromDesc = extractAddressFromText(prop.description || prop.title || '');
            if (addressFromDesc) {
              cleanAddress = addressFromDesc;
            } else {
              cleanAddress = 'milano';
            }
          }
          
          const coords = await geocodeAddress(cleanAddress);
          if (coords) {
            const distance = calculateDistance(DUOMO_LAT, DUOMO_LON, coords.lat, coords.lon);
            if (distance > MAX_DISTANCE_KM) {
              console.log(`[BAKECA] ⏭️ Skipping: ${cleanAddress} is ${distance.toFixed(1)}km from Duomo (max ${MAX_DISTANCE_KM}km)`);
              continue;
            }
            console.log(`[BAKECA] ✅ ${cleanAddress} is ${distance.toFixed(1)}km from Duomo`);
          }
          
          const urlIdMatch = fullUrl.match(/(\d{5,})(?:\.html)?$/);
          const externalId = urlIdMatch ? `bakeca-${urlIdMatch[1]}` : `bakeca-${Date.now()}-${count}`;
          
          const description = prop.description && prop.description.length > 20 
            ? prop.description.substring(0, 1000)
            : prop.title;
          
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
            ownerEmail: prop.email,
            latitude: coords?.lat,
            longitude: coords?.lon,
            source: 'bakeca',
          };
          
          listings.push(listing);
          count++;
          
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          console.warn('[BAKECA] ⚠️ Failed to parse item:', e);
        }
      }
      
      console.log(`[BAKECA] ✅ Successfully parsed ${listings.length} properties (filtered: price >= €${MIN_PRICE}, within ${MAX_DISTANCE_KM}km of Duomo)`);
    } catch (error) {
      console.error('[BAKECA] ❌ Error scraping:', error instanceof Error ? error.message : error);
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
