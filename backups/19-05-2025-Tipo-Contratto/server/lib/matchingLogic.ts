/**
 * matchingLogic.ts
 * 
 * Centralizza la logica di matching tra immobili e acquirenti
 * per garantire consistenza in tutta l'applicazione.
 */

import { Buyer, Property } from '@shared/schema';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon } from '@turf/helpers';

/**
 * Verifica se un immobile corrisponde alle preferenze di un acquirente,
 * applicando i criteri di tolleranza specificati:
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
  
  // Verifica metratura con tolleranza del 10% inferiore
  if (buyer.minSize && property.size < buyer.minSize * 0.9) {
    return false;
  }
  
  // Verifica prezzo con tolleranza del 10% superiore
  if (buyer.maxPrice && property.price > buyer.maxPrice * 1.1) {
    return false;
  }
  
  // Verifica se l'immobile è all'interno dell'area di ricerca (poligono)
  if (buyer.searchArea && property.location) {
    try {
      // Se searchArea è disponibile come GeoJSON o altro formato
      // usa la funzione pointInPolygon per verificare se la posizione
      // dell'immobile è all'interno del poligono
      
      // Nota: questa è una semplificazione, in un'implementazione reale
      // useremmo una libreria come turf.js per verificare se il punto
      // è all'interno del poligono
      
      // Se non abbiamo informazioni sulla posizione, assumiamo che non sia nel poligono
      if (!property.location) {
        return false;
      }
      
      // Se non abbiamo un'area di ricerca definita, consideriamo l'immobile come valido
      if (!buyer.searchArea || !Array.isArray(buyer.searchArea) || buyer.searchArea.length < 3) {
        console.log(`[Matching] L'acquirente ${buyer.id} non ha un poligono di ricerca valido`, 
          buyer.searchArea ? `(${buyer.searchArea.length} punti)` : '(undefined)');
        return true;
      }
      
      // Verifico che la posizione dell'immobile sia nel formato corretto
      if (!property.location || !property.location.lat || !property.location.lng) {
        console.log(`[Matching] L'immobile ${property.id} non ha una posizione valida:`, property.location);
        return false;
      }
      
      // Utilizzo Turf.js per verificare se il punto è dentro il poligono
      // Creo un punto GeoJSON con la posizione dell'immobile [lng, lat]
      const immobilePoint = point([property.location.lng, property.location.lat]);
      
      // Creo un poligono GeoJSON con l'area di ricerca del cliente
      // Turf.js richiede che l'array di coordinate sia chiuso (primo e ultimo punto identici)
      let searchAreaCoords = [...buyer.searchArea];
      
      // Verifica se il poligono è chiuso (il primo e l'ultimo punto devono coincidere)
      const firstPoint = buyer.searchArea[0];
      const lastPoint = buyer.searchArea[buyer.searchArea.length - 1];
      
      // Se il poligono non è chiuso, lo chiudiamo aggiungendo il primo punto alla fine
      if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        searchAreaCoords.push(firstPoint);
      }
      
      const buyerPolygon = polygon([searchAreaCoords]);
      
      // Eseguo il controllo con Turf.js
      const isInPolygon = booleanPointInPolygon(immobilePoint, buyerPolygon);
      
      console.log(`[Matching] Immobile ${property.id} (${property.address}) in posizione [${property.location.lng}, ${property.location.lat}] è ${isInPolygon ? 'DENTRO' : 'FUORI'} dal poligono dell'acquirente ${buyer.id}`);
      
      return isInPolygon;
    } catch (error) {
      console.error('Errore nella verifica del poligono:', error);
      // In caso di errore, assumiamo che non sia nel poligono
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
  if (buyer.minSize && property.size > buyer.minSize * 1.5) {
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