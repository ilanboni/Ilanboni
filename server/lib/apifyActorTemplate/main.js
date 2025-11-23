import Apify from 'apify';

// Costanti Duomo Milano
const DUOMO_LAT = 45.464211;
const DUOMO_LON = 9.191383;
const MAX_RADIUS_KM = 4;

// Variabile globale per input
let GLOBAL_INPUT;

// Funzione Haversine per calcolare distanza (km)
const haversineKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371; // Raggio medio Terra in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Funzione di geocoding
const geocodeAddress = async (address, apiKey) => {
    if (!address) return null;
    try {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
            address
        )}&key=${apiKey}&limit=1&language=it`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.results || !data.results.length) return null;
        const { lat, lng } = data.results[0].geometry;
        return { lat, lon: lng };
    } catch (error) {
        Apify.log.error(`Geocoding error for "${address}":`, error);
        return null;
    }
};

Apify.main(async () => {
    const input = await Apify.getInput();
    GLOBAL_INPUT = input;

    const {
        city = 'milano',
        area = 'milano',
        contract = 'vendita',
        modeClickCase = 'solo_vendita',
        maxPagesCasa = 3,
        maxPagesClick = 3,
        geocodingApiKey,
    } = input;

    if (!geocodingApiKey) {
        Apify.log.error(
            'Manca geocodingApiKey nell\'input, non posso filtrare per raggio.'
        );
        throw new Error('geocodingApiKey è obbligatorio');
    }

    Apify.log.info(
        `Avvio scraping: città="${city}", zona="${area}", contratto="${contract}"`
    );
    Apify.log.info(`Geocoding API attivo. Filtro: ${MAX_RADIUS_KM}km dal Duomo`);

    // Configura le opzioni dello scraper (esempio generico)
    const crawlerOptions = {
        maxRequestsPerCrawl: 1000,
        maxPagesPerCrawl: Math.max(maxPagesCasa, maxPagesClick),
        headless: true,
    };

    // Qui andrà il tuo codice di scraping (CasaDaPrivato, ClickCase, ecc.)
    // Per ora è uno stub - tu integrerai il tuo scraper
    Apify.log.info('Placeholder: inserisci qui il codice di scraping');

    const datasetId = await Apify.call('apify/web-scraper', {
        startUrls: [
            { url: `https://www.casadaprivato.it/ricerca?city=${city}&type=casa` },
            { url: `https://www.clickcase.it/ricerca?city=${city}` },
        ],
        ...crawlerOptions,
    });

    Apify.log.info(`Scraping completato. Dataset ID: ${datasetId}`);
});

// Export delle funzioni per il modulo
export { haversineKm, geocodeAddress, GLOBAL_INPUT };
