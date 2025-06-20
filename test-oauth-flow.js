// Test per simulare il flusso OAuth e verificare il salvataggio dei token
const axios = require('axios');

async function testOAuthFlow() {
  try {
    console.log('🔍 Test 1: Verifica stato iniziale Google Calendar');
    const statusResponse = await axios.get('http://localhost:5000/api/calendar/status');
    console.log('Status iniziale:', statusResponse.data);
    
    console.log('\n🔍 Test 2: Genera URL di autorizzazione');
    const authUrlResponse = await axios.get('http://localhost:5000/api/oauth/auth-url');
    console.log('Auth URL generato:', authUrlResponse.data.authUrl ? 'OK' : 'FAILED');
    
    console.log('\n🔍 Test 3: Simula callback OAuth (questo fallirà ma mostrerà il flusso)');
    try {
      // Questo fallirà perché non abbiamo un codice reale, ma mostrerà il flusso
      await axios.get('http://localhost:5000/oauth/callback?code=test_fake_code');
    } catch (error) {
      console.log('Callback test (atteso fallimento):', error.response?.status || 'Network error');
    }
    
    console.log('\n🔍 Test 4: Verifica stato finale Google Calendar');
    const finalStatusResponse = await axios.get('http://localhost:5000/api/calendar/status');
    console.log('Status finale:', finalStatusResponse.data);
    
  } catch (error) {
    console.error('Errore nel test:', error.message);
  }
}

testOAuthFlow();