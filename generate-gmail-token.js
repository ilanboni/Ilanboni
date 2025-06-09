import { google } from 'googleapis';
import readline from 'readline';

// Usa le tue credenziali Gmail esistenti
const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'https://client-management-system-ilanboni.replit.app/oauth/gmail/callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Scope per accesso Gmail
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

console.log('🔧 Generazione Token Gmail per Gestionale Immobiliare\n');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ ERRORE: GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET devono essere configurati come secrets in Replit');
  console.log('\n📋 Per configurare:');
  console.log('1. Vai nella sezione Secrets di Replit');
  console.log('2. Aggiungi GMAIL_CLIENT_ID con il tuo client ID');
  console.log('3. Aggiungi GMAIL_CLIENT_SECRET con il tuo client secret');
  process.exit(1);
}

// Genera URL di autorizzazione
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
});

console.log('📋 PASSAGGI PER OTTENERE IL REFRESH TOKEN:\n');
console.log('1. Apri questo URL nel browser:');
console.log('   ', authUrl);
console.log('\n2. Accedi con l\'account Gmail che riceve le email da immobiliare.it');
console.log('3. Autorizza l\'applicazione');
console.log('4. Copia il codice di autorizzazione che appare');
console.log('5. Incollalo qui sotto\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Inserisci il codice di autorizzazione: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n✅ SUCCESS! Token generato correttamente');
    console.log('\n📋 AGGIUNGI QUESTO SECRET IN REPLIT:');
    console.log('   Nome: GMAIL_REFRESH_TOKEN');
    console.log('   Valore:', tokens.refresh_token);
    
    console.log('\n🎉 Una volta aggiunto il secret, il monitoraggio Gmail sarà attivo!');
    
  } catch (error) {
    console.error('❌ Errore nell\'ottenere il token:', error.message);
  }
  
  rl.close();
});