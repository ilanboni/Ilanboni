import { ApifyClient } from 'apify-client';
import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';

const REQUEST_DELAY_MS = 5000;

// Duomo di Milano coordinates for distance filtering
const DUOMO_MILANO_LAT = 45.4642;
const DUOMO_MILANO_LNG = 9.1900;
const MAX_DISTANCE_KM = 4;

export class CustomIdealistaAdapter implements PortalAdapter {
  name = 'Idealista Private (Custom Actor)';
  portalId = 'idealista-private-custom';
  private lastRequestTime = 0;
  private client: ApifyClient;
  private actorId: string;

  constructor(actorId?: string) {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      throw new Error('APIFY_API_TOKEN environment variable is required');
    }
    this.client = new ApifyClient({ token });
    
    // Actor ID will be set after deployment
    // Format: "YOUR_USERNAME/idealista-private-scraper" or the actor ID
    this.actorId = actorId || process.env.CUSTOM_IDEALISTA_ACTOR_ID || '';
    
    if (!this.actorId) {
      throw new Error('Custom actor ID not configured. Set CUSTOM_IDEALISTA_ACTOR_ID environment variable.');
    }
  }

  async search(criteria: SearchCriteria & { maxItems?: number }): Promise<PropertyListing[]> {
    console.log(`[CUSTOM-IDEALISTA] Searching for PRIVATE properties using custom actor: ${this.actorId}`);

    await this.respectRateLimit();

    try {
      const startUrl = 'https://www.idealista.it/vendita-case/milano-milano/?ordine=da-privati-asc';
      
      const input = {
        startUrl: startUrl,
        maxItems: criteria.maxItems || 100,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      };

      console.log(`[CUSTOM-IDEALISTA] Starting custom actor with URL: ${startUrl}`);
      console.log(`[CUSTOM-IDEALISTA] Full input payload:`, JSON.stringify(input, null, 2));

      const run = await this.client.actor(this.actorId).call(input);
      
      console.log(`[CUSTOM-IDEALISTA] Run ID: ${run.id}, Status: ${run.status}`);
      
      // Get run details for debugging
      try {
        const runDetails: any = await this.client.run(run.id).get();
        console.log('[CUSTOM-IDEALISTA] Run completed:', {
          status: runDetails?.status,
          statusMessage: runDetails?.statusMessage,
          itemsCount: runDetails?.stats?.itemCount,
          failedRequests: runDetails?.stats?.requestsFailed,
          finishedAt: runDetails?.finishedAt
        });
      } catch (detailsError: any) {
        console.log('[CUSTOM-IDEALISTA] Could not fetch run details:', detailsError?.message);
      }
      
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      console.log(`[CUSTOM-IDEALISTA] Dataset returned ${items.length} items (all should be PRIVATE)`);
      if (items.length > 0) {
        console.log('[CUSTOM-IDEALISTA] First item sample:', JSON.stringify(items[0], null, 2));
      }

      // Transform custom actor results to PropertyListings
      const listings: PropertyListing[] = [];
      let filteredByDistance = 0;
      
      for (const item of items) {
        try {
          const itemData: any = item;
          
          // Extract basic info from custom actor output
          const price = Number(itemData.price) || 0;
          const size = Number(itemData.size) || 0;
          const rooms = itemData.rooms ? Number(itemData.rooms) : undefined;
          const address = String(itemData.address || '');
          const url = String(itemData.url || '');
          const propertyId = String(itemData.adid || '');
          const description = String(itemData.description || '');
          
          // Extract coordinates
          const latitude = itemData.latitude ? parseFloat(String(itemData.latitude)) : undefined;
          const longitude = itemData.longitude ? parseFloat(String(itemData.longitude)) : undefined;
          
          // Filter by distance from Duomo (4 km radius)
          if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
            const distance = this.calculateDistance(DUOMO_MILANO_LAT, DUOMO_MILANO_LNG, latitude, longitude);
            if (distance > MAX_DISTANCE_KM) {
              console.log(`[CUSTOM-IDEALISTA] ⊘ Filtered out by distance: ${propertyId} - ${distance.toFixed(2)} km from Duomo (max ${MAX_DISTANCE_KM} km)`);
              filteredByDistance++;
              continue;
            }
            console.log(`[CUSTOM-IDEALISTA] ✓ Within range: ${propertyId} - ${distance.toFixed(2)} km from Duomo`);
          } else {
            console.log(`[CUSTOM-IDEALISTA] ⚠️ No coordinates for ${propertyId}, including anyway`);
          }
          
          // All items from custom actor are guaranteed to be private
          const ownerType = 'private';
          const contactName = itemData.contactName ? String(itemData.contactName) : undefined;
          
          if (url && price > 0) {
            listings.push({
              externalId: propertyId,
              title: itemData.title || `Proprietà privata - ${address}`,
              address: address,
              city: criteria.city || 'Milano',
              price: price,
              size: size,
              bedrooms: rooms,
              type: 'apartment',
              url: url,
              description: description,
              latitude: latitude && !isNaN(latitude) ? latitude : undefined,
              longitude: longitude && !isNaN(longitude) ? longitude : undefined,
              ownerType: ownerType,
              agencyName: undefined,
              ownerName: contactName,
              ownerPhone: undefined
            });
            
            console.log(`[CUSTOM-IDEALISTA] ✅ Added PRIVATE property: ${propertyId} - ${address} (€${price.toLocaleString()})`);
          }
        } catch (itemError) {
          console.error('[CUSTOM-IDEALISTA] Failed to transform item:', itemError);
        }
      }
      
      console.log(`[CUSTOM-IDEALISTA] 📍 Distance filter: ${filteredByDistance} properties excluded (>${MAX_DISTANCE_KM}km from Duomo)`);
      console.log(`[CUSTOM-IDEALISTA] ✅ Found ${listings.length} PRIVATE listings`);
      
      return listings;
    } catch (error) {
      console.error('[CUSTOM-IDEALISTA] Search failed:', error);
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
    return !!process.env.APIFY_API_TOKEN && !!this.actorId;
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
