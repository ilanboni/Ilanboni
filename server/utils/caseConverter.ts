/**
 * Utilità per la conversione tra diversi formati di notazione (camelCase, snake_case, ecc.)
 */

/**
 * Converte le chiavi di un oggetto da camelCase a snake_case
 * @param obj L'oggetto con chiavi in camelCase
 * @returns Un nuovo oggetto con chiavi convertite in snake_case
 */
export function camelToSnake(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Se è un array, converti ogni elemento
  if (Array.isArray(obj)) {
    return obj.map(item => typeof item === 'object' ? camelToSnake(item) : item);
  }
  
  // Altrimenti converti l'oggetto
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Converti la chiave da camelCase a snake_case
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      
      // Gestisci ricorsivamente oggetti annidati
      const value = obj[key];
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Ricorsione per oggetti annidati
        result[snakeKey] = camelToSnake(value);
      } else if (Array.isArray(value)) {
        // Gestisci array di oggetti
        result[snakeKey] = value.map(item => 
          typeof item === 'object' && item !== null ? camelToSnake(item) : item
        );
      } else {
        // Valori primitivi
        result[snakeKey] = value;
      }
    }
  }
  
  return result;
}

/**
 * Converte le chiavi di un oggetto da snake_case a camelCase
 * @param obj L'oggetto con chiavi in snake_case
 * @returns Un nuovo oggetto con chiavi convertite in camelCase
 */
export function snakeToCamel(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Se è un array, converti ogni elemento
  if (Array.isArray(obj)) {
    return obj.map(item => typeof item === 'object' ? snakeToCamel(item) : item);
  }
  
  // Altrimenti converti l'oggetto
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Converti la chiave da snake_case a camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      
      // Gestisci ricorsivamente oggetti annidati
      const value = obj[key];
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Ricorsione per oggetti annidati
        result[camelKey] = snakeToCamel(value);
      } else if (Array.isArray(value)) {
        // Gestisci array di oggetti
        result[camelKey] = value.map(item => 
          typeof item === 'object' && item !== null ? snakeToCamel(item) : item
        );
      } else {
        // Valori primitivi
        result[camelKey] = value;
      }
    }
  }
  
  return result;
}