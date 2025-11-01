import { db } from "../db";
import { buyers, clients } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { PropertyListing, SearchCriteria } from "./portalIngestionService";
import { CasafariAdapter } from "./adapters/casafariAdapter";

export interface ScrapedPropertyResult extends PropertyListing {
  portalSource: string;
  matchScore?: number;
}

export class ClientPropertyScrapingService {
  private casafariAdapter = new CasafariAdapter();

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

      // Use Casafari API (aggregates data from all Italian portals)
      try {
        const casafariResults = await this.casafariAdapter.search(criteria);
        const enriched = casafariResults.map(r => ({
          ...r,
          portalSource: 'Casafari (Multi-portal)'
        }));
        allResults.push(...enriched);
        console.log(`[CLIENT-SCRAPING] Casafari: found ${casafariResults.length} properties for zone ${zone || 'Milano'}`);
      } catch (error) {
        console.error(`[CLIENT-SCRAPING] Casafari scraping failed for zone ${zone}:`, error);
      }
    }

    // Deduplicate by externalId + portalSource
    const uniqueResults = this.deduplicateResults(allResults);

    // Filter: exclude our own agency properties (if applicable)
    const filteredResults = this.filterExternalAgencies(uniqueResults);

    console.log(`[CLIENT-SCRAPING] Total results: ${allResults.length}, unique: ${uniqueResults.length}, after filtering: ${filteredResults.length}`);

    return filteredResults;
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

  private filterExternalAgencies(results: ScrapedPropertyResult[]): ScrapedPropertyResult[] {
    // Filter to include only properties from other agencies
    // Exclude: private owners (ownerType === 'private') and our own agency
    
    const OUR_AGENCY_NAMES = [
      'la tua agenzia', // Replace with actual agency name if needed
      'tua agenzia',
      'agenzia'
    ];

    return results.filter(result => {
      // Exclude private owners
      if (result.ownerType === 'private') {
        return false;
      }

      // If agencyName is present, check it's not ours
      if (result.agencyName) {
        const normalizedAgency = result.agencyName.toLowerCase().trim();
        const isOurAgency = OUR_AGENCY_NAMES.some(name => 
          normalizedAgency.includes(name.toLowerCase())
        );
        
        if (isOurAgency) {
          return false;
        }
      }

      // Include all other agency properties (even if agencyName is undefined)
      return true;
    });
  }

  async cleanup() {
    // Cleanup Casafari resources
    try {
      await this.casafariAdapter.cleanup();
    } catch (error) {
      console.error('[CLIENT-SCRAPING] Cleanup failed:', error);
    }
  }
}

export const clientPropertyScrapingService = new ClientPropertyScrapingService();
