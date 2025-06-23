/**
 * Script per pulire Google Calendar dai test duplicati
 */
import { google } from 'googleapis';
import fs from 'fs';

async function cleanupGoogleCalendar() {
  try {
    // Configurazione OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      'http://localhost:5000/oauth/callback'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    console.log('🔍 Recupero eventi dal Google Calendar...');
    
    // Ottieni eventi dal 1 giugno al 31 luglio 2025
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: '2025-06-01T00:00:00.000Z',
      timeMax: '2025-07-31T23:59:59.000Z',
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    console.log(`📅 Trovati ${events.length} eventi totali`);

    // Identifica eventi di test da eliminare
    const testEvents = events.filter(event => {
      const summary = event.summary || '';
      return summary.includes('TestSalutation') ||
             summary.includes('TestCalendar') ||
             summary.includes('TestOrario') ||
             summary.includes('Paganelli') ||
             summary.includes('Erba') ||
             summary.includes('ceruti') ||
             summary.includes('Boni - 393407992052') ||
             (summary.includes('Test') && summary.includes('Dott.'));
    });

    console.log(`🗑️ Trovati ${testEvents.length} eventi di test da eliminare`);

    if (testEvents.length === 0) {
      console.log('✅ Nessun evento di test trovato');
      return;
    }

    // Mostra alcuni esempi di eventi che verranno eliminati
    console.log('\n📋 Esempi di eventi da eliminare:');
    testEvents.slice(0, 10).forEach((event, index) => {
      console.log(`${index + 1}. ${event.summary} - ${event.start?.dateTime || event.start?.date}`);
    });

    console.log(`\n🚨 Eliminazione di ${testEvents.length} eventi di test...`);

    let deletedCount = 0;
    let errorCount = 0;

    // Elimina gli eventi in batch di 50
    for (let i = 0; i < testEvents.length; i += 50) {
      const batch = testEvents.slice(i, i + 50);
      
      console.log(`📦 Elaborazione batch ${Math.floor(i/50) + 1}/${Math.ceil(testEvents.length/50)} (${batch.length} eventi)`);

      const deletePromises = batch.map(async (event) => {
        try {
          await calendar.events.delete({
            calendarId: 'primary',
            eventId: event.id
          });
          deletedCount++;
          return { success: true, eventId: event.id };
        } catch (error) {
          errorCount++;
          console.error(`❌ Errore eliminando evento ${event.id}:`, error.message);
          return { success: false, eventId: event.id, error: error.message };
        }
      });

      await Promise.all(deletePromises);
      
      // Pausa tra i batch per non superare i rate limits
      if (i + 50 < testEvents.length) {
        console.log('⏳ Pausa per rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n✅ Pulizia completata!`);
    console.log(`🗑️ Eventi eliminati: ${deletedCount}`);
    console.log(`❌ Errori: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log(`⚠️ Alcuni eventi potrebbero non essere stati eliminati a causa di errori`);
    }

    // Verifica finale
    console.log('\n🔍 Verifica finale...');
    const finalResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin: '2025-06-25T00:00:00.000Z',
      timeMax: '2025-06-25T23:59:59.000Z',
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const june25Events = finalResponse.data.items || [];
    console.log(`📅 Eventi rimanenti per il 25 giugno: ${june25Events.length}`);
    
    june25Events.forEach(event => {
      console.log(`  - ${event.summary} alle ${event.start?.dateTime || event.start?.date}`);
    });

  } catch (error) {
    console.error('💥 Errore durante la pulizia:', error);
  }
}

// Esegui la pulizia
cleanupGoogleCalendar();