import { db } from "../db";
import { geocodeCache, properties } from "@shared/schema";
import { eq } from "drizzle-orm";
import axios from "axios";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const RATE_LIMIT_MS = 1100; // 1.1 seconds between requests (Nominatim limit: 1 req/sec)

class GeocodingService {
  private lastRequestTime = 0;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  /**
   * Normalize address for cache lookup
   */
  private normalizeAddress(address: string, city: string): string {
    return `${address.toLowerCase().trim()}, ${city.toLowerCase().trim()}`;
  }

  /**
   * Geocode an address using Nominatim with caching
   */
  async geocodeAddress(address: string, city: string): Promise<{ lat: string; lng: string } | null> {
    const normalized = this.normalizeAddress(address, city);

    // Check cache first
    const cached = await db.select()
      .from(geocodeCache)
      .where(eq(geocodeCache.normalizedAddress, normalized))
      .limit(1);

    if (cached.length > 0) {
      const result = cached[0];
      if (result.status === 'success' && result.latitude && result.longitude) {
        console.log(`[GEOCODING] Cache hit for: ${normalized}`);
        return { lat: result.latitude, lng: result.longitude };
      }
      if (result.status === 'failed') {
        console.log(`[GEOCODING] Cache hit (failed) for: ${normalized}`);
        return null;
      }
    }

    // Not in cache or pending - geocode with rate limiting
    return this.geocodeWithRateLimit(address, city, normalized);
  }

  /**
   * Geocode with rate limiting queue
   */
  private async geocodeWithRateLimit(
    address: string,
    city: string,
    normalized: string
  ): Promise<{ lat: string; lng: string } | null> {
    return new Promise((resolve) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.performGeocode(address, city, normalized);
          resolve(result);
        } catch (error) {
          console.error(`[GEOCODING] Error geocoding ${normalized}:`, error);
          resolve(null);
        }
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued geocoding requests with rate limiting
   */
  private async processQueue() {
    if (this.requestQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const task = this.requestQueue.shift();

    // Respect rate limit
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
    
    if (task) {
      await task();
    }

    // Process next in queue
    setTimeout(() => this.processQueue(), 0);
  }

  /**
   * Perform actual geocoding request to Nominatim
   */
  private async performGeocode(
    address: string,
    city: string,
    normalized: string
  ): Promise<{ lat: string; lng: string } | null> {
    try {
      console.log(`[GEOCODING] Geocoding: ${normalized}`);
      
      const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
        params: {
          q: `${address}, ${city}, Italy`,
          format: 'json',
          limit: 1,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'RealEstateCRM/1.0'
        },
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        const lat = result.lat;
        const lng = result.lon;

        // Cache success
        await db.insert(geocodeCache)
          .values({
            normalizedAddress: normalized,
            latitude: lat,
            longitude: lng,
            status: 'success'
          })
          .onConflictDoUpdate({
            target: geocodeCache.normalizedAddress,
            set: {
              latitude: lat,
              longitude: lng,
              status: 'success',
              errorMessage: null,
              updatedAt: new Date()
            }
          });

        console.log(`[GEOCODING] Success: ${lat}, ${lng}`);
        return { lat, lng };
      }

      // No results found - cache failure
      await db.insert(geocodeCache)
        .values({
          normalizedAddress: normalized,
          status: 'failed',
          errorMessage: 'No results found'
        })
        .onConflictDoUpdate({
          target: geocodeCache.normalizedAddress,
          set: {
            status: 'failed',
            errorMessage: 'No results found',
            updatedAt: new Date()
          }
        });

      console.log(`[GEOCODING] No results for: ${normalized}`);
      return null;

    } catch (error: any) {
      console.error(`[GEOCODING] Error:`, error.message);

      // Cache error
      await db.insert(geocodeCache)
        .values({
          normalizedAddress: normalized,
          status: 'failed',
          errorMessage: error.message || 'Unknown error'
        })
        .onConflictDoUpdate({
          target: geocodeCache.normalizedAddress,
          set: {
            status: 'failed',
            errorMessage: error.message || 'Unknown error',
            updatedAt: new Date()
          }
        });

      return null;
    }
  }

  /**
   * Geocode properties in batch (for background processing)
   */
  async geocodePropertiesBatch(propertyIds: number[]): Promise<void> {
    console.log(`[GEOCODING] Batch geocoding ${propertyIds.length} properties...`);

    for (const propertyId of propertyIds) {
      const property = await db.select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (property.length === 0) continue;

      const prop = property[0];
      
      // Skip if already geocoded
      if (prop.geocodeStatus === 'success' && prop.latitude && prop.longitude) {
        continue;
      }

      const result = await this.geocodeAddress(prop.address, prop.city);

      if (result) {
        await db.update(properties)
          .set({
            latitude: result.lat,
            longitude: result.lng,
            geocodeStatus: 'success'
          })
          .where(eq(properties.id, propertyId));
      } else {
        await db.update(properties)
          .set({
            geocodeStatus: 'failed'
          })
          .where(eq(properties.id, propertyId));
      }
    }

    console.log(`[GEOCODING] Batch complete`);
  }

  /**
   * Calculate great-circle distance between two points using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1: string, lng1: string, lat2: string, lng2: string): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = parseFloat(lat1) * Math.PI / 180;
    const φ2 = parseFloat(lat2) * Math.PI / 180;
    const Δφ = (parseFloat(lat2) - parseFloat(lat1)) * Math.PI / 180;
    const Δλ = (parseFloat(lng2) - parseFloat(lng1)) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}

export const geocodingService = new GeocodingService();
