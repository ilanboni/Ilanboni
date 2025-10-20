/**
 * Middleware di autenticazione Bearer Token
 * 
 * Protegge gli endpoint dell'agente virtuale richiedendo il token REPLIT_API_TOKEN
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware per autenticazione Bearer Token
 * Verifica che l'header Authorization contenga: Bearer ${REPLIT_API_TOKEN}
 */
export function authBearer(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    console.log('[AuthBearer] ❌ Richiesta senza header Authorization');
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Missing Authorization header' 
    });
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('[AuthBearer] ❌ Formato Authorization header non valido:', authHeader);
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid Authorization header format. Expected: Bearer <token>' 
    });
  }

  const token = parts[1];
  const expectedToken = process.env.REPLIT_API_TOKEN;

  if (!expectedToken) {
    console.error('[AuthBearer] ⚠️ REPLIT_API_TOKEN non configurato nel sistema');
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Authentication not configured' 
    });
  }

  if (token !== expectedToken) {
    console.log('[AuthBearer] ❌ Token non valido');
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Invalid token' 
    });
  }

  console.log('[AuthBearer] ✅ Token valido, accesso consentito');
  next();
}
