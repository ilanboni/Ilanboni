/**
 * Servizio di geocodifica basato su Nominatim (OpenStreetMap)
 * Implementa un wrapper sicuro per le API di geocodifica con gestione degli header obbligatori
 */

import fetch from 'node-fetch';

// Configurazione per le richieste Nominatim
const USER_AGENT = 'RealEstateCRM/1.0 (info@tuosito.it)';
const BASE_URL = 'https://nominatim.openstreetmap.org';

export interface GeocodingResult {
  lat: number;
  lng: number;
  display_name: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

/**
 * Formatta un indirizzo per mostrare solo strada, numero civico e città
 * @param item Risultato grezzo da Nominatim
 * @returns Indirizzo formattato in modo pulito
 */
function formatCleanAddress(item: any): string {
  const address = item.address;
  if (!address) return item.display_name;

  // Estrai le componenti essenziali
  const road = address.road || address.street || '';
  const houseNumber = address.house_number || '';
  const city = address.city || address.town || address.village || address.municipality || '';

  // Costruisci l'indirizzo pulito
  let cleanAddress = '';
  
  if (road && houseNumber) {
    cleanAddress = `${road} ${houseNumber}`;
  } else if (road) {
    cleanAddress = road;
  }
  
  if (city && cleanAddress) {
    cleanAddress += `, ${city}`;
  } else if (city) {
    cleanAddress = city;
  }

  // Se non riusciamo a costruire un indirizzo pulito, usa quello originale
  return cleanAddress || item.display_name;
}

/**
 * Geocodifica un indirizzo con Nominatim
 * @param address L'indirizzo da geocodificare (es. "Via Roma 1, Milano, Italia")
 * @returns Un array di risultati con coordinate e dettagli dell'indirizzo
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult[]> {
  try {
    // Utilizza solo Nominatim che ha migliore supporto per indirizzi italiani
    const url = `${BASE_URL}/search?format=json&q=${encodeURIComponent(address)}&countrycodes=it&limit=5&addressdetails=1`;
    
    console.log(`[Geocoding] Ricerca indirizzo: ${address}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'it'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Errore API Nominatim: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any[];
    
    if (!data || data.length === 0) {
      console.log(`[Geocoding] Nessun risultato trovato per: ${address}`);
      return [];
    }
    
    console.log(`[Geocoding] Trovati ${data.length} risultati per: ${address}`);
    
    // Formatta i risultati nel formato standard della nostra applicazione
    return data.map(item => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      display_name: formatCleanAddress(item), // Usa l'indirizzo formattato
      address: item.address
    }));
  } catch (error: any) {
    console.error('[Geocoding] Errore nella geocodifica:', error);
    throw new Error(`Errore nella geocodifica: ${error.message || 'Sconosciuto'}`);
  }
}

/**
 * Geocodifica inversa: ottiene un indirizzo a partire da coordinate
 * @param lat Latitudine
 * @param lng Longitudine
 * @returns Informazioni sull'indirizzo corrispondente alle coordinate
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    const url = `${BASE_URL}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    
    console.log(`[Geocoding] Reverse geocoding per: (${lat}, ${lng})`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'it'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Errore API Nominatim: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.lat || !data.lon) {
      console.log(`[Geocoding] Nessun risultato trovato per le coordinate: (${lat}, ${lng})`);
      return null;
    }
    
    return {
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon),
      display_name: formatCleanAddress(data), // Usa l'indirizzo formattato
      address: data.address
    };
  } catch (error) {
    console.error('[Geocoding] Errore nel reverse geocoding:', error);
    return null;
  }
}