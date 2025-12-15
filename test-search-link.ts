import { ApifyClient } from 'apify-client';
import { storage } from './server/storage';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || ''
});

function parseImmobiliareUrl(url: string) {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  
  let operation: 'buy' | 'rent' | 'auction' = 'buy';
  const pathFirst = pathParts[0]?.toLowerCase() || '';
  if (pathFirst.includes('affitto')) operation = 'rent';
  
  let propertyType: '' | 'apartment' | 'house' | 'commercialProperty' | 'land' = 'apartment';
  if (pathFirst.includes('case') || pathFirst.includes('ville')) propertyType = 'house';
  else if (pathFirst.includes('uffici') || pathFirst.includes('negozi') || pathFirst.includes('locali')) propertyType = 'commercialProperty';
  else if (pathFirst.includes('terreni')) propertyType = 'land';
  
  let municipality = pathParts[1]?.split('-')[0] || 'milano';
  municipality = municipality.charAt(0).toUpperCase() + municipality.slice(1).toLowerCase();
  
  return { country: 'it', municipality, operation, propertyType, maxItems: 50, fetchDetails: true };
}

async function testSearchLink() {
  const searchLink = "https://www.immobiliare.it/vendita-uffici/milano/?idMZona%5B0%5D=10060&idMZona%5B1%5D=10059";
  
  console.log('🔍 Testing:', searchLink);
  
  try {
    const input = parseImmobiliareUrl(searchLink);
    console.log('📋 Parameters:', JSON.stringify(input));
    console.log('⏳ Scraping (1-3 min)...');
    
    const run = await apifyClient.actor('igolaizola/immobiliare-it-scraper').call(input, { timeout: 180 });
    console.log('✅ Status:', run.status);

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    let existingCount = 0;
    const parsedItems: any[] = [];
    
    for (const item of items) {
      // Parse nested structure
      const geography = item.geography as any || {};
      const priceObj = item.price as any || {};
      const topology = item.topology as any || {};
      const analytics = item.analytics as any || {};
      
      const address = geography.street || 
                     `${geography.microzone?.name || ''}, ${geography.macrozone?.name || ''}`.trim() ||
                     'Milano';
      const price = priceObj.raw || 0;
      const size = topology.surface?.size || 0;
      const agencyName = analytics.agencyName || 'privato';
      const itemId = item.id;
      
      parsedItems.push({ address, price, size, agencyName, id: itemId });
      
      if (address && price > 0) {
        const existing = await storage.getSharedPropertyByAddressAndPrice(address, price);
        if (existing) existingCount++;
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('📈 RISULTATI:');
    console.log('   Totale scrapati:', items.length);
    console.log('   Già in DB:', existingCount);
    console.log('   Nuovi:', items.length - existingCount);
    console.log('═══════════════════════════════════════════════');
    console.log('');
    
    console.log('📋 Immobili trovati:');
    parsedItems.forEach((p, i) => {
      console.log(`${i+1}. ${p.address}`);
      console.log(`   €${p.price.toLocaleString()} | ${p.size} mq`);
      console.log(`   Agenzia: ${p.agencyName}`);
      console.log(`   ID: ${p.id}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

testSearchLink();
