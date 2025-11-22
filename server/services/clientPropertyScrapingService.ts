import { db } from "../db";
import { buyers, clients, sharedProperties } from "@shared/schema";
import { eq, and, lte, gte, sql, isNull } from "drizzle-orm";
import type { PropertyListing, SearchCriteria } from "./portalIngestionService";
import { ImmobiliareApifyAdapter } from "./adapters/immobiliareApifyAdapter";
import { IdealistaApifyAdapter } from "./adapters/idealistaApifyAdapter";
import { geocodingService } from "./geocodingService";

export type PropertyClassification = 'private' | 'multiagency' | 'single-agency';

export interface AgencyVariant {
  agencyName: string;
  url: string;
  portalSource: string;
  externalId: string;
}

export interface ScrapedPropertyResult extends PropertyListing {
  id?: number; // ID from sharedProperties table (for saved/database properties)
  portalSource: string;
  matchScore?: number;
  isMultiagency?: boolean;
  isDuplicate?: boolean;
  isPrivate?: boolean;
  classification?: PropertyClassification; // New: for color coding
  agencyCount?: number; // Number of different agencies listing this property
  agencyVariants?: AgencyVariant[]; // All agency listings for multi-agency properties
}

export class ClientPropertyScrapingService {
  private immobiliareAdapter = new ImmobiliareApifyAdapter();
  private idealistaAdapter = new IdealistaApifyAdapter();

  async getSavedScrapedPropertiesForClient(clientId: number): Promise<ScrapedPropertyResult[]> {
    console.log(`[SAVED-PROPERTIES] Loading saved scraped properties for client ${clientId}`);

    // Get client and buyer data
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, clientId)
    });

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    if (client.type !== 'buyer') {
      throw new Error(`Client ${clientId} is not a buyer`);
    }

    const buyer = await db.query.buyers.findFirst({
      where: eq(buyers.clientId, clientId)
    });

    if (!buyer) {
      throw new Error(`Buyer data not found for client ${clientId}`);
    }

    console.log(`[SAVED-PROPERTIES] Client ${client.firstName} ${client.lastName}, buyer type: ${buyer.propertyType || 'any'}, zones: ${(buyer.zones as any)?.length || 0}, rating: ${buyer.rating}`);

    // Get all saved scraped properties from database
    const savedProperties = await db
      .select()
      .from(sharedProperties)
      .where(eq(sharedProperties.matchBuyers, true));

    const drizzleCount = savedProperties.length;
    console.log(`[DRIZZLE-QUERY] Query executed. Drizzle.length = ${drizzleCount}`);
    console.log(`[DRIZZLE-QUERY] First 3 IDs: ${savedProperties.slice(0, 3).map(p => p.id).join(', ')}`);
    console.log(`[DRIZZLE-QUERY] Last 3 IDs: ${savedProperties.slice(-3).map(p => p.id).join(', ')}`);
    
    console.log(`[SAVED-PROPERTIES] Drizzle returned ${savedProperties.length} properties (database has 2731 with match_buyers=true)`);
    console.log(`[SAVED-PROPERTIES] Found ${savedProperties.length} saved properties before filtering`);
    
    // DEBUG: Log first property details
    if (savedProperties.length > 0) {
      console.log(`[DEBUG] First property:`, { id: savedProperties[0].id, ownerType: savedProperties[0].ownerType, address: savedProperties[0].address });
      console.log(`[DEBUG] All property IDs in range [1200-3500]:`, savedProperties.filter(sp => sp.id >= 1200 && sp.id <= 3500).map(p => p.id));
    }
    
    // DEBUG: Check if private properties are in the list
    const debugProps = savedProperties.filter(sp => [1236, 3461].includes(sp.id));
    if (debugProps.length > 0) {
      console.log(`[DEBUG] Found ${debugProps.length} private test properties:`, debugProps.map(p => ({ id: p.id, ownerType: p.ownerType, address: p.address, size: p.size, location: p.location })));
    } else {
      console.log(`[DEBUG] Private test properties (1236, 3461) NOT found in saved properties list!`);
    }

    // Filter using centralized matching logic
    const { isSharedPropertyMatchingBuyerCriteria } = await import('../lib/matchingLogic');
    const matchingProperties = savedProperties.filter(sp => 
      isSharedPropertyMatchingBuyerCriteria(sp, buyer)
    );

    console.log(`[SAVED-PROPERTIES] After filtering: ${matchingProperties.length} properties match buyer criteria (type: ${buyer.propertyType || 'any'})`);

    // Convert to ScrapedPropertyResult format
    const results: ScrapedPropertyResult[] = matchingProperties.map(sp => {
      let latitude: number | undefined;
      let longitude: number | undefined;
      
      if (sp.location) {
        try {
          const loc = sp.location as any;
          if (loc.coordinates && Array.isArray(loc.coordinates)) {
            longitude = loc.coordinates[0];
            latitude = loc.coordinates[1];
          } else if (loc.x !== undefined && loc.y !== undefined) {
            longitude = loc.x;
            latitude = loc.y;
          } else if (loc.lat !== undefined && loc.lng !== undefined) {
            latitude = loc.lat;
            longitude = loc.lng;
          }
        } catch (e) {
          console.warn('[CLIENT-SCRAPING] Failed to parse location for property', sp.id);
        }
      }
      
      // Calculate isMultiagency based on number of agencies
      const agencyCount = (sp.agencies && Array.isArray(sp.agencies)) ? sp.agencies.length : 0;
      const isMultiagency = agencyCount > 1;
      
      // Derive ownerType: if ownerName is NULL or looks like "Multi-Agency", treat as agency
      // if ownerType is explicitly set to 'private', use that. Otherwise default to 'agency'
      let derivedOwnerType: 'agency' | 'private' = 'agency';
      if (sp.ownerType === 'private') {
        derivedOwnerType = 'private';
      } else if (sp.ownerName && sp.ownerName.toLowerCase().includes('privato')) {
        derivedOwnerType = 'private';
      }
      
      return {
        id: sp.id, // CRITICAL: Include the sharedProperties.id for frontend links
        externalId: sp.externalId || sp.id.toString(),
        title: `${sp.type} - ${sp.address}`,
        address: sp.address,
        city: sp.city || 'Milano',
        price: sp.price || 0,
        size: sp.size || 0,
        bedrooms: undefined,
        bathrooms: undefined,
        floor: sp.floor || undefined,
        type: sp.type || 'apartment',
        description: sp.ownerNotes || '',
        url: sp.url || '',
        latitude,
        longitude,
        imageUrls: Array.isArray(sp.imageUrls) ? sp.imageUrls : [],
        ownerType: derivedOwnerType,
        agencyName: sp.ownerName || 'Multi-Agency',
        portalSource: sp.portalSource || 'Database',
        isMultiagency,
        isDuplicate: true,
        isPrivate: derivedOwnerType === 'private',
        agencyCount,
        agencies: sp.agencies
      };
    });

    // Classify properties for all users
    const classifiedResults = this.classifyProperties(results);

    // Calculate match score for each result
    const scoredResults = classifiedResults.map(result => ({
      ...result,
      matchScore: this.calculateMatchScore(result, buyer)
    }));

    // Sort by match score
    scoredResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    console.log(`[CLIENT-SCRAPING] Returning ${scoredResults.length} saved properties`);
    return scoredResults;
  }

  async scrapePropertiesForClient(clientId: number): Promise<ScrapedPropertyResult[]> {
    console.log(`[CLIENT-SCRAPING] Starting scraping for client ${clientId}`);

    // Get client and buyer data
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, clientId)
    });

    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    if (client.type !== 'buyer') {
      throw new Error(`Client ${clientId} is not a buyer`);
    }

    const buyer = await db.query.buyers.findFirst({
      where: eq(buyers.clientId, clientId)
    });

    if (!buyer) {
      throw new Error(`Buyer data not found for client ${clientId}`);
    }

    console.log(`[CLIENT-SCRAPING] Client ${client.firstName} ${client.lastName} (rating ${buyer.rating || 'N/A'}), proceeding with scraping`);

    // Extract search criteria from buyer preferences
    const zones = (buyer.zones as string[] | null) || [];
    const allResults: ScrapedPropertyResult[] = [];

    // If no zones specified, do a generic search for Milano
    const searchZones = zones.length > 0 ? zones : [''];

    // Use Apify adapters for all clients
    console.log(`[CLIENT-SCRAPING] Using Apify adapters for all property searches`);
    
    for (const zone of searchZones) {
      const criteria: SearchCriteria = {
        city: 'milano',
        zone: zone || undefined,
        maxPrice: buyer.maxPrice || undefined,
        minSize: buyer.minSize || undefined,
        bedrooms: buyer.rooms || undefined,
        propertyType: buyer.propertyType || undefined
      };

      console.log(`[CLIENT-SCRAPING] Searching zone: ${zone || 'Milano (generic)'}`, criteria);

      // Scrape Immobiliare.it with Apify
      try {
        const immobiliareResults = await this.immobiliareAdapter.search(criteria);
        const enriched = immobiliareResults.map(r => ({
          ...r,
          portalSource: 'Immobiliare.it (Apify)',
          isPrivate: r.ownerType === 'private',
          isMultiagency: false
        }));
        allResults.push(...enriched);
        console.log(`[CLIENT-SCRAPING] Immobiliare.it: found ${immobiliareResults.length} properties for zone ${zone || 'Milano'}`);
      } catch (error) {
        console.error(`[CLIENT-SCRAPING] Immobiliare.it scraping failed for zone ${zone}:`, error);
      }

      // Scrape Idealista.it with Apify
      try {
        const idealistaResults = await this.idealistaAdapter.search(criteria);
        const enriched = idealistaResults.map(r => ({
          ...r,
          portalSource: 'Idealista.it (Apify)',
          isPrivate: r.ownerType === 'private',
          isMultiagency: false
        }));
        allResults.push(...enriched);
        console.log(`[CLIENT-SCRAPING] Idealista.it: found ${idealistaResults.length} properties for zone ${zone || 'Milano'}`);
      } catch (error) {
        console.error(`[CLIENT-SCRAPING] Idealista.it scraping failed for zone ${zone}:`, error);
      }
    }

    // Add multi-agency properties from database (shared_properties)
    console.log(`[CLIENT-SCRAPING] Fetching multi-agency properties from database...`);
    const multiAgencyProperties = await this.getMultiAgencyPropertiesForClient(buyer);
    allResults.push(...multiAgencyProperties);
    console.log(`[CLIENT-SCRAPING] Added ${multiAgencyProperties.length} multi-agency properties from database`)

    // Deduplicate by externalId + portalSource
    const uniqueResults = this.deduplicateResults(allResults);

    // Classify properties (private/multiagency/single-agency) for all results
    const classifiedResults = this.classifyProperties(uniqueResults);

    // Calculate match score for each result based on buyer criteria
    const scoredResults = classifiedResults.map(result => ({
      ...result,
      matchScore: this.calculateMatchScore(result, buyer)
    }));

    // Sort by match score (highest first)
    scoredResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    console.log(`[CLIENT-SCRAPING] Total results: ${allResults.length}, unique: ${uniqueResults.length}, scored: ${scoredResults.length}`);

    // Save new scraped properties to database (only from Apify, not DB multi-agency)
    await this.saveScrapedPropertiesToDatabase(scoredResults, clientId);

    // Geocode properties missing GPS coordinates as fallback
    await this.geocodeMissingCoordinates();

    return scoredResults;
  }

  private async saveScrapedPropertiesToDatabase(results: ScrapedPropertyResult[], clientId: number): Promise<void> {
    try {
      console.log(`[CLIENT-SCRAPING] Saving ${results.length} properties to database...`);
      
      let newCount = 0;
      let updatedCount = 0;
      
      for (const result of results) {
        // Skip properties already in database (they have an ID)
        if (result.id) {
          continue;
        }
        
        // Check if property already exists (by externalId + portalSource)
        const existing = await db.query.sharedProperties.findFirst({
          where: and(
            eq(sharedProperties.externalId, result.externalId),
            eq(sharedProperties.portalSource, result.portalSource)
          )
        });
        
        const propertyData = {
          externalId: result.externalId,
          portalSource: result.portalSource,
          address: result.address,
          city: result.city,
          price: result.price,
          size: result.size,
          floor: result.floor,
          type: result.type,
          ownerType: result.ownerType || 'unknown',
          ownerName: result.agencyName || null,
          ownerPhone: null,
          ownerNotes: result.description || null,
          matchBuyers: true,
          imageUrls: result.imageUrls || [],
          url: result.url || null,
          location: result.latitude && result.longitude 
            ? sql`ST_SetSRID(ST_MakePoint(${result.longitude}::double precision, ${result.latitude}::double precision), 4326)`
            : null,
          scrapedForClientId: clientId,
          lastScrapedAt: new Date()
        };
        
        if (existing) {
          // Update existing property
          await db.update(sharedProperties)
            .set({
              ...propertyData,
              updatedAt: new Date()
            })
            .where(eq(sharedProperties.id, existing.id));
          updatedCount++;
        } else {
          // Insert new property
          await db.insert(sharedProperties).values(propertyData);
          newCount++;
        }
      }
      
      console.log(`[CLIENT-SCRAPING] Saved to database: ${newCount} new, ${updatedCount} updated`);
    } catch (error) {
      console.error('[CLIENT-SCRAPING] Error saving properties to database:', error);
    }
  }

  private async geocodeMissingCoordinates(): Promise<void> {
    try {
      // Find properties without GPS coordinates (limit to 50 per run to avoid overwhelming Nominatim)
      const propertiesWithoutCoords = await db
        .select()
        .from(sharedProperties)
        .where(isNull(sharedProperties.location))
        .limit(50);

      if (propertiesWithoutCoords.length === 0) {
        console.log('[GEOCODING-FALLBACK] No properties need geocoding');
        return;
      }

      console.log(`[GEOCODING-FALLBACK] Geocoding ${propertiesWithoutCoords.length} properties without GPS coordinates...`);
      let geocodedCount = 0;

      for (const property of propertiesWithoutCoords) {
        try {
          // Skip if no address
          if (!property.address || !property.city) {
            continue;
          }

          // Geocode using the service
          const coords = await geocodingService.geocodeAddress(property.address, property.city);
          
          if (coords) {
            // Update property with geocoded coordinates
            await db.update(sharedProperties)
              .set({
                location: sql`ST_SetSRID(ST_MakePoint(${parseFloat(coords.lng)}::double precision, ${parseFloat(coords.lat)}::double precision), 4326)`,
                updatedAt: new Date()
              })
              .where(eq(sharedProperties.id, property.id));
            
            geocodedCount++;
            console.log(`[GEOCODING-FALLBACK] ✓ Geocoded #${property.id}: ${property.address}`);
          }
        } catch (error) {
          console.error(`[GEOCODING-FALLBACK] Failed to geocode property #${property.id}:`, error);
        }
      }

      console.log(`[GEOCODING-FALLBACK] Successfully geocoded ${geocodedCount}/${propertiesWithoutCoords.length} properties`);
    } catch (error) {
      console.error('[GEOCODING-FALLBACK] Error in geocoding fallback:', error);
    }
  }

  private deduplicateResults(results: ScrapedPropertyResult[]): ScrapedPropertyResult[] {
    const seen = new Set<string>();
    const unique: ScrapedPropertyResult[] = [];

    for (const result of results) {
      // Use portal:ID as dedup key - ensures each portal's results are kept separately
      const key = `${result.portalSource}:${result.externalId}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    console.log(`[DEDUP] Processed ${results.length} results, found ${unique.length} unique (by portal:ID)`);
    return unique;
  }

  private classifyProperties(results: ScrapedPropertyResult[]): ScrapedPropertyResult[] {
    console.log(`[CLASSIFY] Classifying ${results.length} properties...`);
    
    // Normalize address for comparison
    const normalizeAddress = (addr: string): string => {
      return addr.toLowerCase()
        .replace(/via|viale|piazza|corso|largo/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/[,\.]/g, '')
        .trim();
    };
    
    // Normalize agency name for comparison (handles variations like "S.r.l.", "SRL", punctuation, etc.)
    const normalizeAgencyName = (name: string): string => {
      return name.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[\.,'"\-]/g, '')  // Remove punctuation
        .replace(/\bs\.?r\.?l\.?\b/gi, 'srl')  // Normalize S.r.l., S.R.L., etc. to srl
        .replace(/\bs\.?p\.?a\.?\b/gi, 'spa')  // Normalize S.p.A., SPA, etc. to spa
        .replace(/\bs\.?a\.?s\.?\b/gi, 'sas')  // Normalize S.a.s., SAS, etc. to sas
        .replace(/\bs\.?n\.?c\.?\b/gi, 'snc')  // Normalize S.n.c., SNC, etc. to snc
        .replace(/\bdi\b/gi, '')  // Remove common connectors
        .replace(/\be\b/gi, '')
        .replace(/\&/g, 'e')  // Normalize & to e
        .replace(/\s+/g, ' ')  // Clean up extra spaces
        .trim();
    };
    
    // Group properties by normalized address and similar price
    const groups = new Map<string, ScrapedPropertyResult[]>();
    
    for (const result of results) {
      const normalizedAddr = normalizeAddress(result.address);
      const priceRange = Math.floor(result.price / 10000) * 10000; // Group by 10k price ranges
      const groupKey = `${normalizedAddr}:${priceRange}:${result.size || 0}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(result);
    }
    
    // Classify each property based on its group
    const classified: ScrapedPropertyResult[] = [];
    let privateCount = 0;
    let multiagencyCount = 0;
    let singleAgencyCount = 0;
    let consolidatedCount = 0;
    
    for (const [groupKey, groupProperties] of Array.from(groups.entries())) {
      // Get unique agencies in this group (using normalized names)
      const agencies = new Set<string>();
      let hasPrivate = false;
      
      for (const prop of groupProperties) {
        if (prop.ownerType === 'private') {
          hasPrivate = true;
        } else if (prop.agencies && Array.isArray(prop.agencies) && prop.agencies.length > 0) {
          // Count unique agencies from the agencies array (from database properties)
          for (const agency of prop.agencies) {
            if (agency.name) {
              const normalized = normalizeAgencyName(agency.name);
              agencies.add(normalized);
            }
          }
        } else if (prop.agencyName) {
          // Fallback for properties without agencies array
          const normalized = normalizeAgencyName(prop.agencyName);
          agencies.add(normalized);
        }
      }
      
      // Classify based on composition
      // Priorità: Privato > Multi-agenzia > Singola agenzia
      let classification: PropertyClassification;
      if (hasPrivate) {
        // Proprietà con almeno un privato → Verde (anche se ci sono agenzie)
        classification = 'private';
        privateCount++;
      } else if (agencies.size > 1) {
        // Più agenzie (senza privati) → Giallo
        classification = 'multiagency';
        multiagencyCount++;
      } else {
        // Una sola agenzia → Rosso
        classification = 'single-agency';
        singleAgencyCount++;
      }
      
      // Consolidate duplicates (both multi-agency AND single-agency with multiple listings)
      if (groupProperties.length > 1) {
        // Use the first property as the canonical one
        const canonical = groupProperties[0];
        
        // Build agency variants array with all listings
        const agencyVariants: AgencyVariant[] = groupProperties.map(prop => ({
          agencyName: prop.agencyName || (prop.ownerType === 'private' ? 'Privato' : 'Agenzia'),
          url: prop.url,
          portalSource: prop.portalSource,
          externalId: prop.externalId
        }));
        
        // Push ONE consolidated property
        classified.push({
          ...canonical,
          classification,
          agencyCount: agencies.size,
          isMultiagency: classification === 'multiagency',
          ownerType: hasPrivate ? 'private' : 'agency', // Correctly set ownerType based on classification
          agencyVariants
        });
        
        consolidatedCount++;
      } else {
        // Single property (no duplicates): keep as-is
        const prop = groupProperties[0];
        classified.push({
          ...prop,
          classification,
          agencyCount: agencies.size,
          isMultiagency: classification === 'multiagency',
          ownerType: hasPrivate ? 'private' : 'agency' // Ensure consistent ownerType
        });
      }
    }
    
    console.log(`[CLASSIFY] Results: ${privateCount} private, ${multiagencyCount} multi-agency (${consolidatedCount} consolidated), ${singleAgencyCount} single-agency`);
    return classified;
  }

  private async getMultiAgencyPropertiesForClient(buyer: any): Promise<ScrapedPropertyResult[]> {
    try {
      // Get all multi-agency properties (shared_properties)
      const multiAgency = await db
        .select()
        .from(sharedProperties)
        .where(eq(sharedProperties.matchBuyers, true));

      console.log(`[CLIENT-SCRAPING] Found ${multiAgency.length} multi-agency properties before filtering`);

      // Filter using centralized matching logic
      const { isSharedPropertyMatchingBuyerCriteria } = await import('../lib/matchingLogic');
      const matchingProperties = multiAgency.filter(sp => 
        isSharedPropertyMatchingBuyerCriteria(sp, buyer)
      );

      console.log(`[CLIENT-SCRAPING] After filtering: ${matchingProperties.length} properties match buyer criteria (type: ${buyer.propertyType || 'any'})`);

      const results: ScrapedPropertyResult[] = matchingProperties.map(sp => {
        // Handle PostGIS location format safely
        let latitude: number | undefined;
        let longitude: number | undefined;
        
        if (sp.location) {
          try {
            const loc = sp.location as any;
            if (loc.coordinates && Array.isArray(loc.coordinates)) {
              longitude = loc.coordinates[0];
              latitude = loc.coordinates[1];
            } else if (loc.x !== undefined && loc.y !== undefined) {
              longitude = loc.x;
              latitude = loc.y;
            }
          } catch (e) {
            console.warn('[CLIENT-SCRAPING] Failed to parse location for property', sp.id);
          }
        }
        
        return {
          id: sp.id, // CRITICAL: Include the sharedProperties.id for frontend links
          externalId: sp.externalId || sp.id.toString(),
          title: `${sp.type} - ${sp.address}`,
          address: sp.address,
          city: sp.city || 'Milano',
          price: sp.price || 0,
          size: sp.size || 0,
          bedrooms: undefined,
          bathrooms: undefined,
          floor: sp.floor || undefined,
          type: sp.type || 'apartment',
          description: sp.ownerNotes || '',
          url: sp.url || '',
          latitude,
          longitude,
          ownerType: (sp.ownerType as 'agency' | 'private') || 'agency',
          agencyName: sp.ownerName || 'Multi-Agency',
          portalSource: sp.portalSource || 'Database (Multi-Agency)',
          isMultiagency: true,
          isDuplicate: true,
          isPrivate: sp.ownerType === 'private'
        };
      });

      return results;
    } catch (error) {
      console.error('[CLIENT-SCRAPING] Failed to fetch multi-agency properties:', error);
      return [];
    }
  }

  private calculateMatchScore(property: ScrapedPropertyResult, buyer: any): number {
    let score = 100;
    
    // Price match (most important - 40 points)
    if (buyer.maxPrice && property.price) {
      if (property.price > buyer.maxPrice) {
        score -= 40; // Over budget - major penalty
      } else if (property.price <= buyer.maxPrice * 0.8) {
        score -= 10; // Significantly under budget - minor penalty
      }
    }

    // Size match (30 points)
    if (buyer.minSize && property.size) {
      if (property.size < buyer.minSize) {
        score -= 30; // Too small - major penalty
      } else if (property.size > buyer.minSize * 1.5) {
        score -= 5; // Much larger than needed - minor penalty
      }
    }

    // Rooms match (20 points)
    if (buyer.rooms && property.bedrooms) {
      const roomDiff = Math.abs(property.bedrooms - buyer.rooms);
      if (roomDiff === 0) {
        // Perfect match
      } else if (roomDiff === 1) {
        score -= 5;
      } else {
        score -= 20;
      }
    }

    // Property type match (10 points)
    if (buyer.propertyType && property.type) {
      if (buyer.propertyType !== property.type) {
        score -= 10;
      }
    }

    // Bonus for multi-agency (competitive pressure)
    if (property.isMultiagency) {
      score += 5;
    }

    // Bonus for private (potentially better price)
    if (property.isPrivate) {
      score += 3;
    }

    return Math.max(0, Math.min(100, score));
  }

  async cleanup() {
    // Cleanup Apify resources
    try {
      await this.immobiliareAdapter.cleanup();
      await this.idealistaAdapter.cleanup();
    } catch (error) {
      console.error('[CLIENT-SCRAPING] Cleanup failed:', error);
    }
  }
}

export const clientPropertyScrapingService = new ClientPropertyScrapingService();
