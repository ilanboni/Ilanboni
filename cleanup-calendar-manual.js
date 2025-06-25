/**
 * Script manuale per eliminare eventi di test da Google Calendar
 * Rispetta rigorosamente i limiti di quota di Google
 */

import { google } from 'googleapis';
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';

async function cleanupCalendarManual() {
  try {
    console.log('🔧 Avvio pulizia manuale Google Calendar...');
    
    // Configurazione WebSocket per Neon
    const { neonConfig } = await import('@neondatabase/serverless');
    neonConfig.webSocketConstructor = ws;
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Recupera token dal database
    const result = await pool.query(`
      SELECT refresh_token, access_token 
      FROM oauth_tokens 
      WHERE service = 'google_calendar' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      throw new Error('Nessun token trovato');
    }
    
    const tokenData = result.rows[0];
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      'https://cavourimmobiliare-ilanboni.replit.app/oauth/callback'
    );

    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    console.log('📋 Recupero primi 100 eventi...');
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: '2025-06-01T00:00:00.000Z',
      timeMax: '2025-07-31T23:59:59.000Z',
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    console.log(`📊 Trovati ${events.length} eventi`);

    // Filtra solo eventi di test
    const testEvents = events.filter(event => {
      const summary = event.summary || '';
      return (
        summary.includes('Test') ||
        summary.includes('Paganelli') ||
        summary.includes('Erba') ||
        summary.includes('ceruti') ||
        summary.includes('TestOrario') ||
        summary.includes('TestCalendar') ||
        (summary.includes('Appuntamento') && 
         !summary.includes('Benarroch') && 
         !summary.includes('Troina'))
      );
    });

    console.log(`🗑️ Eventi di test da eliminare: ${testEvents.length}`);

    if (testEvents.length === 0) {
      console.log('✅ Nessun evento di test trovato!');
      await pool.end();
      return { success: true, deletedCount: 0 };
    }

    // Mostra eventi da eliminare
    console.log('\n📋 Eventi da eliminare:');
    testEvents.slice(0, 10).forEach((event, index) => {
      console.log(`${index + 1}. "${event.summary}" - ${event.start?.dateTime || event.start?.date}`);
    });

    let deletedCount = 0;
    const maxToDelete = Math.min(testEvents.length, 10); // Massimo 10 per volta

    console.log(`\n🔥 Eliminazione di ${maxToDelete} eventi (lenta per rispettare quota)...`);

    for (let i = 0; i < maxToDelete; i++) {
      const event = testEvents[i];
      
      try {
        console.log(`🗑️ Eliminando ${i + 1}/${maxToDelete}: "${event.summary}"`);
        
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: event.id
        });
        
        deletedCount++;
        console.log(`✅ Eliminato con successo`);
        
        // Pausa lunga tra le eliminazioni
        if (i < maxToDelete - 1) {
          console.log('⏳ Pausa 10 secondi...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
      } catch (error) {
        console.error(`❌ Errore eliminando "${event.summary}": ${error.message}`);
        
        if (error.message.includes('Quota exceeded')) {
          console.log('⚠️ Quota raggiunta, fermando eliminazione');
          break;
        }
      }
    }

    console.log(`\n🎉 Eliminazione completata!`);
    console.log(`✅ Eventi eliminati: ${deletedCount}`);
    console.log(`📋 Eventi rimanenti da eliminare: ${testEvents.length - deletedCount}`);

    if (testEvents.length > deletedCount) {
      console.log('💡 Esegui nuovamente lo script tra qualche minuto per continuare');
    }

    await pool.end();

    return {
      success: true,
      deletedCount,
      remainingCount: testEvents.length - deletedCount
    };

  } catch (error) {
    console.error('💥 Errore:', error);
    throw error;
  }
}

export { cleanupCalendarManual };

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupCalendarManual()
    .then((result) => {
      console.log('🏁 Risultato:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Errore:', error);
      process.exit(1);
    });
}