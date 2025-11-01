import type { PortalAdapter, PropertyListing, SearchCriteria } from '../portalIngestionService';
import type { FeedPayload, Data, Result } from 'casafari';

const CASAFARI_BASE_URL = 'https://app.casafari.com';

export class CasafariAdapter implements PortalAdapter {
  name = 'Casafari API';
  portalId = 'casafari';
  private client: any = null;
  private clientPromise: Promise<any> | null = null;
  private feedCache: Map<string, number> = new Map();

  private async getClient() {
    if (this.client) {
      return this.client;
    }
    
    if (!this.clientPromise) {
      this.clientPromise = this.initializeClient();
    }
    
    return this.clientPromise;
  }

  private async initializeClient() {
    const token = process.env.CASAFARI_API_TOKEN;
    if (!token) {
      throw new Error('[CASAFARI] CASAFARI_API_TOKEN not found - set environment variable');
    }
    
    // Dynamic import for CommonJS module
    const { default: casafari } = await import('casafari');
    this.client = casafari(`Token ${token}`);
    return this.client;
  }

  async search(criteria: SearchCriteria): Promise<PropertyListing[]> {
    try {
      const client = await this.getClient();
      console.log('[CASAFARI] Searching with criteria:', criteria);

      // Create or get existing feed for this search
      const feedId = await this.getOrCreateFeed(criteria);
      
      // Paginate through all results
      const allListings: PropertyListing[] = [];
      let offset = 0;
      const batchSize = 100;
      let hasMore = true;

      while (hasMore) {
        const data: Data = await client.getFeed(feedId, {
          limit: batchSize,
          offset,
          order_by: 'alert_id'
        });

        console.log(`[CASAFARI] Batch ${offset / batchSize + 1}: ${data.results.length} listings (${data.count} total available)`);

        // Transform Casafari results to our PropertyListing format
        const batchListings: PropertyListing[] = data.results
          .filter(r => r.operations.includes('sale')) // Only sale listings
          .map(result => this.transformResult(result));

        allListings.push(...batchListings);

        // Check if we need to fetch more
        hasMore = data.results.length === batchSize && allListings.length < data.count;
        offset += batchSize;

        // Safety limit: max 500 results per zone to avoid excessive API calls
        if (allListings.length >= 500) {
          console.log(`[CASAFARI] Reached safety limit of 500 results for this zone`);
          break;
        }
      }

      console.log(`[CASAFARI] Total fetched: ${allListings.length} listings`);
      return allListings;
    } catch (error) {
      console.error('[CASAFARI] Search failed:', error);
      return [];
    }
  }

  async fetchDetails(externalId: string): Promise<PropertyListing | null> {
    // Casafari provides all details in the initial response
    return null;
  }

  async cleanup(): Promise<void> {
    // Delete all feeds created by this adapter to prevent accumulation
    try {
      const client = await this.getClient();
      
      // Get all feed IDs from cache
      const feedIds = Array.from(this.feedCache.values());
      
      console.log(`[CASAFARI] Cleaning up ${feedIds.length} temporary feeds`);
      
      // Delete each feed
      for (const feedId of feedIds) {
        try {
          await client.deleteFeed(feedId);
          console.log(`[CASAFARI] Deleted feed #${feedId}`);
        } catch (error) {
          console.warn(`[CASAFARI] Failed to delete feed #${feedId}:`, error);
        }
      }
      
      this.feedCache.clear();
    } catch (error) {
      console.error('[CASAFARI] Cleanup failed:', error);
      this.feedCache.clear();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getClient();
      return true;
    } catch {
      return false;
    }
  }

  private async getOrCreateFeed(criteria: SearchCriteria): Promise<number> {
    const client = await this.getClient();

    // Generate a cache key from search criteria
    const cacheKey = this.getCacheKey(criteria);
    
    // Check if we already have a feed for this search
    if (this.feedCache.has(cacheKey)) {
      console.log(`[CASAFARI] Reusing cached feed for ${criteria.zone || criteria.city}`);
      return this.feedCache.get(cacheKey)!;
    }

    // NOTE: Casafari API limitation - custom_locations not supported in current SDK version
    // The API returns 400 errors when trying to use geographic filters
    // This means we get results from all of Italy, not just specific Milano zones
    // Future improvement: investigate Casafari location_ids or upgrade to newer API version
    
    // Create new feed
    const feedPayload: FeedPayload = {
      name: `Auto: ${criteria.city} ${criteria.zone || ''} (${criteria.propertyType || 'any'})`,
      filter: {
        operation: 'sale',
        types: [criteria.propertyType === 'house' ? 'house' : 'apartment'],
        ...(criteria.maxPrice && { price_to: criteria.maxPrice }),
        ...(criteria.minPrice && { price_from: criteria.minPrice }),
        ...(criteria.minSize && { total_area_from: criteria.minSize }),
        ...(criteria.maxSize && { total_area_to: criteria.maxSize }),
        ...(criteria.bedrooms && { bedrooms_from: criteria.bedrooms })
        // Geographic filtering not available - searches all of Italy
      }
    };

    console.log(`[CASAFARI] Creating feed for ${criteria.zone || criteria.city} (no geographic filter available)`);
    const feed = await client.createFeed(feedPayload);
    console.log(`[CASAFARI] Created feed #${feed.id}: ${feed.name}`);

    // Cache the feed ID
    this.feedCache.set(cacheKey, feed.id);

    return feed.id;
  }

  private getCacheKey(criteria: SearchCriteria): string {
    return JSON.stringify({
      city: criteria.city,
      zone: criteria.zone,
      type: criteria.propertyType,
      priceMin: criteria.minPrice,
      priceMax: criteria.maxPrice,
      sizeMin: criteria.minSize,
      sizeMax: criteria.maxSize,
      bedrooms: criteria.bedrooms
    });
  }

  private transformResult(result: Result): PropertyListing {
    return {
      externalId: `casafari-${result.listing_id}`,
      title: `${result.type} - ${result.address}`,
      address: result.address,
      city: result.location.name,
      price: result.sale_price || 0,
      size: result.total_area || result.living_area || 0,
      bedrooms: result.bedrooms || undefined,
      type: this.mapPropertyType(result.type),
      url: result.property_url || result.listing_url,
      description: result.description || `${result.type} in ${result.location.name}`,
      ownerType: result.is_private_property ? 'private' : 'agency',
      imageUrls: result.pictures?.length > 0 ? result.pictures : (result.thumbnails || undefined),
      agencyName: result.agency || undefined,
      floor: result.features?.floor || undefined,
      bathrooms: result.bathrooms || undefined
    };
  }

  private mapPropertyType(casafariType: string): 'apartment' | 'house' | 'land' | 'commercial' | 'other' {
    const type = casafariType.toLowerCase();
    if (['apartment', 'studio', 'duplex', 'penthouse'].includes(type)) {
      return 'apartment';
    }
    if (['house', 'villa', 'townhouse', 'country_house', 'chalet', 'bungalow'].includes(type)) {
      return 'house';
    }
    if (['plot', 'country_estate'].includes(type)) {
      return 'land';
    }
    if (['retail', 'office', 'industrial', 'warehouse', 'hotel', 'building'].includes(type)) {
      return 'commercial';
    }
    return 'other';
  }

  private extractFeatures(result: Result): string[] {
    const features: string[] = [];
    
    if (result.features?.characteristics) {
      features.push(...result.features.characteristics);
    }
    
    if (result.is_new_development_property) {
      features.push('new_development');
    }
    
    if (result.features?.views && result.features.views.length > 0) {
      features.push(...result.features.views.map(v => `view_${v}`));
    }
    
    return features;
  }
}
