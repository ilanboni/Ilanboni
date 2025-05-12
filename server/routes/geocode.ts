import express from 'express';
import { geocodeAddress, reverseGeocode } from '../lib/geocoding';

const router = express.Router();

/**
 * GET /api/geocode
 * Geocodifica un indirizzo (testo -> coordinate)
 * Query params:
 * - q: l'indirizzo da geocodificare
 */
router.get('/', async (req, res) => {
  try {
    const address = req.query.q as string;
    
    if (!address) {
      return res.status(400).json({ error: "Parametro 'q' mancante" });
    }
    
    console.log("Query ricevuta:", address);
    const results = await geocodeAddress(address);
    res.json(results);
  } catch (error: any) {
    console.error("[GET /api/geocode] Errore:", error);
    res.status(500).json({ error: error.message || "Errore durante la geocodifica" });
  }
});

/**
 * GET /api/geocode/reverse
 * Geocodifica inversa (coordinate -> indirizzo)
 * Query params:
 * - lat: latitudine
 * - lng: longitudine
 */
router.get('/reverse', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Parametri 'lat' e 'lng' devono essere numeri validi" });
    }
    
    console.log("[GET /api/geocode/reverse] Geocodifica inversa:", { lat, lng });
    const result = await reverseGeocode(lat, lng);
    res.json(result);
  } catch (error: any) {
    console.error("[GET /api/geocode/reverse] Errore:", error);
    res.status(500).json({ error: error.message || "Errore durante la geocodifica inversa" });
  }
});

export default router;