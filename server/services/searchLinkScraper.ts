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

interface ImmobiliareSearchParams {
  country: string;
  municipality: string;
  operation: 'buy' | 'rent' | 'auction';
  propertyType: '' | 'apartment' | 'house' | 'commercialProperty' | 'land';
  maxItems: number;
  fetchDetails: boolean;
  minPrice?: number;
  maxPrice?: number;
  minSurface?: number;
  maxSurface?: number;
  minRooms?: number;
  maxRooms?: number;
}

interface ParsedUrlResult {
  params: ImmobiliareSearchParams;
  zoneIds: number[]; // idMZona values for post-filtering
}

function parseImmobiliareUrl(url: string): ParsedUrlResult {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const params = urlObj.searchParams;
    
    // Extract operation from path (vendita/affitto/aste)
    let operation: 'buy' | 'rent' | 'auction' = 'buy';
    const pathFirst = pathParts[0]?.toLowerCase() || '';
    if (pathFirst.includes('affitto')) operation = 'rent';
    if (pathFirst.includes('aste') || pathFirst.includes('auction')) operation = 'auction';
    
    // Extract property type from path
    let propertyType: '' | 'apartment' | 'house' | 'commercialProperty' | 'land' = 'apartment';
    if (pathFirst.includes('case') || pathFirst.includes('ville') || pathFirst.includes('villette')) {
      propertyType = 'house';
    } else if (pathFirst.includes('uffici') || pathFirst.includes('negozi') || pathFirst.includes('locali') || pathFirst.includes('commercial')) {
      propertyType = 'commercialProperty';
    } else if (pathFirst.includes('terreni')) {
      propertyType = 'land';
    }
    
    // Extract municipality from path
    let municipality = pathParts[1]?.split('-')[0] || 'milano';
    municipality = municipality.charAt(0).toUpperCase() + municipality.slice(1).toLowerCase();
    
    // Parse query parameters for filters
    const searchParams: ImmobiliareSearchParams = {
      country: 'it',
      municipality,
      operation,
      propertyType,
      maxItems: 200, // Increased to get more results for zone filtering
      fetchDetails: true
    };
    
    // Price filters
    const minPrice = params.get('prezzoMinimo');
    const maxPrice = params.get('prezzoMassimo');
    if (minPrice) searchParams.minPrice = parseInt(minPrice);
    if (maxPrice) searchParams.maxPrice = parseInt(maxPrice);
    
    // Size filters
    const minSurface = params.get('superficieMinima');
    const maxSurface = params.get('superficieMassima');
    if (minSurface) searchParams.minSurface = parseInt(minSurface);
    if (maxSurface) searchParams.maxSurface = parseInt(maxSurface);
    
    // Room filters
    const minRooms = params.get('localiMinimo');
    const maxRooms = params.get('localiMassimo');
    if (minRooms) searchParams.minRooms = parseInt(minRooms);
    if (maxRooms) searchParams.maxRooms = parseInt(maxRooms);
    
    // Extract zone IDs (idMZona[0], idMZona[1], etc.)
    const zoneIds: number[] = [];
    Array.from(params.entries()).forEach(([key, value]) => {
      // Match idMZona[0], idMZona[1], idMZona, idQuartiere, etc.
      if (key.startsWith('idMZona') || key.startsWith('idQuartiere') || key.startsWith('idZona')) {
        const zoneId = parseInt(value);
        if (!isNaN(zoneId)) {
          zoneIds.push(zoneId);
        }
      }
    });
    
    console.log(`[SEARCH-LINK-SCRAPER] Parsed URL params:`, JSON.stringify(searchParams));
    if (zoneIds.length > 0) {
      console.log(`[SEARCH-LINK-SCRAPER] Zone filter IDs: ${zoneIds.join(', ')}`);
    }
    
    return { params: searchParams, zoneIds };
    
  } catch (error) {
    console.error(`[SEARCH-LINK-SCRAPER] Error parsing URL:`, error);
    return {
      params: {
        country: 'it',
        municipality: 'Milano',
        operation: 'buy',
        propertyType: 'apartment',
        maxItems: 200,
        fetchDetails: true
      },
      zoneIds: []
    };
  }
}

function matchesZoneFilter(item: any, zoneIds: number[]): boolean {
  if (zoneIds.length === 0) return true; // No filter, include all
  
  const geography = item.geography as any || {};
  const macrozoneId = geography.macrozone?.id;
  const microzoneId = geography.microzone?.id;
  
  // Check if property's zone matches any of the requested zones
  if (macrozoneId && zoneIds.includes(macrozoneId)) return true;
  if (microzoneId && zoneIds.includes(microzoneId)) return true;
  
  return false;
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

    // Parse URL into structured parameters and zone IDs
    const { params: searchParams, zoneIds } = parseImmobiliareUrl(client.searchLink);
    
    console.log(`[SEARCH-LINK-SCRAPER] 📋 Calling Apify with params: ${JSON.stringify(searchParams)}`);

    const run = await apifyClient.actor('igolaizola/immobiliare-it-scraper').call(searchParams, {
      timeout: 180 // 3 minutes timeout
    });

    console.log(`[SEARCH-LINK-SCRAPER] Apify run ${run.id} completed with status: ${run.status}`);

    const { items: allItems } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log(`[SEARCH-LINK-SCRAPER] Found ${allItems.length} properties from Apify`);

    // Apply zone filter if specified in the URL
    const items = zoneIds.length > 0 
      ? allItems.filter(item => matchesZoneFilter(item, zoneIds))
      : allItems;
    
    if (zoneIds.length > 0) {
      console.log(`[SEARCH-LINK-SCRAPER] 🎯 Zone filter applied: ${items.length}/${allItems.length} properties match zones [${zoneIds.join(', ')}]`);
    }

    result.totalFound = items.length;

    const buyer = await storage.getBuyerByClientId(client.id);
    const isHighRating = buyer && (buyer.rating === 4 || buyer.rating === 5);

    for (const item of items) {
      try {
        // Parse nested Apify response structure
        const itemId = item.id as number;
        const title = item.title as string || '';
        
        // Geography data
        const geography = item.geography as any || {};
        const address = geography.street || 
                       `${geography.microzone?.name || ''}, ${geography.macrozone?.name || ''}`.trim() ||
                       geography.municipality?.name ||
                       searchParams.municipality;
        const city = geography.municipality?.name || searchParams.municipality;
        const lat = geography.geolocation?.latitude;
        const lng = geography.geolocation?.longitude;
        
        // Price data
        const priceObj = item.price as any || {};
        const price = priceObj.raw || parseInt(String(priceObj.value || '0').replace(/\D/g, '')) || 0;
        
        // Topology data
        const topology = item.topology as any || {};
        const size = topology.surface?.size || 0;
        const rooms = parseInt(topology.rooms || '0') || undefined;
        const bathrooms = parseInt(topology.bathrooms || '0') || undefined;
        const floor = topology.floor;
        
        // Analytics data
        const analytics = item.analytics as any || {};
        const agencyName = analytics.agencyName;
        const advertiserType = analytics.advertiser; // 'agenzia' or 'privato'
        
        // Contacts data
        const contacts = item.contacts as any || {};
        const phones = contacts.phones as any[] || [];
        const phone = phones.length > 0 ? phones[0].num : null;
        
        // Build URL
        const url = `https://www.immobiliare.it/annunci/${itemId}/`;
        
        // Description from media or title
        const description = item.description as string || title || '';
        
        // Agency classification
        const agencies: string[] = [];
        if (agencyName) agencies.push(agencyName);
        
        const isPrivate = advertiserType === 'privato' || 
                         /privato|da privato|proprietario|no agenzie/i.test(description + title);
        const category = categorizeProperty(agencies, isPrivate);
        
        let ownerPhone: string | null = null;
        if (category === 'privato' || category === 'privato+agenzia') {
          ownerPhone = phone || extractPhoneFromText(description) || null;
        }

        // Check for existing property by address+price
        const existingProperty = (address && price > 0) 
          ? await storage.getSharedPropertyByAddressAndPrice(address, price)
          : undefined;
        
        const propertyData = {
          address,
          city,
          price,
          size: size || undefined,
          rooms,
          bathrooms,
          floor,
          latitude: lat,
          longitude: lng,
          sourceUrl: url,
          description: description.substring(0, 2000),
          type: searchParams.propertyType === 'commercialProperty' ? 'commercial' : 
                searchParams.propertyType === 'house' ? 'house' : 'apartment',
          portalSource: 'Immobiliare.it',
          externalId: `imm-${itemId}`,
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
          savedProperty = await storage.createSharedProperty(propertyData as any);
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
