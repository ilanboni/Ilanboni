import { ApifyClient } from 'apify-client';
import type { PropertyListing } from '../portalIngestionService';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;
const ACTOR_ID = 'igolaizola/idealista-scraper'; // Professional actor with contactInfo

const MILANO_METRO_BOUNDS = {
  minLat: 45.3,
  maxLat: 45.6,
  minLng: 8.9,
  maxLng: 9.4
};

const MILANO_NEIGHBORHOODS = [
  'porta venezia', 'porta romana', 'porta genova', 'porta garibaldi', 'porta nuova',
  'navigli', 'brera', 'isola', 'lambrate', 'città studi', 'citta studi',
  'centrale', 'loreto', 'buenos aires', 'corso como', 'garibaldi',
  'moscova', 'castello', 'duomo', 'san babila', 'quadrilatero',
  'tortona', 'ticinese', 'darsena', 'barona', 'affori', 'bovisa',
  'bicocca', 'niguarda', 'greco', 'turro', 'gorla', 'precotto',
  'sesto', 'monza', 'zara', 'maciachini', 'cenisio', 'sempione',
  'wagner', 'de angeli', 'gambara', 'bande nere', 'primaticcio',
  'lorenteggio', 'bisceglie', 'inganni', 'famagosta', 'romolo',
  'abbiategrasso', 'chiesa rossa', 'gratosoglio', 'ripamonti',
  'corvetto', 'rogoredo', 'porto di mare', 'lodi', 'brenta',
  'forlanini', 'ortica', 'cimiano', 'crescenzago', 'cascina gobba',
  'udine', 'pasteur', 'piola', 'dateo', 'tricolore', 'san donato',
  'santa giulia', 'cermenate', 'vigentino', 'chiaravalle', 'nosedo',
  'mecenate', 'taliedo', 'morsenchio', 'quintosole', 'ponte lambro',
  'castelfidardo', 'fiera', 'citylife', 'portello', 'tre torri',
  'san siro', 'lotto', 'amendola', 'cadorna', 'cairoli', 'cordusio',
  'missori', 'crocetta', 'porta vittoria', 'palestro', 'turati',
  'repubblica', 'gioia', 'sondrio', 'marche', 'lima', 'viale monza'
];

function isInMilanoArea(item: any): { isValid: boolean; reason?: string } {
  const municipality = (item.municipality || '').toLowerCase().trim();
  const province = (item.province || '').toUpperCase().trim();
  const address = (item.address || '').toLowerCase().trim();
  const neighborhood = (item.neighborhood || '').toLowerCase().trim();
  const lat = item.latitude ? parseFloat(item.latitude) : null;
  const lng = item.longitude ? parseFloat(item.longitude) : null;

  if (municipality.includes('milan') || municipality.includes('milano')) {
    return { isValid: true };
  }

  if (province === 'MI') {
    return { isValid: true };
  }

  for (const hood of MILANO_NEIGHBORHOODS) {
    if (municipality.includes(hood) || neighborhood.includes(hood) || address.includes(hood)) {
      return { isValid: true };
    }
  }

  if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
    if (
      lat >= MILANO_METRO_BOUNDS.minLat &&
      lat <= MILANO_METRO_BOUNDS.maxLat &&
      lng >= MILANO_METRO_BOUNDS.minLng &&
      lng <= MILANO_METRO_BOUNDS.maxLng
    ) {
      return { isValid: true };
    }
  }

  if (!municipality && !province && lat === null && lng === null) {
    return { isValid: true, reason: 'no-location-data-trust-api' };
  }

  const details = [
    `municipality="${item.municipality || 'N/A'}"`,
    `province="${item.province || 'N/A'}"`,
    lat !== null && lng !== null ? `coords=(${lat}, ${lng})` : 'coords=N/A'
  ].join(', ');
  
  return { isValid: false, reason: details };
}

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
          const updatedRun = await this.client.run(run.id).get();
          if (!updatedRun) {
            throw new Error(`Failed to get run status for ${run.id}`);
          }
          finalRun = updatedRun;
          console.log(`[IGOLA-IDEALISTA] Polling... Status: ${finalRun.status}`);
        }

        if (finalRun.status !== 'SUCCEEDED') {
          console.error(`[IGOLA-IDEALISTA] ❌ Location ${locationId} failed: ${finalRun.statusMessage}`);
          continue; // Skip failed locations
        }

        console.log('[IGOLA-IDEALISTA] Run completed:', {
          status: finalRun.status,
          statusMessage: finalRun.statusMessage,
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
        const userTypeFiltered = params.privateOnly !== false
          ? allItems.filter((item: any) => item.contactInfo?.userType === 'private')
          : allItems;

        console.log(`[IGOLA-IDEALISTA] After userType filter: ${userTypeFiltered.length} properties`);
        const privateCount = allItems.filter((i: any) => i.contactInfo?.userType === 'private').length;
        const professionalCount = allItems.filter((i: any) => i.contactInfo?.userType === 'professional').length;
        const developerCount = allItems.filter((i: any) => i.contactInfo?.userType === 'developer').length;
        console.log(`[IGOLA-IDEALISTA]   - Private: ${privateCount}, Professional: ${professionalCount}, Developer: ${developerCount}`);

        // Additional filter: detect agencies disguised as private sellers by owner name
        const agencyKeywords = [
          'immobiliare', 'immobiliari', 'agency', 'agenzia', 'agenzie',
          'consulting', 'consultant', 'consultants', 'consulenza',
          'real estate', 'realestate', 'property', 'properties',
          'srl', 's.r.l.', 'spa', 's.p.a.', 'snc', 's.n.c.', 'sas', 's.a.s.',
          'group', 'gruppo', 'holding', 'invest', 'investment', 'investments',
          'casa', 'case', 'home', 'homes', 'house', 'houses',
          'broker', 'brokers', 'mediazione', 'mediazioni',
          'vendite', 'vendita', 'compravendite', 'compravendita',
          'gestioni', 'gestione', 'servizi', 'service', 'services',
          'partners', 'partner', 'associati', 'associates',
          'studio', 'studi', 'advisors', 'advisor',
          'capital', 'capitale', 'patrimoniale', 'patrimoni',
          'itineris', 'tecnocasa', 'gabetti', 'engel', 'remax', 're/max',
          'coldwell', 'century21', 'century 21', 'keller williams',
          'toscano', 'grimaldi', 'frimm', 'professione'
        ];
        
        const isAgencyByName = (ownerName: string | null | undefined): boolean => {
          if (!ownerName) return false;
          const nameLower = ownerName.toLowerCase().trim();
          
          // Check for agency keywords
          for (const keyword of agencyKeywords) {
            if (nameLower.includes(keyword)) {
              return true;
            }
          }
          
          // Check for company suffixes at end of name
          if (/\b(srl|s\.r\.l\.|spa|s\.p\.a\.|snc|s\.n\.c\.|sas|s\.a\.s\.)\s*$/i.test(ownerName)) {
            return true;
          }
          
          return false;
        };
        
        // Apply agency name filter only when looking for private properties
        let realPrivateFiltered = userTypeFiltered;
        let agencyByNameCount = 0;
        
        if (params.privateOnly !== false) {
          realPrivateFiltered = userTypeFiltered.filter((item: any) => {
            const contact = item.contactInfo || {};
            const ownerName = contact.contactName || contact.commercialName || '';
            if (isAgencyByName(ownerName)) {
              agencyByNameCount++;
              console.log(`[IGOLA-IDEALISTA] ⛔ Filtered agency disguised as private: "${ownerName}" (${item.propertyCode || 'N/A'})`);
              return false;
            }
            return true;
          });
          console.log(`[IGOLA-IDEALISTA] After agency-name filter: ${realPrivateFiltered.length} properties (detected ${agencyByNameCount} fake privates)`);
        }

        // Filter by Milano location to prevent out-of-market listings
        const filteredItems: any[] = [];
        let milanoFilteredCount = 0;
        
        for (const item of realPrivateFiltered) {
          const locationCheck = isInMilanoArea(item);
          if (locationCheck.isValid) {
            filteredItems.push(item);
          } else {
            milanoFilteredCount++;
            console.log(`[IGOLA-IDEALISTA] ⛔ Filtered out non-Milano property: ${item.propertyCode || 'N/A'} - ${locationCheck.reason}`);
          }
        }

        console.log(`[IGOLA-IDEALISTA] After Milano location filter: ${filteredItems.length} properties (filtered out: ${milanoFilteredCount})`);

        // Transform to PropertyListing format
        const listings: PropertyListing[] = filteredItems.map((item: any) => {
          const contact = item.contactInfo || {};
          const userType = contact.userType;
          
          // Create title from property characteristics
          const rooms = item.rooms ? `${item.rooms} locali` : '';
          const size = item.size ? `${item.size}m²` : '';
          const zone = item.district || item.neighborhood || '';
          const titleParts = [rooms, size, zone].filter(Boolean);
          const title = titleParts.length > 0 
            ? `Appartamento ${titleParts.join(', ')}` 
            : `Appartamento in ${item.municipality || 'Milano'}`;
          
          return {
            externalId: item.propertyCode || `idealista-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title,
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
