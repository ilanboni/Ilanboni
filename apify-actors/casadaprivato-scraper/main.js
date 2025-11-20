// Apify Actor for scraping 100% PRIVATE properties from CasaDaPrivato.it
// All properties on this site are from private sellers - no agencies!

import { Actor } from 'apify';
import { PuppeteerCrawler, Dataset } from 'crawlee';

await Actor.init();

const input = await Actor.getInput();
const {
    startUrl = 'https://www.casadaprivato.it/annunci-vendita/immobili/milano-milano',
    maxItems = 100,
    centerLat = 45.4642,  // Duomo di Milano
    centerLng = 9.1900,
    maxDistanceKm = 4
} = input || {};

console.log('🏠 Starting CasaDaPrivato.it Scraper (100% PRIVATE sellers)');
console.log('URL:', startUrl);
console.log('Max items:', maxItems);
console.log('Center:', centerLat, centerLng);
console.log('Max distance:', maxDistanceKm, 'km');

// Haversine distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

let itemCount = 0;
let excludedByDistance = 0;

// Create crawler
const crawler = new PuppeteerCrawler({
    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        }
    },

    async requestHandler({ request, page, enqueueLinks }) {
        console.log(`📄 Processing: ${request.url}`);
        
        try {
            // Wait for property listings to load (CasaDaPrivato uses dynamic loading)
            await page.waitForSelector('.risultato-annuncio, .annuncio-item, .property-card, [class*="annuncio"]', { 
                timeout: 15000 
            }).catch(() => {
                console.log('⚠️ Selector not found, will try alternative approach');
            });
            
            // Wait a bit more for all content to load
            await page.waitForTimeout(2000);
            
            // Take screenshot for debugging
            const screenshotBuffer = await page.screenshot({ fullPage: false });
            await Actor.setValue('debug-screenshot.png', screenshotBuffer, { contentType: 'image/png' });
            console.log('📸 Screenshot saved for debugging');
            
            // Get page HTML to analyze structure
            const html = await page.content();
            await Actor.setValue('page-html.html', html, { contentType: 'text/html' });
            console.log('💾 HTML saved for analysis');
            
            // Try multiple selector strategies
            const selectors = [
                '.risultato-annuncio',
                '.annuncio-item', 
                '.property-card',
                '[class*="annuncio"]',
                'article',
                '.card',
                '[data-id]'
            ];
            
            let properties = [];
            
            for (const selector of selectors) {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
                    
                    // Extract data from found elements
                    properties = await page.$$eval(selector, (items) => {
                        return items.map(item => {
                            try {
                                // Extract property ID
                                const propertyId = item.getAttribute('data-id') || 
                                                 item.getAttribute('id') || 
                                                 Math.random().toString(36).substr(2, 9);
                                
                                // Extract link
                                const linkEl = item.querySelector('a[href*="/annuncio"], a[href*="/immobile"], a');
                                const href = linkEl ? linkEl.getAttribute('href') : '';
                                const url = href ? (href.startsWith('http') ? href : `https://www.casadaprivato.it${href}`) : '';
                                
                                // Extract title
                                const titleEl = item.querySelector('h2, h3, .title, [class*="titolo"]');
                                const title = titleEl ? titleEl.textContent.trim() : '';
                                
                                // Extract price
                                const priceEl = item.querySelector('.prezzo, .price, [class*="prezzo"], [class*="price"]');
                                const priceText = priceEl ? priceEl.textContent.trim() : '';
                                const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
                                
                                // Extract location
                                const locationEl = item.querySelector('.localita, .location, [class*="localita"], [class*="zona"]');
                                const address = locationEl ? locationEl.textContent.trim() : 'Milano';
                                
                                // Extract size
                                const sizeEl = item.querySelector('[class*="superficie"], [class*="mq"]');
                                const sizeText = sizeEl ? sizeEl.textContent.trim() : '';
                                const size = parseInt(sizeText.replace(/[^\d]/g, '')) || null;
                                
                                // Extract rooms
                                const roomsEl = item.querySelector('[class*="locali"], [class*="camere"]');
                                const roomsText = roomsEl ? roomsEl.textContent.trim() : '';
                                const rooms = parseInt(roomsText.replace(/[^\d]/g, '')) || null;
                                
                                // Extract description
                                const descEl = item.querySelector('.descrizione, .description, p');
                                const description = descEl ? descEl.textContent.trim() : '';
                                
                                // Extract coordinates if available
                                const latitude = item.getAttribute('data-lat') ? parseFloat(item.getAttribute('data-lat')) : null;
                                const longitude = item.getAttribute('data-lng') ? parseFloat(item.getAttribute('data-lng')) : null;
                                
                                return {
                                    propertyId,
                                    title,
                                    url,
                                    price,
                                    size,
                                    rooms,
                                    description,
                                    address,
                                    latitude,
                                    longitude,
                                    source: 'casadaprivato',
                                    ownerType: 'private', // 100% private on this site!
                                    scrapedAt: new Date().toISOString()
                                };
                            } catch (err) {
                                console.error('Error parsing item:', err);
                                return null;
                            }
                        }).filter(item => item && item.price > 0);
                    });
                    
                    break; // Found working selector, stop trying
                }
            }
            
            if (properties.length === 0) {
                console.log('⚠️ No properties found with any selector. Check debug files.');
            } else {
                console.log(`✅ Found ${properties.length} properties on this page`);
                
                // Apply distance filter (if we have coordinates)
                for (const property of properties) {
                    if (itemCount >= maxItems) break;
                    
                    // If property has coordinates, check distance
                    if (property.latitude && property.longitude) {
                        const distance = calculateDistance(
                            centerLat, centerLng,
                            property.latitude, property.longitude
                        );
                        
                        if (distance > maxDistanceKm) {
                            excludedByDistance++;
                            continue;
                        }
                        
                        property.distanceFromCenter = distance;
                    }
                    
                    await Dataset.pushData(property);
                    itemCount++;
                }
            }
            
            // Enqueue pagination if we need more items
            if (itemCount < maxItems) {
                await enqueueLinks({
                    selector: '.pagination a, a[rel="next"], .next, [class*="paginazione"]',
                    baseUrl: 'https://www.casadaprivato.it'
                });
            }
            
        } catch (error) {
            console.error('❌ Error processing page:', error.message);
            
            // Save error details
            await Actor.setValue('error-details.txt', error.stack);
        }
    },

    maxRequestsPerCrawl: 20,
    maxConcurrency: 1, // Be gentle with the site
});

// Start crawling
await crawler.run([startUrl]);

console.log(`✅ Scraping complete!`);
console.log(`   Total properties: ${itemCount}`);
console.log(`   Excluded by distance (>${maxDistanceKm}km): ${excludedByDistance}`);

await Actor.exit();
