import axios from 'axios';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

const IDEALISTA_BASE_URL = 'https://www.idealista.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const REQUEST_DELAY_MS = 2000;

export class IdealistaAdapter implements PortalAdapter {
  name = 'Idealista';
  portalId = 'idealista';
  private lastRequestTime = 0;

  async search(criteria: SearchCriteria): Promise<PropertyListing[]> {
    const { baseUrl, params } = this.buildSearchUrlAndParams(criteria);
    const fullUrl = params ? `${baseUrl}?${new URLSearchParams(params as any).toString()}` : baseUrl;
    console.log(`[IDEALISTA] Searching: ${fullUrl}`);

    await this.respectRateLimit();

    try {
      const response = await axios.get(fullUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
        },
        timeout: 15000
      });

      const listings = this.parseSearchResults(response.data);
      console.log(`[IDEALISTA] Found ${listings.length} listings`);
      
      return listings;
    } catch (error) {
      console.error('[IDEALISTA] Search failed:', error);
      return [];
    }
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    const url = `${IDEALISTA_BASE_URL}/immobile/${externalId}/`;
    
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
      console.error(`[IDEALISTA] Failed to fetch details for ${externalId}:`, error);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.head(IDEALISTA_BASE_URL, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  private buildSearchUrlAndParams(criteria: SearchCriteria): { baseUrl: string; params?: Record<string, string> } {
    const parts: string[] = [IDEALISTA_BASE_URL];
    
    parts.push('vendita-case');
    
    if (criteria.city) {
      parts.push(criteria.city.toLowerCase().replace(/\s+/g, '-'));
    }
    
    if (criteria.zone) {
      parts.push(criteria.zone.toLowerCase().replace(/\s+/g, '-'));
    }

    const baseUrl = parts.join('/') + '/';
    
    const params: Record<string, string> = {};
    
    if (criteria.minPrice) {
      params.prezzoMinimo = criteria.minPrice.toString();
    }
    if (criteria.maxPrice) {
      params.prezzoMassimo = criteria.maxPrice.toString();
    }
    if (criteria.minSize) {
      params.superficieMinima = criteria.minSize.toString();
    }
    if (criteria.maxSize) {
      params.superficieMassima = criteria.maxSize.toString();
    }
    if (criteria.bedrooms) {
      params.camere = criteria.bedrooms.toString();
    }

    return { baseUrl, params: Object.keys(params).length > 0 ? params : undefined };
  }

  private parseSearchResults(html: string): PropertyListing[] {
    const listings: PropertyListing[] = [];

    const articleRegex = /<article[^>]*class="[^"]*item[^"]*"[^>]*>(.*?)<\/article>/gs;
    const articles = html.match(articleRegex) || [];

    for (const article of articles.slice(0, 20)) {
      try {
        const listing = this.parseArticle(article);
        if (listing) {
          listings.push(listing);
        }
      } catch (error) {
        console.error('[IDEALISTA] Failed to parse article:', error);
      }
    }

    return listings;
  }

  private parseArticle(article: string): PropertyListing | null {
    const idMatch = article.match(/data-adid="(\d+)"/);
    const urlMatch = article.match(/href="([^"]+immobile\/\d+[^"]*)"/);
    const priceMatch = article.match(/<span class="[^"]*item-price[^"]*">([^<]+)<\/span>/);
    const titleMatch = article.match(/<a[^>]*class="[^"]*item-link[^"]*"[^>]*>([^<]+)<\/a>/);
    const addressMatch = article.match(/<span class="[^"]*item-detail[^"]*">([^<]+)<\/span>/);
    const sizeMatch = article.match(/(\d+)\s*m²/);
    const roomsMatch = article.match(/(\d+)\s*locale/i);

    if (!idMatch || !urlMatch) {
      return null;
    }

    const externalId = idMatch[1];
    let url = urlMatch[1];
    if (!url.startsWith('http')) {
      url = IDEALISTA_BASE_URL + url;
    }

    const priceText = priceMatch?.[1] || '0';
    const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;

    const sizeText = sizeMatch?.[1] || '0';
    const size = parseInt(sizeText) || 0;

    const roomsText = roomsMatch?.[1] || '0';
    const bedrooms = parseInt(roomsText) || undefined;

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
