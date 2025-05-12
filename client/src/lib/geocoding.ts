/**
 * Client per servizi di geocodifica tramite proxy backend
 */

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
    postcode?: string;
  };
}

/**
 * Geocodifica un indirizzo utilizzando il proxy backend sicuro
 * che aggiunge gli header necessari (User-Agent)
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult[]> {
  try {
    if (!address || address.trim() === "") {
      console.warn("Tentativo di geocodifica con indirizzo vuoto");
      return [];
    }
    
    console.log(`Geocodifica indirizzo: "${address}"`);
    
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
    
    if (!response.ok) {
      throw new Error(`Errore API (${response.status}): ${response.statusText}`);
    }
    
    const results: GeocodingResult[] = await response.json();
    console.log(`Trovati ${results.length} risultati per "${address}"`);
    
    return results;
  } catch (error) {
    console.error("Errore durante la geocodifica:", error);
    throw error;
  }
}

/**
 * Geocodifica inversa: ottiene un indirizzo a partire da coordinate
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    if (isNaN(lat) || isNaN(lng)) {
      console.warn("Tentativo di reverse geocoding con coordinate non valide");
      return null;
    }
    
    console.log(`Reverse geocoding per: (${lat}, ${lng})`);
    
    const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
    
    if (!response.ok) {
      throw new Error(`Errore API (${response.status}): ${response.statusText}`);
    }
    
    const result: GeocodingResult | null = await response.json();
    return result;
  } catch (error) {
    console.error("Errore durante il reverse geocoding:", error);
    return null;
  }
}