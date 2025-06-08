import { db } from '../db';
import { immobiliareEmails, clients, properties, tasks, communications } from '@shared/schema';
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
      const clientId = await this.findOrCreateClient(extractedData.client);
      
      // Trova l'immobile se presente
      const propertyId = extractedData.property.address 
        ? await this.findProperty(extractedData.property)
        : null;

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

      console.log(`[EMAIL PROCESSOR] ✅ Email elaborata con successo:
        - Cliente: ${extractedData.client.name} (ID: ${clientId})
        - Task creato: ID ${taskId}
        - Comunicazione: ID ${communicationId}`);

    } catch (error) {
      console.error(`[EMAIL PROCESSOR] ❌ Errore nell'elaborazione:`, error);
      // Salva l'errore nel database se possibile
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
      } catch (dbError) {
        console.error(`[EMAIL PROCESSOR] Errore nel salvataggio dell'errore:`, dbError);
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
    "name": "Nome completo del cliente",
    "email": "email del cliente se presente",
    "phone": "telefono del cliente se presente"
  },
  "property": {
    "address": "indirizzo completo dell'immobile se presente",
    "type": "tipologia (appartamento, villa, etc.) se presente",
    "price": prezzo_numerico_se_presente,
    "size": dimensione_numerica_mq_se_presente
  },
  "request": {
    "type": "visita | informazioni | contatto",
    "urgency": "alta | media | bassa",
    "notes": "note aggiuntive dal messaggio"
  }
}

ISTRUZIONI:
- Se un dato non è presente, usa null
- Il tipo di richiesta deve essere: "visita" per richieste di visita, "informazioni" per richieste di informazioni, "contatto" per richieste di contatto generico
- L'urgenza deve essere basata sul tono del messaggio
- Estrai solo informazioni esplicitamente presenti nell'email
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
   * Trova o crea un cliente
   */
  private async findOrCreateClient(clientData: ExtractedClientData): Promise<number> {
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
    const lastName = nameParts.slice(1).join(' ') || 'Da immobiliare.it';

    const [newClient] = await db.insert(clients).values({
      type: 'buyer',
      salutation: 'Sig.',
      firstName,
      lastName,
      email: clientData.email || null,
      phone: clientData.phone ? this.normalizePhone(clientData.phone) : 'N/D',
      notes: 'Cliente creato automaticamente da email immobiliare.it'
    }).returning();

    console.log(`[EMAIL PROCESSOR] Nuovo cliente creato: ${newClient.firstName} ${newClient.lastName} (ID: ${newClient.id})`);
    return newClient.id;
  }

  /**
   * Trova un immobile esistente
   */
  private async findProperty(propertyData: ExtractedPropertyData): Promise<number | null> {
    if (!propertyData.address) return null;

    const existingProperties = await db.select()
      .from(properties)
      .where(eq(properties.address, propertyData.address))
      .limit(1);

    return existingProperties.length > 0 ? existingProperties[0].id : null;
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
        title = `Organizzare visita per ${clientData.name}`;
        description = `Cliente interessato a visita immobile`;
        break;
      case 'informazioni':
        title = `Fornire informazioni a ${clientData.name}`;
        description = `Cliente richiede informazioni su immobile`;
        break;
      case 'contatto':
        title = `Contattare ${clientData.name}`;
        description = `Cliente ha richiesto un contatto`;
        break;
    }

    if (propertyData.address) {
      description += ` in ${propertyData.address}`;
    }

    if (requestData.notes) {
      description += `\n\nNote: ${requestData.notes}`;
    }

    description += `\n\nContatti:`;
    if (clientData.email) description += `\nEmail: ${clientData.email}`;
    if (clientData.phone) description += `\nTelefono: ${clientData.phone}`;

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
   * Normalizza un numero di telefono
   */
  private normalizePhone(phone: string): string {
    // Rimuovi spazi e caratteri speciali
    let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Se inizia con +39, rimuovi il +
    if (normalized.startsWith('+39')) {
      normalized = normalized.substring(1);
    }
    
    // Se non inizia con 39 e sembra un numero italiano, aggiungi 39
    if (!normalized.startsWith('39') && normalized.length >= 9) {
      normalized = '39' + normalized;
    }
    
    return normalized;
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