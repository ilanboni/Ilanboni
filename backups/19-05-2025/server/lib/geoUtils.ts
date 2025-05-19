/**
 * geoUtils.ts
 * 
 * Utility per operazioni geografiche e geospaziali
 */

/**
 * Verifica se un punto si trova all'interno di un poligono
 * Implementazione dell'algoritmo "ray casting" per la verifica punto-in-poligono
 * 
 * @param point Il punto da verificare, in formato [longitudine, latitudine]
 * @param polygon Il poligono, un array di punti [longitudine, latitudine]
 * @returns true se il punto è all'interno del poligono, false altrimenti
 */
export function pointInPolygon(point: [number, number], polygon: Array<[number, number]>): boolean {
  // Assicurati che ci siano abbastanza punti per formare un poligono
  if (!polygon || polygon.length < 3) {
    return false;
  }
  
  const x = point[0];
  const y = point[1];
  
  let inside = false;
  
  // Algoritmo Ray Casting
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Calcola la distanza in metri tra due punti geografici usando la formula dell'emisenoverso
 * (anche conosciuta come formula di Haversine)
 * 
 * @param point1 Primo punto [longitudine, latitudine]
 * @param point2 Secondo punto [longitudine, latitudine]
 * @returns La distanza in metri tra i due punti
 */
export function calculateDistance(point1: [number, number], point2: [number, number]): number {
  const R = 6371e3; // Raggio della Terra in metri
  
  const lat1 = point1[1] * Math.PI / 180; // φ1 in radianti
  const lat2 = point2[1] * Math.PI / 180; // φ2 in radianti
  const deltaLat = (point2[1] - point1[1]) * Math.PI / 180; // Δφ in radianti
  const deltaLon = (point2[0] - point1[0]) * Math.PI / 180; // Δλ in radianti
  
  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distanza in metri
}

/**
 * Converte un oggetto geospatiale GeoJSON in un array di coordinate
 * per l'utilizzo nelle altre funzioni di utility
 * 
 * @param geoJson Un oggetto GeoJSON (Polygon o Point)
 * @returns Le coordinate estratte nel formato richiesto
 */
export function parseGeoJson(geoJson: any): Array<[number, number]> | [number, number] | null {
  try {
    if (!geoJson || !geoJson.type) {
      return null;
    }
    
    // Gestisci i diversi tipi di GeoJSON
    switch (geoJson.type) {
      case 'Point':
        return geoJson.coordinates as [number, number];
        
      case 'Polygon':
        // Prendi solo il ring esterno (primo array di coordinate)
        return geoJson.coordinates[0] as Array<[number, number]>;
        
      case 'MultiPolygon':
        // Prendi solo il primo poligono e il suo ring esterno
        return geoJson.coordinates[0][0] as Array<[number, number]>;
        
      default:
        console.warn(`Tipo GeoJSON non supportato: ${geoJson.type}`);
        return null;
    }
  } catch (error) {
    console.error('Errore nel parsing GeoJSON:', error);
    return null;
  }
}