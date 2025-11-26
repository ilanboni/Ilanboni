import { getApifyService } from './server/services/apifyService';

async function testScrape() {
  console.log('🎯 Scraping 4 annunci specifici via Apify...\n');

  const immobiliareUrls = [
    'https://www.immobiliare.it/annunci/124788755/',  // Via Correggio 12
    'https://www.immobiliare.it/annunci/124916727/'   // Via Sardegna 31
  ];

  try {
    const apifyService = getApifyService();
    
    console.log('📡 Scraping Immobiliare.it URLs...');
    const listings = await apifyService.scrapeSpecificListings(immobiliareUrls);
    
    console.log(`\n✅ Trovati ${listings.length} annunci:\n`);
    listings.forEach(l => {
      console.log(`  ID: ${l.externalId}`);
      console.log(`  📍 ${l.address}`);
      console.log(`  💰 €${l.price?.toLocaleString()} | ${l.size}m²`);
      console.log(`  🔗 ${l.url}`);
      console.log(`  👤 Owner: ${l.ownerType} - ${l.agencyName || l.ownerName || 'N/A'}`);
      console.log('');
    });

    return listings;
  } catch (error) {
    console.error('\n❌ Errore:', error);
    return [];
  }
}

testScrape();
