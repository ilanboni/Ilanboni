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
    city: string;
    maxItems?: number;
    privateOnly?: boolean;
  }): Promise<PropertyListing[]> {
    console.log('[IGOLA-IDEALISTA] Searching Idealista properties via igolaizola actor');
    console.log('[IGOLA-IDEALISTA] City:', params.city);
    console.log('[IGOLA-IDEALISTA] Max items:', params.maxItems || 100);
    console.log('[IGOLA-IDEALISTA] Private only filter:', params.privateOnly !== false);

    try {
      // Prepare input for igolaizola actor with full parameters
      // Try using "city-city" format for more results (e.g., "milano-milano")
      const locationFormat = `${params.city.toLowerCase()}-${params.city.toLowerCase()}`;
      const input = {
        country: 'it',
        location: locationFormat,
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
        throw new Error(`Actor run ${finalRun.status}: ${finalRun.statusMessage}`);
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
        const { items, count, total, offset: nextOffset } = await this.client
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

      console.log(`[IGOLA-IDEALISTA] Dataset returned ${allItems.length} total items (full pagination complete)`);

      // Filter by userType if privateOnly is true (default)
      const filteredItems = params.privateOnly !== false
        ? allItems.filter((item: any) => item.contactInfo?.userType === 'private')
        : allItems;

      console.log(`[IGOLA-IDEALISTA] After userType filter: ${filteredItems.length} properties`);
      console.log(`[IGOLA-IDEALISTA] Breakdown:`);
      const privateCount = allItems.filter((i: any) => i.contactInfo?.userType === 'private').length;
      const professionalCount = allItems.filter((i: any) => i.contactInfo?.userType === 'professional').length;
      const developerCount = allItems.filter((i: any) => i.contactInfo?.userType === 'developer').length;
      const unknownCount = allItems.length - privateCount - professionalCount - developerCount;
      console.log(`[IGOLA-IDEALISTA]   - Private: ${privateCount}`);
      console.log(`[IGOLA-IDEALISTA]   - Professional: ${professionalCount}`);
      console.log(`[IGOLA-IDEALISTA]   - Developer: ${developerCount}`);
      console.log(`[IGOLA-IDEALISTA]   - Unknown: ${unknownCount}`);

      // Transform to PropertyListing format
      const listings: PropertyListing[] = filteredItems.map((item: any) => {
        const contact = item.contactInfo || {};
        const userType = contact.userType;
        
        return {
          externalId: item.propertyCode || `idealista-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          address: item.address || '',
          city: params.city,
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
          latitude: item.latitude || null,
          longitude: item.longitude || null
        };
      });

      console.log(`[IGOLA-IDEALISTA] ✅ Returning ${listings.length} listings`);

      return listings;

    } catch (error) {
      console.error('[IGOLA-IDEALISTA] Error:', error);
      throw error;
    }
  }

  async cleanup() {
    // No cleanup needed
  }
}
