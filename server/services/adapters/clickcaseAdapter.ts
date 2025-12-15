import { chromium } from 'playwright';
import type { PropertyListing } from '../portalIngestionService';
import axios from 'axios';

const BASE_URL = 'https://www.clickcase.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Common Italian adjectives that indicate descriptive text, not real addresses
const DESCRIPTIVE_WORDS = [
  'tranquilla', 'tranquillo', 'comoda', 'comodo', 'luminosa', 'luminoso',
  'centrale', 'residenziale', 'signorile', 'elegante', 'esclusiva', 'esclusivo',
  'ottima', 'ottimo', 'bella', 'bello', 'nuova', 'nuovo', 'moderna', 'moderno',
  'silenziosa', 'silenzioso', 'riservata', 'riservato', 'privata', 'privato',
  'verde', 'pedonale', 'principale', 'secondaria', 'secondario', 'laterale',
  'stretta', 'stretto', 'larga', 'largo', 'breve', 'lunga', 'lungo', 'corta', 'corto'
];

// Check if an extracted "address" is actually a descriptive phrase
function isDescriptivePhrase(address: string): boolean {
  if (!address) return true;
  const lowerAddress = address.toLowerCase();
  
  // Check if address contains descriptive words
  for (const word of DESCRIPTIVE_WORDS) {
    if (lowerAddress.includes(word)) {
      return true;
    }
  }
  
  // Real addresses usually have a proper noun (capitalized) after Via/Viale/etc.
  // Check if address is too short to be real (e.g., "Via Roma" = 8 chars minimum)
  const parts = address.trim().split(/\s+/);
  if (parts.length < 2) return true;
  
  return false;
}

// Helper function to extract address from text
function extractAddressFromText(text: string): string | null {
  if (!text) return null;
  
  const addressPatterns = [
    /(?:via|viale|corso|piazza|largo|vicolo|piazzale)\s+[A-Za-zÀ-ÿ\s]+(?:\s+\d+)?(?:\/[A-Za-z])?/gi
  ];
  
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match && match[0] && match[0].length > 8) {
      const candidate = match[0].trim();
      // Validate it's not a descriptive phrase
      if (!isDescriptivePhrase(candidate)) {
        return candidate;
      }
    }
  }
  
  return null;
}

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
            let description = '';
            
            // Title usually in h1 or main heading
            const h1 = document.querySelector('h1');
            if (h1) title = h1.textContent?.trim() || '';
            
            // Extract full description from description area
            const descriptionSelectors = [
              '.description', '.descrizione', '[class*="description"]', '[class*="descrizione"]',
              '.annuncio-text', '.property-description', 'article p', '.detail-text'
            ];
            for (const sel of descriptionSelectors) {
              const descEl = document.querySelector(sel);
              if (descEl && descEl.textContent && descEl.textContent.length > 50) {
                description = descEl.textContent.trim();
                break;
              }
            }
            // Fallback: get all paragraphs and combine
            if (!description) {
              const paragraphs = document.querySelectorAll('p');
              const texts = Array.from(paragraphs)
                .map(p => p.textContent?.trim())
                .filter(t => t && t.length > 30);
              if (texts.length > 0) {
                description = texts.slice(0, 3).join(' ');
              }
            }
            
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
                const neighborhoodMatch = title.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
                if (neighborhoodMatch) address = neighborhoodMatch[1].trim();
              }
            }
            
            // Find price - look for specific price elements first
            const priceSelectors = ['.price', '.prezzo', '[class*="price"]', '[class*="prezzo"]'];
            for (const sel of priceSelectors) {
              const priceEl = document.querySelector(sel);
              if (priceEl && priceEl.textContent?.includes('€')) {
                price = priceEl.textContent.trim();
                break;
              }
            }
            // Fallback to generic search
            if (!price) {
              const priceEls = Array.from(document.querySelectorAll('*')).filter((el: any) => 
                el.textContent?.includes('€') && el.textContent.length < 50
              );
              if (priceEls.length > 0) {
                price = priceEls[0].textContent?.trim() || '';
              }
            }
            
            // Find size
            const sizeMatch = allText.match(/(\d+)\s*m[²q]/i);
            if (sizeMatch) size = sizeMatch[1];
            
            // Check if it's a rental
            const isRental = title.toLowerCase().includes('affitto') || 
                            allText.toLowerCase().includes('affitto') ||
                            price.toLowerCase().includes('/mese');
            
            return { title, address, price, size, description, isRental };
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
            // Extract external ID from URL (e.g., "408777" from "115-mq-5-vani-da-privato-milano-408777.html")
            const urlIdMatch = fullUrl.match(/(\d{5,})(?:\.html)?$/);
            const externalId = urlIdMatch ? `clickcase-${urlIdMatch[1]}` : `clickcase-${Date.now()}-${count}`;
            
            // Use full description if available, fallback to title
            const description = prop.description && prop.description.length > 20 
              ? prop.description.substring(0, 1000) // Limit description length
              : prop.title;
            
            // Validate address - reject placeholder/garbage addresses
            const invalidAddressPatterns = [
              /^via un messaggio/i,
              /^via\s*$/i,
              /^contatta/i,
              /^clicca/i,
              /^scopri/i,
              /^vedi/i,
              /^dettagli/i,
              /^info/i,
            ];
            
            let cleanAddress = prop.address?.trim() || '';
            const isInvalidAddress = invalidAddressPatterns.some(pattern => pattern.test(cleanAddress));
            
            if (isInvalidAddress || cleanAddress.length < 5 || cleanAddress.toLowerCase() === 'milano') {
              // Try to extract address from description or title
              const addressFromDesc = extractAddressFromText(prop.description || '');
              const addressFromTitle = extractAddressFromText(prop.title || '');
              
              if (addressFromDesc) {
                cleanAddress = addressFromDesc;
              } else if (addressFromTitle) {
                cleanAddress = addressFromTitle;
              } else {
                // Try to extract neighborhood/zone from description or title
                const zonePatterns = [
                  /zona\s+([A-Za-zÀ-ÿ\s]+?)(?:\s*[,\-\/\|]|$)/i,
                  /quartiere\s+([A-Za-zÀ-ÿ\s]+?)(?:\s*[,\-\/\|]|$)/i,
                  /(?:a|in)\s+((?:Porta|Brera|Navigli|Isola|Città Studi|Lambrate|Loreto|Centrale|Garibaldi|Sempione|Fiera|San Siro|Bicocca|Bovisa|Niguarda|Affori|Greco|Turro|Precotto|Gorla|Crescenzago|Cimiano|Udine|Piola|Buenos Aires|Corvetto|Rogoredo|Lodi|Ripamonti|Abbiategrasso|Bande Nere|Lorenteggio|Giambellino|Baggio|Quarto Oggiaro|Villapizzone|Dergano|Maciachini|Zara|Sondrio|Pasteur|Nolo|NoLo)[A-Za-zÀ-ÿ\s]*)/i
                ];
                
                for (const pattern of zonePatterns) {
                  const match = (prop.description + ' ' + prop.title).match(pattern);
                  if (match && match[1] && match[1].trim().length > 3) {
                    cleanAddress = `Zona ${match[1].trim()}`;
                    break;
                  }
                }
                
                // If still nothing, check for recognizable Milan neighborhoods in text
                if (!cleanAddress || cleanAddress.length < 5) {
                  const neighborhoods = ['Porta Romana', 'Brera', 'Navigli', 'Isola', 'Città Studi', 'Lambrate', 'Loreto', 'Centrale', 'Garibaldi', 'Sempione', 'Fiera', 'San Siro', 'Bicocca', 'Bovisa', 'Niguarda', 'Affori', 'Nolo', 'NoLo', 'Porta Venezia', 'Porta Genova', 'Porta Ticinese', 'Porta Nuova', 'Duomo', 'Cordusio', 'Moscova', 'Repubblica', 'Palestro'];
                  const combinedText = (prop.description + ' ' + prop.title).toLowerCase();
                  
                  for (const hood of neighborhoods) {
                    if (combinedText.includes(hood.toLowerCase())) {
                      cleanAddress = `Zona ${hood}`;
                      break;
                    }
                  }
                }
                
                // Last resort: use title if it contains location info
                if (!cleanAddress || cleanAddress.length < 5) {
                  cleanAddress = prop.title?.substring(0, 60) || city;
                }
              }
              console.log(`[CLICKCASE] ⚠️ Fixed invalid address "${prop.address}" -> "${cleanAddress}"`);
            }
            
            const listing: PropertyListing = {
              externalId,
              title: prop.title,
              address: cleanAddress,
              city,
              price,
              size,
              url: fullUrl,
              description,
              type: 'apartment',
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
