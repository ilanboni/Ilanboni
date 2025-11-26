/**
 * matchingLogic.ts
 * 
 * Centralizza la logica di matching tra immobili e acquirenti
 * per garantire consistenza in tutta l'applicazione.
 */

import { Buyer, Property, SharedProperty } from '@shared/schema';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';

/**
 * Normalizza i tipi di proprietà per il matching, gestendo sinonimi e varianti
 * @param type Il tipo di proprietà da normalizzare
 * @returns Il tipo normalizzato
 */
function normalizePropertyType(type: string | undefined | null): string {
  if (!type) return '';
  const normalized = type.toLowerCase().trim();
  
  // Map common synonyms to standardized types
  if (normalized === 'appartamento' || normalized === 'apartment') return 'apartment';
  if (normalized === 'attico' || normalized === 'penthouse') return 'penthouse';
  if (normalized === 'monolocale') return 'apartment'; // Monolocale is a type of apartment
  if (normalized === 'villa') return 'villa';
  if (normalized === 'loft') return 'loft';
  
  return normalized;
}

/**
 * Calcola la distanza tra due punti usando la formula di Haversine
 * @param lat1 Latitudine del primo punto
 * @param lng1 Longitudine del primo punto
 * @param lat2 Latitudine del secondo punto
 * @param lng2 Longitudine del secondo punto
 * @returns Distanza in metri
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Raggio della Terra in metri
  const φ1 = lat1 * Math.PI/180; // φ, λ in radianti
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const d = R * c; // in metri
  return d;
}

/**
 * Estrae le coordinate da una proprietà
 * Supporta sia il formato location object (shared/multi-agency properties)
 * che il formato latitude/longitude strings (private properties da Idealista)
 * @param property La proprietà da cui estrarre le coordinate
 * @returns Oggetto con { lat, lng } oppure null se non trovate
 */
function extractCoordinates(property: any): { lat: number; lng: number } | null {
  // Try location object first (shared/multi-agency properties)
  if (property.location) {
    let loc = property.location;
    
    if (typeof loc === 'string') {
      try {
        loc = JSON.parse(loc);
      } catch (e) {
        // Not JSON, continue
      }
    }
    
    if (loc && typeof loc === 'object' && loc.lat !== undefined && loc.lng !== undefined) {
      const lat = typeof loc.lat === 'string' ? parseFloat(loc.lat) : loc.lat;
      const lng = typeof loc.lng === 'string' ? parseFloat(loc.lng) : loc.lng;
      
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  }
  
  // Fallback to latitude/longitude fields (Idealista private properties)
  if (property.latitude !== undefined && property.longitude !== undefined) {
    const lat = typeof property.latitude === 'string' ? parseFloat(property.latitude) : property.latitude;
    const lng = typeof property.longitude === 'string' ? parseFloat(property.longitude) : property.longitude;
    
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  
  return null;
}

/**
 * Verifica se un immobile corrisponde alle preferenze di un acquirente,
 * applicando i criteri di tolleranza specificati:
 * - Tipologia proprietà (matching esatto se specificato)
 * - È situato all'interno del poligono di ricerca dell'acquirente
 * - Ha una metratura >= minimo richiesto -20% (NO upper limit)
 * - Ha un prezzo che può essere fino al +20% superiore al massimo richiesto
 * 
 * @param property L'immobile da verificare
 * @param buyer L'acquirente con le preferenze da confrontare
 * @returns true se l'immobile corrisponde alle preferenze, false altrimenti
 */
export function isPropertyMatchingBuyerCriteria(property: Property, buyer: Buyer): boolean {
  // Verifica se l'immobile è disponibile
  if (property.status !== 'available') {
    return false;
  }
  
  // Property type check - strict matching required if buyer specifies a type
  if (buyer.propertyType) {
    const buyerType = normalizePropertyType(buyer.propertyType);
    const propertyType = normalizePropertyType(property.type);
    
    if (buyerType && propertyType !== buyerType) {
      console.log(`[Matching] Property ${property.id} type '${property.type}' (normalized: '${propertyType}') doesn't match buyer requirement '${buyer.propertyType}' (normalized: '${buyerType}') - REJECTED`);
      return false;
    }
  }
  
  // Verifica metratura con tolleranza -20% rispetto al minimo (NO upper limit)
  if (buyer.minSize && property.size) {
    const minAcceptable = buyer.minSize * 0.8; // -20%
    
    if (property.size < minAcceptable) {
      console.log(`[Matching] Property ${property.id} size ${property.size}mq is below minimum ${minAcceptable.toFixed(0)}mq (buyer wants ${buyer.minSize}mq minimum -20%) - REJECTED`);
      return false;
    }
  }
  
  // Verifica prezzo con tolleranza del +20%
  if (buyer.maxPrice && property.price > buyer.maxPrice * 1.20) {
    console.log(`[Matching] Property ${property.id} price €${property.price} exceeds max €${buyer.maxPrice * 1.20} (buyer max €${buyer.maxPrice} +20%) - REJECTED`);
    return false;
  }
  
  // Verifica se l'immobile è all'interno dell'area di ricerca (poligono)
  if (buyer.searchArea) {
    // Estrae le coordinate da location object O da latitude/longitude fields
    const propertyLocation = extractCoordinates(property);
    
    if (!propertyLocation) {
      console.log(`[Matching] L'immobile ${property.id} non ha coordinate GPS - RIFIUTATO (buyer richiede searchArea)`);
      return false;
    }
    
    try {
      
      // Utilizzo Turf.js per verificare se il punto è dentro il poligono
      // Creo un punto GeoJSON con la posizione dell'immobile [lng, lat]
      const immobilePoint = point([propertyLocation.lng, propertyLocation.lat]);
      
      // Gestisci l'area di ricerca in formato GeoJSON, array semplice o cerchio
      let buyerPolygon;
      let isInArea = false;
      
      if (buyer.searchArea && typeof buyer.searchArea === 'object') {
        // Se è un FeatureCollection (array di poligoni/punti multipli)
        if ((buyer.searchArea as any).type === 'FeatureCollection' && (buyer.searchArea as any).features) {
          // Verifica se il punto è dentro ALMENO UNO dei poligoni
          for (const feature of (buyer.searchArea as any).features) {
            if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates) {
              const featurePolygon = polygon(feature.geometry.coordinates);
              if (booleanPointInPolygon(immobilePoint, featurePolygon)) {
                isInArea = true;
                break;
              }
            }
            // FIX ARCHITECT: Gestisci MultiPolygon (comune per zone complesse)
            else if (feature.geometry.type === 'MultiPolygon' && feature.geometry.coordinates) {
              // MultiPolygon = array di Polygon
              for (const polygonCoords of feature.geometry.coordinates) {
                const featurePolygon = polygon(polygonCoords);
                if (booleanPointInPolygon(immobilePoint, featurePolygon)) {
                  isInArea = true;
                  break;
                }
              }
              if (isInArea) break; // Exit outer loop if found
            }
            // Gestisci Point con raggio di default 2000m (2km per zone urbane)
            else if (feature.geometry.type === 'Point' && feature.geometry.coordinates) {
              const distance = calculateDistance(
                propertyLocation.lat, propertyLocation.lng,
                feature.geometry.coordinates[1], feature.geometry.coordinates[0]
              );
              if (distance <= 2000) { // 2km di raggio di default per i punti (zone urbane Milano)
                isInArea = true;
                console.log(`[Matching] Property ${property.id} (${property.address}) è DENTRO il raggio della zona ${feature.properties?.zoneName || 'unnamed'} a ${Math.round(distance)}m`);
                break;
              }
            }
          }
          return isInArea;
        }
        // Se è un oggetto con center e radius (formato cerchio)
        else if ((buyer.searchArea as any).center && (buyer.searchArea as any).radius && 
            (buyer.searchArea as any).center.lat && (buyer.searchArea as any).center.lng) {
          
          // Calcola la distanza tra il punto dell'immobile e il centro del cerchio
          const searchArea = buyer.searchArea as any;
          const propertyLocation = property.location as any;
          
          // Calcola la distanza in metri usando la formula di Haversine
          const distance = calculateDistance(
            propertyLocation.lat, propertyLocation.lng,
            searchArea.center.lat, searchArea.center.lng
          );
          
          const isInRadius = distance <= searchArea.radius;
          
          console.log(`[Matching] Immobile ${property.id} (${property.address}) è a ${Math.round(distance)}m dal centro (raggio: ${searchArea.radius}m) - ${isInRadius ? 'DENTRO' : 'FUORI'}`);
          
          return isInRadius;
        }
        // Se è un oggetto GeoJSON Feature
        else if ((buyer.searchArea as any).type === 'Feature' && (buyer.searchArea as any).geometry) {
          if ((buyer.searchArea as any).geometry.type === 'Polygon' && (buyer.searchArea as any).geometry.coordinates) {
            // Usa direttamente le coordinate dal GeoJSON
            buyerPolygon = polygon((buyer.searchArea as any).geometry.coordinates);
          } else {
            console.log(`[Matching] L'acquirente ${buyer.id} ha una geometria non supportata:`, (buyer.searchArea as any).geometry.type);
            return false;
          }
        } 
        // Se è un array di coordinate
        else if (Array.isArray(buyer.searchArea) && buyer.searchArea.length >= 3) {
          let searchAreaCoords = [...buyer.searchArea];
          
          // Verifica se il poligono è chiuso (il primo e l'ultimo punto devono coincidere)
          const firstPoint = buyer.searchArea[0];
          const lastPoint = buyer.searchArea[buyer.searchArea.length - 1];
          
          // Se il poligono non è chiuso, lo chiudiamo aggiungendo il primo punto alla fine
          if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
            searchAreaCoords.push(firstPoint);
          }
          
          buyerPolygon = polygon([searchAreaCoords]);
        } else {
          console.log(`[Matching] L'acquirente ${buyer.id} non ha un'area di ricerca valida:`, buyer.searchArea);
          return false;
        }
      } else {
        console.log(`[Matching] L'acquirente ${buyer.id} non ha definito un'area di ricerca`);
        return false;
      }
      
      // Eseguo il controllo con Turf.js (se buyerPolygon è stato creato)
      if (buyerPolygon) {
        const isInPolygon = booleanPointInPolygon(immobilePoint, buyerPolygon);
        
        console.log(`[Matching] Immobile ${property.id} (${property.address}) in posizione [${propertyLocation.lng}, ${propertyLocation.lat}] è ${isInPolygon ? 'DENTRO' : 'FUORI'} dal poligono dell'acquirente ${buyer.id || buyer.clientId}`);
        
        return isInPolygon;
      }
      
      return false;
    } catch (error) {
      console.error('Errore nella verifica del poligono:', error);
      // In caso di errore, assumiamo che non sia nel poligono
      return false;
    }
  }
  
  // Se l'acquirente non ha specificato un'area di ricerca, assumiamo che sia compatibile
  return true;
}

/**
 * Verifica se un immobile condiviso (sharedProperty) corrisponde alle preferenze di un acquirente.
 * Applica gli stessi criteri di tolleranza di isPropertyMatchingBuyerCriteria:
 * -20% metratura (NO upper limit), +20% prezzo.
 * 
 * @param sharedProperty L'immobile condiviso da verificare
 * @param buyer L'acquirente con le preferenze da confrontare
 * @returns true se l'immobile corrisponde alle preferenze, false altrimenti
 */
export function isSharedPropertyMatchingBuyerCriteria(sharedProperty: SharedProperty, buyer: Buyer): boolean {
  // SharedProperty non ha campo status - assumiamo siano sempre disponibili
  
  // Property type check - strict matching required if buyer specifies a type
  if (buyer.propertyType) {
    const buyerType = normalizePropertyType(buyer.propertyType);
    const propertyType = normalizePropertyType(sharedProperty.type);
    
    if (buyerType && propertyType !== buyerType) {
      console.log(`[Matching] SharedProperty ${sharedProperty.id} type '${sharedProperty.type}' (normalized: '${propertyType}') doesn't match buyer requirement '${buyer.propertyType}' (normalized: '${buyerType}') - REJECTED`);
      return false;
    }
  }
  
  // Verifica metratura con tolleranza -20% rispetto al minimo (NO upper limit)
  if (buyer.minSize && sharedProperty.size) {
    const minAcceptable = buyer.minSize * 0.8; // -20%
    
    if (sharedProperty.size < minAcceptable) {
      console.log(`[Matching] SharedProperty ${sharedProperty.id} size ${sharedProperty.size}mq is below minimum ${minAcceptable.toFixed(0)}mq (buyer wants ${buyer.minSize}mq minimum -20%) - REJECTED`);
      return false;
    }
  }
  
  // Verifica prezzo con tolleranza del +20%
  if (buyer.maxPrice && sharedProperty.price && sharedProperty.price > buyer.maxPrice * 1.20) {
    console.log(`[Matching] SharedProperty ${sharedProperty.id} price €${sharedProperty.price} exceeds max €${buyer.maxPrice * 1.20} (buyer max €${buyer.maxPrice} +20%) - REJECTED`);
    return false;
  }
  
  // Verifica se l'immobile è all'interno dell'area di ricerca (poligono)
  if (buyer.searchArea) {
    // Estrae le coordinate da location object O da latitude/longitude fields
    const propertyLocation = extractCoordinates(sharedProperty);
    
    if (!propertyLocation) {
      console.log(`[Matching] SharedProperty ${sharedProperty.id} (${sharedProperty.address}) non ha coordinate GPS - RIFIUTATO (buyer richiede searchArea)`);
      return false;
    }
    
    try {
      
      const immobilePoint = point([propertyLocation.lng, propertyLocation.lat]);
      
      let buyerPolygon;
      let isInArea = false;
      
      if (buyer.searchArea && typeof buyer.searchArea === 'object') {
        console.log(`[Matching] DEBUG: Buyer ${buyer.id} searchArea type: ${(buyer.searchArea as any).type}, has features: ${!!(buyer.searchArea as any).features}, is array: ${Array.isArray(buyer.searchArea)}`);
        // FIX: Se è un FeatureCollection (array di poligoni/punti multipli) - per zone multiple
        if ((buyer.searchArea as any).type === 'FeatureCollection' && (buyer.searchArea as any).features) {
          // Verifica se il punto è dentro ALMENO UNO dei poligoni
          for (const feature of (buyer.searchArea as any).features) {
            if (feature.geometry.type === 'Polygon' && feature.geometry.coordinates) {
              const featurePolygon = polygon(feature.geometry.coordinates);
              if (booleanPointInPolygon(immobilePoint, featurePolygon)) {
                isInArea = true;
                console.log(`[Matching] SharedProperty ${sharedProperty.id} (${sharedProperty.address}) è DENTRO la zona ${feature.properties?.name || feature.properties?.zoneName || 'unnamed'}`);
                break;
              }
            }
            // FIX ARCHITECT: Gestisci MultiPolygon (comune per zone complesse)
            else if (feature.geometry.type === 'MultiPolygon' && feature.geometry.coordinates) {
              // MultiPolygon = array di Polygon
              for (const polygonCoords of feature.geometry.coordinates) {
                const featurePolygon = polygon(polygonCoords);
                if (booleanPointInPolygon(immobilePoint, featurePolygon)) {
                  isInArea = true;
                  console.log(`[Matching] SharedProperty ${sharedProperty.id} (${sharedProperty.address}) è DENTRO la zona ${feature.properties?.name || feature.properties?.zoneName || 'unnamed'} (MultiPolygon)`);
                  break;
                }
              }
              if (isInArea) break; // Exit outer loop if found
            }
            // Gestisci Point con raggio di default 2000m (2km per zone urbane)
            else if (feature.geometry.type === 'Point' && feature.geometry.coordinates) {
              const distance = calculateDistance(
                propertyLocation.lat, propertyLocation.lng,
                feature.geometry.coordinates[1], feature.geometry.coordinates[0]
              );
              if (distance <= 2000) { // 2km di raggio di default per i punti (zone urbane Milano)
                isInArea = true;
                console.log(`[Matching] SharedProperty ${sharedProperty.id} (${sharedProperty.address}) è DENTRO il raggio della zona ${feature.properties?.name || feature.properties?.zoneName || 'unnamed'} a ${Math.round(distance)}m`);
                break;
              }
            }
          }
          return isInArea;
        }
        // Se è un oggetto con center e radius (formato cerchio)
        else if ((buyer.searchArea as any).center && (buyer.searchArea as any).radius && 
            (buyer.searchArea as any).center.lat && (buyer.searchArea as any).center.lng) {
          
          const searchArea = buyer.searchArea as any;
          const distance = calculateDistance(
            propertyLocation.lat, propertyLocation.lng,
            searchArea.center.lat, searchArea.center.lng
          );
          
          const isInRadius = distance <= searchArea.radius;
          console.log(`[Matching] SharedProperty ${sharedProperty.id} (${sharedProperty.address}) è a ${Math.round(distance)}m dal centro (raggio: ${searchArea.radius}m) - ${isInRadius ? 'DENTRO' : 'FUORI'}`);
          
          return isInRadius;
        }
        // Se è un oggetto GeoJSON Feature
        else if ((buyer.searchArea as any).type === 'Feature' && (buyer.searchArea as any).geometry) {
          if ((buyer.searchArea as any).geometry.type === 'Polygon' && (buyer.searchArea as any).geometry.coordinates) {
            buyerPolygon = polygon((buyer.searchArea as any).geometry.coordinates);
          } else {
            console.log(`[Matching] SharedProperty - L'acquirente ${buyer.id} ha una geometria non supportata:`, (buyer.searchArea as any).geometry.type);
            return false;
          }
        } 
        // Se è un array di coordinate
        else if (Array.isArray(buyer.searchArea) && buyer.searchArea.length >= 3) {
          let searchAreaCoords = [...buyer.searchArea];
          
          if (searchAreaCoords[0][0] !== searchAreaCoords[searchAreaCoords.length - 1][0] ||
              searchAreaCoords[0][1] !== searchAreaCoords[searchAreaCoords.length - 1][1]) {
            searchAreaCoords.push(searchAreaCoords[0]);
          }
          
          buyerPolygon = polygon([searchAreaCoords]);
        } else {
          console.log(`[Matching] SharedProperty - L'acquirente ${buyer.id} non ha un'area di ricerca valida:`, buyer.searchArea);
          return false;
        }
      } else {
        console.log(`[Matching] SharedProperty - L'acquirente ${buyer.id} non ha definito un'area di ricerca`);
        return false;
      }
      
      const isInPolygon = booleanPointInPolygon(immobilePoint, buyerPolygon);
      console.log(`[Matching] SharedProperty ${sharedProperty.id} (${sharedProperty.address}) in posizione [${propertyLocation.lng}, ${propertyLocation.lat}] è ${isInPolygon ? 'DENTRO' : 'FUORI'} dal poligono dell'acquirente ${buyer.id || buyer.clientId}`);
      
      return isInPolygon;
    } catch (error) {
      console.error('Errore nella verifica del poligono per SharedProperty:', error);
      return false;
    }
  }
  
  // CRITICAL FIX: Se l'acquirente HA specificato un'area di ricerca ma siamo giunti qui,
  // significa che la proprietà NON è dentro nessuna delle sue aree di ricerca.
  // Rifiutiamo il matching.
  // Se l'acquirente NON ha una searchArea, allora NON matchamo (perché non abbiamo modo di validare).
  console.log(`[Matching] SharedProperty ${sharedProperty.id} (${sharedProperty.address}) RIFIUTATO: buyer ${buyer.id} non ha area di ricerca valida o proprietà è fuori area`);
  return false;
}

/**
 * Calcola una percentuale di corrispondenza tra un immobile e un acquirente
 * in base a quanto l'immobile soddisfa le preferenze dell'acquirente.
 * Un punteggio più alto significa una migliore corrispondenza.
 * 
 * @param property L'immobile da valutare
 * @param buyer L'acquirente con le preferenze
 * @returns Un valore percentuale tra 0 e 100
 */
export function calculatePropertyMatchPercentage(property: Property, buyer: Buyer): number {
  // Se non corrisponde ai criteri fondamentali, restituisci 0%
  if (!isPropertyMatchingBuyerCriteria(property, buyer)) {
    return 0;
  }
  
  let score = 100;
  
  // Applica penalità in base alla differenza di dimensione (se troppo grande)
  if (buyer.minSize && property.size && property.size > buyer.minSize * 1.5) {
    // Penalizza immobili molto più grandi del necessario
    const sizeDifference = (property.size - buyer.minSize) / buyer.minSize;
    score -= Math.min(30, sizeDifference * 30); // Max 30% di penalità
  }
  
  // Applica penalità in base alla differenza di prezzo rispetto all'ottimale
  if (buyer.maxPrice) {
    const pricePercentage = property.price / buyer.maxPrice;
    
    if (pricePercentage > 1) {
      // Se sopra il massimo (ma entro il 10%), penalizza
      score -= Math.min(40, (pricePercentage - 1) * 400); // 10% sopra = 40% penalità
    } else if (pricePercentage < 0.8) {
      // Se molto sotto il budget, penalizza leggermente (potrebbe significare qualità inferiore)
      score -= Math.min(15, (0.8 - pricePercentage) * 75); // 20% sotto = 15% penalità
    }
  }
  
  // Limita il punteggio tra 0 e 100
  return Math.max(0, Math.min(100, Math.round(score)));
}