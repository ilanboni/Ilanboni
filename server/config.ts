/**
 * Configurazione dell'applicazione
 */
export const config = {
  /**
   * URL base dell'applicazione - utilizzato per i link negli SMS/WhatsApp
   */
  getBaseUrl: (): string => {
    // In production, usa il dominio di deployment
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    
    // Per development locale
    return 'http://localhost:5000';
  },

  /**
   * Ottiene l'URL completo per visualizzare un immobile
   */
  getPropertyUrl: (propertyId: number): string => {
    return `${config.getBaseUrl()}/properties/${propertyId}`;
  },

  /**
   * Ottiene l'URL per l'OAuth callback di Google Calendar
   */
  getOAuthCallbackUrl: (): string => {
    return `${config.getBaseUrl()}/oauth/callback`;
  }
};