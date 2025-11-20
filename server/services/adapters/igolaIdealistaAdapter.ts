import { ApifyClient } from 'apify-client';
import type { PropertyListing } from '../propertyIngestion';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;
const ACTOR_ID = 'igolaizola/idealista-scraper'; // Professional actor with contactInfo

export class IgolaIdealistaAdapter {
  private client: ApifyClient;

  constructor() {
    this.client = new ApifyClient({ token: APIFY_TOKEN });
  }

  async search(params: {
    city?: string;
    locationIds?: string[];
    maxItems?: number;
    privateOnly?: boolean;
  }): Promise<PropertyListing[]> {
    console.log('[IGOLA-IDEALISTA] Searching Idealista properties via igolaizola actor');
    console.log('[IGOLA-IDEALISTA] Location IDs:', params.locationIds);
    console.log('[IGOLA-IDEALISTA] Max items per location:', params.maxItems || 100);
    console.log('[IGOLA-IDEALISTA] Private only filter:', params.privateOnly !== false);

    // Validate input
    if (!params.locationIds || params.locationIds.length === 0) {
      throw new Error('locationIds array is required and must not be empty');
    }

    try {
      // Scrape each location and aggregate results
      let allListings: PropertyListing[] = [];
      
      for (const locationId of params.locationIds) {
        console.log(`\n[IGOLA-IDEALISTA] 📍 Scraping location: ${locationId}`);
        
        const input = {
          country: 'it',
          location: locationId,
          operation: 'sale',
          propertyType: 'homes',
          homeType: ['flat', 'apartment', 'penthouse', 'duplex', 'loft'],
          maxItems: params.maxItems || 100,
          fetchDetails: false
        };

        console.log('[IGOLA-IDEALISTA] Starting actor with input:', JSON.stringify(input, null, 2));

        // Run the actor
        const run = await this.client.actor(ACTOR_ID).call(input, {
          waitSecs: 0,
        });

        console.log(`[IGOLA-IDEALISTA] Run ID: ${run.id}, Status: ${run.status}`);

        // Wait for completion (up to 5 minutes for large scrapes)
        let finalRun = run;
        const maxWaitTime = 300000; // 5 minutes
        const pollInterval = 5000; // 5 seconds
        const startTime = Date.now();

        while (
          finalRun.status !== 'SUCCEEDED' &&
          finalRun.status !== 'FAILED' &&
          finalRun.status !== 'ABORTED' &&
          finalRun.status !== 'TIMED-OUT' &&
          Date.now() - startTime < maxWaitTime
        ) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          finalRun = await this.client.run(run.id).get();
          console.log(`[IGOLA-IDEALISTA] Polling... Status: ${finalRun.status}`);
        }

        if (finalRun.status !== 'SUCCEEDED') {
          console.error(`[IGOLA-IDEALISTA] ❌ Location ${locationId} failed: ${finalRun.statusMessage}`);
          continue; // Skip failed locations
        }

        console.log('[IGOLA-IDEALISTA] Run completed:', {
          status: finalRun.status,
          statusMessage: finalRun.statusMessage,
          itemsCount: finalRun.stats?.itemsCount,
          finishedAt: finalRun.finishedAt
        });

        // Get ALL results from dataset with full pagination loop
        let allItems: any[] = [];
        let offset = 0;
        const pageSize = 1000; // Reasonable page size for efficient pagination
        let hasMore = true;

        while (hasMore) {
          const { items } = await this.client
            .dataset(finalRun.defaultDatasetId!)
            .listItems({
              limit: pageSize,
              offset: offset
            });

          allItems = allItems.concat(items);
          offset += items.length;

          console.log(`[IGOLA-IDEALISTA] Fetched page: ${items.length} items (total so far: ${allItems.length})`);

          // Stop if we got fewer items than requested (last page)
          if (items.length < pageSize) {
            hasMore = false;
          }
        }

        console.log(`[IGOLA-IDEALISTA] Location ${locationId}: ${allItems.length} total items`);

        // Filter by userType if privateOnly is true (default)
        const filteredItems = params.privateOnly !== false
          ? allItems.filter((item: any) => item.contactInfo?.userType === 'private')
          : allItems;

        console.log(`[IGOLA-IDEALISTA] After userType filter: ${filteredItems.length} properties`);
        const privateCount = allItems.filter((i: any) => i.contactInfo?.userType === 'private').length;
        const professionalCount = allItems.filter((i: any) => i.contactInfo?.userType === 'professional').length;
        const developerCount = allItems.filter((i: any) => i.contactInfo?.userType === 'developer').length;
        console.log(`[IGOLA-IDEALISTA]   - Private: ${privateCount}, Professional: ${professionalCount}, Developer: ${developerCount}`);

        // Transform to PropertyListing format
        const listings: PropertyListing[] = filteredItems.map((item: any) => {
          const contact = item.contactInfo || {};
          const userType = contact.userType;
          
          return {
            externalId: item.propertyCode || `idealista-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            address: item.address || '',
            city: item.municipality || params.city || 'Milano',
            price: item.price || 0,
            size: item.size || null,
            bedrooms: item.rooms || null,
            bathrooms: item.bathrooms || null,
            type: 'apartment' as const,
            description: item.description || '',
            url: item.url || '',
            source: 'idealista',
            ownerType: userType === 'private' ? 'private' : 'agency',
            ownerName: contact.contactName || contact.commercialName || null,
            ownerPhone: contact.phone1?.formattedPhone || null,
            latitude: item.latitude ? String(item.latitude) : null,
            longitude: item.longitude ? String(item.longitude) : null
          };
        });

        console.log(`[IGOLA-IDEALISTA] ✅ Location ${locationId}: ${listings.length} listings added`);
        allListings = allListings.concat(listings);
      }

      console.log(`\n[IGOLA-IDEALISTA] 🎯 TOTAL: ${allListings.length} listings from ${params.locationIds.length} locations`);
      return allListings;

    } catch (error) {
      console.error('[IGOLA-IDEALISTA] Error:', error);
      throw error;
    }
  }

  async cleanup() {
    // No cleanup needed
  }
}
