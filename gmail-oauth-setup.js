const { google } = require('googleapis');
const express = require('express');
const url = require('url');

// Inserisci qui le credenziali ottenute dalla Google Cloud Console
const CLIENT_ID = 'INSERISCI_IL_TUO_GMAIL_CLIENT_ID';
const CLIENT_SECRET = 'INSERISCI_IL_TUO_GMAIL_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/oauth/gmail/callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const app = express();

console.log('\n🔧 CONFIGURAZIONE OAUTH2 GMAIL');
console.log('================================');

// Step 1: Genera URL di autorizzazione
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
  ],
  prompt: 'consent'
});

console.log('\n📋 ISTRUZIONI:');
console.log('1. Aggiorna le credenziali CLIENT_ID e CLIENT_SECRET in questo file');
console.log('2. Esegui: node gmail-oauth-setup.js');
console.log('3. Apri questo URL nel browser:');
console.log('\n' + authUrl);
console.log('\n4. Autorizza l\'accesso e verrai reindirizzato');
console.log('5. Copia il REFRESH_TOKEN che apparirà\n');

// Step 2: Gestisci il callback
app.get('/oauth/gmail/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.send('❌ Errore: codice di autorizzazione mancante');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('\n✅ SUCCESSO! Ecco le tue credenziali:');
    console.log('=====================================');
    console.log('GMAIL_CLIENT_ID=' + CLIENT_ID);
    console.log('GMAIL_CLIENT_SECRET=' + CLIENT_SECRET);
    console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('=====================================\n');
    
    res.send(`
      <h1>✅ Configurazione OAuth2 Gmail Completata!</h1>
      <p>Copia queste credenziali nel tuo ambiente Replit:</p>
      <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
GMAIL_CLIENT_ID=${CLIENT_ID}
GMAIL_CLIENT_SECRET=${CLIENT_SECRET}
GMAIL_REFRESH_TOKEN=${tokens.refresh_token}
      </pre>
      <p>Ora puoi chiudere questa finestra e aggiungere le credenziali al tuo progetto.</p>
    `);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore nell\'ottenere i token:', error);
    res.send('❌ Errore nell\'autorizzazione');
  }
});

// Avvia il server temporaneo
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server di configurazione avviato su http://localhost:${PORT}`);
  console.log('\nApri l\'URL di autorizzazione sopra per continuare...');
});