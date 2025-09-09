import { db } from '../db';
import { immobiliareEmails, properties, communications } from '@shared/schema';
import { eq, and, like, isNull } from 'drizzle-orm';

export class EmailPropertyLinker {
  
  /**
   * Associa automaticamente le email alle proprietà basandosi sull'indirizzo
   */
  async linkEmailsToProperties(): Promise<void> {
    console.log('[EMAIL LINKER] Avvio associazione email-proprietà...');
    
    try {
      // Ottieni tutte le email non ancora associate a proprietà
      const unlinkedEmails = await db.select()
        .from(immobiliareEmails)
        .where(isNull(immobiliareEmails.propertyId));

      console.log(`[EMAIL LINKER] Trovate ${unlinkedEmails.length} email non associate`);

      // Ottieni tutte le proprietà
      const allProperties = await db.select().from(properties);
      
      for (const email of unlinkedEmails) {
        await this.linkSingleEmail(email, allProperties);
      }

      console.log('[EMAIL LINKER] ✅ Associazione completata');
      
    } catch (error) {
      console.error('[EMAIL LINKER] ❌ Errore durante associazione:', error);
    }
  }

  /**
   * Associa una singola email a una proprietà
   */
  private async linkSingleEmail(email: any, properties: any[]): Promise<void> {
    try {
      const emailText = `${email.subject} ${email.body}`.toLowerCase();
      
      // Cerca corrispondenze con indirizzi delle proprietà
      for (const property of properties) {
        if (this.isEmailRelatedToProperty(emailText, property)) {
          console.log(`[EMAIL LINKER] Associo email "${email.subject}" a proprietà ${property.address}`);
          
          // Aggiorna l'email con l'ID della proprietà
          await db.update(immobiliareEmails)
            .set({ propertyId: property.id })
            .where(eq(immobiliareEmails.id, email.id));

          // Crea/aggiorna la comunicazione con l'associazione alla proprietà
          if (email.communicationId) {
            await db.update(communications)
              .set({ propertyId: property.id })
              .where(eq(communications.id, email.communicationId));
          }

          break; // Associazione trovata, interrompi ricerca
        }
      }
    } catch (error) {
      console.error(`[EMAIL LINKER] Errore associazione email ${email.id}:`, error);
    }
  }

  /**
   * Verifica se un'email è correlata a una proprietà specifica
   */
  private isEmailRelatedToProperty(emailText: string, property: any): boolean {
    // Prima controlla se c'è un match tramite ID immobiliare.it (più preciso)
    if (property.immobiliareItId) {
      const extractedId = this.extractImmobiliareItId(emailText);
      if (extractedId && extractedId === property.immobiliareItId) {
        console.log(`[EMAIL LINKER] ✅ Match perfetto tramite ID Immobiliare.it: ${extractedId}`);
        return true;
      }
    }

    const address = property.address.toLowerCase();
    
    // Estrai componenti dell'indirizzo
    const addressParts = this.extractAddressComponents(address);
    
    // Verifica corrispondenze dirette
    if (emailText.includes(address)) {
      return true;
    }

    // Verifica componenti dell'indirizzo
    let matches = 0;
    
    if (addressParts.street && emailText.includes(addressParts.street)) matches++;
    if (addressParts.number && emailText.includes(addressParts.number)) matches++;
    if (addressParts.city && emailText.includes(addressParts.city)) matches++;

    // Se almeno 2 componenti corrispondono, considera correlata
    return matches >= 2;
  }

  /**
   * Estrae l'ID dell'annuncio immobiliare.it dall'email
   */
  private extractImmobiliareItId(emailText: string): string | null {
    // Pattern per estrarre l'ID da URL immobiliare.it
    // Es: https://www.immobiliare.it/annunci/119032725/
    const immobiliareUrlPattern = /(?:https?:\/\/)?(?:www\.)?immobiliare\.it\/annunci\/(\d+)/gi;
    const match = immobiliareUrlPattern.exec(emailText);
    
    if (match && match[1]) {
      return match[1];
    }
    
    // Pattern alternativo per ID senza URL completo 
    // Es: "annuncio 119032725" o "codice 119032725"
    const idPattern = /(?:annuncio|codice|id)\s*:?\s*(\d{8,9})/gi;
    const idMatch = idPattern.exec(emailText);
    
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }
    
    return null;
  }

  /**
   * Estrae i componenti di un indirizzo
   */
  private extractAddressComponents(address: string): {
    street: string | null;
    number: string | null;
    city: string | null;
  } {
    const addressLower = address.toLowerCase();
    
    // Pattern per estrarre componenti italiani
    const streetMatch = addressLower.match(/(via|viale|piazza|corso)\s+([^,\d]+)/i);
    const numberMatch = addressLower.match(/(\d+)/);
    const cityMatch = addressLower.match(/milano|roma|torino|firenze|napoli/i);

    return {
      street: streetMatch ? streetMatch[0].trim() : null,
      number: numberMatch ? numberMatch[0] : null,
      city: cityMatch ? cityMatch[0] : null
    };
  }

  /**
   * Forza il riprocessamento di email specifiche con AI migliorata
   */
  async reprocessEmailsWithImprovedAI(emailIds: number[]): Promise<void> {
    console.log(`[EMAIL LINKER] Riprocessamento ${emailIds.length} email con AI migliorata...`);
    
    for (const emailId of emailIds) {
      try {
        const email = await db.select()
          .from(immobiliareEmails)
          .where(eq(immobiliareEmails.id, emailId))
          .limit(1);

        if (email.length === 0) continue;

        await this.reprocessSingleEmail(email[0]);
        
      } catch (error) {
        console.error(`[EMAIL LINKER] Errore riprocessamento email ${emailId}:`, error);
      }
    }
  }

  /**
   * Riprocessa una singola email con logica migliorata
   */
  private async reprocessSingleEmail(email: any): Promise<void> {
    try {
      // Se l'email contiene "Abruzzi", associala alla proprietà Viale Abruzzi
      if (email.subject.toLowerCase().includes('abruzzi') || 
          email.body.toLowerCase().includes('abruzzi')) {
        
        // Trova la proprietà Viale Abruzzi
        const abruzziProperty = await db.select()
          .from(properties)
          .where(like(properties.address, '%Abruzzi%'))
          .limit(1);

        if (abruzziProperty.length > 0) {
          console.log(`[EMAIL LINKER] Associo email "${email.subject}" a Viale Abruzzi`);
          
          // Aggiorna l'email
          await db.update(immobiliareEmails)
            .set({ 
              propertyId: abruzziProperty[0].id,
              propertyAddress: abruzziProperty[0].address 
            })
            .where(eq(immobiliareEmails.id, email.id));

          // Aggiorna la comunicazione se esiste
          if (email.communicationId) {
            await db.update(communications)
              .set({ propertyId: abruzziProperty[0].id })
              .where(eq(communications.id, email.communicationId));
          }
        }
      }

      // Simile logica per Via Roma
      if (email.subject.toLowerCase().includes('roma') || 
          email.body.toLowerCase().includes('roma')) {
        
        const romaProperty = await db.select()
          .from(properties)
          .where(like(properties.address, '%Roma%'))
          .limit(1);

        if (romaProperty.length > 0) {
          console.log(`[EMAIL LINKER] Associo email "${email.subject}" a Via Roma`);
          
          await db.update(immobiliareEmails)
            .set({ 
              propertyId: romaProperty[0].id,
              propertyAddress: romaProperty[0].address 
            })
            .where(eq(immobiliareEmails.id, email.id));

          if (email.communicationId) {
            await db.update(communications)
              .set({ propertyId: romaProperty[0].id })
              .where(eq(communications.id, email.communicationId));
          }
        }
      }

    } catch (error) {
      console.error(`[EMAIL LINKER] Errore riprocessamento email ${email.id}:`, error);
    }
  }
}