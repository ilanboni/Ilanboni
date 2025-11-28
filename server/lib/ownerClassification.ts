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
  'proponiamo',      // "proponiamo in vendita" - tipico linguaggio agenzie italiane
  'disponiamo',      // "disponiamo in vendita" - tipico linguaggio agenzie italiane
  'propone',         // "l'agenzia propone" - tipico linguaggio agenzie italiane
  'proposta',        // "proposta immobiliare" - tipico linguaggio agenzie italiane
];

/**
 * Helper to check if a name looks like an agency (not a private person)
 */
function looksLikeAgencyName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lowerName = name.toLowerCase().trim();
  
  // Skip empty or very short names
  if (lowerName.length < 2) return false;
  
  // Names that are clearly private person indicators
  const privateIndicators = ['privato', 'private', 'proprietario', 'owner', 'particolare'];
  for (const indicator of privateIndicators) {
    if (lowerName === indicator || lowerName.startsWith(indicator + ' ')) {
      return false;
    }
  }
  
  // Agency-like patterns in name
  const agencyPatterns = [
    'immobil', 'agenzia', 'real estate', 'casa', 'group', 'srl', 's.r.l', 
    'spa', 's.p.a', 'snc', 's.n.c', 'consulting', 'service', 'property',
    'properties', 'realty', 'estate', 'broker', 'mediazione', 'intermediazione'
  ];
  
  for (const pattern of agencyPatterns) {
    if (lowerName.includes(pattern)) {
      return true;
    }
  }
  
  // If the name has multiple words or contains corporate-like structure, likely an agency
  // e.g., "Temacase", "Casa Milano", "RE/MAX Italia"
  // However, single names could be agencies too (like "Temacase")
  // So we'll be lenient: if it's not a clear private indicator, assume agency potential
  return true;
}

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

  // PRIORITY 0 (NEW): Check for explicit agency name that looks like an agency
  // This takes precedence over "privato" flags which can be misleading
  const agencyNameFromData = input.analytics?.agencyName || input.contacts?.agencyName || input.agencyName;
  if (agencyNameFromData && looksLikeAgencyName(agencyNameFromData)) {
    return {
      ownerType: 'agency',
      agencyName: agencyNameFromData,
      confidence: 'high',
      reasoning: `Agency name detected: "${agencyNameFromData}" (overrides advertiser field)`
    };
  }

  // Priority 1: analytics.advertiser field (for Immobiliare.it via Apify)
  // Only trust "privato" if no agency name was found above
  if (input.analytics?.advertiser) {
    const advertiser = input.analytics.advertiser.toLowerCase().trim();
    
    if (advertiser === 'privato' || advertiser === 'private' || advertiser === 'owner') {
      return {
        ownerType: 'private',
        agencyName: null,
        confidence: 'high',
        reasoning: 'analytics.advertiser === "privato" (no agency name found)'
      };
    }
    
    if (advertiser === 'agenzia' || advertiser === 'agency') {
      return {
        ownerType: 'agency',
        agencyName: agencyNameFromData || null,
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
  const hasAgencyName = !!(agencyNameFromData);
  
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

  // Check for BOTH private and agency keywords
  const privateMatches = PRIVATE_KEYWORDS.filter(keyword => 
    textToCheck.includes(keyword.toLowerCase())
  );

  const agencyMatches = AGENCY_KEYWORDS.filter(keyword =>
    textToCheck.includes(keyword.toLowerCase())
  );

  // PRIORITY TO AGENCY KEYWORDS - They are more specific and reliable
  // "proponiamo" is much more indicative of agency than "proprietario" is of private
  
  // If any agency keywords found, classify as agency (they are highly specific)
  if (agencyMatches.length > 0) {
    return {
      ownerType: 'agency',
      agencyName: null,
      confidence: agencyMatches.length >= 2 ? 'high' : 'medium',
      reasoning: agencyMatches.length >= 2 
        ? `Multiple agency keywords found: ${agencyMatches.join(', ')}`
        : `Agency keyword in description: ${agencyMatches[0]}`
    };
  }

  // Only if NO agency keywords found, check for private keywords
  if (privateMatches.length > 0) {
    return {
      ownerType: 'private',
      agencyName: null,
      confidence: privateMatches.length >= 2 ? 'high' : 'medium',
      reasoning: `Private keywords found (no agency keywords): ${privateMatches.join(', ')}`
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
  // Idealista provides structured fields for advertiser detection
  // Unlike Immobiliare, it doesn't have analytics.advertiser but has:
  // - item.advertiser / item.advertiserName (name of who's selling)
  // - item.advertiserType (could be "privato" or "agenzia")
  // - item.contact (raw contact text)
  // - item.phone / item.email
  
  const result = classifyOwnerType({
    // Structured advertiser data (if available)
    analytics: item.advertiserType ? {
      advertiser: item.advertiserType,  // "privato" vs "agenzia"
      advertiserName: item.advertiser || item.advertiserName
    } : undefined,
    
    // Contact info
    contact: item.contact,
    description: item.description,
    title: item.title,
    
    // Pre-extracted agency name (for fallback)
    agencyName: item.advertiser || item.advertiserName || undefined
  });
  
  // Log classification for non-agency or low confidence
  const propertyId = item.propertyCode || item.id || 'unknown';
  if (result.ownerType === 'private' || result.confidence !== 'high') {
    console.log(`[IDEALISTA-CLASSIFY] ${propertyId}: ${result.ownerType} (${result.confidence}) - ${result.reasoning} | advertiser="${item.advertiser || item.advertiserName}" type="${item.advertiserType}"`);
  }
  
  return result;
}
