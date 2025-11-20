import { ApifyClient } from 'apify-client';
import type { PropertyListing } from '../propertyIngestion';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;
const ACTOR_ID = 'exuberant_exclamation/casadaprivato-scraper'; // 100% private properties!

export class CasaDaPrivatoAdapter {
  private client: ApifyClient;

  constructor() {
    this.client = new ApifyClient({ token: APIFY_TOKEN });
  }

  async search(params: {
    city: string;
    maxItems?: number;
    centerLat?: number;
    centerLng?: number;
    maxDistanceKm?: number;
  }): Promise<PropertyListing[]> {
    console.log('[CASADAPRIVATO] Searching for 100% PRIVATE properties on CasaDaPrivato.it');
    console.log('[CASADAPRIVATO] City:', params.city);
    console.log('[CASADAPRIVATO] Max items:', params.maxItems || 100);

    try {
      // Prepare input for the actor
      const input = {
        startUrl: `https://www.casadaprivato.it/annunci-vendita/immobili/${params.city}-${params.city}`,
        maxItems: params.maxItems || 100,
        centerLat: params.centerLat || 45.4642, // Duomo di Milano
        centerLng: params.centerLng || 9.1900,
        maxDistanceKm: params.maxDistanceKm || 4
      };

      console.log('[CASADAPRIVATO] Starting actor with URL:', input.startUrl);
      console.log('[CASADAPRIVATO] Full input payload:', JSON.stringify(input, null, 2));

      // Run the actor
      const run = await this.client.actor(ACTOR_ID).call(input, {
        waitSecs: 0, // Don't wait, we'll poll
      });

      console.log(`[CASADAPRIVATO] Run ID: ${run.id}, Status: ${run.status}`);

      // Wait for completion (up to 3 minutes)
      let finalRun = run;
      const maxWaitTime = 180000; // 3 minutes
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
        console.log(`[CASADAPRIVATO] Polling... Status: ${finalRun.status}`);
      }

      if (finalRun.status !== 'SUCCEEDED') {
        throw new Error(`Actor run ${finalRun.status}: ${finalRun.statusMessage}`);
      }

      console.log('[CASADAPRIVATO] Run completed:', {
        status: finalRun.status,
        statusMessage: finalRun.statusMessage,
        itemsCount: finalRun.stats?.itemsCount,
        failedRequests: finalRun.stats?.requestsFailed,
        finishedAt: finalRun.finishedAt
      });

      // Get results from dataset
      const { items } = await this.client.dataset(finalRun.defaultDatasetId!).listItems();

      console.log(`[CASADAPRIVATO] Dataset returned ${items.length} items (all 100% PRIVATE!)`);

      // Transform to PropertyListing format
      const listings: PropertyListing[] = items.map((item: any) => {
        return {
          externalId: item.propertyId || item.url?.split('/').pop() || `cdp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          address: item.address || 'Milano',
          city: params.city,
          price: item.price || 0,
          size: item.size || null,
          bedrooms: item.rooms || null,
          bathrooms: null,
          type: 'apartment' as const,
          description: item.description || item.title || '',
          url: item.url || '',
          source: 'casadaprivato',
          ownerType: 'private', // 100% guaranteed private on this site!
          latitude: item.latitude || null,
          longitude: item.longitude || null,
          distanceFromCenter: item.distanceFromCenter || null
        };
      });

      console.log(`[CASADAPRIVATO] ✅ Found ${listings.length} PRIVATE listings`);

      return listings;

    } catch (error) {
      console.error('[CASADAPRIVATO] Error:', error);
      throw error;
    }
  }

  async cleanup() {
    // No cleanup needed for Apify client
  }
}
