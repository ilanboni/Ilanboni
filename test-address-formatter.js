// Test per la funzione di formattazione degli indirizzi
const { standardizeAddress } = require('./server/utils/addressFormatter.ts');

console.log('=== TEST FORMATTAZIONE INDIRIZZI ===\n');

const testCases = [
  'Via Francesco Primaticcio, Bande Nere, Municipio 7, Milano, Lombardia, 20147, Italia',
  'Via Giuseppe Garibaldi, Centro, Milano',
  'Viale Antonio Gramsci, 45, Milano',
  'Corso Giovanni Battista, Porta Venezia, Milano'
];

testCases.forEach((address, index) => {
  console.log(`Test ${index + 1}:`);
  console.log(`Input:  "${address}"`);
  console.log(`Output: "${standardizeAddress(address)}"`);
  console.log('');
});