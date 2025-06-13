/**
 * Utility per standardizzare il formato degli indirizzi degli immobili
 * Formato standard: "Via ........., civico, Milano"
 */

export function standardizeAddress(address: string): string {
  if (!address || address.trim() === '') {
    return address;
  }

  const cleanAddress = address.trim();
  
  // Se l'indirizzo già termina con ", Milano", non modificarlo
  if (cleanAddress.toLowerCase().endsWith(', milano')) {
    return cleanAddress;
  }
  
  // Rimuovi "Milano" finale se presente (senza virgola)
  let standardizedAddress = cleanAddress.replace(/,?\s*Milano\s*$/i, '');
  
  // Aggiungi ", Milano" alla fine se non c'è già
  if (!standardizedAddress.toLowerCase().includes('milano')) {
    standardizedAddress = `${standardizedAddress}, Milano`;
  }
  
  return standardizedAddress;
}

/**
 * Estrae componenti dell'indirizzo per analisi
 */
export function parseAddress(address: string) {
  const standardized = standardizeAddress(address);
  
  // Pattern per estrarre via e civico
  const patterns = [
    // "Via Nome Strada, 123, Milano"
    /^(Via\s+[^,]+),\s*(\d+[A-Za-z]*),?\s*Milano$/i,
    // "Viale Nome Strada, 123, Milano"  
    /^(Viale\s+[^,]+),\s*(\d+[A-Za-z]*),?\s*Milano$/i,
    // "Piazza Nome, 123, Milano"
    /^(Piazza\s+[^,]+),\s*(\d+[A-Za-z]*),?\s*Milano$/i,
    // "Corso Nome, 123, Milano"
    /^(Corso\s+[^,]+),\s*(\d+[A-Za-z]*),?\s*Milano$/i,
    // Pattern generico per strada con civico
    /^([^,]+),\s*(\d+[A-Za-z]*),?\s*Milano$/i
  ];
  
  for (const pattern of patterns) {
    const match = standardized.match(pattern);
    if (match) {
      return {
        street: match[1].trim(),
        number: match[2].trim(),
        city: 'Milano',
        formatted: standardized
      };
    }
  }
  
  return {
    street: standardized.replace(', Milano', ''),
    number: null,
    city: 'Milano',
    formatted: standardized
  };
}