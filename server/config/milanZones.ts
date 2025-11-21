/**
 * Milano Zone Location IDs for Idealista Scraping
 * 
 * These are the Idealista location IDs for Milano neighborhoods/zones
 * Add your zone IDs here so they persist in the codebase
 * Format: "0-EU-IT-MI-XX-XXX-XXX-XX"
 * 
 * Example structure for Milano:
 * - Centro/Duomo
 * - Navigli  
 * - Brera
 * - Monforte
 * - Isola
 * - Porta Romana
 * - Magenta/Dante
 * - Porta Venezia
 */

export const MILANO_ZONES = [
  "0-EU-IT-MI-01-001-135-01",
  "0-EU-IT-MI-01-001-135-02",
  "0-EU-IT-MI-01-001-135-03",
  "0-EU-IT-MI-01-001-135-04",
  "0-EU-IT-MI-01-001-135-05",
  "0-EU-IT-MI-01-001-135-16"
];

/**
 * Configuration for Idealista scraping
 */
export const IDEALISTA_CONFIG = {
  country: 'it' as const,
  operation: 'sale' as const,
  propertyType: 'homes' as const,
  homeTypes: ['flat', 'apartment', 'penthouse', 'duplex', 'loft'] as const,
  maxItemsPerZone: 1000,
  privateOnly: true
};
