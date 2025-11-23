import axios from 'axios';
import type { PropertyListing } from '../portalIngestionService';

const BASE_URL = 'https://www.clickcase.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export class ClickCaseAdapter {
  name = 'ClickCase.it';
  portalId = 'clickcase';

  async search(params: { city?: string; maxItems?: number }): Promise<PropertyListing[]> {
    console.log('[CLICKCASE] 🔍 Scraping ClickCase (100% private properties)');
    const listings: PropertyListing[] = [];

    try {
      const response = await axios.get(`${BASE_URL}/ricerca`, {
        params: {
          city: params.city || 'milano',
          type: 'casa',
          contract: 'vendita'
        },
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
        },
        timeout: 15000,
      });
      
      console.log(`[CLICKCASE] Fetching URL (params auto-encoded by axios)`);

      const html = response.data;
      
      // Estrae annunci dalla pagina (regex per dati strutturati)
      const propertyRegex = /class="property-card"[^>]*data-id="([^"]*)"[^>]*>(.*?)<\/div>/gs;
      let match;
      let count = 0;

      while ((match = propertyRegex.exec(html)) !== null && count < (params.maxItems || 100)) {
        try {
          const id = match[1];
          const itemHtml = match[2];
          
          // Estrae titolo
          const titleMatch = itemHtml.match(/<h\d[^>]*>([^<]*)<\/h\d>/);
          const title = titleMatch ? titleMatch[1].trim() : 'N/A';

          // Estrae URL
          const urlMatch = itemHtml.match(/<a[^>]*href="([^"]*)"[^>]*>/);
          const url = urlMatch ? `${BASE_URL}${urlMatch[1]}` : '';

          // Estrae prezzo
          const priceMatch = itemHtml.match(/€\s*([\d.,]+)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/\D/g, '')) : 0;

          // Estrae indirizzo
          const addressMatch = itemHtml.match(/<span class="location">([^<]*)<\/span>/);
          const address = addressMatch ? addressMatch[1].trim() : '';

          // Estrae mq
          const meterMatch = itemHtml.match(/(\d+)\s*m(?:q|²)/i);
          const size = meterMatch ? parseInt(meterMatch[1]) : 0;

          const listing: PropertyListing = {
            externalId: id,
            title,
            address,
            city: params.city || 'milano',
            price,
            size,
            url,
            description: title,
            portal: 'clickcase',
            ownerType: 'private', // Always private on ClickCase
            source: 'clickcase',
          };

          listings.push(listing);
          count++;
        } catch (e) {
          console.warn('[CLICKCASE] ⚠️ Failed to parse item:', e);
        }
      }

      console.log(`[CLICKCASE] ✅ Found ${listings.length} PRIVATE properties`);
    } catch (error) {
      console.error('[CLICKCASE] ❌ Error scraping:', error);
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
