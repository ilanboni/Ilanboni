import { ApifyClient } from 'apify-client';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

const IDEALISTA_PRIVATE_BASE_URL = 'https://www.idealista.it/vendita-case/milano-milano/?ordine=da-privati-asc';
const REQUEST_DELAY_MS = 5000;

// Duomo di Milano coordinates for distance filtering
const DUOMO_MILANO_LAT = 45.4642;
const DUOMO_MILANO_LNG = 9.1900;
const MAX_DISTANCE_KM = 4;

export class Memo23IdealistaAdapter implements PortalAdapter {
  name = 'Idealista Private (Memo23)';
  portalId = 'idealista-private-memo23';
  private lastRequestTime = 0;
  private client: ApifyClient;

  constructor() {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      throw new Error('APIFY_API_TOKEN environment variable is required');
    }
    this.client = new ApifyClient({ token });
  }

  async search(criteria: SearchCriteria & { maxItems?: number }): Promise<PropertyListing[]> {
    console.log(`[MEMO23-IDEALISTA] Searching for PRIVATE properties only`);

    await this.respectRateLimit();

    try {
      const startUrl = IDEALISTA_PRIVATE_BASE_URL;
      
      const input = {
        startUrls: [{ url: startUrl }],
        maxItems: criteria.maxItems || 100,
        monitoringMode: false,
        maxConcurrency: 10,
        minConcurrency: 1,
        maxRequestRetries: 100,
        proxyConfiguration: {
          useApifyProxy: true
        }
      };

      console.log(`[MEMO23-IDEALISTA] Starting memo23/apify-idealista-scraper with URL: ${startUrl}`);
      console.log(`[MEMO23-IDEALISTA] Full input payload:`, JSON.stringify(input, null, 2));

      const run = await this.client.actor('memo23/apify-idealista-scraper').call(input);
      
      console.log(`[MEMO23-IDEALISTA] Run ID: ${run.id}, Status: ${run.status}`);
      
      // Get run details for debugging
      try {
        const runDetails: any = await this.client.run(run.id).get();
        console.log('[MEMO23-IDEALISTA] Run completed:', {
          status: runDetails?.status,
          statusMessage: runDetails?.statusMessage,
          itemsCount: runDetails?.stats?.itemCount,
          failedRequests: runDetails?.stats?.requestsFailed,
          finishedAt: runDetails?.finishedAt
        });
      } catch (detailsError: any) {
        console.log('[MEMO23-IDEALISTA] Could not fetch run details:', detailsError?.message);
      }
      
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      console.log(`[MEMO23-IDEALISTA] Dataset returned ${items.length} items (expected PRIVATE only)`);
      if (items.length > 0) {
        console.log('[MEMO23-IDEALISTA] First item sample:', JSON.stringify(items[0], null, 2));
      }

      // Transform memo23 results to PropertyListings
      const listings: PropertyListing[] = [];
      let filteredByDistance = 0;
      let filteredByAgency = 0;
      
      for (const item of items) {
        try {
          const itemData: any = item;
          
          // Extract basic info
          const price = Number(itemData.price || itemData.priceInfo?.amount) || 0;
          const size = Number(itemData.size || itemData.surface) || 0;
          const rooms = itemData.rooms || itemData.bedrooms ? Number(itemData.rooms || itemData.bedrooms) : undefined;
          const bathrooms = itemData.bathrooms ? Number(itemData.bathrooms) : undefined;
          const address = String(itemData.address || itemData.ubication || '');
          const url = itemData.url || itemData.detailUrl || `https://www.idealista.it/inmueble/${itemData.adid}/`;
          const propertyId = String(itemData.adid || itemData.propertyCode || itemData.id || '');
          
          // Extract coordinates
          const latitude = itemData.latitude ? parseFloat(String(itemData.latitude)) : undefined;
          const longitude = itemData.longitude ? parseFloat(String(itemData.longitude)) : undefined;
          
          // Filter by distance from Duomo (4 km radius)
          if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
            const distance = this.calculateDistance(DUOMO_MILANO_LAT, DUOMO_MILANO_LNG, latitude, longitude);
            if (distance > MAX_DISTANCE_KM) {
              console.log(`[MEMO23-IDEALISTA] ⊘ Filtered out by distance: ${propertyId} - ${distance.toFixed(2)} km from Duomo (max ${MAX_DISTANCE_KM} km)`);
              filteredByDistance++;
              continue;
            }
            console.log(`[MEMO23-IDEALISTA] ✓ Within range: ${propertyId} - ${distance.toFixed(2)} km from Duomo`);
          } else {
            console.log(`[MEMO23-IDEALISTA] ⚠️ No coordinates for ${propertyId}, including anyway`);
          }
          
          // Determine if property is from private seller
          // Check contactInfo to verify it's actually private
          let ownerType: 'private' | 'agency' = 'private'; // Default assumption from URL
          let agencyName: string | undefined = undefined;
          
          if (itemData.contact) {
            const contactInfo = itemData.contact;
            // If there's a professional/company name, it's likely an agency
            if (contactInfo.contactName || contactInfo.commercialName || contactInfo.agencyName) {
              ownerType = 'agency';
              agencyName = String(contactInfo.commercialName || contactInfo.contactName || contactInfo.agencyName || '');
              console.log(`[MEMO23-IDEALISTA] ⊘ Filtered out agency: ${propertyId} - ${agencyName}`);
              filteredByAgency++;
              continue; // Skip agencies
            }
          }
          
          // Additional check: if description mentions typical agency keywords
          const description = String(itemData.propertyComment || itemData.description || '');
          const lowerDesc = description.toLowerCase();
          const agencyKeywords = ['agenzia', 'immobiliare', 'proponiamo', 'disponiamo', 'propone'];
          if (agencyKeywords.some(keyword => lowerDesc.includes(keyword))) {
            console.log(`[MEMO23-IDEALISTA] ⊘ Filtered out (agency keywords in description): ${propertyId}`);
            filteredByAgency++;
            continue;
          }
          
          if (url && price > 0) {
            listings.push({
              externalId: propertyId,
              title: String(itemData.title || `Proprietà privata - ${address}`),
              address: address,
              city: criteria.city || 'Milano',
              price: price,
              size: size,
              bedrooms: rooms,
              bathrooms: bathrooms,
              type: 'apartment',
              url: url,
              description: description,
              latitude: latitude && !isNaN(latitude) ? latitude : undefined,
              longitude: longitude && !isNaN(longitude) ? longitude : undefined,
              ownerType: ownerType,
              agencyName: agencyName
            });
            
            console.log(`[MEMO23-IDEALISTA] ✅ Added PRIVATE property: ${propertyId} - ${address} (€${price.toLocaleString()})`);
          }
        } catch (itemError) {
          console.error('[MEMO23-IDEALISTA] Failed to transform item:', itemError);
        }
      }
      
      console.log(`[MEMO23-IDEALISTA] 📍 Distance filter: ${filteredByDistance} properties excluded (>${MAX_DISTANCE_KM}km from Duomo)`);
      console.log(`[MEMO23-IDEALISTA] 🏢 Agency filter: ${filteredByAgency} agencies excluded`);
      console.log(`[MEMO23-IDEALISTA] ✅ Found ${listings.length} PRIVATE listings`);
      
      return listings;
    } catch (error) {
      console.error('[MEMO23-IDEALISTA] Search failed:', error);
      return [];
    }
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    return null;
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for Apify client
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.APIFY_API_TOKEN;
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

  // Calculate distance between two GPS coordinates using Haversine formula
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
