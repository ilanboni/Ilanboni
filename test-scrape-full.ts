import { getApifyService } from './server/services/apifyService';

async function testScrapeFullMilano() {
  console.log('🎯 Scraping completo Milano via igolaizola actor...\n');

  try {
    const apifyService = getApifyService();
    
    console.log('📡 Scraping Immobiliare.it Milano (max 5000 items)...');
    console.log('⏳ Questo potrebbe richiedere qualche minuto...\n');
    
    const listings = await apifyService.scrapeImmobiliare({
      maxItems: 5000,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    });
    
    console.log(`\n✅ Trovati ${listings.length} annunci totali`);
    
    // Filter for our target addresses and IDs
    const targetIds = ['124788755', '124916727'];
    const sardegnaMatches = listings.filter(l => 
      (l.address || '').toLowerCase().includes('sardegna')
    );
    const correggioMatches = listings.filter(l => 
      (l.address || '').toLowerCase().includes('correggio')
    );
    const exactIdMatches = listings.filter(l => targetIds.includes(l.externalId));
    
    console.log(`\n📍 VIA SARDEGNA - Trovati ${sardegnaMatches.length} annunci:`);
    sardegnaMatches.forEach(l => {
      const isTarget = l.address?.toLowerCase().includes('31') || l.externalId === '124916727';
      const marker = isTarget ? '🎯' : '  ';
      console.log(`${marker} ID: ${l.externalId} | ${l.address} | €${l.price?.toLocaleString()} | ${l.size}m²`);
    });
    
    console.log(`\n📍 VIA CORREGGIO - Trovati ${correggioMatches.length} annunci:`);
    correggioMatches.forEach(l => {
      const isTarget = l.address?.toLowerCase().includes('12') || l.externalId === '124788755';
      const marker = isTarget ? '🎯' : '  ';
      console.log(`${marker} ID: ${l.externalId} | ${l.address} | €${l.price?.toLocaleString()} | ${l.size}m²`);
    });
    
    if (exactIdMatches.length > 0) {
      console.log(`\n🎯 MATCH ESATTI per ID target:`);
      exactIdMatches.forEach(l => {
        console.log(`  ID: ${l.externalId} | ${l.address} | €${l.price?.toLocaleString()}`);
      });
    }

    return { 
      total: listings.length, 
      sardegna: sardegnaMatches.length, 
      correggio: correggioMatches.length,
      exactMatches: exactIdMatches.length
    };
  } catch (error) {
    console.error('\n❌ Errore:', error);
    return { total: 0, sardegna: 0, correggio: 0, exactMatches: 0 };
  }
}

testScrapeFullMilano();
