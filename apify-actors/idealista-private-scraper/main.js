// Custom Apify Actor for scraping PRIVATE properties from Idealista.it
// Uses the ordine=da-privati-asc URL parameter to get only private sellers

import { Actor } from 'apify';
import { PuppeteerCrawler, Dataset } from 'crawlee';

await Actor.init();

const input = await Actor.getInput();
const {
    startUrl = 'https://www.idealista.it/vendita-case/milano-milano/?ordine=da-privati-asc',
    maxItems = 100,
    proxyConfiguration = { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] }
} = input || {};

console.log('🏠 Starting Idealista Private Properties Scraper');
console.log('URL:', startUrl);
console.log('Max items:', maxItems);

// Initialize proxy configuration
const proxyConfig = await Actor.createProxyConfiguration(proxyConfiguration);

let itemCount = 0;

// Create crawler
const crawler = new PuppeteerCrawler({
    proxyConfiguration: proxyConfig,
    
    // Use stealth to avoid detection
    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        },
        useChrome: true // Use Chrome instead of Chromium
    },

    async requestHandler({ request, page, enqueueLinks }) {
        console.log(`📄 Processing: ${request.url}`);
        
        try {
            // Wait for property listings to load
            await page.waitForSelector('.item', { timeout: 30000 });
            
            // Extract property data
            const properties = await page.$$eval('.item', (items) => {
                return items.map(item => {
                    try {
                        // Extract property ID
                        const propertyCode = item.getAttribute('data-adid') || '';
                        
                        // Extract title
                        const titleEl = item.querySelector('.item-link');
                        const title = titleEl ? titleEl.textContent.trim() : '';
                        const url = titleEl ? titleEl.getAttribute('href') : '';
                        
                        // Extract price
                        const priceEl = item.querySelector('.item-price');
                        const priceText = priceEl ? priceEl.textContent.trim() : '';
                        const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
                        
                        // Extract size
                        const sizeEl = item.querySelector('.item-detail:nth-child(1)');
                        const sizeText = sizeEl ? sizeEl.textContent.trim() : '';
                        const size = parseInt(sizeText.replace(/[^\d]/g, '')) || 0;
                        
                        // Extract rooms
                        const roomsEl = item.querySelector('.item-detail:nth-child(2)');
                        const roomsText = roomsEl ? roomsEl.textContent.trim() : '';
                        const rooms = parseInt(roomsText.replace(/[^\d]/g, '')) || null;
                        
                        // Extract description
                        const descEl = item.querySelector('.item-description');
                        const description = descEl ? descEl.textContent.trim() : '';
                        
                        // Extract address/location
                        const locationEl = item.querySelector('.item-location');
                        const address = locationEl ? locationEl.textContent.trim() : '';
                        
                        // Extract coordinates if available
                        const latitude = item.getAttribute('data-lat') ? parseFloat(item.getAttribute('data-lat')) : null;
                        const longitude = item.getAttribute('data-lng') ? parseFloat(item.getAttribute('data-lng')) : null;
                        
                        // Extract contact info
                        const contactEl = item.querySelector('.item-advertiser');
                        const contactName = contactEl ? contactEl.textContent.trim() : '';
                        
                        // Check if it's private (no agency name/logo)
                        const hasAgencyLogo = !!item.querySelector('.item-agency-logo');
                        const isPrivate = !hasAgencyLogo && !contactName.toLowerCase().includes('immobiliare') && 
                                         !contactName.toLowerCase().includes('agenzia');
                        
                        return {
                            adid: propertyCode,
                            title,
                            url: url ? `https://www.idealista.it${url}` : '',
                            price,
                            size,
                            rooms,
                            description,
                            address,
                            latitude,
                            longitude,
                            contactName,
                            isPrivate,
                            scrapedAt: new Date().toISOString()
                        };
                    } catch (err) {
                        console.error('Error parsing item:', err);
                        return null;
                    }
                }).filter(item => item && item.price > 0 && item.isPrivate); // Only private properties
            });
            
            console.log(`✅ Found ${properties.length} PRIVATE properties on this page`);
            
            // Save to dataset
            for (const property of properties) {
                if (itemCount >= maxItems) break;
                await Dataset.pushData(property);
                itemCount++;
            }
            
            // Enqueue pagination links if we need more items
            if (itemCount < maxItems) {
                await enqueueLinks({
                    selector: '.pagination .next a',
                    baseUrl: 'https://www.idealista.it'
                });
            }
            
        } catch (error) {
            console.error('❌ Error processing page:', error.message);
            
            // Check if we're blocked by CAPTCHA
            const pageContent = await page.content();
            if (pageContent.includes('captcha') || pageContent.includes('blocked')) {
                console.error('🚫 CAPTCHA/Block detected! Try using better proxies.');
            }
        }
    },

    maxRequestsPerCrawl: 50,
    maxConcurrency: 2, // Low concurrency to avoid detection
});

// Start crawling
await crawler.run([startUrl]);

console.log(`✅ Scraping complete! Total private properties: ${itemCount}`);

await Actor.exit();
