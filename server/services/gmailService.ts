import { google } from 'googleapis';
import { emailProcessor } from './immobiliareEmailProcessor';
import { parseIdealistaEmail, processIdealistaEmail } from './idealistaEmailProcessor';

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
      }>;
    }>;
  };
  internalDate: string;
}

export class GmailService {
  private gmail: any;
  private isAuthenticated = false;
  public ready: Promise<void>;

  constructor() {
    this.ready = this.initializeGmail();
  }

  private async initializeGmail() {
    try {
      // Verifica presenza credenziali Gmail separate
      if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
        console.log('[GMAIL] Credenziali Gmail mancanti. Servizio disabilitato.');
        console.log('[GMAIL] Richieste: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
        this.isAuthenticated = false;
        return;
      }

      const clientId = process.env.GMAIL_NATIVE_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_NATIVE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
      
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      });

      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Test della connessione
      await this.gmail.users.getProfile({ userId: 'me' });
      
      this.isAuthenticated = true;
      console.log('[GMAIL] Servizio Gmail inizializzato correttamente con credenziali separate');
    } catch (error) {
      console.error('[GMAIL] Errore inizializzazione Gmail:', error);
      this.isAuthenticated = false;
    }
  }

  /**
   * Controlla nuove email da immobiliare.it
   */
  async checkNewEmails(): Promise<void> {
    if (!this.isAuthenticated) {
      console.log('[GMAIL] Servizio non autenticato, salto controllo email');
      return;
    }

    try {
      console.log('[GMAIL] 📧 Controllo nuove email da immobiliare.it (ricerca ampliata)...');
      
      // Cerca email da immobiliare.it ricevute nelle ultime 24 ore (ricerca normale)
      const query = 'from:noreply@immobiliare.it OR from:@immobiliare.it newer_than:1d';
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });

      const messages = response.data.messages || [];
      console.log(`[GMAIL] Trovate ${messages.length} email da immobiliare.it`);

      for (const message of messages) {
        console.log(`[GMAIL] Elaborazione messaggio ID: ${message.id}`);
        await this.processMessage(message.id);
      }

    } catch (error) {
      console.error('[GMAIL] Errore controllo email:', error);
    }
  }

  /**
   * Elabora un singolo messaggio
   */
  private async processMessage(messageId: string): Promise<void> {
    try {
      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const messageData: GmailMessage = message.data;
      
      // Estrai dati dall'email prima della verifica duplicati
      const emailData = this.extractEmailData(messageData);
      
      // Verifica se l'email è già stata elaborata
      const emailId = `gmail-${messageId}`;
      console.log(`[GMAIL] Controllo duplicato per: ${emailData.subject}`);
      const existingEmail = await this.checkIfEmailExists(emailId, emailData);
      
      if (existingEmail) {
        console.log(`[GMAIL] Email già elaborata: ${emailData.subject} (ID: ${emailId})`);
        return; // Email già elaborata
      }
      
      console.log(`[GMAIL] ✅ Email non presente nel database, procedo con elaborazione: ${emailId}`);
      
      console.log(`[GMAIL] Verifica se è email immobiliare.it: ${emailData.fromAddress}`);
      if (this.isImmobiliareNotification(emailData)) {
        console.log(`[GMAIL] 📧 Elaborazione email immobiliare.it: ${emailData.subject}`);
        // Aggiungi l'emailId alla struttura dati prima di processare
        const emailWithId = {
          ...emailData,
          emailId: emailId
        };
        await emailProcessor.processEmail(emailWithId);
      } else if (this.isIdealistaNotification(emailData)) {
        console.log(`[GMAIL] 📧 Elaborazione email Idealista: ${emailData.subject}`);
        
        // Parsa l'email di Idealista
        const idealistaData = parseIdealistaEmail(emailData.subject, emailData.body);
        
        if (idealistaData) {
          console.log(`[IDEALISTA] Dati estratti:`, idealistaData);
          
          // Processa l'email e crea cliente/buyer
          const result = await processIdealistaEmail(idealistaData);
          
          console.log(`[IDEALISTA] Cliente creato/aggiornato: ${result.clientId}, Buyer: ${result.buyerId}, Comunicazione: ${result.communicationId}`);
          
          // Salva l'email nel database per tracking
          await this.saveEmailToDatabase({
            ...emailData,
            emailId: emailId,
            source: 'idealista',
            processed: true
          });
        } else {
          console.log(`[IDEALISTA] Impossibile estrarre dati dall'email`);
        }
      } else {
        console.log(`[GMAIL] Email non riconosciuta: ${emailData.fromAddress}`);
      }

    } catch (error) {
      console.error(`[GMAIL] Errore elaborazione messaggio ${messageId}:`, error);
    }
  }

  /**
   * Estrae i dati dall'email Gmail
   */
  private extractEmailData(message: GmailMessage) {
    const headers = message.payload.headers;
    
    const getHeader = (name: string) => 
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('subject');
    const fromAddress = getHeader('from');
    const receivedAt = new Date(parseInt(message.internalDate));

    // Estrai il corpo dell'email
    let body = '';
    let htmlBody = '';

    const extractBody = (payload: any): void => {
      if (payload.body?.data) {
        const content = Buffer.from(payload.body.data, 'base64').toString('utf8');
        if (payload.mimeType === 'text/html') {
          htmlBody = content;
        } else {
          body = content;
        }
      }

      if (payload.parts) {
        payload.parts.forEach((part: any) => {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf8');
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            htmlBody = Buffer.from(part.body.data, 'base64').toString('utf8');
          } else if (part.parts) {
            extractBody(part);
          }
        });
      }
    };

    extractBody(message.payload);

    return {
      emailId: `gmail-${message.id}`,
      fromAddress,
      subject,
      body: body || this.stripHtml(htmlBody),
      htmlBody,
      receivedAt,
    };
  }

  /**
   * Verifica se è una notifica da immobiliare.it
   */
  private isImmobiliareNotification(emailData: any): boolean {
    const fromDomain = emailData.fromAddress.toLowerCase();
    const subject = emailData.subject.toLowerCase();
    
    return (
      fromDomain.includes('immobiliare.it') ||
      subject.includes('richiesta') ||
      subject.includes('visita') ||
      subject.includes('interesse') ||
      subject.includes('contatto')
    );
  }

  /**
   * Verifica se è una notifica da Idealista
   */
  private isIdealistaNotification(emailData: any): boolean {
    const fromDomain = emailData.fromAddress.toLowerCase();
    const subject = emailData.subject.toLowerCase();
    const body = emailData.body.toLowerCase();
    
    return (
      fromDomain.includes('idealista') ||
      body.includes('il team di idealista') ||
      body.includes('una persona interessata ai tuoi annunci ti ha chiamato') ||
      subject.includes('idealista')
    );
  }

  /**
   * Salva email nel database per tracking
   */
  private async saveEmailToDatabase(emailData: any): Promise<void> {
    try {
      const response = await fetch('http://localhost:5000/api/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailId: emailData.emailId,
          fromAddress: emailData.fromAddress,
          subject: emailData.subject,
          body: emailData.body,
          receivedAt: emailData.receivedAt,
          source: emailData.source || 'gmail',
          processed: emailData.processed || false
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log(`[GMAIL] Email salvata nel database: ${emailData.emailId}`);
    } catch (error) {
      console.error('[GMAIL] Errore salvataggio email:', error);
    }
  }

  /**
   * Rimuove tag HTML dal testo
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Verifica se un'email esiste già nel database usando subject e timestamp
   */
  private async checkIfEmailExists(emailId: string, emailData?: any): Promise<boolean> {
    try {
      // Prima verifica per ID esatto
      const response = await fetch(`http://localhost:5000/api/emails?emailId=${emailId}`);
      const emails = await response.json();
      if (emails.length > 0) {
        return true;
      }

      // Se non trovata per ID, verifica duplicati con criteri più specifici per immobiliare.it
      if (emailData) {
        const allEmailsResponse = await fetch(`http://localhost:5000/api/emails`);
        const allEmails = await allEmailsResponse.json();
        
        // Per email di immobiliare.it, verifica duplicati basandosi su contenuto completo e timestamp preciso
        if (emailData.fromAddress.includes('immobiliare.it')) {
          // Usa una combinazione di fattori per identificare duplicati reali:
          // 1. Stesso contenuto completo del corpo email
          // 2. Timestamp molto vicino (entro 2 minuti)
          // 3. Stesso subject
          
          const duplicateEmail = allEmails.find((email: any) => 
            email.subject === emailData.subject &&
            email.body === emailData.body &&
            email.fromAddress === emailData.fromAddress &&
            Math.abs(new Date(email.receivedAt).getTime() - emailData.receivedAt.getTime()) < 120000 // 2 minuti di tolleranza
          );
          
          if (duplicateEmail) {
            console.log(`[GMAIL] Email duplicata immobiliare.it trovata (contenuto identico): ${duplicateEmail.emailId}`);
            console.log(`[GMAIL] Confronto duplicato - Subject: "${emailData.subject}" vs "${duplicateEmail.subject}"`);
            console.log(`[GMAIL] Confronto duplicato - Timestamp: ${emailData.receivedAt} vs ${duplicateEmail.receivedAt}`);
            console.log(`[GMAIL] Confronto duplicato - Differenza timestamp: ${Math.abs(new Date(duplicateEmail.receivedAt).getTime() - emailData.receivedAt.getTime())} ms`);
            return true;
          }
        } else {
          // Per altre email, usa il controllo tradizionale
          const duplicateEmail = allEmails.find((email: any) => 
            email.subject === emailData.subject &&
            email.fromAddress === emailData.fromAddress &&
            Math.abs(new Date(email.receivedAt).getTime() - emailData.receivedAt.getTime()) < 60000 // 1 minuto di tolleranza
          );
          
          if (duplicateEmail) {
            console.log(`[GMAIL] Email duplicata trovata con ID diverso: ${duplicateEmail.emailId}`);
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('[GMAIL] Errore verifica email esistente:', error);
      return false;
    }
  }

  /**
   * Stato del servizio Gmail
   */
  getStatus() {
    return {
      authenticated: this.isAuthenticated,
      service: 'Gmail API v1',
    };
  }
}

export const gmailService = new GmailService();