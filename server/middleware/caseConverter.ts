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
  try {
    console.log('===============================================');
    console.log(`[CaseConverter] ${req.method} ${req.path} - Iniziando conversione`);
    
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      // Log originale per debug
      console.log('[CaseConverter] Body originale:', JSON.stringify(req.body, null, 2));
      
      // Verifica se ci sono proprietà buyer o seller
      if (req.body.buyer) {
        console.log('[CaseConverter] Trovata proprietà buyer:', JSON.stringify(req.body.buyer, null, 2));
        // Applica la conversione anche all'oggetto buyer
        req.body.buyer = camelToSnake(req.body.buyer);
        console.log('[CaseConverter] Buyer convertito:', JSON.stringify(req.body.buyer, null, 2));
      }
      
      if (req.body.seller) {
        console.log('[CaseConverter] Trovata proprietà seller:', JSON.stringify(req.body.seller, null, 2));
        // Applica la conversione anche all'oggetto seller
        req.body.seller = camelToSnake(req.body.seller);
        console.log('[CaseConverter] Seller convertito:', JSON.stringify(req.body.seller, null, 2));
      }
      
      // Converti il body principale da camelCase a snake_case
      const convertedBody = camelToSnake(req.body);
      console.log('[CaseConverter] Body principale convertito:', JSON.stringify(convertedBody, null, 2));
      
      // Sostituisci il body originale con quello convertito
      req.body = convertedBody;
    } else {
      console.log('[CaseConverter] Nessun corpo nella richiesta o formato non supportato.');
    }
    
    console.log('[CaseConverter] Conversione completata con successo.');
    console.log('===============================================');
    next();
  } catch (error) {
    console.error('[CaseConverter] ERRORE durante la conversione:', error);
    // Continuiamo comunque con la richiesta originale
    next();
  }
};