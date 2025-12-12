import { ApifyClient } from 'apify-client';

export interface SinglePropertyData {
  address: string;
  city: string;
  price: number | null;
  size: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  description: string;
  ownerPhone: string | null;
  ownerName: string | null;
  agencyName: string | null;
  portalSource: string;
  externalId: string;
  latitude: number | null;
  longitude: number | null;
  isAgency: boolean;
}

export class ApifySinglePropertyExtractor {
  private client: ApifyClient;

  constructor(apiToken: string) {
    this.client = new ApifyClient({ token: apiToken });
  }

  async extractFromImmobiliare(url: string): Promise<SinglePropertyData | null> {
    const idMatch = url.match(/annunci\/(\d+)/);
    if (!idMatch) {
      console.log('[APIFY-SINGLE] Could not extract ID from Immobiliare URL');
      return null;
    }

    const propertyId = idMatch[1];
    console.log(`[APIFY-SINGLE] Extracting Immobiliare property ID: ${propertyId}`);

    try {
      const run = await this.client.actor('igolaizola/immobiliare-it-scraper').call({
        startUrls: [{ url }],
        maxItems: 1,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      }, { 
        timeout: 120,
        waitSecs: 60 
      });

      console.log(`[APIFY-SINGLE] Immobiliare run completed: ${run.id}`);

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems({ limit: 10 });
      
      if (items.length === 0) {
        console.log('[APIFY-SINGLE] No items returned from Immobiliare actor');
        return null;
      }

      const item = items[0] as any;
      console.log('[APIFY-SINGLE] Immobiliare item keys:', Object.keys(item));

      return this.transformImmobiliareItem(item, propertyId);
    } catch (error) {
      console.error('[APIFY-SINGLE] Immobiliare extraction failed:', error);
      return null;
    }
  }

  async extractFromIdealista(url: string): Promise<SinglePropertyData | null> {
    const idMatch = url.match(/inmueble\/(\d+)|\/(\d+)\/?$/);
    if (!idMatch) {
      console.log('[APIFY-SINGLE] Could not extract ID from Idealista URL');
      return null;
    }

    const propertyId = idMatch[1] || idMatch[2];
    console.log(`[APIFY-SINGLE] Extracting Idealista property ID: ${propertyId}`);

    try {
      const run = await this.client.actor('igolaizola/idealista-scraper').call({
        startUrls: [{ url }],
        maxItems: 1,
        country: 'it',
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      }, { 
        timeout: 120,
        waitSecs: 60 
      });

      console.log(`[APIFY-SINGLE] Idealista run completed: ${run.id}`);

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems({ limit: 10 });
      
      if (items.length === 0) {
        console.log('[APIFY-SINGLE] No items returned from Idealista actor');
        return null;
      }

      const item = items[0] as any;
      console.log('[APIFY-SINGLE] Idealista item keys:', Object.keys(item));

      return this.transformIdealistaItem(item, propertyId);
    } catch (error) {
      console.error('[APIFY-SINGLE] Idealista extraction failed:', error);
      return null;
    }
  }

  private transformImmobiliareItem(item: any, externalId: string): SinglePropertyData {
    const geography = item.geography || {};
    const topology = item.topology || {};
    const price = item.price || {};
    const contacts = item.contacts || {};
    const analytics = item.analytics || {};

    const street = geography.street || geography.address || '';
    const municipality = geography.municipality?.name || geography.city || 'Milano';
    const address = street ? `${street}, ${municipality}` : municipality;

    const phones = contacts.phones || [];
    const phone = phones.length > 0 ? phones[0].num : null;

    const isAgency = analytics.advertiser === 'agenzia' || 
                     analytics.advertiser === 'agency' ||
                     !!analytics.agencyName;

    return {
      address,
      city: municipality,
      price: price.raw || price.value || null,
      size: topology.surface?.size || item.surface || null,
      bedrooms: parseInt(topology.rooms) || item.rooms || null,
      bathrooms: parseInt(topology.bathrooms) || item.bathrooms || null,
      floor: topology.floor || item.floor || null,
      description: item.description || item.title || '',
      ownerPhone: isAgency ? null : phone,
      ownerName: isAgency ? null : (item.advertiserName || null),
      agencyName: isAgency ? (analytics.agencyName || item.advertiserName || null) : null,
      portalSource: 'Immobiliare.it',
      externalId,
      latitude: geography.geolocation?.latitude || null,
      longitude: geography.geolocation?.longitude || null,
      isAgency
    };
  }

  private transformIdealistaItem(item: any, externalId: string): SinglePropertyData {
    const address = item.address || item.location || item.title || '';
    const city = item.municipality || item.city || 'Milano';

    const contactInfo = item.contactInfo || {};
    const phone = contactInfo.phone || item.phone || null;

    const userType = item.userType || '';
    const isAgency = userType === 'professional' || 
                     userType === 'agency' ||
                     !!item.agencyName;

    return {
      address: address.includes(city) ? address : `${address}, ${city}`,
      city,
      price: item.price || item.priceInfo?.price || null,
      size: item.size || item.surface || null,
      bedrooms: item.rooms || item.bedrooms || null,
      bathrooms: item.bathrooms || null,
      floor: item.floor || null,
      description: item.description || item.title || '',
      ownerPhone: isAgency ? null : phone,
      ownerName: isAgency ? null : (item.contactName || null),
      agencyName: isAgency ? (item.agencyName || item.contactName || null) : null,
      portalSource: 'Idealista',
      externalId,
      latitude: item.latitude || null,
      longitude: item.longitude || null,
      isAgency
    };
  }
}

let extractorInstance: ApifySinglePropertyExtractor | null = null;

export function getApifySingleExtractor(): ApifySinglePropertyExtractor {
  if (!extractorInstance) {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      throw new Error('APIFY_API_TOKEN not configured');
    }
    extractorInstance = new ApifySinglePropertyExtractor(token);
  }
  return extractorInstance;
}
