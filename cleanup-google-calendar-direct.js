/**
 * Script diretto per eliminare tutti gli eventi di test da Google Calendar
 */

import { google } from 'googleapis';

async function cleanupGoogleCalendarDirect() {
  try {
    console.log('🔄 Inizializzazione pulizia Google Calendar...');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      'https://cavourimmobiliare-ilanboni.replit.app/oauth/callback'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    console.log('📅 Recupero tutti gli eventi di giugno-luglio 2025...');
    
    // Recupera TUTTI gli eventi dal 1 giugno al 31 luglio 2025
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: '2025-06-01T00:00:00.000Z',
      timeMax: '2025-07-31T23:59:59.000Z',
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = response.data.items || [];
    console.log(`📊 Trovati ${events.length} eventi totali su Google Calendar`);

    // Log dei primi 10 eventi per debug
    console.log('\n🔍 Primi 10 eventi trovati:');
    events.slice(0, 10).forEach((event, index) => {
      console.log(`${index + 1}. "${event.summary || 'NESSUN TITOLO'}" - ${event.start?.dateTime || event.start?.date || 'NESSUNA DATA'}`);
    });

    // Identifica gli eventi legittimi da PRESERVARE
    const legitimateEvents = events.filter(event => {
      const summary = event.summary || '';
      
      // Eventi legittimi: Benarroch (23 giugno) e Troina (25 giugno)
      return (
        summary.includes('Benarroch') ||
        summary.includes('Troina') ||
        (summary.includes('Appuntamento') && !summary.includes('Test') && !summary.includes('Paganelli') && !summary.includes('Erba') && !summary.includes('ceruti'))
      );
    });

    console.log(`\n✅ Eventi LEGITTIMI da preservare: ${legitimateEvents.length}`);
    legitimateEvents.forEach((event, index) => {
      console.log(`${index + 1}. "${event.summary}" - ${event.start?.dateTime || event.start?.date}`);
    });

    // Identifica TUTTI gli altri eventi come test da eliminare
    const testEvents = events.filter(event => {
      const summary = event.summary || '';
      
      // Se non è un evento legittimo, è un test da eliminare
      return !(
        summary.includes('Benarroch') ||
        summary.includes('Troina') ||
        (summary.includes('Appuntamento') && !summary.includes('Test') && !summary.includes('Paganelli') && !summary.includes('Erba') && !summary.includes('ceruti'))
      );
    });

    console.log(`\n🗑️ Eventi di TEST da eliminare: ${testEvents.length}`);
    
    if (testEvents.length === 0) {
      console.log('✅ Nessun evento di test trovato da eliminare!');
      return;
    }

    // Mostra alcuni eventi di test per conferma
    console.log('\n📋 Primi 20 eventi di test da eliminare:');
    testEvents.slice(0, 20).forEach((event, index) => {
      console.log(`${index + 1}. "${event.summary || 'NESSUN TITOLO'}" - ${event.start?.dateTime || event.start?.date}`);
    });

    console.log(`\n🔥 AVVIO ELIMINAZIONE DI ${testEvents.length} EVENTI...`);

    let deletedCount = 0;
    let errorCount = 0;

    // Elimina gli eventi in batch di 20 per evitare rate limiting
    for (let i = 0; i < testEvents.length; i += 20) {
      const batch = testEvents.slice(i, i + 20);
      
      console.log(`📦 Elaborazione batch ${Math.floor(i/20) + 1}/${Math.ceil(testEvents.length/20)} (${batch.length} eventi)`);

      const deletePromises = batch.map(async (event, batchIndex) => {
        try {
          await calendar.events.delete({
            calendarId: 'primary',
            eventId: event.id
          });
          deletedCount++;
          if (batchIndex < 3) {
            console.log(`  ✅ Eliminato: "${event.summary || 'NESSUN TITOLO'}"`);
          }
          return { success: true, eventId: event.id };
        } catch (error) {
          errorCount++;
          console.error(`  ❌ Errore eliminando "${event.summary || 'NESSUN TITOLO'}": ${error.message}`);
          return { success: false, eventId: event.id, error: error.message };
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
    console.log(`📊 Eventi totali elaborati: ${testEvents.length}`);
    console.log(`🛡️ Eventi legittimi preservati: ${legitimateEvents.length}`);

  } catch (error) {
    console.error('💥 ERRORE CRITICO nella pulizia:', error);
    throw error;
  }
}

// Esegui la pulizia se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupGoogleCalendarDirect()
    .then(() => {
      console.log('🏁 Script completato con successo');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💀 Script fallito:', error);
      process.exit(1);
    });
}

export { cleanupGoogleCalendarDirect };