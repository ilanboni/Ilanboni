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
    console.log(`[APIFY-SINGLE] Extracting Immobiliare property ID: ${propertyId} using memo23 specialized actor`);

    try {
      // Use memo23 Immobiliare.it actor ($1/1K, supports single detail pages)
      const run = await this.client.actor('memo23/immobiliare-scraper').call({
        startUrls: [{ url }],
        maxItems: 1,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      }, { 
        timeout: 180,
        waitSecs: 90 
      });

      console.log(`[APIFY-SINGLE] memo23 actor run completed: ${run.id}`);

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems({ limit: 10 });
      
      if (items.length === 0) {
        console.log('[APIFY-SINGLE] No items returned from memo23 actor');
        return null;
      }

      const item = items[0] as any;
      console.log('[APIFY-SINGLE] memo23 item keys:', Object.keys(item));
      
      if (item['#error'] || item.error) {
        console.log('[APIFY-SINGLE] memo23 actor returned error');
        return null;
      }

      // Parse memo23 actor output format (rich API payload)
      const geography = item.geography || {};
      const topology = item.topology || {};
      const priceData = item.price || {};
      const contacts = item.contacts || {};
      const author = item.author || {};
      
      // Extract address from geography or title
      const geoLocation = geography.location || {};
      const addressParts = [
        geoLocation.address || geoLocation.street,
        geography.zone || geoLocation.zone,
        geography.neighborhood
      ].filter(Boolean);
      const address = addressParts.length > 0 
        ? addressParts.join(', ')
        : item.title || geography.title || 'Milano';
      const city = geography.city || geoLocation.city || geoLocation.province || 'Milano';
      
      // Parse price (can be object with 'value' or 'raw')
      const priceRaw = priceData.value || priceData.raw || priceData;
      const price = typeof priceRaw === 'number' ? priceRaw : 
                   typeof priceRaw === 'string' ? parseInt(priceRaw.replace(/[^0-9]/g, '')) : null;
      
      // Parse surface (memo23: topology.surface.size contains the numeric value)
      const surfaceData = topology.surface;
      const sizeRaw = typeof surfaceData === 'object' 
        ? (surfaceData?.size || surfaceData?.value || surfaceData?.raw) 
        : surfaceData;
      const size = typeof sizeRaw === 'number' ? sizeRaw : 
                  typeof sizeRaw === 'string' ? parseInt(sizeRaw) : null;
      
      // Parse rooms (can be object with 'value' or plain number)
      const roomsData = topology.rooms || topology.locali;
      const bedrooms = typeof roomsData === 'object' ? (roomsData?.value || roomsData?.raw) : roomsData;
      
      // Parse bathrooms and floor
      const bathroomsData = topology.bathrooms || topology.bagni;
      const bathrooms = typeof bathroomsData === 'object' ? (bathroomsData?.value) : bathroomsData;
      
      const floorData = topology.floor || topology.floorValue;
      const floor = typeof floorData === 'object' ? (floorData?.value || floorData?.label) : floorData;
      
      // Determine if agency or private
      const agencyName = contacts.contactName || author.name || null;
      const isPrivate = author.type === 'private' || 
                       (author.name || '').toLowerCase().includes('privat') ||
                       (contacts.contactType || '').toLowerCase().includes('privat');
      
      // Handle description (might be object or string)
      const descText = typeof item.description === 'string' 
        ? item.description 
        : item.description?.text || item.description?.value || '';
      const description = descText.substring(0, 500);
      
      // Coordinates
      const latitude = geography.lat || geography.coordinates?.lat || null;
      const longitude = geography.lng || geography.coordinates?.lng || null;

      console.log(`[APIFY-SINGLE] Parsed memo23: ${address}, €${price}, ${size}mq, agency: ${agencyName}, private: ${isPrivate}`);

      return {
        address,
        city,
        price,
        size: typeof size === 'number' ? size : (size ? parseInt(String(size)) : null),
        bedrooms: typeof bedrooms === 'number' ? bedrooms : (bedrooms ? parseInt(String(bedrooms)) : null),
        bathrooms: typeof bathrooms === 'number' ? bathrooms : (bathrooms ? parseInt(String(bathrooms)) : null),
        floor: floor?.toString() || null,
        description,
        ownerPhone: item.seller?.phone || null,
        ownerName: isPrivate ? (item.seller?.name || null) : null,
        agencyName: !isPrivate ? agencyName : null,
        portalSource: 'Immobiliare.it',
        externalId: propertyId,
        latitude,
        longitude,
        isAgency: !isPrivate && !!agencyName
      };
    } catch (error) {
      console.error('[APIFY-SINGLE] memo23 extraction failed:', error);
      return null;
    }
  }

  async extractFromIdealista(url: string): Promise<SinglePropertyData | null> {
    const idMatch = url.match(/inmueble\/(\d+)|immobile\/(\d+)|\/(\d+)\/?$/);
    if (!idMatch) {
      console.log('[APIFY-SINGLE] Could not extract ID from Idealista URL');
      return null;
    }

    const propertyId = idMatch[1] || idMatch[2] || idMatch[3];
    console.log(`[APIFY-SINGLE] Extracting Idealista property ID: ${propertyId} using dz_omar specialized actor`);

    try {
      // Use specialized Idealista actor for single URL extraction
      const run = await this.client.actor('dz_omar/idealista-scraper-api').call({
        Url: url,
        proxyConfig: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        maxRetries: 2,
        timeout: 60,
        includeGallery: false,
        extractContactInfo: true
      }, { 
        timeout: 180,
        waitSecs: 90 
      });

      console.log(`[APIFY-SINGLE] dz_omar actor run completed for Idealista: ${run.id}`);

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems({ limit: 10 });
      
      if (items.length === 0) {
        console.log('[APIFY-SINGLE] No items returned from dz_omar actor for Idealista');
        return null;
      }

      const item = items[0] as any;
      console.log('[APIFY-SINGLE] dz_omar Idealista item keys:', Object.keys(item));
      
      if (item['#error'] || item.error) {
        console.log('[APIFY-SINGLE] dz_omar actor returned error');
        return null;
      }

      // Parse dz_omar actor output format
      const address = item.title || item.address || item.location || 'Milano';
      const city = item.municipality || item.city || 'Milano';
      const priceRaw = item.price?.value || item.price?.raw || item.price;
      const price = typeof priceRaw === 'number' ? priceRaw : 
                   typeof priceRaw === 'string' ? parseInt(priceRaw.replace(/[^0-9]/g, '')) : null;
      
      const size = item.builtArea?.value || item.surface || item.size || null;
      const bedrooms = item.rooms || item.bedrooms || null;
      const bathrooms = item.bathrooms || null;
      const floor = item.floor || null;
      
      const agencyName = item.agency?.name || item.contact?.name || item.agencyName || null;
      const isPrivate = item.isPrivate || 
                       (item.contact?.type || '').toLowerCase().includes('particular') ||
                       (item.contact?.type || '').toLowerCase().includes('privat') ||
                       !agencyName;
      
      const descText = typeof item.description === 'string' 
        ? item.description 
        : item.description?.text || '';
      const description = descText.substring(0, 500);
      const latitude = item.coordinates?.lat || item.latitude || null;
      const longitude = item.coordinates?.lng || item.longitude || null;
      const ownerPhone = item.contact?.phone || item.phone || null;

      console.log(`[APIFY-SINGLE] Parsed Idealista: ${address}, €${price}, ${size}mq, agency: ${agencyName}`);

      return {
        address,
        city,
        price,
        size: typeof size === 'number' ? size : (size ? parseInt(String(size)) : null),
        bedrooms: typeof bedrooms === 'number' ? bedrooms : (bedrooms ? parseInt(String(bedrooms)) : null),
        bathrooms: typeof bathrooms === 'number' ? bathrooms : (bathrooms ? parseInt(String(bathrooms)) : null),
        floor: floor?.toString() || null,
        description,
        ownerPhone,
        ownerName: isPrivate ? (item.contact?.name || null) : null,
        agencyName: !isPrivate ? agencyName : null,
        portalSource: 'Idealista',
        externalId: propertyId,
        latitude,
        longitude,
        isAgency: !isPrivate && !!agencyName
      };
    } catch (error) {
      console.error('[APIFY-SINGLE] dz_omar Idealista extraction failed:', error);
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
