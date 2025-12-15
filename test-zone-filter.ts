import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || ''
});

function parseImmobiliareUrl(url: string) {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  const params = urlObj.searchParams;
  
  let operation: 'buy' | 'rent' = 'buy';
  const pathFirst = pathParts[0]?.toLowerCase() || '';
  if (pathFirst.includes('affitto')) operation = 'rent';
  
  let propertyType: 'apartment' | 'house' | 'commercialProperty' | 'land' = 'apartment';
  if (pathFirst.includes('uffici') || pathFirst.includes('negozi')) propertyType = 'commercialProperty';
  
  let municipality = pathParts[1]?.split('-')[0] || 'milano';
  municipality = municipality.charAt(0).toUpperCase() + municipality.slice(1).toLowerCase();
  
  const zoneIds: number[] = [];
  Array.from(params.entries()).forEach(([key, value]) => {
    if (key.startsWith('idMZona') || key.startsWith('idQuartiere')) {
      const zoneId = parseInt(value);
      if (!isNaN(zoneId)) zoneIds.push(zoneId);
    }
  });
  
  return {
    params: { country: 'it', municipality, operation, propertyType, maxItems: 50, fetchDetails: true },
    zoneIds
  };
}

function matchesZoneFilter(item: any, zoneIds: number[]): boolean {
  if (zoneIds.length === 0) return true;
  const geography = item.geography as any || {};
  const macrozoneId = geography.macrozone?.id;
  const microzoneId = geography.microzone?.id;
  if (macrozoneId && zoneIds.includes(macrozoneId)) return true;
  if (microzoneId && zoneIds.includes(microzoneId)) return true;
  return false;
}

async function testZoneFilter() {
  const searchLink = "https://www.immobiliare.it/vendita-uffici/milano/?idMZona%5B0%5D=10060&idMZona%5B1%5D=10059";
  
  console.log('🔍 Testing:', searchLink);
  
  const { params, zoneIds } = parseImmobiliareUrl(searchLink);
  console.log('📋 Parameters:', JSON.stringify(params));
  console.log('🎯 Zone IDs to filter:', zoneIds);
  console.log('');
  console.log('⏳ Scraping (1-3 min)...');
  
  const run = await apifyClient.actor('igolaizola/immobiliare-it-scraper').call(params, { timeout: 180 });
  const { items: allItems } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  
  console.log(`📊 Total scraped: ${allItems.length}`);
  
  // Apply zone filter
  const filteredItems = allItems.filter(item => matchesZoneFilter(item, zoneIds));
  
  console.log(`🎯 After zone filter: ${filteredItems.length}`);
  console.log('');
  
  // Show all items with their zones for debugging
  console.log('📋 Tutti gli immobili con zone:');
  allItems.forEach((item: any, i: number) => {
    const geo = item.geography || {};
    const macrozone = geo.macrozone?.id || 'N/A';
    const microzone = geo.microzone?.id || 'N/A';
    const address = geo.street || geo.microzone?.name || 'N/A';
    const matches = matchesZoneFilter(item, zoneIds) ? '✅' : '❌';
    console.log(`${i+1}. ${matches} ${address} (macro: ${macrozone}, micro: ${microzone})`);
  });
  
  process.exit(0);
}

testZoneFilter();
