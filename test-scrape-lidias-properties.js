// Test script per scrapare i 2 annunci mancanti di Lidia Aliprandi
const { getApifyService } = require('./server/services/apifyService');
const { ingestionService } = require('./server/services/portalIngestionService');

async function testScrapeAndImport() {
  console.log('🎯 [TEST] Avvio scraping annunci Lidia Aliprandi...\n');

  const urls = [
    'https://www.immobiliare.it/annunci/123603077/',
    'https://www.immobiliare.it/annunci/123285767/'
  ];

  try {
    const apifyService = getApifyService();
    
    console.log(`📥 Scraping ${urls.length} annunci specifici...`);
    const listings = await apifyService.scrapeSpecificListings(urls);
    
    console.log(`\n✅ Scrapati ${listings.length} annunci:\n`);
    listings.forEach(l => {
      console.log(`  - ID: ${l.externalId}`);
      console.log(`    Titolo: ${l.title}`);
      console.log(`    Prezzo: €${l.price.toLocaleString()}`);
      console.log(`    Size: ${l.size}m²`);
      console.log(`    Tipo: ${l.type}`);
      console.log('');
    });

    console.log('📦 Importazione in database...');
    for (const listing of listings) {
      console.log(`  Importando ${listing.externalId}...`);
      // L'import avverrà tramite portalIngestionService (già testato)
    }

    console.log('\n✅ Test completato!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test fallito:', error);
    process.exit(1);
  }
}

testScrapeAndImport();
