import { db } from "../db";
import { buyers, clients, sharedProperties } from "@shared/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import type { PropertyListing, SearchCriteria } from "./portalIngestionService";
import { ImmobiliareApifyAdapter } from "./adapters/immobiliareApifyAdapter";
import { IdealistaApifyAdapter } from "./adapters/idealistaApifyAdapter";

export interface ScrapedPropertyResult extends PropertyListing {
  portalSource: string;
  matchScore?: number;
  isMultiagency?: boolean;
  isDuplicate?: boolean;
  isPrivate?: boolean;
}

export class ClientPropertyScrapingService {
  private immobiliareAdapter = new ImmobiliareApifyAdapter();
  private idealistaAdapter = new IdealistaApifyAdapter();

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
    console.log(`[CLIENT-SCRAPING] Added ${multiAgencyProperties.length} multi-agency properties from database`);

    // Deduplicate by externalId + portalSource
    const uniqueResults = this.deduplicateResults(allResults);

    // Calculate match score for each result based on buyer criteria
    const scoredResults = uniqueResults.map(result => ({
      ...result,
      matchScore: this.calculateMatchScore(result, buyer)
    }));

    // Sort by match score (highest first)
    scoredResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    console.log(`[CLIENT-SCRAPING] Total results: ${allResults.length}, unique: ${uniqueResults.length}, scored: ${scoredResults.length}`);

    return scoredResults;
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

  private async getMultiAgencyPropertiesForClient(buyer: any): Promise<ScrapedPropertyResult[]> {
    try {
      // Get all multi-agency properties (shared_properties)
      const multiAgency = await db
        .select()
        .from(sharedProperties)
        .where(eq(sharedProperties.matchBuyers, true));

      const results: ScrapedPropertyResult[] = multiAgency.map(sp => ({
        externalId: sp.id.toString(),
        title: `${sp.type} - ${sp.address}`,
        address: sp.address,
        city: sp.city || 'Milano',
        price: sp.price,
        size: sp.size,
        bedrooms: sp.rooms || undefined,
        bathrooms: sp.bathrooms || undefined,
        floor: sp.floor || undefined,
        type: sp.type,
        description: sp.ownerNotes || '',
        url: '',
        latitude: sp.location ? (sp.location as any).coordinates[1] : undefined,
        longitude: sp.location ? (sp.location as any).coordinates[0] : undefined,
        ownerType: 'agency',
        agencyName: 'Multi-Agency',
        portalSource: 'Database (Multi-Agency)',
        isMultiagency: true,
        isDuplicate: true,
        isPrivate: false
      }));

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
