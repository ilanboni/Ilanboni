# Come Mettere l'Actor su Apify

## Prerequisiti
- Account Apify.com (gratuito)

## ✨ Nota Importante
**NON SERVE API KEY DI GEOCODING!** L'actor usa Nominatim (OpenStreetMap) che è completamente GRATUITO.

## Step 1: Crea l'Actor su Apify

1. Vai su https://console.apify.com
2. Clicca **"Actors"** nel menu di sinistra
3. Clicca **"Create actor"** (pulsante blu)
4. Dai un nome, es: **"Milano Private Properties Scraper"**
5. Clicca **"Create"**

## Step 2: Configura il Codice

1. Copia il file `main.js` (quello fornito)
2. Nel tuo nuovo actor su Apify:
   - Nella sezione **"Source"**, sostituisci il file `main.js` con il contenuto fornito
3. Copia il file `INPUT_SCHEMA.json` (quello fornito)
4. Nella sezione **"Input"**:
   - Clicca il pulsante accanto a "Input schema"
   - Incolla il contenuto di `INPUT_SCHEMA.json`
   - Clicca **"Save"**

## Step 3: Integra il Tuo Scraper Reale

Nel file `main.js`, nella sezione **"Qui andrà il tuo codice di scraping"**, inserirai il tuo scraper per:
- CasaDaPrivato (handleCasaDetail con filtro 4km)
- ClickCase (handleClickDetail con filtro 4km)

Il template fornisce già:
- ✅ Funzione `haversineKm()` - calcola distanza dal Duomo
- ✅ Funzione `geocodeAddress()` - geocodifica indirizzi usando Nominatim (GRATIS, NO API KEY!)
- ✅ GLOBAL_INPUT - accedi agli input ovunque

Basta fare come nelle tue istruzioni: prima di salvare nel dataset, chiama:
```javascript
const coords = await geocodeAddress(locationString);
const distanceKm = haversineKm(DUOMO_LAT, DUOMO_LON, coords.lat, coords.lon);
if (distanceKm <= MAX_RADIUS_KM) {
    await Dataset.pushData({ ...item, lat: coords.lat, lon: coords.lon, distance_km: distanceKm });
}
```

## Step 4: Testa l'Actor

1. Sulla pagina dell'actor, clicca **"Start"**
2. Gli input hanno valori di default (city, maxPages, ecc.)
3. Clicca **"Start"** di nuovo
4. L'actor parte! Puoi vedere i log e il dataset finale
5. ✨ **NON SERVE NESSUNA API KEY** - Nominatim è gratis!

## Step 5: Usa i Dati Scrapati

Quando l'actor finisce:
1. Vai alla scheda **"Dataset"**
2. Vedi tutti gli immobili scrapati (solo quelli entro 4km dal Duomo ✨)
3. Puoi:
   - Esportarli in CSV/JSON
   - Usare il dataset ID negli API di Apify
   - Integrarli nel tuo backend

## Di Cosa hai Bisogno:

**NIENTE!** 🎉
- ✅ Account Apify.com - gratuito
- ✅ Nominatim API per geocoding - **GRATUITO, ILLIMITATO**
- ✅ Nessuna chiave esterna richiesta

---

**Nota Tecnica:** Il template fornito include le funzioni `haversineKm()` e `geocodeAddress()` già pronte. Dovrai solo integrare il vero codice di scraping (Playwright, Puppeteer, ecc.) dentro `Actor.main()`, ma la parte di geocoding + filtro è **100% funzionante** e pronta! 🎉

**Nominatim è Open Street Map**, usato dal tuo backend già - perfetto per continuità!
