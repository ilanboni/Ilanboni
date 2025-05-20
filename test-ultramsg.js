import axios from 'axios';

// Accedi alle variabili d'ambiente
const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
const token = process.env.ULTRAMSG_API_KEY;
const phoneNumber = '393407992052'; // Il numero di telefono del cliente di test
const message = 'Test di connessione UltraMsg - ' + new Date().toISOString();

async function testUltraMsg() {
  console.log('Test UltraMsg API');
  console.log('Instance ID:', instanceId);
  console.log('Token presente:', token ? 'Sì' : 'No');
  console.log('Invio messaggio a:', phoneNumber);
  
  const params = new URLSearchParams();
  params.append('to', phoneNumber);
  params.append('body', message);
  
  try {
    const response = await axios.post(
      `https://api.ultramsg.com/${instanceId}/messages/chat`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        params: {
          token: token
        }
      }
    );
    
    console.log('Risposta API:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Errore:', error.message);
    if (error.response) {
      console.error('Dettagli errore:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

testUltraMsg();
