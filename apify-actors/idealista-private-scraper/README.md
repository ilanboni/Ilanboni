# Idealista Private Properties Scraper

Custom Apify actor to scrape **ONLY private seller properties** from Idealista.it.

## Features

- ✅ Uses `ordine=da-privati-asc` URL filter to target private sellers
- ✅ Filters out all real estate agencies
- ✅ Extracts complete property data (price, size, rooms, location, coordinates)
- ✅ Supports pagination for bulk scraping
- ✅ Uses residential proxies to avoid blocks
- ✅ Optimized for Milano properties

## Input

```json
{
  "startUrl": "https://www.idealista.it/vendita-case/milano-milano/?ordine=da-privati-asc",
  "maxItems": 100,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## Output

Returns an array of private property listings:

```json
{
  "adid": "109366429",
  "title": "Appartamento in vendita",
  "url": "https://www.idealista.it/inmueble/109366429/",
  "price": 350000,
  "size": 85,
  "rooms": 3,
  "description": "Bellissimo appartamento...",
  "address": "Via Roma, 123, Milano",
  "latitude": 45.4642,
  "longitude": 9.1900,
  "contactName": "Mario Rossi",
  "isPrivate": true,
  "scrapedAt": "2025-11-20T09:00:00.000Z"
}
```

## How to Deploy

1. Go to [Apify Console](https://console.apify.com/actors)
2. Click "Create new" → "From source code"
3. Upload the files from this directory
4. Set as PRIVATE actor (for your use only)
5. Deploy and run!

## Cost

Using Apify's RESIDENTIAL proxies:
- ~$0.25 per 1000 requests
- For 100 properties: ~$0.025 (2.5 cents)

## Notes

- **RESIDENTIAL proxies required**: Idealista blocks datacenter proxies
- **Low concurrency**: Set to 2 to avoid rate limiting
- **CAPTCHA risk**: If detected, the actor will log it and stop
