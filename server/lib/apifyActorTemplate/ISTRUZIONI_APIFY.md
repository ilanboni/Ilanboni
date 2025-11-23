# Come Mettere l'Actor su Apify

## Prerequisiti
- Account Apify.com
- Chiave API di OpenCage (https://opencagedata.com/) - la puoi ottenere gratis

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
- ✅ Funzione `geocodeAddress()` - geocodifica indirizzi
- ✅ GLOBAL_INPUT - accedi alla chiave di geocoding ovunque

Basta fare come nelle tue istruzioni: prima di salvare nel dataset, chiama geocodeAddress + haversineKm e filtra a 4km.

## Step 4: Testa l'Actor

1. Sulla pagina dell'actor, clicca **"Start"**
2. Un popup ti chiede gli input:
   - **geocodingApiKey**: Inserisci qui la tua chiave di OpenCage (es: `abc123def456`)
   - Gli altri parametri hanno valori di default

3. Clicca **"Start"** di nuovo
4. L'actor parte! Puoi vedere i log e il dataset finale

## Step 5: Usa i Dati Scrapati

Quando l'actor finisce:
1. Vai alla scheda **"Dataset"**
2. Vedi tutti gli immobili scrapati (solo quelli entro 4km dal Duomo ✨)
3. Puoi:
   - Esportarli in CSV/JSON
   - Usare il dataset ID negli API di Apify
   - Integrarli nel tuo backend

## Di Cosa hai Bisogno:

**Chiave OpenCage gratuita:**
1. Vai su https://opencagedata.com/
2. Registrati (è gratis per 2500 richieste/giorno)
3. Copia la tua API key
4. Usala nei test dell'actor

---

**Nota:** Il template fornito è uno stub. Dovrai integrare il vero codice di scraping (Playwright, Puppeteer, ecc.) dentro Actor.main(), ma la parte di geocoding + filtro è già pronta! 🎉
