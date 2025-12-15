import { ApifyClient } from 'apify-client';
import { storage } from './server/storage';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || ''
});

function parseImmobiliareUrl(url: string) {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  
  let operation = 'buy';
  if (pathParts[0]?.includes('affitto')) operation = 'rent';
  
  // Map to allowed values: apartment, house, commercialProperty, land
  let propertyType = 'apartment';
  if (pathParts[0]?.includes('uffici') || pathParts[0]?.includes('commercial') || pathParts[0]?.includes('locali')) {
    propertyType = 'commercialProperty';
  }
  if (pathParts[0]?.includes('case') || pathParts[0]?.includes('ville')) {
    propertyType = 'house';
  }
  if (pathParts[0]?.includes('terreni')) {
    propertyType = 'land';
  }
  
  const municipality = pathParts[1]?.replace(/-.*$/, '') || 'milano';
  
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
    console.log('📊 Found:', items.length, 'properties');
    
    let existingCount = 0;
    for (const item of items) {
      const url = item.url as string || '';
      if (url) {
        const existing = await storage.getSharedPropertyBySourceUrl(url);
        if (existing) existingCount++;
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════');
    console.log('📈 RISULTATI:');
    console.log('   Totale scrapati:', items.length);
    console.log('   Già in DB:', existingCount);
    console.log('   Nuovi:', items.length - existingCount);
    console.log('═══════════════════════════════════');
    console.log('');
    
    console.log('📋 Primi 5:');
    items.slice(0, 5).forEach((p: any, i: number) => {
      console.log(`${i+1}. ${(p.title || 'N/A').substring(0, 50)}`);
      const price = parseInt(String(p.price || '0').replace(/\D/g, ''));
      console.log(`   €${price.toLocaleString()} | ${p.surface || 'N/A'} | ${p.agency || 'privato'}`);
    });
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

testSearchLink();
