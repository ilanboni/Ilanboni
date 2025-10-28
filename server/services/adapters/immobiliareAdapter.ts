import axios from 'axios';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

const IMMOBILIARE_BASE_URL = 'https://www.immobiliare.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const REQUEST_DELAY_MS = 2000;

export class ImmobiliareAdapter implements PortalAdapter {
  name = 'Immobiliare.it';
  portalId = 'immobiliare';
  private lastRequestTime = 0;

  async search(criteria: SearchCriteria): Promise<PropertyListing[]> {
    const searchUrl = this.buildSearchUrl(criteria);
    console.log(`[IMMOBILIARE] Searching: ${searchUrl}`);

    await this.respectRateLimit();

    try {
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
        },
        timeout: 15000
      });

      const listings = this.parseSearchResults(response.data);
      console.log(`[IMMOBILIARE] Found ${listings.length} listings`);
      
      return listings;
    } catch (error) {
      console.error('[IMMOBILIARE] Search failed:', error);
      return [];
    }
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    const url = `${IMMOBILIARE_BASE_URL}/annunci/${externalId}/`;
    
    await this.respectRateLimit();

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT
        },
        timeout: 15000
      });

      return this.parseDetailPage(response.data, externalId);
    } catch (error) {
      console.error(`[IMMOBILIARE] Failed to fetch details for ${externalId}:`, error);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.head(IMMOBILIARE_BASE_URL, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private buildSearchUrl(criteria: SearchCriteria): string {
    const parts: string[] = [IMMOBILIARE_BASE_URL];
    
    parts.push('vendita-case');
    
    if (criteria.city) {
      parts.push(criteria.city.toLowerCase().replace(/\s+/g, '-'));
    }
    
    if (criteria.zone) {
      parts.push(criteria.zone.toLowerCase().replace(/\s+/g, '-'));
    }

    let url = parts.join('/') + '/';
    
    const params: string[] = [];
    
    if (criteria.minPrice) {
      params.push(`prezzoMinimo=${criteria.minPrice}`);
    }
    if (criteria.maxPrice) {
      params.push(`prezzoMassimo=${criteria.maxPrice}`);
    }
    if (criteria.minSize) {
      params.push(`superficieMinima=${criteria.minSize}`);
    }
    if (criteria.maxSize) {
      params.push(`superficieMassima=${criteria.maxSize}`);
    }
    if (criteria.bedrooms) {
      params.push(`locali=${criteria.bedrooms}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    return url;
  }

  private parseSearchResults(html: string): PropertyListing[] {
    const listings: PropertyListing[] = [];

    const listItemRegex = /<li[^>]*class="[^"]*in-realEstateResults__item[^"]*"[^>]*>(.*?)<\/li>/gs;
    const items = html.match(listItemRegex) || [];

    for (const item of items.slice(0, 20)) {
      try {
        const listing = this.parseListItem(item);
        if (listing) {
          listings.push(listing);
        }
      } catch (error) {
        console.error('[IMMOBILIARE] Failed to parse list item:', error);
      }
    }

    return listings;
  }

  private parseListItem(item: string): PropertyListing | null {
    const idMatch = item.match(/data-id="(\d+)"/);
    const urlMatch = item.match(/href="([^"]+\/annunci\/\d+[^"]*)"/);
    const priceMatch = item.match(/class="[^"]*in-realEstateListCard__price[^"]*"[^>]*>([^<]+)<\/li>/);
    const titleMatch = item.match(/<p[^>]*class="[^"]*in-realEstateListCard__title[^"]*"[^>]*>([^<]+)<\/p>/);
    const addressMatch = item.match(/<div[^>]*class="[^"]*in-realEstateListCard__location[^"]*"[^>]*>([^<]+)<\/div>/);
    const sizeMatch = item.match(/(\d+)\s*m²/);
    const roomsMatch = item.match(/(\d+)\s*local/i);
    const bathroomsMatch = item.match(/(\d+)\s*bagn/i);
    const floorMatch = item.match(/Piano\s+(\d+|T|S)/i);

    if (!idMatch || !urlMatch) {
      return null;
    }

    const externalId = idMatch[1];
    let url = urlMatch[1];
    if (!url.startsWith('http')) {
      url = IMMOBILIARE_BASE_URL + url;
    }

    const priceText = priceMatch?.[1] || '0';
    const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;

    const sizeText = sizeMatch?.[1] || '0';
    const size = parseInt(sizeText) || 0;

    const roomsText = roomsMatch?.[1] || '0';
    const bedrooms = parseInt(roomsText) || undefined;

    const bathroomsText = bathroomsMatch?.[1] || undefined;
    const bathrooms = bathroomsText ? parseInt(bathroomsText) : undefined;

    const floor = floorMatch?.[1] || undefined;

    const title = titleMatch?.[1]?.trim() || 'Appartamento';
    const address = addressMatch?.[1]?.trim() || '';

    const cityMatch = address.match(/,\s*([^,]+)$/);
    const city = cityMatch?.[1]?.trim() || 'Milano';

    return {
      externalId,
      title,
      address,
      city,
      price,
      size,
      bedrooms,
      bathrooms,
      floor,
      type: 'apartment',
      url,
      description: title,
      ownerType: 'agency'
    };
  }

  private parseDetailPage(html: string, externalId: string): PropertyListing | null {
    return null;
  }

  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < REQUEST_DELAY_MS) {
      const delay = REQUEST_DELAY_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }
}
