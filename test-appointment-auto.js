/**
 * Test per verificare l'estrazione automatica degli appuntamenti dai messaggi WhatsApp
 */

async function testAppointmentExtraction() {
  try {
    console.log("=== TEST ESTRAZIONE AUTOMATICA APPUNTAMENTI ===");
    
    const testMessage = "Egr. Dott. Rossi, le confermo appuntamento di Lunedì 10/6, ore 14:00, in Via Milano 123. La ringrazio. Ilan Boni - Cavour Immobiliare";
    const recipientPhone = "393555123456";
    
    // Test diretto delle funzioni di estrazione
    const { extractAppointmentData, createCalendarEventFromAppointment, isAppointmentConfirmation } = await import('./server/services/appointmentExtractor.ts');
    
    console.log("1. Test riconoscimento messaggio di conferma...");
    const isConfirmation = isAppointmentConfirmation(testMessage);
    console.log(`   Risultato: ${isConfirmation ? 'RICONOSCIUTO' : 'NON RICONOSCIUTO'}`);
    
    if (isConfirmation) {
      console.log("\n2. Test estrazione dati appuntamento...");
      const appointmentData = extractAppointmentData(testMessage, recipientPhone);
      
      if (appointmentData) {
        console.log("   Dati estratti:");
        console.log(`   - Nome cliente: ${appointmentData.clientName}`);
        console.log(`   - Telefono: ${appointmentData.clientPhone}`);
        console.log(`   - Data appuntamento: ${appointmentData.appointmentDate}`);
        console.log(`   - Indirizzo: ${appointmentData.address}`);
        console.log(`   - Salutazione: ${appointmentData.salutation}`);
        
        console.log("\n3. Test creazione evento Google Calendar...");
        const calendarSuccess = await createCalendarEventFromAppointment(appointmentData);
        
        if (calendarSuccess) {
          console.log("   ✅ SUCCESSO: Evento creato in Google Calendar");
        } else {
          console.log("   ❌ ERRORE: Impossibile creare evento in Google Calendar");
        }
      } else {
        console.log("   ❌ ERRORE: Impossibile estrarre dati appuntamento");
      }
    }
    
    console.log("\n=== TEST COMPLETATO ===");
    
  } catch (error) {
    console.error("❌ Errore durante il test:", error);
  }
}

// Esegui il test
testAppointmentExtraction();