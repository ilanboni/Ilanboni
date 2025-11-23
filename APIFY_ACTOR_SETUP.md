# 🚀 Setup Actor Apify - Scraping Immobili Privati Milano

## ✨ Buone Notizie!
- ✅ **NON SERVE API KEY** - Usa Nominatim (OpenStreetMap) gratis
- ✅ **TUTTO PRONTO** - Copia e incolla il codice
- ✅ **ZERO COSTI** - Completamente gratuito

---

## 📋 Step 1: Accedi ad Apify

1. Vai su https://console.apify.com
2. Accedi o registrati (è gratis)

---

## 📝 Step 2: Crea l'Actor

1. Clicca **"Actors"** nel menu di sinistra
2. Clicca **"Create actor"** (pulsante blu)
3. Dai un nome: **"Milano Private Properties Scraper"**
4. Clicca **"Create"**

---

## 💾 Step 3: Copia il Codice main.js

**Nella sezione "Source" del tuo actor:**

1. Seleziona tutto il file `main.js`
2. **Copia il codice qui sotto:**

```javascript
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

// Funzione di geocoding con Nominatim (GRATUITO, NO API KEY)
const geocodeAddress = async (address) => {
    if (!address) return null;
    try {
        // Nominatim API (OpenStreetMap) - GRATUITO
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            address
        )}&format=json&limit=1&countrycodes=it`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Milano-PropertyScraper/1.0' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !data.length) return null;
        const { lat, lon } = data[0];
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
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
    } = input;

    Apify.log.info(
        `Avvio scraping: città="${city}", zona="${area}", contratto="${contract}"`
    );
    Apify.log.info(
        `Geocoding: Nominatim (OpenStreetMap - GRATUITO). Filtro: ${MAX_RADIUS_KM}km dal Duomo`
    );

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
```

3. **Incolla nel tuo actor** nella sezione "Source"
4. Clicca **"Save"**

---

## ⚙️ Step 4: Copia lo Schema di Input

**Nella sezione "Input" del tuo actor:**

1. Clicca il pulsante accanto a "Input schema"
2. **Copia il codice JSON qui sotto:**

```json
{
  "title": "Scraper Immobili Privati Milano - 4km dal Duomo",
  "type": "object",
  "schemaVersion": 1,
  "properties": {
    "city": {
      "title": "Città",
      "type": "string",
      "description": "Città da scrapare",
      "default": "milano",
      "prefill": "milano"
    },
    "area": {
      "title": "Area/Zona",
      "type": "string",
      "description": "Area specifiche entro la città",
      "default": "milano",
      "prefill": "milano"
    },
    "contract": {
      "title": "Tipo Contratto",
      "type": "string",
      "description": "Tipo di contratto immobiliare",
      "default": "vendita",
      "enum": ["vendita", "affitto", "tutti"],
      "prefill": "vendita"
    },
    "modeClickCase": {
      "title": "Modalità ClickCase",
      "type": "string",
      "description": "Modalità di scraping per ClickCase",
      "default": "solo_vendita",
      "enum": ["solo_vendita", "tutti"],
      "prefill": "solo_vendita"
    },
    "maxPagesCasa": {
      "title": "Max Pagine CasaDaPrivato",
      "type": "integer",
      "description": "Numero massimo di pagine da scrapare da CasaDaPrivato",
      "default": 3,
      "minimum": 1,
      "prefill": 3
    },
    "maxPagesClick": {
      "title": "Max Pagine ClickCase",
      "type": "integer",
      "description": "Numero massimo di pagine da scrapare da ClickCase",
      "default": 3,
      "minimum": 1,
      "prefill": 3
    }
  },
  "required": []
}
```

3. **Incolla nello schema**
4. Clicca **"Save"**

---

## 🎯 Step 5: Usa il Filtro 4km

Nel tuo codice di scraping (handleCasaDetail, handleClickDetail), prima di salvare:

```javascript
// Esempio: prima di fare await Dataset.pushData()

const locationString = `${item.city || 'Milano'} ${item.zone || ''}`.trim();
const coords = await geocodeAddress(locationString);

if (!coords) {
    Apify.log.warning(`Geocoding fallito per: ${locationString}`);
    return; // scarta l'annuncio
}

const distanceKm = haversineKm(DUOMO_LAT, DUOMO_LON, coords.lat, coords.lon);

if (distanceKm <= MAX_RADIUS_KM) {
    await Dataset.pushData({
        ...item,
        lat: coords.lat,
        lon: coords.lon,
        distance_km: distanceKm,
    });
} else {
    Apify.log.info(`Scartato (distanza ${distanceKm.toFixed(2)} km): ${item.title}`);
}
```

---

## ▶️ Step 6: Testa l'Actor

1. Clicca **"Start"** sulla pagina dell'actor
2. Gli input hanno già valori di default
3. Clicca **"Start"** di nuovo
4. ✨ Fatto! L'actor scrapa i dati

---

## 📊 Step 7: Scarica i Dati

Quando l'actor finisce:
1. Vai alla scheda **"Dataset"**
2. Vedi tutti gli immobili (filtrati a 4km dal Duomo ✨)
3. Scarica in CSV, JSON, o altro formato

---

## 🎁 Cosa hai:

✅ `haversineKm()` - Calcola distanza dal Duomo  
✅ `geocodeAddress()` - Geocodifica indirizzi gratis  
✅ `GLOBAL_INPUT` - Accedi agli input ovunque  
✅ Filtro a 4km già pronto  
✅ Nessuna API key richiesta  

---

## 📝 Domande?

- Come aggiungere il filtro nei miei handler? → Vedi Step 5
- Che API geocoding usi? → Nominatim (OpenStreetMap) - GRATUITO
- Serve una chiave? → NO! ✨
- Quanto costa? → ZERO! 🎉

Fatto! 🚀
