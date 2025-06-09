import { google } from 'googleapis';
import { emailProcessor } from './immobiliareEmailProcessor';

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

  constructor() {
    this.initializeGmail();
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

      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'https://client-management-system-ilanboni.replit.app/oauth/gmail/callback'
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
      console.log('[GMAIL] 📧 Controllo nuove email da immobiliare.it...');
      
      // Cerca email da immobiliare.it ricevute nelle ultime 24 ore
      const query = 'from:noreply@immobiliare.it OR from:@immobiliare.it newer_than:1d';
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });

      const messages = response.data.messages || [];
      console.log(`[GMAIL] Trovate ${messages.length} email da immobiliare.it`);

      for (const message of messages) {
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
      
      // Verifica se l'email è già stata elaborata
      const emailId = `gmail-${messageId}`;
      const existingEmail = await this.checkIfEmailExists(emailId);
      
      if (existingEmail) {
        return; // Email già elaborata
      }

      // Estrai dati dall'email
      const emailData = this.extractEmailData(messageData);
      
      if (this.isImmobiliareNotification(emailData)) {
        console.log(`[GMAIL] 📧 Elaborazione email immobiliare.it: ${emailData.subject}`);
        await emailProcessor.processEmail(emailData);
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
   * Verifica se un'email esiste già nel database
   */
  private async checkIfEmailExists(emailId: string): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:5000/api/emails?emailId=${emailId}`);
      const emails = await response.json();
      return emails.length > 0;
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