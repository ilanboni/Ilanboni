/**
 * Utility per standardizzare il formato degli indirizzi degli immobili nel frontend
 * Formato standard: "Via ........., civico, Milano"
 */

export function standardizeAddress(address: string): string {
  if (!address || address.trim() === '') {
    return address;
  }

  let cleanAddress = address.trim();
  
  // Rimuovi Milano e tutto quello che segue (incluse info aggiuntive geografiche)
  cleanAddress = cleanAddress.replace(/,?\s*Milano.*$/i, '');
  
  // Pattern per riconoscere diversi formati di indirizzo
  const patterns = [
    // "Via Nome 123" -> "Via Nome, 123, Milano"
    /^(Via|Viale|Piazza|Corso)\s+([^,0-9]+)\s+(\d+[A-Za-z]*)$/i,
    // "Via Nome, 123" -> "Via Nome, 123, Milano"  
    /^(Via|Viale|Piazza|Corso)\s+([^,]+),\s*(\d+[A-Za-z]*)$/i,
  ];
  
  for (const pattern of patterns) {
    const match = cleanAddress.match(pattern);
    if (match) {
      const tipo = match[1];
      const nome = match[2].trim().replace(/,$/, '');
      const civico = match[3];
      return `${tipo} ${nome}, ${civico}, Milano`;
    }
  }
  
  // Pattern per "Via Nome" senza civico -> "Via Nome, Milano"
  const simplePattern = /^(Via|Viale|Piazza|Corso)\s+([^,]+)$/i;
  const simpleMatch = cleanAddress.match(simplePattern);
  if (simpleMatch) {
    const tipo = simpleMatch[1];
    const nome = simpleMatch[2].trim().replace(/,$/, '');
    return `${tipo} ${nome}, Milano`;
  }
  
  // Se non corrisponde a nessun pattern, aggiungi semplicemente Milano
  return `${cleanAddress}, Milano`;
}

/**
 * Hook per applicare automaticamente la standardizzazione degli indirizzi
 */
export function useAddressFormatter() {
  const formatOnBlur = (value: string, onChange: (value: string) => void) => {
    const formatted = standardizeAddress(value);
    if (formatted !== value) {
      onChange(formatted);
    }
  };

  return { formatOnBlur, standardizeAddress };
}