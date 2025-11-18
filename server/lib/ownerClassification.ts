/**
 * Shared helper for classifying property owner type (private vs agency)
 * 
 * This module provides robust classification logic that works across different
 * data sources (Apify, direct scraping, manual entry) by using multiple signals.
 * 
 * Priority order:
 * 1. Explicit analytics.advertiser field ("privato" / "agenzia")
 * 2. Contacts metadata (agencyId presence, type field)
 * 3. Keywords in description/title ("vendita diretta", "no agenzie", "proprietario")
 * 4. Agency name patterns
 * 
 * @module ownerClassification
 */

export interface ClassificationInput {
  // Apify analytics fields
  analytics?: {
    advertiser?: string;           // "privato" | "agenzia"
    advertiserName?: string;       // Name of advertiser
    agencyName?: string;           // Agency name if applicable
    agencyId?: string | number;    // Agency ID
  };
  
  // Apify contacts fields
  contacts?: {
    agencyId?: number | string;    // Agency ID
    agencyName?: string;           // Agency name
    agencyUuid?: string;           // Agency UUID
    type?: string;                 // "privato" | "agenzia"
  };
  
  // Text content for keyword analysis
  description?: string;            // Full property description
  title?: string;                  // Property title
  contact?: string;                // Contact field (Idealista format)
  
  // Already extracted fields (for adapters that pre-process)
  ownerType?: 'private' | 'agency';
  agencyName?: string;
}

export interface ClassificationResult {
  ownerType: 'private' | 'agency';
  agencyName: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Keywords that indicate a private seller (case-insensitive)
 */
const PRIVATE_KEYWORDS = [
  'vendita diretta',
  'no agenzie',
  'no agenzia',
  'senza agenzie',
  'privato vende',
  'proprietario vende',
  'particolare vende',
  'privat',           // Matches "privato", "privatamente", "privat"
  'proprietari',
  'particolare',
  'owner',
  'propri',           // Matches "proprietario"
];

/**
 * Keywords that strongly suggest an agency (case-insensitive)
 */
const AGENCY_KEYWORDS = [
  'agenzia',
  'immobiliare',
  'real estate',
  'gruppo',
  'consulenza',
  'services',
];

/**
 * Classify owner type using multiple signals with fallback logic
 */
export function classifyOwnerType(input: ClassificationInput): ClassificationResult {
  // If already classified by adapter, trust it with medium confidence
  if (input.ownerType) {
    return {
      ownerType: input.ownerType,
      agencyName: input.ownerType === 'agency' ? input.agencyName || null : null,
      confidence: 'medium',
      reasoning: 'Pre-classified by adapter'
    };
  }

  // Priority 1: analytics.advertiser field (most reliable for Immobiliare.it via Apify)
  if (input.analytics?.advertiser) {
    const advertiser = input.analytics.advertiser.toLowerCase().trim();
    
    if (advertiser === 'privato' || advertiser === 'private' || advertiser === 'owner') {
      return {
        ownerType: 'private',
        agencyName: null,
        confidence: 'high',
        reasoning: 'analytics.advertiser === "privato"'
      };
    }
    
    if (advertiser === 'agenzia' || advertiser === 'agency') {
      return {
        ownerType: 'agency',
        agencyName: input.analytics?.agencyName || input.contacts?.agencyName || null,
        confidence: 'high',
        reasoning: 'analytics.advertiser === "agenzia"'
      };
    }
  }

  // Priority 2: contacts.type field (if available)
  if (input.contacts?.type) {
    const contactType = input.contacts.type.toLowerCase().trim();
    
    if (contactType === 'privato' || contactType === 'private') {
      return {
        ownerType: 'private',
        agencyName: null,
        confidence: 'high',
        reasoning: 'contacts.type === "privato"'
      };
    }
  }

  // Priority 3: Check for agency identifiers
  const hasAgencyId = !!(input.analytics?.agencyId || input.contacts?.agencyId || input.contacts?.agencyUuid);
  const hasAgencyName = !!(input.analytics?.agencyName || input.contacts?.agencyName);
  
  // If we have both agency ID and name, very likely an agency
  if (hasAgencyId && hasAgencyName) {
    return {
      ownerType: 'agency',
      agencyName: input.analytics?.agencyName || input.contacts?.agencyName || null,
      confidence: 'high',
      reasoning: 'Has both agencyId and agencyName'
    };
  }

  // Priority 4: Keyword analysis in description and title
  const textToCheck = [
    input.description || '',
    input.title || '',
    input.contact || ''
  ].join(' ').toLowerCase();

  // Check for strong private seller indicators
  const privateMatches = PRIVATE_KEYWORDS.filter(keyword => 
    textToCheck.includes(keyword.toLowerCase())
  );

  if (privateMatches.length > 0) {
    return {
      ownerType: 'private',
      agencyName: null,
      confidence: privateMatches.length >= 2 ? 'high' : 'medium',
      reasoning: `Keywords found: ${privateMatches.join(', ')}`
    };
  }

  // Priority 5: Check agency keywords
  const agencyMatches = AGENCY_KEYWORDS.filter(keyword =>
    textToCheck.includes(keyword.toLowerCase())
  );

  // For Idealista (no agencyId): detect agencies by keywords alone if strong signal
  if (agencyMatches.length >= 2) {
    // Multiple agency keywords = strong signal (e.g. "REload Agency Milano")
    return {
      ownerType: 'agency',
      agencyName: null, // Extract from description later if needed
      confidence: 'high',
      reasoning: `Multiple agency keywords found: ${agencyMatches.join(', ')}`
    };
  }
  
  if (agencyMatches.length > 0 && hasAgencyId) {
    return {
      ownerType: 'agency',
      agencyName: input.analytics?.agencyName || input.contacts?.agencyName || null,
      confidence: 'medium',
      reasoning: `Agency keywords + agencyId present: ${agencyMatches.join(', ')}`
    };
  }
  
  // Single agency keyword without other signals = medium confidence
  if (agencyMatches.length === 1 && textToCheck.length > 500) {
    // Long description with "agenzia"/"immobiliare" likely agency
    return {
      ownerType: 'agency',
      agencyName: null,
      confidence: 'medium',
      reasoning: `Agency keyword in detailed description: ${agencyMatches[0]}`
    };
  }

  // Priority 6: Fallback based on agency presence
  // If we have ANY agency identifier, assume agency (most common case)
  if (hasAgencyId || hasAgencyName) {
    return {
      ownerType: 'agency',
      agencyName: input.analytics?.agencyName || input.contacts?.agencyName || null,
      confidence: 'low',
      reasoning: 'Has agency identifiers (fallback)'
    };
  }

  // Final fallback: If no agency identifiers at all, assume private
  // This covers edge cases where all fields are missing
  return {
    ownerType: 'private',
    agencyName: null,
    confidence: 'low',
    reasoning: 'No agency identifiers found (default to private)'
  };
}

/**
 * Convenience function for Apify Immobiliare.it format
 */
export function classifyFromApifyImmobiliare(item: any): ClassificationResult {
  return classifyOwnerType({
    analytics: item.analytics,
    contacts: item.contacts,
    description: item.description?.description,
    title: item.title
  });
}

/**
 * Convenience function for Apify Idealista format
 */
export function classifyFromApifyIdealista(item: any): ClassificationResult {
  return classifyOwnerType({
    contact: item.contact,
    description: item.description,
    title: item.title
  });
}
