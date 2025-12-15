import { ApifyClient } from 'apify-client';
import { storage } from '../storage';
import { Client, SharedProperty } from '@shared/schema';
import { runQuickMatchingForHighRatingClients } from './quickMatcher';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || ''
});

export type OwnerCategory = 'privato' | 'monocondiviso' | 'pluricondiviso' | 'privato+agenzia';

export interface SearchLinkScrapingResult {
  clientId: number;
  clientName: string;
  searchLink: string;
  totalFound: number;
  newProperties: number;
  updatedProperties: number;
  matchesCreated: number;
  properties: Array<{
    id: number;
    address: string;
    price: number;
    category: OwnerCategory;
    isNew: boolean;
  }>;
  errors: string[];
}

function categorizeProperty(agencies: string[], hasPrivate: boolean): OwnerCategory {
  const agencySet = new Set(agencies.filter(a => a && a.trim()));
  const uniqueAgencies = Array.from(agencySet);
  
  if (hasPrivate && uniqueAgencies.length === 0) {
    return 'privato';
  }
  if (hasPrivate && uniqueAgencies.length > 0) {
    return 'privato+agenzia';
  }
  if (uniqueAgencies.length === 1) {
    return 'monocondiviso';
  }
  if (uniqueAgencies.length > 1) {
    return 'pluricondiviso';
  }
  return 'privato';
}

function extractPhoneFromText(text: string): string | null {
  if (!text) return null;
  
  const phonePatterns = [
    /(?:tel|telefono|cell|mobile)[:\s]*([+\d\s\-()]{8,})/i,
    /(\+39[\s.-]?\d{2,4}[\s.-]?\d{5,8})/,
    /(3[0-9]{2}[\s.-]?\d{3}[\s.-]?\d{4})/,
    /(\d{2,4}[\s.-]?\d{5,8})/
  ];
  
  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/\s+/g, '').trim();
    }
  }
  return null;
}

export async function scrapePropertiesFromSearchLink(client: Client): Promise<SearchLinkScrapingResult> {
  const result: SearchLinkScrapingResult = {
    clientId: client.id,
    clientName: `${client.firstName} ${client.lastName}`,
    searchLink: client.searchLink || '',
    totalFound: 0,
    newProperties: 0,
    updatedProperties: 0,
    matchesCreated: 0,
    properties: [],
    errors: []
  };

  if (!client.searchLink) {
    result.errors.push('Client has no search link configured');
    console.log(`[SEARCH-LINK-SCRAPER] ⚠️ Client ${client.id} has no searchLink`);
    return result;
  }

  console.log(`[SEARCH-LINK-SCRAPER] 🔍 Scraping for client ${client.id}: ${client.searchLink}`);

  try {
    const isImmobiliare = client.searchLink.includes('immobiliare.it');
    
    if (!isImmobiliare) {
      result.errors.push('Only immobiliare.it links are currently supported');
      return result;
    }

    const run = await apifyClient.actor('igolaizola/immobiliare-it-scraper').call({
      startUrls: [{ url: client.searchLink }],
      maxItems: 100,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    });

    console.log(`[SEARCH-LINK-SCRAPER] Apify run ${run.id} completed with status: ${run.status}`);

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log(`[SEARCH-LINK-SCRAPER] Found ${items.length} properties from Apify`);

    result.totalFound = items.length;

    const buyer = await storage.getBuyerByClientId(client.id);
    const isHighRating = buyer && (buyer.rating === 4 || buyer.rating === 5);

    for (const item of items) {
      try {
        const url = item.url as string || '';
        const title = item.title as string || '';
        const address = item.address as string || item.location as string || 'Milano';
        const price = parseInt(String(item.price || '0').replace(/\D/g, '')) || 0;
        const size = parseInt(String(item.surface || item.size || '0').replace(/\D/g, '')) || 0;
        const description = item.description as string || '';
        
        const agencies: string[] = [];
        if (item.agency) agencies.push(item.agency as string);
        if (item.agencies && Array.isArray(item.agencies)) {
          agencies.push(...(item.agencies as string[]));
        }
        
        const hasPrivate = /privato|da privato|proprietario|no agenzie/i.test(description + title);
        const category = categorizeProperty(agencies, hasPrivate);
        
        let ownerPhone: string | null = null;
        if (category === 'privato' || category === 'privato+agenzia') {
          ownerPhone = extractPhoneFromText(description) || 
                       item.phone as string || 
                       item.ownerPhone as string || 
                       null;
        }

        const existingProperty = await storage.getSharedPropertyByAddressAndPrice(address, price);
        
        const propertyData = {
          address,
          city: 'Milano',
          price,
          size: size || undefined,
          url,
          description: description.substring(0, 2000),
          type: 'apartment',
          portalSource: 'Immobiliare.it',
          externalId: `imm-${url.match(/(\d+)(?:\.html)?$/)?.[1] || Date.now()}`,
          ownerType: category === 'privato' ? 'private' : 'agency',
          ownerPhone,
          agencies: agencies.length > 0 ? agencies.map(a => ({ name: a, link: '' })) : undefined,
          classificationColor: category === 'privato' ? 'green' : (category === 'pluricondiviso' ? 'yellow' : 'red'),
          scrapedForClientId: client.id
        };

        let savedProperty: SharedProperty;
        let isNew = false;

        if (existingProperty) {
          const updated = await storage.updateSharedProperty(existingProperty.id, propertyData);
          if (updated) {
            savedProperty = updated;
            result.updatedProperties++;
          } else {
            continue;
          }
        } else {
          savedProperty = await storage.createSharedProperty(propertyData);
          result.newProperties++;
          isNew = true;
        }

        result.properties.push({
          id: savedProperty.id,
          address: savedProperty.address,
          price: savedProperty.price || 0,
          category,
          isNew
        });

        if (isHighRating && isNew) {
          const matchResult = await runQuickMatchingForHighRatingClients(savedProperty, 'shared');
          result.matchesCreated += matchResult.matchesSaved;
        }

      } catch (itemError) {
        const errorMsg = itemError instanceof Error ? itemError.message : String(itemError);
        console.error(`[SEARCH-LINK-SCRAPER] Error processing item:`, errorMsg);
        result.errors.push(`Item error: ${errorMsg}`);
      }
    }

    console.log(`[SEARCH-LINK-SCRAPER] ✅ Completed for client ${client.id}: ${result.newProperties} new, ${result.updatedProperties} updated, ${result.matchesCreated} matches`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[SEARCH-LINK-SCRAPER] ❌ Critical error:`, errorMsg);
    result.errors.push(`Critical error: ${errorMsg}`);
  }

  return result;
}

export async function scrapeAllClientSearchLinks(): Promise<{
  processed: number;
  results: SearchLinkScrapingResult[];
}> {
  console.log('[SEARCH-LINK-SCRAPER] 🔄 Starting batch scraping for all clients with search links');
  
  const allClients = await storage.getClients({ type: 'buyer' });
  const clientsWithLinks = allClients.filter(c => c.searchLink && c.searchLink.trim());
  
  console.log(`[SEARCH-LINK-SCRAPER] Found ${clientsWithLinks.length} clients with search links`);
  
  const results: SearchLinkScrapingResult[] = [];
  
  for (const client of clientsWithLinks) {
    const result = await scrapePropertiesFromSearchLink(client);
    results.push(result);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const totalNew = results.reduce((sum, r) => sum + r.newProperties, 0);
  const totalMatches = results.reduce((sum, r) => sum + r.matchesCreated, 0);
  
  console.log(`[SEARCH-LINK-SCRAPER] ✅ Batch completed: ${clientsWithLinks.length} clients, ${totalNew} new properties, ${totalMatches} matches`);
  
  return {
    processed: clientsWithLinks.length,
    results
  };
}

export async function scrapeSearchLinkForHighRatingClients(): Promise<{
  processed: number;
  results: SearchLinkScrapingResult[];
}> {
  console.log('[SEARCH-LINK-SCRAPER] 🌟 Starting scraping for high-rating clients (4-5) only');
  
  const allClients = await storage.getClients({ type: 'buyer' });
  const results: SearchLinkScrapingResult[] = [];
  
  for (const client of allClients) {
    if (!client.searchLink) continue;
    
    const buyer = await storage.getBuyerByClientId(client.id);
    if (!buyer || (buyer.rating !== 4 && buyer.rating !== 5)) continue;
    
    console.log(`[SEARCH-LINK-SCRAPER] Processing high-rating client: ${client.firstName} ${client.lastName} (rating ${buyer.rating})`);
    
    const result = await scrapePropertiesFromSearchLink(client);
    results.push(result);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`[SEARCH-LINK-SCRAPER] ✅ High-rating batch completed: ${results.length} clients processed`);
  
  return {
    processed: results.length,
    results
  };
}
