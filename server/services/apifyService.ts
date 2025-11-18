import { ApifyClient } from 'apify-client';
import type { PropertyListing } from './portalIngestionService';
import * as fs from 'fs';
import * as path from 'path';
import { classifyFromApifyImmobiliare, classifyFromApifyIdealista } from '../lib/ownerClassification';

export interface ApifyScraperConfig {
  searchUrls?: string[];
  maxItems?: number;
  proxyConfiguration?: {
    useApifyProxy: boolean;
    apifyProxyGroups?: string[];
  };
  filters?: {
    propertyType?: string;
    priceMin?: number;
    priceMax?: number;
    surfaceMin?: number;
    surfaceMax?: number;
    rooms?: number;
    bathrooms?: number;
  };
}

export class ApifyService {
  private client: ApifyClient;
  private actorId = 'igolaizola/immobiliare-it-scraper'; // New actor with 1-day trial

  constructor(apiToken: string) {
    this.client = new ApifyClient({ token: apiToken });
    console.log('[APIFY] Service initialized with actor:', this.actorId);
  }

  /**
   * Scrapes Immobiliare.it using Apify actor
   */
  async scrapeImmobiliare(config: ApifyScraperConfig): Promise<PropertyListing[]> {
    console.log(`[APIFY] Starting scrape with config:`, JSON.stringify(config, null, 2));
    
    // New actor format: igolaizola/immobiliare-it-scraper
    const input: any = {
      municipality: 'milano',
      category: 'vendita',
      maxItems: config.maxItems || 1000,
      proxyConfiguration: config.proxyConfiguration || {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };

    // Add filters if provided
    if (config.filters) {
      input.filters = config.filters;
      console.log('[APIFY] Using filters:', config.filters);
    }

    try {
      // Run the actor
      const run = await this.client.actor(this.actorId).call(input);
      console.log(`[APIFY] Actor run completed: ${run.id}`);
      console.log(`[APIFY] Dataset: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`);

      // Fetch ALL results from dataset (not just first page)
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems({
        limit: 999999  // Get all items
      });
      console.log(`[APIFY] Fetched ${items.length} items from dataset`);

      // Debug: Log first item structure
      if (items.length > 0) {
        console.log('[APIFY] Sample item structure:', JSON.stringify(items[0], null, 2));
        console.log('[APIFY] Sample item keys:', Object.keys(items[0]));
      }

      // Transform Apify results to PropertyListing format
      const listings = this.transformApifyResults(items);
      console.log(`[APIFY] Transformed ${listings.length} listings`);

      return listings;
    } catch (error) {
      console.error('[APIFY] Scraping failed:', error);
      throw error;
    }
  }

  /**
   * Scrapes Idealista.it using Apify actor
   */
  async scrapeIdealista(config: { maxItems?: number } = {}): Promise<PropertyListing[]> {
    console.log(`[APIFY-IDEALISTA] Starting scrape...`);
    
    const idealistaActorId = 'igolaizola/idealista-scraper';
    
    const input = {
      location: 'Milano',
      country: 'it',  // CRITICAL: Must specify Italy to avoid country mismatch
      maxItems: config.maxItems || 1000,
      propertyType: 'homes',
      operation: 'sale',
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };

    try {
      const run = await this.client.actor(idealistaActorId).call(input);
      console.log(`[APIFY-IDEALISTA] Actor run completed: ${run.id}`);

      // Fetch ALL items from dataset (not just first page)
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems({
        limit: 999999  // Get all items
      });
      console.log(`[APIFY-IDEALISTA] Fetched ${items.length} items from dataset`);

      if (items.length > 0) {
        console.log('[APIFY-IDEALISTA] Sample item keys:', Object.keys(items[0]));
      }

      const listings = this.transformIdealistaResults(items);
      console.log(`[APIFY-IDEALISTA] Transformed ${listings.length} listings`);

      return listings;
    } catch (error) {
      console.error('[APIFY-IDEALISTA] Scraping failed:', error);
      return [];
    }
  }

  /**
   * Transform Idealista Apify data to PropertyListing format
   */
  private transformIdealistaResults(items: any[]): PropertyListing[] {
    console.log(`[APIFY-IDEALISTA] Processing ${items.length} raw items...`);

    return items
      .filter(item => {
        if (!item || !item.url) {
          return false;
        }
        return true;
      })
      .map((item): PropertyListing => {
        const price = item.price || 0;
        const size = item.size || 0;
        const rooms = item.rooms;
        const address = item.address || 'Indirizzo non disponibile';
        const url = item.url || '';
        const propertyId = item.propertyCode || item.id || '';
        
        const rawLat = item.latitude || item.lat;
        const rawLng = item.longitude || item.lng || item.lon;
        
        const latitude = rawLat ? (typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat))) : undefined;
        const longitude = rawLng ? (typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng))) : undefined;
        
        const classification = classifyFromApifyIdealista(item);
        
        if (classification.ownerType === 'private' || classification.confidence !== 'high') {
          console.log(`[APIFY-IDEALISTA-CLASSIFY] ID ${propertyId}: ${classification.ownerType} (${classification.confidence}) - ${classification.reasoning}`);
        }
        
        // Extract owner contact info from Idealista data
        // Idealista format may have: item.contact, item.advertiser, item.phone, item.email
        let ownerPhone: string | undefined = undefined;
        let ownerName: string | undefined = undefined;
        let ownerEmail: string | undefined = undefined;
        
        // Normalize phone number: keep country code (+39), remove only separators
        if (item.phone) {
          const phoneStr = String(item.phone).trim();
          // Remove spaces, dots, dashes, but keep +
          ownerPhone = phoneStr.replace(/[\s\.\-\(\)]/g, '');
        } else if (item.contact && typeof item.contact === 'string') {
          // Extract phone number from contact field preserving country code
          const phoneMatch = item.contact.match(/(\+?\d{1,3})?[\s\.\-]?(\d[\d\s\.\-]{6,})/);
          if (phoneMatch) {
            // Normalize: remove separators but keep +
            ownerPhone = phoneMatch[0].replace(/[\s\.\-\(\)]/g, '');
          }
        }
        
        // Extract owner/advertiser name
        if (item.advertiser) {
          ownerName = String(item.advertiser).trim();
        } else if (item.advertiserName) {
          ownerName = String(item.advertiserName).trim();
        }
        
        // Extract email if available
        if (item.email) {
          ownerEmail = String(item.email).trim();
        }
        
        // Extract images from Idealista
        const images = item.images || item.photos || [];
        const imageUrls = Array.isArray(images) 
          ? images.map((img: any) => typeof img === 'string' ? img : (img.url || img.src || '')).filter((url: string) => url).slice(0, 10)
          : [];
        
        return {
          externalId: propertyId,
          title: item.title || item.description || `Appartamento - ${address}`,
          address: address,
          city: 'Milano',
          price: price,
          size: size,
          bedrooms: rooms,
          bathrooms: item.bathrooms || undefined,
          floor: item.floor || undefined,
          type: 'apartment',
          url: url,
          description: item.description || '',
          latitude: latitude && !isNaN(latitude) ? latitude : undefined,
          longitude: longitude && !isNaN(longitude) ? longitude : undefined,
          ownerType: classification.ownerType,
          agencyName: classification.agencyName ?? undefined, // Convert null to undefined
          ownerName: ownerName,
          ownerPhone: ownerPhone,
          ownerEmail: ownerEmail,
          imageUrls: imageUrls,
          source: 'apify'
        };
      });
  }

  /**
   * Scrapes all properties in Milano from BOTH Immobiliare.it and Idealista.it
   * Uses geographic center (Duomo: 45.464, 9.190) with specific zones
   */
  async scrapeAllMilano(): Promise<PropertyListing[]> {
    console.log('[APIFY] 🔍 Starting complete Milano scrape from BOTH portals...');

    const results: PropertyListing[] = [];
    
    // Scrape Immobiliare.it
    try {
      console.log('[APIFY] 📡 Scraping Immobiliare.it...');
      const immobiliareListings = await this.scrapeImmobiliare({
        maxItems: 20000,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      });
      console.log(`[APIFY] ✅ Immobiliare.it: ${immobiliareListings.length} listings`);
      results.push(...immobiliareListings);
    } catch (error) {
      console.error('[APIFY] ❌ Immobiliare.it scraping failed:', error);
    }
    
    // Scrape Idealista.it
    try {
      console.log('[APIFY] 📡 Scraping Idealista.it...');
      const idealistaListings = await this.scrapeIdealista({
        maxItems: 10000
      });
      console.log(`[APIFY] ✅ Idealista.it: ${idealistaListings.length} listings`);
      results.push(...idealistaListings);
    } catch (error) {
      console.error('[APIFY] ❌ Idealista.it scraping failed:', error);
    }
    
    console.log(`[APIFY] 🎉 Total listings from both portals: ${results.length}`);
    return results;
  }

  /**
   * Scrapes properties for a specific buyer based on their criteria
   * This ensures we find ALL relevant properties, not just the first 2000
   */
  async scrapeForBuyer(buyerCriteria: {
    propertyType?: string;
    minSize?: number;
    maxPrice?: number;
    rooms?: number;
    bathrooms?: number;
  }): Promise<PropertyListing[]> {
    console.log('[APIFY] 🎯 Starting targeted scrape for buyer criteria:', buyerCriteria);

    const filters: any = {};

    // Map propertyType (penthouse -> attico)
    if (buyerCriteria.propertyType) {
      const typeMap: Record<string, string> = {
        'penthouse': 'attico',
        'apartment': 'appartamento',
        'house': 'villa',
        'office': 'ufficio'
      };
      filters.propertyType = typeMap[buyerCriteria.propertyType.toLowerCase()] || buyerCriteria.propertyType;
    }

    if (buyerCriteria.maxPrice) {
      filters.priceMax = buyerCriteria.maxPrice;
    }

    if (buyerCriteria.minSize) {
      filters.surfaceMin = buyerCriteria.minSize;
    }

    if (buyerCriteria.rooms) {
      filters.rooms = buyerCriteria.rooms;
    }

    if (buyerCriteria.bathrooms) {
      filters.bathrooms = buyerCriteria.bathrooms;
    }

    return this.scrapeImmobiliare({
      maxItems: 3000, // Higher limit for targeted searches
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    });
  }

  /**
   * Calculate distance between two points in kilometers using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Transform Apify raw data (igolaizola/immobiliare-it-scraper format) to our PropertyListing format
   * New actor format: nested structure with geography.municipality.name
   */
  private transformApifyResults(items: any[]): PropertyListing[] {
    console.log(`[APIFY] Processing ${items.length} raw items from Apify (igolaizola format)...`);

    return items
      .filter(item => {
        if (!item || !item.geography) {
          console.log(`[APIFY] ❌ Filtered out: missing geography data`);
          return false;
        }

        // City is in geography.municipality.name
        const city = item.geography.municipality?.name || '';
        const cityNorm = city.toLowerCase();
        
        if (!cityNorm.includes('milan') && !cityNorm.includes('milano')) {
          console.log(`[APIFY] ❌ Filtered out: wrong city (${city})`);
          return false;
        }

        const address = item.geography.street || '';
        console.log(`[APIFY] ✅ Accepted: ${address} in ${city}`);
        return true;
      })
      .map(item => {
        const geography = item.geography || {};
        const topology = item.topology || {};
        const priceData = item.price || {};
        const analytics = item.analytics || {};
        const mediaData = item.media || {};
        const contacts = item.contacts || {};
        
        // Extract fields from nested structure
        const externalId = String(item.id || Date.now());
        const price = priceData.raw || 0;
        const size = topology.surface?.size || 0;
        const address = geography.street || 'Indirizzo non disponibile';
        const city = geography.municipality?.name || 'Milano';
        const postalCode = geography.zipcode || '';
        const latitude = geography.geolocation?.latitude;
        const longitude = geography.geolocation?.longitude;
        
        // Type mapping from topology.typology.name
        let type = 'apartment';
        const typologyName = (topology.typology?.name || '').toLowerCase();
        if (typologyName.includes('villa')) type = 'villa';
        else if (typologyName.includes('attico') || typologyName.includes('penthouse')) type = 'penthouse';
        else if (typologyName.includes('loft')) type = 'loft';

        // Build full address
        const fullAddress = postalCode 
          ? `${address}, ${postalCode}` 
          : address;

        // Owner type classification using shared helper
        const classification = classifyFromApifyImmobiliare(item);
        const ownerType = classification.ownerType;
        const agencyName = classification.agencyName;
        
        // Log classification for debugging (only for non-agency or low confidence)
        if (ownerType === 'private' || classification.confidence !== 'high') {
          console.log(`[APIFY-CLASSIFY] ID ${externalId}: ${ownerType} (${classification.confidence}) - ${classification.reasoning}`);
        }

        // Owner contact info (extract for all types, but prioritize for private sellers)
        let ownerPhone = null;
        let ownerName = null;
        let ownerEmail = null;
        
        // Extract phone from contacts.phones array
        if (contacts.phones && contacts.phones.length > 0) {
          ownerPhone = contacts.phones[0].num || null;
        }
        // Owner/Advertiser name
        ownerName = analytics.advertiserName || null;
        // Email might be in contacts if available
        ownerEmail = contacts.email || null;

        // URL construction
        const url = `https://www.immobiliare.it/annunci/${externalId}/`;

        // Extract images from media.images array
        const images = mediaData.images || [];
        const imageUrls = images
          .map((img: any) => img.hd || img.sd || '')
          .filter((url: string) => url)
          .slice(0, 10);

        return {
          externalId,
          title: item.title || `${type} in vendita`,
          address: fullAddress,
          city,
          price,
          size,
          bedrooms: parseInt(topology.rooms || '0') || undefined,
          bathrooms: parseInt(topology.bathrooms || '0') || undefined,
          floor: topology.floor || undefined,
          type,
          description: '', // No description field in this format
          url,
          imageUrls,
          latitude,
          longitude,
          ownerType,
          agencyName,
          ownerName,
          ownerPhone,
          ownerEmail,
          source: 'apify'
        } as PropertyListing;
      });
  }

  /**
   * Test connection and actor availability
   */
  async testConnection(): Promise<boolean> {
    try {
      const actorInfo = await this.client.actor(this.actorId).get();
      console.log(`[APIFY] ✅ Actor available: ${actorInfo?.name || this.actorId}`);
      return true;
    } catch (error) {
      console.error('[APIFY] ❌ Connection test failed:', error);
      return false;
    }
  }

  /**
   * Diagnostic: Scrape a small sample and save raw JSON for inspection
   * This helps us understand the actual field structure from Apify
   */
  async diagnosticScrape(): Promise<{ rawPath: string; sampleCount: number }> {
    console.log('[APIFY-DIAGNOSTIC] Starting diagnostic scrape...');
    
    const input = {
      municipality: 'milano',
      category: 'vendita',
      maxItems: 20, // Small sample
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    };

    try {
      const run = await this.client.actor(this.actorId).call(input);
      console.log(`[APIFY-DIAGNOSTIC] Run completed: ${run.id}`);

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      console.log(`[APIFY-DIAGNOSTIC] Fetched ${items.length} items`);

      // Save raw data to file for inspection
      const timestamp = Date.now();
      const uploadDir = path.join(process.cwd(), 'uploads', 'apify');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const rawPath = path.join(uploadDir, `raw-${timestamp}.json`);
      fs.writeFileSync(rawPath, JSON.stringify(items, null, 2), 'utf-8');
      
      console.log(`[APIFY-DIAGNOSTIC] ✅ Raw data saved to: ${rawPath}`);
      console.log(`[APIFY-DIAGNOSTIC] Sample item keys:`, items.length > 0 ? Object.keys(items[0]) : []);
      
      // Log first item structure for quick review
      if (items.length > 0) {
        console.log('[APIFY-DIAGNOSTIC] First item structure:', JSON.stringify(items[0], null, 2).substring(0, 1000) + '...');
      }

      return { rawPath, sampleCount: items.length };
    } catch (error) {
      console.error('[APIFY-DIAGNOSTIC] ❌ Diagnostic scrape failed:', error);
      throw error;
    }
  }

  /**
   * Scrape specific listings by their direct URLs using azzouzana actor
   * Use this for targeted scraping of missing/specific properties
   */
  async scrapeSpecificListings(urls: string[]): Promise<PropertyListing[]> {
    if (!urls || urls.length === 0) {
      console.warn('[APIFY-SPECIFIC] No URLs provided');
      return [];
    }

    console.log(`[APIFY-SPECIFIC] 🎯 Scraping ${urls.length} specific listings...`);
    
    const actorId = 'azzouzana/immobiliare-it-listing-page-scraper-by-items-urls';
    
    try {
      // azzouzana expects startUrls as array of objects with url property
      const startUrls = urls.map(url => ({ url }));
      
      const run = await this.client.actor(actorId).call({ startUrls });
      console.log(`[APIFY-SPECIFIC] Run completed: ${run.id}`);

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      console.log(`[APIFY-SPECIFIC] Fetched ${items.length} items`);

      if (items.length > 0) {
        console.log('[APIFY-SPECIFIC] Sample keys:', Object.keys(items[0]));
      }

      return this.transformAzzouzanaResults(items);
    } catch (error) {
      console.error('[APIFY-SPECIFIC] ❌ Scraping failed:', error);
      throw error;
    }
  }

  /**
   * Transform azzouzana actor results to PropertyListing format
   */
  private transformAzzouzanaResults(items: any[]): PropertyListing[] {
    return items
      .map((item, idx): PropertyListing | null => {
        try {
          // Match externalId from URL with or without trailing slash
          const urlMatch = item.url?.match(/\/annunci\/(\d+)/);
          const externalId = urlMatch ? urlMatch[1] : String(Date.now() + idx);

          let price = 0;
          if (item.price) {
            const priceMatch = String(item.price).match(/[\d.,]+/);
            if (priceMatch) {
              price = parseInt(priceMatch[0].replace(/[.,]/g, ''));
            }
          }

          let size = 0;
          if (item.surface || item.size) {
            const sizeMatch = String(item.surface || item.size).match(/\d+/);
            if (sizeMatch) {
              size = parseInt(sizeMatch[0]);
            }
          }

          const contacts = item.contacts || {};
          const advertiser = contacts.advertiser || item.advertiser || {};
          const agencyName = advertiser.name || contacts.agencyName || contacts.agency || null;
          const isPrivate = !agencyName || advertiser.type === 'private';

          const listing: PropertyListing = {
            externalId,
            title: item.title || item.description?.substring(0, 100) || 'Senza titolo',
            address: item.location?.address || item.address || 'Indirizzo non disponibile',
            city: item.location?.city || item.city || 'Milano',
            price,
            size,
            bedrooms: item.rooms || item.bedrooms,
            bathrooms: item.bathrooms,
            floor: item.floor,
            type: this.parsePropertyType(item.propertyType || item.type),
            url: item.url || `https://www.immobiliare.it/annunci/${externalId}/`,
            description: item.description || item.title || '',
            latitude: item.location?.coordinates?.lat || item.coordinates?.lat || null,
            longitude: item.location?.coordinates?.lng || item.coordinates?.lng || null,
            source: 'apify',
            ownerType: isPrivate ? 'private' : 'agency',
            agencyName: !isPrivate ? agencyName : null,
            ownerName: isPrivate ? (advertiser.name || contacts.name || null) : null,
            ownerPhone: isPrivate ? (contacts.phone || contacts.phoneNumber || null) : null,
            ownerEmail: isPrivate ? (contacts.email || null) : null
          };
          return listing;
        } catch (error) {
          console.error(`[APIFY-SPECIFIC] ❌ Transform error item ${idx}:`, error);
          return null;
        }
      })
      .filter((listing): listing is PropertyListing => listing !== null);
  }

  private parsePropertyType(type?: string): 'apartment' | 'house' | 'villa' | 'penthouse' | 'loft' | 'studio' {
    const lowerType = type?.toLowerCase() || '';
    
    if (lowerType.includes('attico') || lowerType.includes('penthouse')) return 'penthouse';
    if (lowerType.includes('villa')) return 'villa';
    if (lowerType.includes('loft')) return 'loft';
    if (lowerType.includes('studio') || lowerType.includes('monolocale')) return 'studio';
    if (lowerType.includes('casa') || lowerType.includes('house')) return 'house';
    
    return 'apartment';
  }
}

// Singleton instance
let apifyService: ApifyService | null = null;

export function getApifyService(): ApifyService {
  const apiToken = process.env.APIFY_API_TOKEN;
  
  if (!apiToken) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  if (!apifyService) {
    apifyService = new ApifyService(apiToken);
  }

  return apifyService;
}
