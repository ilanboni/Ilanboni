import { db } from '../db';
import { clients } from '@shared/schema';
import { eq, like } from 'drizzle-orm';

/**
 * Utility per pulire i nomi dei clienti che contengono numerazioni automatiche
 * come "Cliente 0592" e sostituirli con nomi più professionali
 */
export class ClientNameCleaner {
  
  /**
   * Trova tutti i clienti con nomi numerati
   */
  async findClientsWithNumberedNames(): Promise<any[]> {
    const numberedClients = await db.select()
      .from(clients)
      .where(like(clients.firstName, 'Cliente%'));
    
    console.log(`[CLIENT CLEANER] Trovati ${numberedClients.length} clienti con nomi numerati`);
    return numberedClients;
  }
  
  /**
   * Pulisce un singolo cliente migliorando il nome basandosi sull'email se disponibile
   */
  async cleanSingleClient(clientId: number): Promise<boolean> {
    try {
      const client = await db.select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      
      if (client.length === 0) {
        console.log(`[CLIENT CLEANER] Cliente ${clientId} non trovato`);
        return false;
      }
      
      const clientData = client[0];
      let newFirstName = clientData.firstName;
      let newLastName = clientData.lastName;
      
      // Se il nome attuale contiene "Cliente", proviamo a migliorarlo
      if (clientData.firstName.includes('Cliente')) {
        if (clientData.email) {
          // Estrai il nome dalla parte prima della @ dell'email
          const emailPart = clientData.email.split('@')[0];
          const cleanEmailPart = emailPart.replace(/[^a-zA-Z]/g, '');
          
          if (cleanEmailPart.length > 2) {
            newFirstName = cleanEmailPart.charAt(0).toUpperCase() + cleanEmailPart.slice(1).toLowerCase();
            newLastName = 'da Immobiliare.it';
            console.log(`[CLIENT CLEANER] Nome estratto dall'email per cliente ${clientId}: ${newFirstName}`);
          } else {
            newFirstName = 'Contatto';
            newLastName = 'da Immobiliare.it';
          }
        } else {
          // Se non abbiamo email, usa un nome generico professionale
          newFirstName = 'Contatto';
          newLastName = 'da Immobiliare.it';
        }
        
        // Aggiorna il cliente nel database
        await db.update(clients)
          .set({
            firstName: newFirstName,
            lastName: newLastName
          })
          .where(eq(clients.id, clientId));
        
        console.log(`[CLIENT CLEANER] ✅ Cliente ${clientId} aggiornato: "${clientData.firstName} ${clientData.lastName}" → "${newFirstName} ${newLastName}"`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`[CLIENT CLEANER] ❌ Errore nell'aggiornamento del cliente ${clientId}:`, error);
      return false;
    }
  }
  
  /**
   * Pulisce tutti i clienti con nomi numerati nel database
   */
  async cleanAllNumberedClients(): Promise<{updated: number, errors: number}> {
    const numberedClients = await this.findClientsWithNumberedNames();
    let updated = 0;
    let errors = 0;
    
    console.log(`[CLIENT CLEANER] Inizio pulizia di ${numberedClients.length} clienti...`);
    
    for (const client of numberedClients) {
      const success = await this.cleanSingleClient(client.id);
      if (success) {
        updated++;
      } else {
        errors++;
      }
      
      // Piccola pausa per non sovraccaricare il database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[CLIENT CLEANER] ✅ Pulizia completata: ${updated} clienti aggiornati, ${errors} errori`);
    return { updated, errors };
  }
}

// Esporta un'istanza per uso immediato
export const clientNameCleaner = new ClientNameCleaner();