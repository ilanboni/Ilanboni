/**
 * Utility per la conversione tra formati di denominazione
 * Gestisce la conversione tra camelCase e snake_case
 */

/**
 * Converte una stringa da camelCase a snake_case
 * @param str Stringa in camelCase
 * @returns Stringa in snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * Converte una stringa da snake_case a camelCase
 * @param str Stringa in snake_case
 * @returns Stringa in camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converte le chiavi di un oggetto da camelCase a snake_case
 * Supporta anche oggetti annidati
 * @param obj Oggetto con chiavi in camelCase
 * @returns Oggetto con chiavi in snake_case
 */
export function convertObjectKeysToCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertObjectKeysToCamelCase(item));
  }

  const newObj: Record<string, any> = {};
  Object.keys(obj).forEach(key => {
    const camelKey = snakeToCamel(key);
    newObj[camelKey] = convertObjectKeysToCamelCase(obj[key]);
  });

  return newObj;
}

/**
 * Converte le chiavi di un oggetto da camelCase a snake_case
 * Supporta anche oggetti annidati
 * @param obj Oggetto con chiavi in camelCase
 * @returns Oggetto con chiavi in snake_case
 */
export function convertObjectKeysToSnakeCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertObjectKeysToSnakeCase(item));
  }

  const newObj: Record<string, any> = {};
  Object.keys(obj).forEach(key => {
    const snakeKey = camelToSnake(key);
    newObj[snakeKey] = convertObjectKeysToSnakeCase(obj[key]);
  });

  return newObj;
}