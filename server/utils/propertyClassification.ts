/**
 * Property Classification Utility
 * 
 * Determines whether a shared property is "multiagency" (multiple agencies)
 * or "private" (private seller or single agency).
 */

interface Agency {
  name?: string | null;
  link?: string | null;
  sourcePropertyId?: number | null;
}

interface SharedProperty {
  agencies?: Agency[] | null;
  agency1Name?: string | null;
  agency2Name?: string | null;
  agency3Name?: string | null;
  [key: string]: any;
}

/**
 * Normalizes an agency name for comparison
 * - Trims whitespace
 * - Converts to lowercase
 * - Removes accents and special characters
 */
function normalizeAgencyName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[.,\s-]/g, ''); // Remove punctuation and spaces
}

/**
 * Checks if an agency name represents a private seller
 */
function isPrivateSeller(normalizedName: string): boolean {
  const privatePatterns = [
    'privato',
    'privata',
    'venditaprivata',
    'proprietario',
    'proprietaria'
  ];
  
  return privatePatterns.some(pattern => normalizedName.includes(pattern));
}

/**
 * Extracts all agency names from a shared property
 * Combines JSONB agencies array with legacy agency1/2/3 fields
 */
function getAllAgencyNames(property: SharedProperty): string[] {
  const names: string[] = [];
  
  // Get names from JSONB agencies array
  if (property.agencies && Array.isArray(property.agencies)) {
    property.agencies.forEach(agency => {
      if (agency.name) {
        names.push(agency.name);
      }
    });
  }
  
  // Get names from legacy fields
  if (property.agency1Name) names.push(property.agency1Name);
  if (property.agency2Name) names.push(property.agency2Name);
  if (property.agency3Name) names.push(property.agency3Name);
  
  return names;
}

/**
 * Computes the classification of a shared property
 * 
 * @param property - The shared property to classify
 * @returns "multiagency" if property has 2+ distinct non-private agencies, "private" otherwise
 * 
 * Classification Logic:
 * - "multiagency": At least 2 distinct agencies, none are private sellers
 * - "private": Single agency, private seller, or no agencies
 */
export function computeClassification(property: SharedProperty): 'multiagency' | 'private' {
  const agencyNames = getAllAgencyNames(property);
  
  if (agencyNames.length === 0) {
    return 'private';
  }
  
  // Normalize and deduplicate agency names
  const normalizedNames = agencyNames
    .map(name => normalizeAgencyName(name))
    .filter(name => name.length > 0);
  
  // Remove duplicates
  const uniqueNames = Array.from(new Set(normalizedNames));
  
  // Check if any are private sellers
  const hasPrivateSeller = uniqueNames.some(name => isPrivateSeller(name));
  
  if (hasPrivateSeller) {
    return 'private';
  }
  
  // Multiagency requires at least 2 distinct agencies
  if (uniqueNames.length >= 2) {
    return 'multiagency';
  }
  
  return 'private';
}

/**
 * Enriches a shared property object with classification
 */
export function enrichWithClassification<T extends SharedProperty>(
  property: T
): T & { classification: 'multiagency' | 'private' } {
  return {
    ...property,
    classification: computeClassification(property)
  };
}

/**
 * Enriches an array of shared properties with classification
 */
export function enrichArrayWithClassification<T extends SharedProperty>(
  properties: T[]
): Array<T & { classification: 'multiagency' | 'private' }> {
  return properties.map(enrichWithClassification);
}
