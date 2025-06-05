import https from 'https';
import querystring from 'querystring';

const code = '4/0AUJR-x5sVBy34-L4awZb6tJkJvsKlAIx6TyFsKjDWA3hbQO53PKcPGj-ixEekQNERi9RwQ';
const clientId = '876070482272-badt95el39sgg9om6mumtf8tcebgiard.apps.googleusercontent.com';
const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const redirectUri = 'https://client-management-system-ilanboni.replit.app/oauth/callback';

console.log('🔧 Configurando Google Calendar...');

const postData = querystring.stringify({
  code: code,
  client_id: clientId,
  client_secret: clientSecret,
  redirect_uri: redirectUri,
  grant_type: 'authorization_code'
});

const options = {
  hostname: 'oauth2.googleapis.com',
  port: 443,
  path: '/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const tokens = JSON.parse(data);
      if (tokens.refresh_token) {
        console.log('✅ Google Calendar configurato con successo!');
        console.log('Per completare la configurazione, aggiungi questa variabile d\'ambiente:');
        console.log('GOOGLE_CALENDAR_REFRESH_TOKEN=' + tokens.refresh_token);
      } else if (tokens.error) {
        console.log('❌ Errore Google OAuth:', tokens.error);
        console.log('Descrizione:', tokens.error_description);
      } else {
        console.log('⚠️ Nessun refresh token ricevuto');
        console.log('Risposta completa:', JSON.stringify(tokens, null, 2));
      }
    } catch (e) {
      console.log('❌ Errore parsing risposta:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Errore richiesta:', e.message);
});

req.write(postData);
req.end();