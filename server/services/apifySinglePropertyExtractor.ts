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
    console.log(`[APIFY-SINGLE] Extracting Immobiliare property ID: ${propertyId} using web-scraper`);

    try {
      const run = await this.client.actor('apify/cheerio-scraper').call({
        startUrls: [{ url }],
        maxRequestsPerCrawl: 1,
        pageFunction: `async function pageFunction(context) {
          const { $, request } = context;
          
          const title = $('h1.im-titleBlock__title, .re-title__title').text().trim();
          const address = $('.im-titleBlock__details, .re-title__location').text().trim() || title;
          const priceText = $('[class*="price"]').first().text().trim();
          const price = parseInt(priceText.replace(/[^0-9]/g, '')) || null;
          
          const sizeText = $('[class*="surface"], [class*="superficie"]').text();
          const sizeMatch = sizeText.match(/(\\d+)\\s*m/);
          const size = sizeMatch ? parseInt(sizeMatch[1]) : null;
          
          const rooms = $('[class*="locali"], [class*="rooms"]').text();
          const roomsMatch = rooms.match(/(\\d+)/);
          const bedrooms = roomsMatch ? parseInt(roomsMatch[1]) : null;
          
          const bathrooms = $('[class*="bagn"]').text();
          const bathroomsMatch = bathrooms.match(/(\\d+)/);
          const bathroomsNum = bathroomsMatch ? parseInt(bathroomsMatch[1]) : null;
          
          const floor = $('[class*="piano"]').text().trim();
          
          const agencyName = $('.im-lead__agency-name, .re-agent__name, [class*="agency"]').text().trim();
          const isAgency = !!agencyName || $('[class*="agenzia"]').length > 0;
          
          const description = $('.im-description__content, .re-description__text').text().trim().substring(0, 500);
          
          return {
            address: address || 'Milano',
            city: 'Milano',
            price,
            size,
            bedrooms,
            bathrooms: bathroomsNum,
            floor,
            description,
            agencyName: isAgency ? agencyName : null,
            isAgency,
            externalId: '${propertyId}',
            url: request.url
          };
        }`,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      }, { 
        timeout: 120,
        waitSecs: 60 
      });

      console.log(`[APIFY-SINGLE] Cheerio scraper run completed: ${run.id}`);

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems({ limit: 10 });
      
      if (items.length === 0) {
        console.log('[APIFY-SINGLE] No items returned from cheerio scraper');
        return null;
      }

      const item = items[0] as any;
      console.log('[APIFY-SINGLE] Cheerio item:', JSON.stringify(item, null, 2));

      return {
        address: item.address || 'Milano',
        city: item.city || 'Milano',
        price: item.price,
        size: item.size,
        bedrooms: item.bedrooms,
        bathrooms: item.bathrooms,
        floor: item.floor,
        description: item.description || '',
        ownerPhone: null,
        ownerName: null,
        agencyName: item.agencyName,
        portalSource: 'Immobiliare.it',
        externalId: propertyId,
        latitude: null,
        longitude: null,
        isAgency: item.isAgency || false
      };
    } catch (error) {
      console.error('[APIFY-SINGLE] Cheerio extraction failed:', error);
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
    console.log(`[APIFY-SINGLE] Extracting Idealista property ID: ${propertyId} using web-scraper`);

    try {
      const run = await this.client.actor('apify/cheerio-scraper').call({
        startUrls: [{ url }],
        maxRequestsPerCrawl: 1,
        pageFunction: `async function pageFunction(context) {
          const { $, request } = context;
          
          const title = $('h1, .main-info__title-main').text().trim();
          const address = $('.main-info__title-minor, .location').text().trim() || title;
          
          const priceText = $('[class*="price"], .info-data-price').first().text().trim();
          const price = parseInt(priceText.replace(/[^0-9]/g, '')) || null;
          
          const sizeText = $('[class*="detail-info"] span, .info-features').text();
          const sizeMatch = sizeText.match(/(\\d+)\\s*m/);
          const size = sizeMatch ? parseInt(sizeMatch[1]) : null;
          
          const roomsMatch = sizeText.match(/(\\d+)\\s*(?:hab|loc|cam)/i);
          const bedrooms = roomsMatch ? parseInt(roomsMatch[1]) : null;
          
          const bathroomsMatch = sizeText.match(/(\\d+)\\s*ba[ñg]/i);
          const bathroomsNum = bathroomsMatch ? parseInt(bathroomsMatch[1]) : null;
          
          const floorMatch = sizeText.match(/(\\d+)[ºª°]?\\s*(?:piso|piano|floor)/i);
          const floor = floorMatch ? floorMatch[1] : null;
          
          const agencyName = $('.professional-name, [class*="advertiser-name"]').text().trim();
          const isPrivate = $('[class*="particular"]').length > 0 || 
                           sizeText.toLowerCase().includes('particular') ||
                           !agencyName;
          
          const description = $('.comment, .adCommentsLanguage').text().trim().substring(0, 500);
          
          return {
            address: address || 'Milano',
            city: 'Milano',
            price,
            size,
            bedrooms,
            bathrooms: bathroomsNum,
            floor,
            description,
            agencyName: isPrivate ? null : agencyName,
            isAgency: !isPrivate,
            externalId: '${propertyId}',
            url: request.url
          };
        }`,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      }, { 
        timeout: 120,
        waitSecs: 60 
      });

      console.log(`[APIFY-SINGLE] Cheerio scraper run completed for Idealista: ${run.id}`);

      const { items } = await this.client.dataset(run.defaultDatasetId).listItems({ limit: 10 });
      
      if (items.length === 0) {
        console.log('[APIFY-SINGLE] No items returned from cheerio scraper for Idealista');
        return null;
      }

      const item = items[0] as any;
      console.log('[APIFY-SINGLE] Idealista cheerio item:', JSON.stringify(item, null, 2));

      return {
        address: item.address || 'Milano',
        city: item.city || 'Milano',
        price: item.price,
        size: item.size,
        bedrooms: item.bedrooms,
        bathrooms: item.bathrooms,
        floor: item.floor,
        description: item.description || '',
        ownerPhone: null,
        ownerName: null,
        agencyName: item.agencyName,
        portalSource: 'Idealista',
        externalId: propertyId,
        latitude: null,
        longitude: null,
        isAgency: item.isAgency || false
      };
    } catch (error) {
      console.error('[APIFY-SINGLE] Idealista cheerio extraction failed:', error);
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
