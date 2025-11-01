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
      
      // Get results from feed
      const data: Data = await client.getFeed(feedId, {
        limit: 100,
        offset: 0,
        order_by: 'alert_id'
      });

      console.log(`[CASAFARI] Found ${data.count} total listings (${data.results.length} in this batch)`);

      // Transform Casafari results to our PropertyListing format
      const listings: PropertyListing[] = data.results
        .filter(r => r.operations.includes('sale')) // Only sale listings
        .map(result => this.transformResult(result));

      return listings;
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
    // Clean up any temporary feeds if needed
    this.feedCache.clear();
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
      return this.feedCache.get(cacheKey)!;
    }

    // Create new feed
    const feedPayload: FeedPayload = {
      name: `Auto-search ${criteria.city} ${criteria.zone || ''} ${Date.now()}`,
      filter: {
        operation: 'sale',
        types: [criteria.propertyType === 'house' ? 'house' : 'apartment'],
        ...(criteria.maxPrice && { price_to: criteria.maxPrice }),
        ...(criteria.minPrice && { price_from: criteria.minPrice }),
        ...(criteria.minSize && { total_area_from: criteria.minSize }),
        ...(criteria.maxSize && { total_area_to: criteria.maxSize }),
        ...(criteria.bedrooms && { bedrooms_from: criteria.bedrooms }),
        // Note: Casafari needs location_ids or custom_locations
        // For now we'll search all of Milano - in production you'd need to map zone names to location IDs
      }
    };

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
