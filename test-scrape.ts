import { getApifyService } from './server/services/apifyService';

async function test() {
  console.log('🎯 Scraping 2 annunci per Lidia Aliprandi...\n');

  const urls = [
    'https://www.immobiliare.it/annunci/123603077/',
    'https://www.immobiliare.it/annunci/123285767/'
  ];

  try {
    const apifyService = getApifyService();
    const listings = await apifyService.scrapeSpecificListings(urls);
    
    console.log(`\n✅ Scrap${listings.length} annunci:\n`);
    listings.forEach(l => {
      console.log(`  ID: ${l.externalId} | ${l.title}`);
      console.log(`  Prezzo: €${l.price.toLocaleString()} | ${l.size}m²`);
    });

  } catch (error) {
    console.error('\n❌ Errore:', error);
  }
}

test();
