/**
 * Script autonomo per pulire i nomi dei clienti numerati nel database
 * Uso: tsx cleanup-client-names.js
 */

import { db } from './server/db';
import { clients } from './shared/schema';
import { like, eq } from 'drizzle-orm';

async function cleanupClientNames() {
  console.log('🧹 Avvio pulizia nomi clienti numerati...');
  
  try {
    // Trova tutti i clienti con nomi che contengono "Cliente"
    const numberedClients = await db.select()
      .from(clients)
      .where(like(clients.firstName, 'Cliente%'));
    
    console.log(`📋 Trovati ${numberedClients.length} clienti con nomi numerati`);
    
    if (numberedClients.length === 0) {
      console.log('✅ Nessun cliente da pulire');
      return;
    }
    
    let updated = 0;
    let errors = 0;
    
    // Processa ogni cliente
    for (const client of numberedClients) {
      try {
        let newFirstName = client.firstName;
        let newLastName = client.lastName;
        
        console.log(`\n🔄 Processando cliente ${client.id}: "${client.firstName} ${client.lastName}"`);
        
        // Se ha email, estrai nome dalla parte prima della @
        if (client.email) {
          const emailPart = client.email.split('@')[0];
          const cleanEmailPart = emailPart.replace(/[^a-zA-Z]/g, '');
          
          if (cleanEmailPart.length > 2) {
            newFirstName = cleanEmailPart.charAt(0).toUpperCase() + cleanEmailPart.slice(1).toLowerCase();
            newLastName = 'da Immobiliare.it';
            console.log(`   📧 Nome estratto dall'email: ${newFirstName}`);
          } else {
            newFirstName = 'Contatto';
            newLastName = 'da Immobiliare.it';
            console.log(`   📧 Email non utilizzabile, uso nome generico`);
          }
        } else {
          // Senza email, usa nome professionale generico
          newFirstName = 'Contatto';
          newLastName = 'da Immobiliare.it';
          console.log(`   📧 Nessuna email, uso nome generico professionale`);
        }
        
        // Aggiorna il database
        await db.update(clients)
          .set({
            firstName: newFirstName,
            lastName: newLastName
          })
          .where(eq(clients.id, client.id));
        
        console.log(`   ✅ Aggiornato: "${client.firstName} ${client.lastName}" → "${newFirstName} ${newLastName}"`);
        updated++;
        
        // Pausa per non sovraccaricare il database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`   ❌ Errore aggiornando cliente ${client.id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n🎉 Pulizia completata!`);
    console.log(`   ✅ Clienti aggiornati: ${updated}`);
    console.log(`   ❌ Errori: ${errors}`);
    console.log(`   📊 Totale processati: ${numberedClients.length}`);
    
  } catch (error) {
    console.error('💥 Errore durante la pulizia:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Esegui la pulizia
cleanupClientNames();