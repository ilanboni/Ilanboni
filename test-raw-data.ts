import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || ''
});

async function testRawData() {
  const input = {
    country: 'it',
    municipality: 'Milano',
    operation: 'buy',
    propertyType: 'commercialProperty',
    maxItems: 5,
    fetchDetails: true
  };
  
  console.log('⏳ Fetching raw data...');
  
  const run = await apifyClient.actor('igolaizola/immobiliare-it-scraper').call(input, { timeout: 180 });
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  
  console.log('📦 Raw item structure (first item):');
  console.log(JSON.stringify(items[0], null, 2));
  
  process.exit(0);
}

testRawData();
