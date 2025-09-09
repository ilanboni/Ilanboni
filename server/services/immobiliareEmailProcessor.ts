import { db } from '../db';
import { immobiliareEmails, clients, properties, tasks, communications, buyers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EmailData {
  emailId: string;
  fromAddress: string;
  subject: string;
  body: string;
  htmlBody?: string;
  receivedAt: Date;
}

interface ExtractedClientData {
  name: string;
  email?: string;
  phone?: string;
}

interface ExtractedPropertyData {
  address?: string;
  type?: string;
  price?: number;
  size?: number;
}

interface ExtractedRequestData {
  type: 'visita' | 'informazioni' | 'contatto';
  urgency: 'alta' | 'media' | 'bassa';
  notes?: string;
}

export class ImmobiliareEmailProcessor {
  
  /**
   * Elabora una nuova email da immobiliare.it
   */
  async processEmail(emailData: EmailData): Promise<void> {
    console.log(`[EMAIL PROCESSOR] Elaborazione email: ${emailData.subject}`);
    
    try {
      // Verifica se l'email è già stata elaborata
      const existingEmail = await db.select()
        .from(immobiliareEmails)
        .where(eq(immobiliareEmails.emailId, emailData.emailId))
        .limit(1);

      if (existingEmail.length > 0) {
        console.log(`[EMAIL PROCESSOR] Email ${emailData.emailId} già elaborata`);
        return;
      }

      // Salva l'email grezza nel database
      const [savedEmail] = await db.insert(immobiliareEmails).values({
        emailId: emailData.emailId,
        fromAddress: emailData.fromAddress,
        subject: emailData.subject,
        body: emailData.body,
        htmlBody: emailData.htmlBody || null,
        receivedAt: emailData.receivedAt,
        processed: false
      }).returning();

      console.log(`[EMAIL PROCESSOR] Email salvata con ID: ${savedEmail.id}`);

      // Estrai i dati usando AI
      const extractedData = await this.extractDataWithAI(emailData);
      
      if (!extractedData) {
        await this.markEmailAsProcessed(savedEmail.id, 'Impossibile estrarre dati dall\'email');
        return;
      }

      // Trova o crea il cliente
      const clientId = await this.findOrCreateClient(extractedData.client, extractedData.property);
      
      // Trova l'immobile tramite riconoscimento automatico o dati estratti
      const propertyId = await this.findProperty(extractedData.property, emailData.subject, emailData.body);

      // Crea il task
      const taskId = await this.createTask(
        clientId, 
        propertyId, 
        extractedData.request,
        extractedData.client,
        extractedData.property
      );

      // Crea la comunicazione
      const communicationId = await this.createCommunication(
        clientId,
        propertyId,
        emailData,
        extractedData
      );

      // Aggiorna l'email con i collegamenti creati
      await db.update(immobiliareEmails)
        .set({
          processed: true,
          clientId,
          propertyId,
          taskId,
          communicationId,
          clientName: extractedData.client.name,
          clientEmail: extractedData.client.email,
          clientPhone: extractedData.client.phone,
          propertyAddress: extractedData.property.address,
          propertyType: extractedData.property.type,
          propertyPrice: extractedData.property.price,
          propertySize: extractedData.property.size,
          requestType: extractedData.request.type
        })
        .where(eq(immobiliareEmails.id, savedEmail.id));

      console.log(`[EMAIL PROCESSOR] ✅ EMAIL PROCESSATA AUTOMATICAMENTE:
        - Oggetto: ${emailData.subject}
        - Cliente: ${extractedData.client.name} (ID: ${clientId})
        - Immobile: ${propertyId ? `ID ${propertyId}` : 'Non identificato'}
        - Task creato: ID ${taskId}
        - Comunicazione: ID ${communicationId}
        - Processamento: AUTOMATICO - Nessun intervento manuale richiesto`);

    } catch (error) {
      console.error(`[EMAIL PROCESSOR] ❌ Errore nell'elaborazione:`, error);
      
      // Verifica se l'email esiste già nel database
      const existingEmail = await db.select()
        .from(immobiliareEmails)
        .where(eq(immobiliareEmails.emailId, emailData.emailId))
        .limit(1);

      if (existingEmail.length > 0) {
        // Aggiorna l'email esistente con l'errore
        await db.update(immobiliareEmails)
          .set({
            processed: false,
            processingError: error instanceof Error ? error.message : 'Errore sconosciuto'
          })
          .where(eq(immobiliareEmails.emailId, emailData.emailId));
        
        console.log(`[EMAIL PROCESSOR] Email aggiornata con errore (ID: ${existingEmail[0].id})`);
      } else {
        // Salva nuova email con errore
        try {
          const [savedEmail] = await db.insert(immobiliareEmails).values({
            emailId: emailData.emailId,
            fromAddress: emailData.fromAddress,
            subject: emailData.subject,
            body: emailData.body,
            htmlBody: emailData.htmlBody || null,
            receivedAt: emailData.receivedAt,
            processed: false,
            processingError: error instanceof Error ? error.message : 'Errore sconosciuto'
          }).returning();
          
          console.log(`[EMAIL PROCESSOR] Email salvata con errore (ID: ${savedEmail.id})`);
        } catch (dbError) {
          console.error(`[EMAIL PROCESSOR] Errore nel salvataggio dell'errore:`, dbError);
        }
      }
    }
  }

  /**
   * Estrae i dati dall'email usando AI
   */
  private async extractDataWithAI(emailData: EmailData) {
    try {
      const prompt = `
Analizza questa email da immobiliare.it e estrai le informazioni del cliente e dell'immobile.

OGGETTO: ${emailData.subject}
CORPO EMAIL:
${emailData.body}

Estrai le seguenti informazioni e restituiscile in formato JSON:

{
  "client": {
    "name": "Nome completo del cliente (es: Elena Valoti)",
    "email": "email del cliente se presente nell'email",
    "phone": "telefono del cliente se presente nell'email"
  },
  "property": {
    "address": "indirizzo completo dell'immobile (es: Viale Abruzzi 78, Milano)",
    "type": "tipologia (appartamento, villa, etc.) se presente",
    "price": prezzo_numerico_se_presente,
    "size": dimensione_numerica_mq_se_presente
  },
  "request": {
    "type": "visita | informazioni | contatto",
    "urgency": "alta | media | bassa",
    "notes": "note aggiuntive, preferenze orarie, commenti del cliente"
  }
}

ESEMPI DI RICONOSCIMENTO:
- Email con richiesta di visitare un immobile → type: "visita"
- Email che chiede solo informazioni → type: "informazioni"
- Email generica di contatto → type: "contatto"

ISTRUZIONI SPECIFICHE:
- Estrai con precisione SOLO nomi italiani completi (Nome e Cognome), escludendo parole come "Email", "Telefono", "Cliente", "Sig", "Dott"
- NON includere mai termini tecnici o parole non-nome nel campo name
- Cerca indirizzi italiani completi con via/viale/piazza
- Se un dato non è presente nell'email, usa null
- L'urgency deve riflettere il tono: richieste immediate = "alta", normali = "media", generiche = "bassa"
- Nelle notes includi dettagli utili come orari preferiti o commenti specifici

ESEMPI NOME CORRETTO:
- "Marco Prestini" → name: "Marco Prestini"
- "PRESTINI Email" → name: "Prestini" (rimuovi "Email")
- "Cliente Email" → name: null (nessun nome reale trovato)
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system", 
            content: "Sei un assistente specializzato nell'analisi di email immobiliari. Estrai sempre e solo informazioni presenti nel testo, senza inventare dati."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Risposta AI vuota');
      }

      const extractedData = JSON.parse(content);
      console.log('[EMAIL PROCESSOR] Dati estratti:', JSON.stringify(extractedData, null, 2));
      
      return extractedData;

    } catch (error) {
      console.error('[EMAIL PROCESSOR] Errore nell\'estrazione AI:', error);
      return null;
    }
  }

  /**
   * Trova o crea un cliente con le preferenze di ricerca
   */
  private async findOrCreateClient(clientData: ExtractedClientData, propertyData?: ExtractedPropertyData): Promise<number> {
    // Se il nome non è presente, prova a estrarlo dall'email o usa un nome generico professionale
    if (!clientData.name || clientData.name.toLowerCase().includes('cliente')) {
      if (clientData.email) {
        // Estrai il nome dalla parte prima della @ dell'email
        const emailPart = clientData.email.split('@')[0];
        const cleanEmailPart = emailPart.replace(/[^a-zA-Z]/g, '');
        if (cleanEmailPart.length > 2) {
          clientData.name = cleanEmailPart.charAt(0).toUpperCase() + cleanEmailPart.slice(1).toLowerCase();
          console.log(`[EMAIL PROCESSOR] Nome estratto dall'email: ${clientData.name}`);
        } else {
          clientData.name = 'Cliente';
        }
      } else {
        clientData.name = 'Cliente';
      }
      console.log(`[EMAIL PROCESSOR] Nome mancante, uso nome professionale: ${clientData.name}`);
    }
    
    if (!clientData.name) {
      throw new Error('Nome cliente mancante');
    }

    // Cerca cliente esistente per email o telefono
    let existingClient = null;
    
    if (clientData.email) {
      const clientsByEmail = await db.select()
        .from(clients)
        .where(eq(clients.email, clientData.email))
        .limit(1);
      
      if (clientsByEmail.length > 0) {
        existingClient = clientsByEmail[0];
      }
    }

    if (!existingClient && clientData.phone) {
      const normalizedPhone = this.normalizePhone(clientData.phone);
      const clientsByPhone = await db.select()
        .from(clients)
        .where(eq(clients.phone, normalizedPhone))
        .limit(1);
      
      if (clientsByPhone.length > 0) {
        existingClient = clientsByPhone[0];
      }
    }

    if (existingClient) {
      console.log(`[EMAIL PROCESSOR] Cliente esistente trovato: ${existingClient.firstName} ${existingClient.lastName}`);
      return existingClient.id;
    }

    // Crea nuovo cliente
    const nameParts = clientData.name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Usa saluto speciale per clienti generici
    const salutation = firstName === 'Cliente' ? 'Gentile' : 'Sig.';
    
    const [newClient] = await db.insert(clients).values({
      type: 'buyer',
      salutation: salutation,
      firstName,
      lastName,
      email: clientData.email || null,
      phone: clientData.phone ? this.normalizePhone(clientData.phone) : 'N/D',
      notes: 'Cliente creato automaticamente da email immobiliare.it'
    }).returning();

    console.log(`[EMAIL PROCESSOR] Nuovo cliente creato: ${newClient.firstName} ${newClient.lastName} (ID: ${newClient.id})`);

    // Crea il record buyer con area di ricerca se abbiamo dati dell'immobile
    if (propertyData && propertyData.address) {
      try {
        // Crea un'area di ricerca circolare centrata sull'immobile di interesse
        const searchArea = {
          type: 'circle',
          center: propertyData.address,
          radius: 600, // 600 metri come standard
          createdFrom: 'email_property_interest'
        };

        await db.insert(buyers).values({
          clientId: newClient.id,
          searchArea: JSON.stringify(searchArea),
          maxPrice: propertyData.price ? Math.round(propertyData.price * 1.1) : null, // +10% dal prezzo di interesse
          minSize: propertyData.size ? Math.round(propertyData.size * 0.9) : null, // -10% dalla superficie di interesse
          searchNotes: `Area di ricerca basata sull'interesse per: ${propertyData.address}`
        });

        console.log(`[EMAIL PROCESSOR] Area di ricerca creata per cliente ${newClient.id} basata su ${propertyData.address}`);
      } catch (error) {
        console.error(`[EMAIL PROCESSOR] Errore nella creazione dell'area di ricerca:`, error);
      }
    }

    return newClient.id;
  }

  /**
   * Trova un immobile esistente
   */
  private async findProperty(propertyData: ExtractedPropertyData, emailSubject?: string, emailBody?: string): Promise<number | null> {
    // Prima di tutto, cerca tramite ID immobiliare.it estratto dall'email
    const immobiliareId = this.extractImmobiliareItId(emailSubject, emailBody);
    if (immobiliareId) {
      console.log(`[EMAIL PROCESSOR] ID Immobiliare.it estratto: ${immobiliareId}`);
      
      const propertyByImmobiliareId = await db.select()
        .from(properties)
        .where(eq(properties.immobiliareItId, immobiliareId))
        .limit(1);
        
      if (propertyByImmobiliareId.length > 0) {
        console.log(`[EMAIL PROCESSOR] ✅ Immobile trovato tramite ID Immobiliare.it: ${immobiliareId} → ID ${propertyByImmobiliareId[0].id}`);
        return propertyByImmobiliareId[0].id;
      } else {
        console.log(`[EMAIL PROCESSOR] ⚠️ Nessun immobile trovato con ID Immobiliare.it: ${immobiliareId}`);
      }
    }

    // Mapping automatico dei riferimenti agli immobili per riconoscimento immediato
    const propertyReferenceMappings: Record<string, number> = {
      'Bel': 14,           // Viale Belisario
      'Belisario': 14,     // Viale Belisario (nome completo)
      'Abruzzi': 18,       // Viale Abruzzi  
      '32962055': 18,      // Viale Abruzzi (codice annuncio)
      'Belfiore': 17,      // Via Belfiore
      'Via Belfiore': 17,  // Via Belfiore (completo)
      'Prim': 19,                    // Via Primaticcio
      'Primaticcio': 19,             // Via Primaticcio (nome completo)
      'Francesco Primaticcio': 19    // Via Francesco Primaticcio (nome completo)
    };

    // Prima prova il riconoscimento automatico dall'oggetto email
    if (emailSubject) {
      console.log(`[EMAIL PROCESSOR] Analisi oggetto email per riconoscimento: "${emailSubject}"`);
      
      for (const [reference, propertyId] of Object.entries(propertyReferenceMappings)) {
        if (emailSubject.includes(reference)) {
          console.log(`[EMAIL PROCESSOR] ✅ Riconoscimento automatico: riferimento "${reference}" → immobile ID ${propertyId}`);
          return propertyId;
        }
      }
    }

    // Se non trova nell'oggetto, cerca anche nel contenuto dell'email
    if (propertyData.address) {
      console.log(`[EMAIL PROCESSOR] Analisi contenuto email per riconoscimento: "${propertyData.address}"`);
      
      for (const [reference, propertyId] of Object.entries(propertyReferenceMappings)) {
        if (propertyData.address.includes(reference)) {
          console.log(`[EMAIL PROCESSOR] ✅ Riconoscimento automatico nel contenuto: riferimento "${reference}" → immobile ID ${propertyId}`);
          return propertyId;
        }
      }
    }

    // Se non trova riferimenti nell'oggetto, prova con l'indirizzo estratto dai dati
    if (!propertyData.address) {
      console.log(`[EMAIL PROCESSOR] Nessun riferimento trovato nell'oggetto e nessun indirizzo estratto`);
      return null;
    }

    // Cerca per indirizzo esatto
    const existingProperties = await db.select()
      .from(properties)
      .where(eq(properties.address, propertyData.address))
      .limit(1);

    if (existingProperties.length > 0) {
      console.log(`[EMAIL PROCESSOR] Immobile trovato per indirizzo: ${propertyData.address} → ID ${existingProperties[0].id}`);
      return existingProperties[0].id;
    }

    console.log(`[EMAIL PROCESSOR] Nessun immobile trovato per indirizzo: ${propertyData.address}`);
    return null;
  }

  /**
   * Crea un task per il follow-up
   */
  private async createTask(
    clientId: number, 
    propertyId: number | null,
    requestData: ExtractedRequestData,
    clientData: ExtractedClientData,
    propertyData: ExtractedPropertyData
  ): Promise<number> {
    
    const dueDate = new Date();
    
    // Imposta la scadenza in base all'urgenza
    switch (requestData.urgency) {
      case 'alta':
        dueDate.setHours(dueDate.getHours() + 2); // 2 ore
        break;
      case 'media':
        dueDate.setDate(dueDate.getDate() + 1); // 1 giorno
        break;
      case 'bassa':
        dueDate.setDate(dueDate.getDate() + 3); // 3 giorni
        break;
    }

    let title = '';
    let description = '';

    switch (requestData.type) {
      case 'visita':
        title = `Richiesta visita - ${clientData.name}`;
        description = `RICHIESTA DI VISITA ricevuta da immobiliare.it\n\nCliente: ${clientData.name}`;
        if (propertyData.address) {
          description += `\nImmobile: ${propertyData.address}`;
        }
        description += `\n\n🎯 AZIONE RICHIESTA: Organizzare visita immobile`;
        description += `\n📞 PROSSIMO STEP: Contattare cliente per fissare appuntamento`;
        break;
      case 'informazioni':
        title = `Richiesta informazioni - ${clientData.name}`;
        description = `RICHIESTA INFORMAZIONI ricevuta da immobiliare.it\n\nCliente: ${clientData.name}`;
        if (propertyData.address) {
          description += `\nImmobile: ${propertyData.address}`;
        }
        description += `\n\n🎯 AZIONE RICHIESTA: Fornire informazioni dettagliate`;
        description += `\n📧 PROSSIMO STEP: Rispondere con brochure e dettagli`;
        break;
      case 'contatto':
        title = `Richiesta contatto - ${clientData.name}`;
        description = `RICHIESTA DI CONTATTO ricevuta da immobiliare.it\n\nCliente: ${clientData.name}`;
        if (propertyData.address) {
          description += `\nImmobile: ${propertyData.address}`;
        }
        description += `\n\n🎯 AZIONE RICHIESTA: Contattare cliente`;
        description += `\n📞 PROSSIMO STEP: Chiamare per comprendere esigenze`;
        break;
    }

    if (requestData.notes) {
      description += `\n\n💬 NOTE DEL CLIENTE:\n${requestData.notes}`;
    }

    description += `\n\n📋 CONTATTI CLIENTE:`;
    if (clientData.email) description += `\n✉️ Email: ${clientData.email}`;
    if (clientData.phone) description += `\n📱 Telefono: ${clientData.phone}`;
    
    description += `\n\n⏰ Urgenza: ${requestData.urgency.toUpperCase()}`;

    const [task] = await db.insert(tasks).values({
      type: 'call',
      title,
      description,
      clientId,
      propertyId,
      dueDate: dueDate.toISOString().split('T')[0], // Solo la data
      status: 'pending'
    }).returning();

    return task.id;
  }

  /**
   * Crea una comunicazione per tracciare l'email
   */
  private async createCommunication(
    clientId: number,
    propertyId: number | null,
    emailData: EmailData,
    extractedData: any
  ): Promise<number> {
    
    const [communication] = await db.insert(communications).values({
      clientId,
      propertyId,
      type: 'email',
      subject: emailData.subject,
      content: emailData.body,
      summary: `Richiesta di ${extractedData.request.type} da immobiliare.it`,
      direction: 'inbound',
      needsFollowUp: true,
      followUpDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      externalId: emailData.emailId
    }).returning();

    return communication.id;
  }

  /**
   * Normalizza un numero di telefono per UltraMsg (formato 393471234567)
   */
  private normalizePhone(phone: string): string {
    // Rimuovi spazi e caratteri speciali
    let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Se inizia con +39, rimuovi il +
    if (normalized.startsWith('+39')) {
      normalized = normalized.substring(1);
    }
    
    // Se inizia con 0039, rimuovi 00
    if (normalized.startsWith('0039')) {
      normalized = normalized.substring(2);
    }
    
    // Se inizia con 0 (numero nazionale), rimuovilo e aggiungi 39
    if (normalized.startsWith('0') && normalized.length >= 10) {
      normalized = '39' + normalized.substring(1);
    }
    
    // Se è un numero cellulare che inizia con 3 (formato nazionale), aggiungi 39
    if (normalized.startsWith('3') && normalized.length === 10) {
      normalized = '39' + normalized;
    }
    
    // Se non inizia con 39 e sembra un numero italiano valido, aggiungi 39
    if (!normalized.startsWith('39') && normalized.length >= 9 && normalized.length <= 10) {
      normalized = '39' + normalized;
    }

    console.log(`[EMAIL PROCESSOR] Numero normalizzato: ${phone} → ${normalized}`);
    
    return normalized;
  }

  /**
   * Estrae l'ID dell'annuncio immobiliare.it dall'email
   */
  private extractImmobiliareItId(emailSubject?: string, emailBody?: string): string | null {
    const fullText = `${emailSubject || ''} ${emailBody || ''}`;
    
    // Pattern per estrarre l'ID da URL immobiliare.it
    // Es: https://www.immobiliare.it/annunci/119032725/
    const immobiliareUrlPattern = /(?:https?:\/\/)?(?:www\.)?immobiliare\.it\/annunci\/(\d+)/gi;
    const match = immobiliareUrlPattern.exec(fullText);
    
    if (match && match[1]) {
      console.log(`[EMAIL PROCESSOR] Estratto ID Immobiliare.it: ${match[1]} da URL: ${match[0]}`);
      return match[1];
    }
    
    // Pattern alternativo per ID senza URL completo 
    // Es: "annuncio 119032725" o "codice 119032725"
    const idPattern = /(?:annuncio|codice|id)\s*:?\s*(\d{8,9})/gi;
    const idMatch = idPattern.exec(fullText);
    
    if (idMatch && idMatch[1]) {
      console.log(`[EMAIL PROCESSOR] Estratto ID Immobiliare.it alternativo: ${idMatch[1]}`);
      return idMatch[1];
    }
    
    console.log(`[EMAIL PROCESSOR] Nessun ID Immobiliare.it trovato nell'email`);
    return null;
  }

  /**
   * Marca un'email come elaborata con errore
   */
  private async markEmailAsProcessed(emailId: number, error: string): Promise<void> {
    await db.update(immobiliareEmails)
      .set({
        processed: true,
        processingError: error
      })
      .where(eq(immobiliareEmails.id, emailId));
  }

  /**
   * Ottieni statistiche delle email elaborate
   */
  async getProcessingStats(): Promise<{
    total: number;
    processed: number;
    errors: number;
    pending: number;
  }> {
    const all = await db.select().from(immobiliareEmails);
    
    return {
      total: all.length,
      processed: all.filter(e => e.processed && !e.processingError).length,
      errors: all.filter(e => e.processingError).length,
      pending: all.filter(e => !e.processed).length
    };
  }
}

export const emailProcessor = new ImmobiliareEmailProcessor();

// Export function for backward compatibility
export async function processImmobiliareEmail(emailData: {
  emailId: string;
  from: string;
  subject: string;
  content: string;
  receivedAt: Date;
}): Promise<void> {
  const processor = new ImmobiliareEmailProcessor();
  await processor.processEmail({
    emailId: emailData.emailId,
    fromAddress: emailData.from,
    subject: emailData.subject,
    body: emailData.content,
    receivedAt: emailData.receivedAt
  });
}