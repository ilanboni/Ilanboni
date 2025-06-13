/**
 * Utility per standardizzare il formato degli indirizzi degli immobili nel frontend
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