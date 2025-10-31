import { db } from "../db";
import { zoneGeocodeCache, buyers } from "@shared/schema";
import { eq } from "drizzle-orm";
import axios from "axios";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const RATE_LIMIT_MS = 1100;
const DEFAULT_ZONE_RADIUS = 800;

interface ZoneGeocodeResult {
  zoneName: string;
  status: 'success' | 'failed';
  latitude?: string;
  longitude?: string;
  boundaryGeoJSON?: any;
  errorMessage?: string;
}

interface SearchAreaResult {
  status: 'success' | 'partial' | 'failed';
  featureCollection: any;
  successfulZones: string[];
  failedZones: string[];
  metadata: {
    totalZones: number;
    geocodedZones: number;
    boundingBox?: [number, number, number, number];
  };
}

class SearchAreaGeocodingService {
  private lastRequestTime = 0;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  private normalizeZoneName(zoneName: string, city: string = "Milano"): string {
    return `${zoneName.trim()}, ${city}, Italy`.toLowerCase();
  }

  async geocodeZone(zoneName: string, city: string = "Milano"): Promise<ZoneGeocodeResult> {
    const normalized = this.normalizeZoneName(zoneName, city);

    const cached = await db.select()
      .from(zoneGeocodeCache)
      .where(eq(zoneGeocodeCache.zoneName, normalized))
      .limit(1);

    if (cached.length > 0) {
      const result = cached[0];
      console.log(`[ZONE-GEOCODE] Cache hit for: ${normalized}`);
      
      if (result.status === 'success') {
        return {
          zoneName,
          status: 'success',
          latitude: result.latitude || undefined,
          longitude: result.longitude || undefined,
          boundaryGeoJSON: result.boundaryGeoJSON || undefined
        };
      }
      
      return {
        zoneName,
        status: 'failed',
        errorMessage: result.errorMessage || 'Cached failure'
      };
    }

    return this.geocodeZoneWithRateLimit(zoneName, city, normalized);
  }

  private async geocodeZoneWithRateLimit(
    zoneName: string,
    city: string,
    normalized: string
  ): Promise<ZoneGeocodeResult> {
    return new Promise((resolve) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.performZoneGeocode(zoneName, city, normalized);
          resolve(result);
        } catch (error: any) {
          console.error(`[ZONE-GEOCODE] Error geocoding ${normalized}:`, error);
          resolve({
            zoneName,
            status: 'failed',
            errorMessage: error.message || 'Unknown error'
          });
        }
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.requestQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const task = this.requestQueue.shift();

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
    
    if (task) {
      await task();
    }

    setTimeout(() => this.processQueue(), 0);
  }

  private async performZoneGeocode(
    zoneName: string,
    city: string,
    normalized: string
  ): Promise<ZoneGeocodeResult> {
    try {
      console.log(`[ZONE-GEOCODE] Geocoding zone: ${normalized}`);
      
      const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
        params: {
          q: `${zoneName}, ${city}, Italy`,
          format: 'json',
          limit: 1,
          addressdetails: 1,
          polygon_geojson: 1
        },
        headers: {
          'User-Agent': 'RealEstateCRM/1.0'
        },
        timeout: 15000
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        const lat = result.lat;
        const lng = result.lon;
        const boundaryGeoJSON = result.geojson || null;

        await db.insert(zoneGeocodeCache)
          .values({
            zoneName: normalized,
            city: city,
            latitude: lat,
            longitude: lng,
            boundaryGeoJSON: boundaryGeoJSON,
            status: 'success'
          })
          .onConflictDoUpdate({
            target: zoneGeocodeCache.zoneName,
            set: {
              latitude: lat,
              longitude: lng,
              boundaryGeoJSON: boundaryGeoJSON,
              status: 'success',
              errorMessage: null,
              updatedAt: new Date()
            }
          });

        console.log(`[ZONE-GEOCODE] Success: ${zoneName} → ${lat}, ${lng}`);
        return {
          zoneName,
          status: 'success',
          latitude: lat,
          longitude: lng,
          boundaryGeoJSON: boundaryGeoJSON
        };
      }

      await db.insert(zoneGeocodeCache)
        .values({
          zoneName: normalized,
          city: city,
          status: 'failed',
          errorMessage: 'No results found'
        })
        .onConflictDoUpdate({
          target: zoneGeocodeCache.zoneName,
          set: {
            status: 'failed',
            errorMessage: 'No results found',
            updatedAt: new Date()
          }
        });

      console.log(`[ZONE-GEOCODE] No results for: ${normalized}`);
      return {
        zoneName,
        status: 'failed',
        errorMessage: 'Zone not found'
      };

    } catch (error: any) {
      console.error(`[ZONE-GEOCODE] Error:`, error.message);

      await db.insert(zoneGeocodeCache)
        .values({
          zoneName: normalized,
          city: city,
          status: 'failed',
          errorMessage: error.message || 'Unknown error'
        })
        .onConflictDoUpdate({
          target: zoneGeocodeCache.zoneName,
          set: {
            status: 'failed',
            errorMessage: error.message || 'Unknown error',
            updatedAt: new Date()
          }
        });

      return {
        zoneName,
        status: 'failed',
        errorMessage: error.message || 'Unknown error'
      };
    }
  }

  async geocodeSearchAreaForZones(
    zones: string[],
    city: string = "Milano"
  ): Promise<SearchAreaResult> {
    if (!zones || zones.length === 0) {
      return {
        status: 'failed',
        featureCollection: { type: 'FeatureCollection', features: [] },
        successfulZones: [],
        failedZones: [],
        metadata: {
          totalZones: 0,
          geocodedZones: 0
        }
      };
    }

    console.log(`[ZONE-GEOCODE] Geocoding search area for ${zones.length} zones...`);

    const results = await Promise.all(
      zones.map(zone => this.geocodeZone(zone, city))
    );

    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');

    const features = successful.map((result, index) => {
      if (result.boundaryGeoJSON) {
        return {
          type: 'Feature',
          id: index,
          properties: {
            zoneName: result.zoneName,
            type: 'polygon'
          },
          geometry: result.boundaryGeoJSON
        };
      } else if (result.latitude && result.longitude) {
        const lat = parseFloat(result.latitude);
        const lng = parseFloat(result.longitude);
        
        return {
          type: 'Feature',
          id: index,
          properties: {
            zoneName: result.zoneName,
            type: 'circle',
            radius: DEFAULT_ZONE_RADIUS
          },
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        };
      }
      return null;
    }).filter(f => f !== null);

    let boundingBox: [number, number, number, number] | undefined;
    if (features.length > 0) {
      const coords = features.map(f => {
        if (f!.geometry.type === 'Point') {
          return f!.geometry.coordinates;
        } else if (f!.geometry.type === 'Polygon') {
          return f!.geometry.coordinates[0][0];
        }
        return null;
      }).filter(c => c !== null) as number[][];

      if (coords.length > 0) {
        const lngs = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        boundingBox = [
          Math.min(...lngs),
          Math.min(...lats),
          Math.max(...lngs),
          Math.max(...lats)
        ];
      }
    }

    const featureCollection = {
      type: 'FeatureCollection',
      features
    };

    let status: 'success' | 'partial' | 'failed';
    if (successful.length === zones.length) {
      status = 'success';
    } else if (successful.length > 0) {
      status = 'partial';
    } else {
      status = 'failed';
    }

    console.log(`[ZONE-GEOCODE] Completed: ${successful.length}/${zones.length} zones geocoded`);

    return {
      status,
      featureCollection,
      successfulZones: successful.map(r => r.zoneName),
      failedZones: failed.map(r => r.zoneName),
      metadata: {
        totalZones: zones.length,
        geocodedZones: successful.length,
        boundingBox
      }
    };
  }

  async updateBuyerSearchArea(buyerId: number, zones: string[]): Promise<void> {
    if (!zones || zones.length === 0) {
      console.log(`[ZONE-GEOCODE] Clearing search area for buyer ${buyerId} (no zones)`);
      await db.update(buyers)
        .set({
          searchArea: null,
          searchAreaStatus: null,
          searchAreaUpdatedAt: new Date()
        })
        .where(eq(buyers.id, buyerId));
      return;
    }

    console.log(`[ZONE-GEOCODE] Updating search area for buyer ${buyerId} with ${zones.length} zones`);

    await db.update(buyers)
      .set({
        searchAreaStatus: 'pending',
        searchAreaUpdatedAt: new Date()
      })
      .where(eq(buyers.id, buyerId));

    try {
      const result = await this.geocodeSearchAreaForZones(zones);

      await db.update(buyers)
        .set({
          searchArea: result.featureCollection,
          searchAreaStatus: result.status,
          searchAreaUpdatedAt: new Date()
        })
        .where(eq(buyers.id, buyerId));

      console.log(`[ZONE-GEOCODE] Search area updated for buyer ${buyerId}: status=${result.status}`);
    } catch (error: any) {
      console.error(`[ZONE-GEOCODE] Failed to update search area for buyer ${buyerId}:`, error);
      
      await db.update(buyers)
        .set({
          searchAreaStatus: 'failed',
          searchAreaUpdatedAt: new Date()
        })
        .where(eq(buyers.id, buyerId));
    }
  }
}

export const searchAreaGeocodingService = new SearchAreaGeocodingService();
