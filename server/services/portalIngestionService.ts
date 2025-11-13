import { db } from "../db";
import { properties } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { geocodingService } from "./geocodingService";

export interface PropertyListing {
  externalId: string;
  title: string;
  address: string;
  city: string;
  price: number;
  size: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: string;
  type: string;
  description?: string;
  url: string;
  imageUrls?: string[];
  latitude?: number;
  longitude?: number;
  ownerType?: 'agency' | 'private';
  agencyName?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  source?: string;
}

export interface SearchCriteria {
  city?: string;
  zone?: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  propertyType?: string;
  bedrooms?: number;
}

export interface PortalAdapter {
  name: string;
  portalId: string;
  
  search(criteria: SearchCriteria): Promise<PropertyListing[]>;
  
  fetchDetails(externalId: string): Promise<PropertyListing | null>;
  
  isAvailable(): Promise<boolean>;
}

export interface IngestionResult {
  portal: string;
  totalFetched: number;
  imported: number;
  updated: number;
  skippedDuplicate: number;
  failed: number;
  errors: string[];
}

export interface IngestionStatus {
  isRunning: boolean;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastResults: IngestionResult[];
  portals: {
    name: string;
    available: boolean;
    lastFetchAt: Date | null;
  }[];
}

export class PortalIngestionService {
  private adapters: Map<string, PortalAdapter> = new Map();
  private isRunning = false;
  private lastRunAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastResults: IngestionResult[] = [];

  registerAdapter(adapter: PortalAdapter) {
    this.adapters.set(adapter.portalId, adapter);
    console.log(`[INGESTION] Registered adapter: ${adapter.name} (${adapter.portalId})`);
  }

  async getStatus(): Promise<IngestionStatus> {
    const portalsStatus = await Promise.all(
      Array.from(this.adapters.values()).map(async (adapter) => ({
        name: adapter.name,
        available: await adapter.isAvailable().catch(() => false),
        lastFetchAt: null
      }))
    );

    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      lastResults: this.lastResults,
      portals: portalsStatus
    };
  }

  async importFromPortal(
    portalId: string, 
    criteria: SearchCriteria
  ): Promise<IngestionResult> {
    const adapter = this.adapters.get(portalId);
    if (!adapter) {
      throw new Error(`No adapter found for portal: ${portalId}`);
    }

    const result: IngestionResult = {
      portal: adapter.name,
      totalFetched: 0,
      imported: 0,
      updated: 0,
      skippedDuplicate: 0,
      failed: 0,
      errors: []
    };

    try {
      console.log(`[INGESTION] Starting import from ${adapter.name}...`);
      const listings = await adapter.search(criteria);
      result.totalFetched = listings.length;

      for (const listing of listings) {
        try {
          await this.importListing(portalId, listing);
          result.imported++;
        } catch (error) {
          result.failed++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`${listing.externalId}: ${errorMsg}`);
          console.error(`[INGESTION] Failed to import ${listing.externalId}:`, error);
        }
      }

      console.log(`[INGESTION] Completed ${adapter.name}: ${result.imported} imported, ${result.failed} failed`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Portal fetch failed: ${errorMsg}`);
      console.error(`[INGESTION] Portal fetch failed for ${adapter.name}:`, error);
    }

    return result;
  }

  async importFromAllPortals(criteria: SearchCriteria): Promise<IngestionResult[]> {
    if (this.isRunning) {
      throw new Error('Ingestion already running');
    }

    this.isRunning = true;
    this.lastRunAt = new Date();
    this.lastResults = [];

    try {
      const results: IngestionResult[] = [];

      for (const adapter of Array.from(this.adapters.values())) {
        const isAvailable = await adapter.isAvailable().catch(() => false);
        if (!isAvailable) {
          console.log(`[INGESTION] Skipping ${adapter.name} - not available`);
          continue;
        }

        const result = await this.importFromPortal(adapter.portalId, criteria);
        results.push(result);
        
        await this.delay(2000);
      }

      this.lastResults = results;
      this.lastSuccessAt = new Date();
      return results;
    } finally {
      this.isRunning = false;
    }
  }

  private async importListing(portalId: string, listing: PropertyListing): Promise<void> {
    const now = new Date();
    
    const existing = await db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.portal, portalId),
          eq(properties.externalId, listing.externalId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(properties)
        .set({
          price: listing.price,
          description: listing.description,
          ownerType: listing.ownerType,
          agencyName: listing.agencyName,
          ownerName: listing.ownerName,
          ownerPhone: listing.ownerPhone,
          ownerEmail: listing.ownerEmail,
          lastSeenAt: now,
          updatedAt: now
        })
        .where(eq(properties.id, existing[0].id));
      
      console.log(`[INGESTION] Updated existing property: ${listing.externalId}`);
    } else {
      const inserted = await db.insert(properties).values({
        address: listing.address,
        city: listing.city,
        size: listing.size,
        price: listing.price,
        type: listing.type || 'apartment',
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        floor: listing.floor,
        description: listing.description,
        portal: portalId,
        agencyName: listing.agencyName,
        ownerName: listing.ownerName,
        ownerPhone: listing.ownerPhone,
        ownerEmail: listing.ownerEmail,
        externalId: listing.externalId,
        url: listing.url,
        source: listing.source || `scraper-${portalId}`,
        latitude: listing.latitude,
        longitude: listing.longitude,
        location: listing.latitude && listing.longitude 
          ? { lat: Number(listing.latitude), lng: Number(listing.longitude) }
          : null,
        firstSeenAt: now,
        lastSeenAt: now,
        isOwned: false,
        isShared: false,
        status: 'available',
        geocodeStatus: listing.latitude && listing.longitude ? 'success' : 'pending',
        ownerType: listing.ownerType || 'private'
      }).returning();
      
      console.log(`[INGESTION] Imported new property: ${listing.externalId}`);
      
      // Geocode in background (non-blocking with rate limiting)
      if (inserted[0]) {
        geocodingService.geocodeAddress(listing.address, listing.city)
          .then(coords => {
            if (coords) {
              db.update(properties)
                .set({
                  latitude: coords.lat,
                  longitude: coords.lng,
                  location: { lat: Number(coords.lat), lng: Number(coords.lng) },
                  geocodeStatus: 'success'
                })
                .where(eq(properties.id, inserted[0].id))
                .catch(err => console.error('[INGESTION] Geocode update failed:', err));
            } else {
              db.update(properties)
                .set({ geocodeStatus: 'failed' })
                .where(eq(properties.id, inserted[0].id))
                .catch(err => console.error('[INGESTION] Geocode status update failed:', err));
            }
          })
          .catch(err => console.error('[INGESTION] Geocode failed:', err));
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const ingestionService = new PortalIngestionService();
