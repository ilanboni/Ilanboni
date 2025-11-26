import { getApifyService } from './server/services/apifyService';

async function testScrapeMilano() {
  console.log('🎯 Scraping Milano via igolaizola actor...\n');

  try {
    const apifyService = getApifyService();
    
    console.log('📡 Scraping Immobiliare.it Milano (max 500 items)...');
    const listings = await apifyService.scrapeImmobiliare({
      maxItems: 500,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL']
      }
    });
    
    console.log(`\n✅ Trovati ${listings.length} annunci totali`);
    
    // Filter for our target addresses
    const targetAddresses = ['sardegna', 'correggio'];
    const targetIds = ['124788755', '124916727'];
    
    const matches = listings.filter(l => {
      const addrLower = (l.address || '').toLowerCase();
      const hasTargetAddress = targetAddresses.some(t => addrLower.includes(t));
      const hasTargetId = targetIds.includes(l.externalId);
      return hasTargetAddress || hasTargetId;
    });
    
    console.log(`\n🎯 Trovati ${matches.length} annunci target (Sardegna/Correggio):\n`);
    matches.forEach(l => {
      console.log(`  ID: ${l.externalId}`);
      console.log(`  📍 ${l.address}`);
      console.log(`  💰 €${l.price?.toLocaleString()} | ${l.size}m²`);
      console.log(`  🔗 ${l.url}`);
      console.log(`  👤 ${l.ownerType} - ${l.agencyName || l.ownerName || 'N/A'}`);
      console.log('');
    });

    // Also show some sample listings
    console.log(`\n📋 Sample di altri annunci (primi 5):`);
    listings.slice(0, 5).forEach(l => {
      console.log(`  ${l.externalId}: ${l.address} - €${l.price?.toLocaleString()}`);
    });

    return { total: listings.length, matches };
  } catch (error) {
    console.error('\n❌ Errore:', error);
    return { total: 0, matches: [] };
  }
}

testScrapeMilano();
