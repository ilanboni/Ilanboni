import { CasaDaPrivatoAdapter } from './adapters/casadaprivatoAdapter';
import { ClickCaseAdapter } from './adapters/clickcaseAdapter';
import { IgolaIdealistaAdapter } from './adapters/igolaIdealistaAdapter';
import { ImmobiliareApifyAdapter } from './adapters/immobiliareApifyAdapter';
import { storage } from '../storage';

// Geographic constants - Milano center coordinates used ONLY as fallback for geocoding
// NO geographic filtering during import - all Milano properties are saved
// Geographic matching to buyers happens dynamically in storage.ts/matchingLogic.ts
const MILANO_CENTER_LAT = 45.464211;
const MILANO_CENTER_LON = 9.191383;

// Nominatim: geocodifica indirizzi GRATIS
const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number } | null> => {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      address
    )}&format=json&limit=1&countrycodes=it`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Milano-PropertyScraper/1.0' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any[];
    if (!data || !data.length) return null;
    const { lat, lon } = data[0];
    return { lat: parseFloat(lat), lon: parseFloat(lon) };
  } catch (error) {
    console.warn('Geocoding error:', error);
    return null;
  }
};

export class DailyPrivatePropertiesScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.intervalId) {
      console.log('[DAILY-SCHEDULER] Already running');
      return;
    }

    // Scrapa al server start
    this.runScheduledScraping().catch(console.error);

    // E poi ogni 24 ore
    this.intervalId = setInterval(() => {
      this.runScheduledScraping().catch(console.error);
    }, 24 * 60 * 60 * 1000);

    console.log('[DAILY-SCHEDULER] ✅ Started - scrapes every 24 hours');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[DAILY-SCHEDULER] ⏸️ Stopped');
    }
  }

  async runScheduledScraping(): Promise<void> {
    if (this.isRunning) {
      console.log('[DAILY-SCHEDULER] ⚠️ Already running, skip');
      return;
    }

    this.isRunning = true;
    console.log('\n' + '='.repeat(60));
    console.log('[DAILY-SCHEDULER] 🚀 Starting daily scraping at', new Date().toISOString());
    console.log('='.repeat(60));

    try {
      // Scrapa CasaDaPrivato
      const casaListings = await this.scrapeCasaDaPrivato();
      
      // Scrapa ClickCase
      const clickListings = await this.scrapeClickCase();
      
      // Scrapa Idealista privati
      const idealistaPrivateListings = await this.scrapeIdealistaPrivate();
      
      // Scrapa Idealista agenzie
      const idealistaAgenciesListings = await this.scrapeIdealistaAgencies();
      
      // Scrapa Immobiliare agenzie
      const immobiliareListings = await this.scrapeImmobiliareAgencies();

      const allListings = [...casaListings, ...clickListings, ...idealistaPrivateListings, ...idealistaAgenciesListings, ...immobiliareListings];
      
      console.log(`\n[DAILY-SCHEDULER] 📊 Processing all Milano properties: ${allListings.length} total`);

      // Save all Milano properties (with classification) - NO geographic filtering
      // Geographic matching to buyers happens dynamically when searching
      const saved = await this.saveAllProperties(allListings);
      
      console.log(`[DAILY-SCHEDULER] ✅ Completed - Saved ${saved} Milano properties`);
      console.log('='.repeat(60) + '\n');
    } catch (error) {
      console.error('[DAILY-SCHEDULER] ❌ Error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async scrapeCasaDaPrivato() {
    console.log('\n[DAILY-SCHEDULER] 🔍 Scraping CasaDaPrivato...');
    const adapter = new CasaDaPrivatoAdapter();
    try {
      const listings = await adapter.search({ city: 'milano', maxItems: 500 });
      console.log(`[DAILY-SCHEDULER] ✅ CasaDaPrivato: ${listings.length} properties`);
      return listings;
    } catch (error) {
      console.error('[DAILY-SCHEDULER] ❌ CasaDaPrivato error:', error);
      return [];
    }
  }

  private async scrapeClickCase() {
    console.log('\n[DAILY-SCHEDULER] 🔍 Scraping ClickCase...');
    const adapter = new ClickCaseAdapter();
    try {
      const listings = await adapter.search({ city: 'milano', maxItems: 500 });
      console.log(`[DAILY-SCHEDULER] ✅ ClickCase: ${listings.length} properties`);
      return listings;
    } catch (error) {
      console.error('[DAILY-SCHEDULER] ❌ ClickCase error:', error);
      return [];
    }
  }

  private async scrapeIdealistaPrivate() {
    console.log('\n[DAILY-SCHEDULER] 🔍 Scraping Idealista private properties...');
    const adapter = new IgolaIdealistaAdapter();
    try {
      // Increased from 100 to 2000 to capture more listings
      const listings = await adapter.search({
        locationIds: ['Milano'],
        maxItems: 2000,
        privateOnly: true,
      });
      console.log(`[DAILY-SCHEDULER] ✅ Idealista (privati): ${listings.length} PRIVATE properties`);
      return listings;
    } catch (error) {
      console.error('[DAILY-SCHEDULER] ❌ Idealista privati error:', error);
      return [];
    }
  }

  private async scrapeIdealistaAgencies() {
    console.log('\n[DAILY-SCHEDULER] 🔍 Scraping Idealista agencies...');
    const adapter = new IgolaIdealistaAdapter();
    try {
      // Increased from 100 to 2000 to capture more listings
      const listings = await adapter.search({
        locationIds: ['Milano'],
        maxItems: 2000,
        privateOnly: false, // Scrapa tutte le agenzie (professional + developer)
      });
      console.log(`[DAILY-SCHEDULER] ✅ Idealista (agenzie): ${listings.length} properties with agencies`);
      return listings;
    } catch (error) {
      console.error('[DAILY-SCHEDULER] ❌ Idealista agenzie error:', error);
      return [];
    }
  }

  private async scrapeImmobiliareAgencies() {
    console.log('\n[DAILY-SCHEDULER] 🔍 Scraping Immobiliare.it (agencies)...');
    const adapter = new ImmobiliareApifyAdapter();
    try {
      // ImmobiliareApifyAdapter now uses maxItems: 2000 internally
      const listings = await adapter.search({
        city: 'milano',
        propertyType: 'apartment',
      });
      console.log(`[DAILY-SCHEDULER] ✅ Immobiliare: ${listings.length} properties with agencies`);
      return listings;
    } catch (error) {
      console.error('[DAILY-SCHEDULER] ❌ Immobiliare error:', error);
      return [];
    }
  }

  private classifyProperty(listing: any): { ownerType: string; isMultiagency: boolean; classificationColor: string } {
    // Classificazione basata su numero di agenzie
    const agenciesCount = (listing.agencies && listing.agencies.length) || 0;
    
    // Se è privato -> PRIVATE 🟢
    if (listing.ownerType === 'private') {
      return {
        ownerType: 'private',
        isMultiagency: false,
        classificationColor: 'green'
      };
    }
    
    // Se è da Immobiliare o Idealista agenzie (ownerType='agency'):
    // - 7+ agenzie -> PLURICONDIVISO 🟡 (multi-agency)
    // - 1-6 agenzie -> MONOCONDIVISO 🔴 (single agency)
    if (listing.ownerType === 'agency') {
      // Immobiliare ha agencies array, Idealista no - quindi controlla
      if (agenciesCount >= 7) {
        return {
          ownerType: 'agency',
          isMultiagency: true,
          classificationColor: 'yellow'
        };
      } else {
        return {
          ownerType: 'agency',
          isMultiagency: false,
          classificationColor: 'red'
        };
      }
    }
    
    // Default: agenzia singola
    return {
      ownerType: 'agency',
      isMultiagency: false,
      classificationColor: 'red'
    };
  }

  private async saveAllProperties(listings: any[]): Promise<number> {
    console.log(`\n[DAILY-SCHEDULER] 🔄 Processing all Milano properties: ${listings.length} properties (dynamic buyer matching enabled)...`);
    
    let saved = 0;
    let duplicates = 0;
    let errors = 0;
    let privateCount = 0;
    let monoagencyCount = 0;
    let multiagencyCount = 0;

    for (const listing of listings) {
      try {
        const address = listing.address || listing.title || '';
        if (!address) {
          errors++;
          continue;
        }

        // Prima usa le coordinate GPS già fornite dall'adapter (se presenti)
        let coords: any = null;
        const hasGpsFromAdapter = listing.latitude && listing.longitude && 
          !isNaN(parseFloat(String(listing.latitude))) && 
          !isNaN(parseFloat(String(listing.longitude)));
        
        if (hasGpsFromAdapter) {
          coords = { 
            lat: parseFloat(String(listing.latitude)), 
            lng: parseFloat(String(listing.longitude)), 
            display_name: address 
          };
        } else {
          // Geocodifica l'indirizzo solo se non abbiamo coordinate GPS
          const fullAddress = `${address}, Milano, Italia`;
          
          let coordsResult: any = null;
          try {
            coordsResult = await geocodeAddress(fullAddress);
          } catch (geocodingError) {
            // Silently continue
          }
          
          // If geocoding failed or returned empty, use Milano center as fallback
          if (!coordsResult) {
            coords = { lat: MILANO_CENTER_LAT, lng: MILANO_CENTER_LON, display_name: 'Milano (Center)' };
          } else {
            coords = { lat: coordsResult.lat, lng: coordsResult.lon, display_name: fullAddress };
          }
        }

        // Classifica il tipo di proprietà
        const classification = this.classifyProperty(listing);
        
        // Conta per statistiche
        if (classification.classificationColor === 'green') privateCount++;
        if (classification.classificationColor === 'yellow') multiagencyCount++;
        if (classification.classificationColor === 'red') monoagencyCount++;
        
        // Salva nel database come SharedProperty (with externalLink per i privati) o Property (per le agenzie)
        if (classification.ownerType === 'private') {
          // Verifica duplicato prima di salvare
          const existingSharedProp = await storage.getSharedPropertyByAddressAndPrice(
            listing.address || '',
            listing.price || 0
          );
          
          if (existingSharedProp) {
            duplicates++;
            continue;
          }
          
          // Salva come SharedProperty con externalLink preservato
          const sharedPropertyToSave = {
            address: listing.address || '',
            city: 'Milano',
            price: listing.price || 0,
            size: listing.size || 0,
            type: 'apartment',
            description: listing.description || listing.title || '',
            externalLink: listing.url || '',
            latitude: coords.lat.toString(),
            longitude: coords.lng.toString(),
            ownerType: classification.ownerType,
            externalId: listing.externalId || `${listing.source}-${Date.now()}`,
            ownerPhone: listing.ownerPhone,
            ownerEmail: listing.ownerEmail,
            ownerName: listing.ownerName,
            portalSource: listing.portal || listing.source || 'Privato',
            classificationColor: classification.classificationColor,
            matchBuyers: true,
          };
          await storage.createSharedProperty(sharedPropertyToSave);
        } else {
          // Salva come Property normale per le agenzie
          const propertyToSave = {
            address: listing.address || '',
            city: 'Milano',
            price: listing.price || 0,
            size: listing.size || 0,
            type: 'apartment',
            description: listing.description || listing.title || '',
            url: listing.url || '',
            externalLink: listing.url || '',
            latitude: coords.lat.toString(),
            longitude: coords.lng.toString(),
            ownerType: classification.ownerType,
            isMultiagency: classification.isMultiagency,
            externalId: listing.externalId,
            ownerPhone: listing.ownerPhone,
            ownerEmail: listing.ownerEmail,
            portal: listing.portal || listing.source || '',
            source: listing.source || listing.portal || '',
            agencies: listing.agencies || [],
          };
          await storage.createProperty(propertyToSave);
        }

        saved++;
      } catch (error) {
        console.warn(`  ✗ Error processing ${listing.title}:`, error);
        errors++;
      }
    }

    console.log(`\n[DAILY-SCHEDULER] 📈 Import Results:`);
    console.log(`  ✅ Saved: ${saved}`);
    console.log(`    🟢 Private: ${privateCount}`);
    console.log(`    🟡 Multi-agency (7+): ${multiagencyCount}`);
    console.log(`    🔴 Single-agency: ${monoagencyCount}`);
    console.log(`  ⏭️ Duplicates skipped: ${duplicates}`);
    console.log(`  ❌ Errors: ${errors}`);

    return saved;
  }
}

export const dailyPrivatePropertiesScheduler = new DailyPrivatePropertiesScheduler();
