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
 * Verifica se un immobile corrisponde alle preferenze di un acquirente,
 * applicando i criteri di tolleranza specificati:
 * - Tipologia proprietà (matching esatto se specificato)
 * - È situato all'interno del poligono di ricerca dell'acquirente
 * - Ha una metratura che può essere fino al 10% inferiore al minimo richiesto
 * - Ha un prezzo che può essere fino al 10% superiore al massimo richiesto
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
  
  // Verifica metratura con tolleranza del 10% inferiore
  if (buyer.minSize && property.size && property.size < buyer.minSize * 0.9) {
    return false;
  }
  
  // Verifica prezzo con tolleranza del 10% superiore
  if (buyer.maxPrice && property.price > buyer.maxPrice * 1.1) {
    return false;
  }
  
  // Verifica se l'immobile è all'interno dell'area di ricerca (poligono)
  if (buyer.searchArea) {
    // Se il buyer ha specificato una searchArea, la property DEVE avere location
    if (!property.location) {
      console.log(`[Matching] L'immobile ${property.id} non ha coordinate GPS - RIFIUTATO (buyer richiede searchArea)`);
      return false;
    }
    
    try {
      // Verifico che la posizione dell'immobile sia nel formato corretto
      const propertyLocation = property.location as any;
      if (!propertyLocation || !propertyLocation.lat || !propertyLocation.lng) {
        console.log(`[Matching] L'immobile ${property.id} non ha una posizione valida:`, property.location);
        return false;
      }
      
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
            // Gestisci Point con raggio di default 1000m
            else if (feature.geometry.type === 'Point' && feature.geometry.coordinates) {
              const distance = calculateDistance(
                propertyLocation.lat, propertyLocation.lng,
                feature.geometry.coordinates[1], feature.geometry.coordinates[0]
              );
              if (distance <= 1000) { // 1km di raggio di default per i punti
                isInArea = true;
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
 * Applica gli stessi criteri di tolleranza di isPropertyMatchingBuyerCriteria ma adattati
 * per gli immobili dei concorrenti.
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
  
  // Verifica metratura con tolleranza del 10% inferiore
  if (buyer.minSize && sharedProperty.size && sharedProperty.size < buyer.minSize * 0.9) {
    return false;
  }
  
  // Verifica prezzo con tolleranza del 10% superiore
  if (buyer.maxPrice && sharedProperty.price && sharedProperty.price > buyer.maxPrice * 1.1) {
    return false;
  }
  
  // Verifica se l'immobile è all'interno dell'area di ricerca (poligono)
  if (buyer.searchArea && sharedProperty.location) {
    try {
      const propertyLocation = sharedProperty.location as any;
      if (!propertyLocation || !propertyLocation.lat || !propertyLocation.lng) {
        console.log(`[Matching] SharedProperty ${sharedProperty.id} non ha una posizione valida:`, sharedProperty.location);
        return false;
      }
      
      const immobilePoint = point([propertyLocation.lng, propertyLocation.lat]);
      
      let buyerPolygon;
      let isInArea = false;
      
      if (buyer.searchArea && typeof buyer.searchArea === 'object') {
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
            // Gestisci Point con raggio di default 1000m
            else if (feature.geometry.type === 'Point' && feature.geometry.coordinates) {
              const distance = calculateDistance(
                propertyLocation.lat, propertyLocation.lng,
                feature.geometry.coordinates[1], feature.geometry.coordinates[0]
              );
              if (distance <= 1000) { // 1km di raggio di default per i punti
                isInArea = true;
                console.log(`[Matching] SharedProperty ${sharedProperty.id} (${sharedProperty.address}) è DENTRO il raggio della zona ${feature.properties?.name || feature.properties?.zoneName || 'unnamed'}`);
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
  
  // Se l'acquirente non ha specificato un'area di ricerca o l'immobile non ha
  // una posizione specificata, assumiamo che sia compatibile
  return true;
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