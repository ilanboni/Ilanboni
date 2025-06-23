/**
 * Pulizia Google Calendar usando i token dal database
 */

import { google } from 'googleapis';
import { Pool } from '@neondatabase/serverless';

async function cleanupWithDatabaseToken() {
  try {
    console.log('🔍 Recupero token dal database...');
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Recupera il token più recente dal database
    const result = await pool.query(`
      SELECT refresh_token, access_token, expires_at 
      FROM oauth_tokens 
      WHERE service = 'google_calendar' 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      throw new Error('Nessun token Google Calendar trovato nel database');
    }
    
    const tokenData = result.rows[0];
    console.log(`📅 Token trovato, scade: ${tokenData.expires_at}`);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      'https://client-management-system-ilanboni.replit.app/oauth/callback'
    );

    // Configura i token
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    console.log('📊 Recupero eventi da Google Calendar...');
    
    // Recupera eventi dal 1 giugno al 31 luglio 2025
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: '2025-06-01T00:00:00.000Z',
      timeMax: '2025-07-31T23:59:59.000Z',
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    console.log(`📋 Trovati ${events.length} eventi totali`);

    // Identifica eventi legittimi da preservare
    const legitimateEvents = events.filter(event => {
      const summary = event.summary || '';
      return (
        summary.includes('Benarroch') ||
        summary.includes('Troina') ||
        (summary.includes('Appuntamento') && 
         !summary.includes('Test') && 
         !summary.includes('Paganelli') && 
         !summary.includes('Erba') && 
         !summary.includes('ceruti') &&
         !summary.includes('TestOrario') &&
         !summary.includes('TestCalendar'))
      );
    });

    // Tutti gli altri sono eventi di test da eliminare
    const testEvents = events.filter(event => {
      const summary = event.summary || '';
      return !(
        summary.includes('Benarroch') ||
        summary.includes('Troina') ||
        (summary.includes('Appuntamento') && 
         !summary.includes('Test') && 
         !summary.includes('Paganelli') && 
         !summary.includes('Erba') && 
         !summary.includes('ceruti') &&
         !summary.includes('TestOrario') &&
         !summary.includes('TestCalendar'))
      );
    });

    console.log(`✅ Eventi legittimi preservati: ${legitimateEvents.length}`);
    console.log(`🗑️ Eventi di test da eliminare: ${testEvents.length}`);

    if (testEvents.length === 0) {
      console.log('✨ Nessun evento di test da eliminare!');
      return { success: true, deletedCount: 0 };
    }

    // Mostra alcuni esempi di eventi da eliminare
    console.log('\n📋 Primi 10 eventi di test da eliminare:');
    testEvents.slice(0, 10).forEach((event, index) => {
      console.log(`${index + 1}. "${event.summary || 'NESSUN TITOLO'}" - ${event.start?.dateTime || event.start?.date}`);
    });

    console.log(`\n🔥 Eliminazione di ${testEvents.length} eventi...`);

    let deletedCount = 0;
    let errorCount = 0;

    // Elimina in batch di 20
    for (let i = 0; i < testEvents.length; i += 20) {
      const batch = testEvents.slice(i, i + 20);
      
      console.log(`📦 Batch ${Math.floor(i/20) + 1}/${Math.ceil(testEvents.length/20)} (${batch.length} eventi)`);

      const deletePromises = batch.map(async (event) => {
        try {
          await calendar.events.delete({
            calendarId: 'primary',
            eventId: event.id
          });
          deletedCount++;
          return { success: true };
        } catch (error) {
          errorCount++;
          console.error(`❌ Errore eliminando "${event.summary}": ${error.message}`);
          return { success: false };
        }
      });

      await Promise.all(deletePromises);
      
      // Pausa tra i batch
      if (i + 20 < testEvents.length) {
        console.log('⏳ Pausa 2 secondi...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n🎉 PULIZIA COMPLETATA!`);
    console.log(`✅ Eventi eliminati: ${deletedCount}`);
    console.log(`❌ Errori: ${errorCount}`);
    console.log(`🛡️ Eventi legittimi preservati: ${legitimateEvents.length}`);

    await pool.end();

    return {
      success: true,
      deletedCount,
      errorCount,
      legitimateCount: legitimateEvents.length
    };

  } catch (error) {
    console.error('💥 Errore durante la pulizia:', error);
    throw error;
  }
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupWithDatabaseToken()
    .then((result) => {
      console.log('🏁 Pulizia completata:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Pulizia fallita:', error);
      process.exit(1);
    });
}

export { cleanupWithDatabaseToken };