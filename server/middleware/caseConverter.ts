/**
 * Middleware per la conversione automatica camelCase <-> snake_case
 */
import { Request, Response, NextFunction } from 'express';
import { camelToSnake } from '../utils/caseConverter';

/**
 * Middleware che converte automaticamente i campi dell'oggetto req.body 
 * da camelCase a snake_case prima di passarli agli handler successivi
 */
export const convertRequestBodyToSnakeCase = (req: Request, res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    // Log originale per debug
    console.log('[CaseConverter] Body originale:', JSON.stringify(req.body, null, 2));
    
    // Converti il body da camelCase a snake_case
    const convertedBody = camelToSnake(req.body);
    console.log('[CaseConverter] Body convertito:', JSON.stringify(convertedBody, null, 2));
    
    // Sostituisci il body originale con quello convertito
    req.body = convertedBody;
  }
  
  next();
};