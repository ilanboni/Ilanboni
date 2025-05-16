/**
 * Middleware per la conversione automatica tra camelCase e snake_case
 */

import { Request, Response, NextFunction } from 'express';
import { convertObjectKeysToCamelCase, convertObjectKeysToSnakeCase } from '../utils/caseConverter';

/**
 * Middleware che converte automaticamente le chiavi della request da camelCase a snake_case
 * Utile per le richieste in ingresso quando il frontend usa camelCase ma il database usa snake_case
 */
export function convertRequestToSnakeCase(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = convertObjectKeysToSnakeCase(req.body);
  }
  next();
}

/**
 * Middleware che converte automaticamente le chiavi della response da snake_case a camelCase
 * Utile per le risposte in uscita quando il database usa snake_case ma il frontend usa camelCase
 */
export function convertResponseToCamelCase(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  
  res.json = function(body) {
    if (body && typeof body === 'object') {
      body = convertObjectKeysToCamelCase(body);
    }
    return originalJson.call(this, body);
  };
  
  next();
}