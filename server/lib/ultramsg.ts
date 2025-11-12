import axios from 'axios';
import { randomUUID } from 'crypto';
import { Communication, InsertCommunication, Client, Property } from '@shared/schema';
import { storage } from '../storage';
import { summarizeText } from './openai';
import { config } from '../config';

// Constants and types for UltraMsg
interface UltraMsgMessageResponse {
  sent: boolean;
  message: string;
  id?: string;
  error?: string;
}

interface UltraMsgMessage {
  to: string;
  body: string;
  priority?: number;
  referenceId?: string;
}

// UltraMsg client class
export class UltraMsgClient {
  private apiUrl: string;
  private apiToken: string;
  private instanceId: string;

  constructor(instanceId: string, apiToken: string) {
    this.instanceId = instanceId;
    this.apiToken = apiToken;
    this.apiUrl = `https://api.ultramsg.com/${instanceId}`;
  }

  /**
   * Invia un file (PDF/JPEG) tramite WhatsApp UltraMsg
   * @param phoneNumber Numero di telefono del destinatario
   * @param fileBuffer Buffer del file
   * @param fileName Nome del file
   * @param caption Didascalia opzionale
   * @returns Response from UltraMsg API
   */
  async sendFile(phoneNumber: string, fileBuffer: Buffer, fileName: string, caption?: string): Promise<UltraMsgMessageResponse> {
    try {
      console.log('[ULTRAMSG] Tentativo di invio file a:', phoneNumber, 'File:', fileName);
      
      // Formatta il numero di telefono (rimuovi eventuali + iniziali e aggiungi @c.us se necessario)
      let formattedPhone = phoneNumber.replace(/^\+/, '');
      if (!formattedPhone.endsWith('@c.us')) {
        formattedPhone += '@c.us';
      }
      console.log('[ULTRAMSG] Numero formattato per file upload:', formattedPhone);

      // Controllo modalità test - blocca l'invio se non autorizzato
      if (config.testMode) {
        const isAuthorized = config.testPhoneNumbers.includes(formattedPhone);
        if (!isAuthorized) {
          console.log(`[ULTRAMSG] 🛡️ MODALITÀ TEST: Invio file bloccato al numero ${formattedPhone} (non autorizzato)`);
          return {
            sent: false,
            message: `Invio file bloccato in modalità test - numero ${formattedPhone} non autorizzato`,
            error: 'TEST_MODE_BLOCKED'
          };
        }
        console.log(`[ULTRAMSG] ✅ MODALITÀ TEST: Numero ${formattedPhone} autorizzato per invio file`);
      }
      
      // Determina il tipo di file e l'endpoint appropriato
      const fileExtension = fileName.toLowerCase().split('.').pop();
      let endpoint = '';
      
      if (fileExtension === 'pdf') {
        endpoint = 'messages/document';
      } else if (['jpg', 'jpeg', 'png'].includes(fileExtension || '')) {
        endpoint = 'messages/image';
      } else {
        throw new Error(`Tipo di file non supportato: ${fileExtension}. Supportati: PDF, JPG, JPEG, PNG`);
      }
      
      console.log('[ULTRAMSG] Usando endpoint:', endpoint);
      
      // Prepara il form data per il file upload
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      formData.append('to', formattedPhone);
      
      // UltraMsg richiede parametri diversi per tipo di file
      if (fileExtension === 'pdf') {
        formData.append('document', fileBuffer, {
          filename: fileName,
          contentType: 'application/pdf'
        });
      } else {
        formData.append('image', fileBuffer, {
          filename: fileName,
          contentType: `image/${fileExtension}`
        });
      }
      
      if (caption) {
        formData.append('caption', caption);
      }
      
      console.log('[ULTRAMSG] Invio file tramite endpoint:', `${this.apiUrl}/${endpoint}`);
      
      try {
        const response = await axios.post<UltraMsgMessageResponse>(
          `${this.apiUrl}/${endpoint}`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
            params: {
              token: this.apiToken
            }
          }
        );
        
        console.log('[ULTRAMSG] Risposta API file:', JSON.stringify(response.data));
        return response.data;
      } catch (axiosError: any) {
        console.error('[ULTRAMSG] Errore nella chiamata API file:', axiosError.message);
        if (axiosError.response) {
          console.error('[ULTRAMSG] Dettagli risposta errore file:', JSON.stringify(axiosError.response.data));
        }
        throw axiosError;
      }
    } catch (error) {
      console.error('Errore nell\'invio del file WhatsApp:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`UltraMsg API file error: ${error.response.data.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Invia un messaggio WhatsApp tramite UltraMsg
   * @param phoneNumber Numero di telefono del destinatario (formato internazionale con o senza +)
   * @param message Testo del messaggio
   * @param priority Priorità del messaggio (opzionale, 0-10)
   * @returns Response from UltraMsg API
   */
  async sendMessage(phoneNumber: string, message: string, priority?: number, referenceId?: string): Promise<UltraMsgMessageResponse> {
    try {
      console.log('[ULTRAMSG] Tentativo di invio messaggio a:', phoneNumber);
      
      // Formatta il numero di telefono (rimuovi eventuali + iniziali)
      const formattedPhone = phoneNumber.replace(/^\+/, '').replace('@c.us', '');
      console.log('[ULTRAMSG] Numero formattato:', formattedPhone);

      // Controllo modalità test - blocca l'invio se non autorizzato
      if (config.testMode) {
        const isAuthorized = config.testPhoneNumbers.includes(formattedPhone);
        if (!isAuthorized) {
          console.log(`[ULTRAMSG] 🛡️ MODALITÀ TEST: Invio bloccato al numero ${formattedPhone} (non autorizzato)`);
          console.log(`[ULTRAMSG] 🛡️ Numeri autorizzati: ${config.testPhoneNumbers.join(', ')}`);
          return {
            sent: false,
            message: `Invio bloccato in modalità test - numero ${formattedPhone} non autorizzato`,
            error: 'TEST_MODE_BLOCKED'
          };
        }
        console.log(`[ULTRAMSG] ✅ MODALITÀ TEST: Numero ${formattedPhone} autorizzato per invio`);
      }
      
      // Prepara il payload
      const payload: UltraMsgMessage = {
        to: formattedPhone,
        body: message,
      };
      
      // Se è specificato un referenceId (per correlazione), aggiungilo
      if (referenceId) {
        payload.referenceId = referenceId;
        console.log('[ULTRAMSG] ReferenceId aggiunto al payload:', referenceId);
      }
      
      console.log('[ULTRAMSG] Payload preparato:', payload);
      
      // Se è specificata una priorità, aggiungila
      if (priority !== undefined && priority >= 0 && priority <= 10) {
        payload.priority = priority;
      }

      // Effettua la chiamata API
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([key, value]) => {
        params.append(key, String(value));
      });

      console.log('[ULTRAMSG] Invio richiesta API a:', `${this.apiUrl}/messages/chat`);
      console.log('[ULTRAMSG] Con token:', this.apiToken ? 'Presente (nascosto)' : 'MANCANTE');
      console.log('[ULTRAMSG] Con parametri:', params.toString());
      
      try {
        const response = await axios.post<UltraMsgMessageResponse>(
          `${this.apiUrl}/messages/chat`,
          params,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            params: {
              token: this.apiToken
            }
          }
        );
        
        console.log('[ULTRAMSG] Risposta API:', JSON.stringify(response.data));
        return response.data;
      } catch (axiosError: any) {
        console.error('[ULTRAMSG] Errore nella chiamata API:', axiosError.message);
        if (axiosError.response) {
          console.error('[ULTRAMSG] Dettagli risposta errore:', JSON.stringify(axiosError.response.data));
        }
        throw axiosError;
      }
    } catch (error) {
      console.error('Errore nell\'invio del messaggio WhatsApp:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`UltraMsg API error: ${error.response.data.error || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Invia un messaggio WhatsApp e registralo nel database
   * @param clientId ID del cliente
   * @param phone Numero di telefono del cliente
   * @param message Testo del messaggio
   * @returns Oggetto comunicazione creato
   */
  async sendAndStoreCommunication(
    clientId: number, 
    phone: string, 
    message: string, 
    additionalParams?: { propertyId?: number | null; responseToId?: number | null }
  ): Promise<Communication> {
    try {
      // Genera un correlation ID unico per deduplicazione
      const correlationId = randomUUID();
      console.log('[ULTRAMSG] Correlation ID generato:', correlationId);
      
      // Invia messaggio tramite UltraMsg con il correlation ID come referenceId
      const ultraMsgResponse = await this.sendMessage(phone, message, undefined, correlationId);
      
      if (!ultraMsgResponse.sent) {
        throw new Error(`Errore nell'invio del messaggio: ${ultraMsgResponse.error || 'Unknown error'}`);
      }
      
      // Genera riassunto con AI se il messaggio è lungo
      let summary: string;
      if (message.length > 100) {
        try {
          summary = await summarizeText(message);
        } catch (aiError) {
          console.warn('Errore nella generazione del riassunto AI:', aiError);
          summary = message.length > 50 ? `${message.substring(0, 47)}...` : message;
        }
      } else {
        summary = message.length > 50 ? `${message.substring(0, 47)}...` : message;
      }
      
      // Prepara i dati per il database con correlation ID e campi di tracking
      const communicationData: InsertCommunication = {
        clientId,
        type: 'whatsapp',
        subject: 'Messaggio WhatsApp',
        content: message,
        summary,
        direction: 'outbound',
        needsFollowUp: false,
        status: 'completed',
        propertyId: additionalParams?.propertyId || null,
        responseToId: additionalParams?.responseToId || null,
        correlationId,
        source: 'app',
        deliveryStatus: 'pending'
      };
      
      console.log('[ULTRAMSG] Salvando comunicazione con parametri:', communicationData);
      
      // Salva nel database
      const communication = await storage.createCommunication(communicationData);
      
      console.log('[ULTRAMSG] Comunicazione salvata con ID:', `${communication.id} propertyId: ${communication.propertyId} correlationId: ${correlationId}`);
      
      return communication;
    } catch (error) {
      console.error('Errore nell\'invio e registrazione del messaggio WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Estrae informazioni nome e saluto da un messaggio WhatsApp
   */
  private extractNameFromMessage(messageBody: string): { salutation?: string; firstName?: string; lastName?: string } | null {
    try {
      // Pattern per riconoscere saluti formali italiani
      const salutationPatterns = [
        { pattern: /^(Gent\.ma Sig\.ra)\s+([A-Za-z\u00C0-\u017F]+(?:\s+[A-Za-z\u00C0-\u017F]+)?)/i, salutation: 'Gent.ma Sig.ra' },
        { pattern: /^(Egr\.?\s+Dott\.?)\s+([A-Za-z\u00C0-\u017F]+(?:\s+[A-Za-z\u00C0-\u017F]+)?)/i, salutation: 'Egr. Dott.' },
        { pattern: /^(Egr\.?\s+Sig\.?)\s+([A-Za-z\u00C0-\u017F]+(?:\s+[A-Za-z\u00C0-\u017F]+)?)/i, salutation: 'Egr. Sig.' },
        { pattern: /^(Gent\.?\s+Dott\.?)\s+([A-Za-z\u00C0-\u017F]+(?:\s+[A-Za-z\u00C0-\u017F]+)?)/i, salutation: 'Gent. Dott.' },
        { pattern: /^(Egr\.?\s+Avv\.?)\s+([A-Za-z\u00C0-\u017F]+(?:\s+[A-Za-z\u00C0-\u017F]+)?)/i, salutation: 'Egr. Avv.to' },
        { pattern: /^(Spett\.le)\s+([A-Za-z\u00C0-\u017F]+(?:\s+[A-Za-z\u00C0-\u017F]+)?)/i, salutation: 'Spett.le' },
        { pattern: /^(Caro|Cara)\s+([A-Za-z\u00C0-\u017F]+(?:\s+[A-Za-z\u00C0-\u017F]+)?)/i, salutation: 'match' }
      ];

      const firstLine = messageBody.split('\n')[0].trim();
      console.log(`[NAME-EXTRACTION] Analyzing first line: "${firstLine}"`);

      for (const { pattern, salutation } of salutationPatterns) {
        const match = firstLine.match(pattern);
        if (match) {
          const extractedSalutation = salutation === 'match' ? match[1] : salutation;
          const fullName = match[2].trim();
          
          // Separa nome e cognome
          const nameParts = fullName.split(/\s+/);
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ') || '';
          
          console.log(`[NAME-EXTRACTION] ✅ Found: salutation="${extractedSalutation}", firstName="${firstName}", lastName="${lastName}"`);
          
          return {
            salutation: extractedSalutation,
            firstName,
            lastName
          };
        }
      }
      
      console.log(`[NAME-EXTRACTION] No formal name pattern found in: "${firstLine}"`);
      return null;
    } catch (error) {
      console.error(`[NAME-EXTRACTION] Error extracting name:`, error);
      return null;
    }
  }

  /**
   * Processa un webhook in arrivo da UltraMsg
   * @param webhookData Dati del webhook
   * @returns La comunicazione creata
   */
  async processIncomingWebhook(webhookData: any): Promise<Communication | null> {
    try {
      console.log("[ULTRAMSG] Elaborazione webhook:", JSON.stringify(webhookData, null, 2));
      
      // Gestisce diversi formati di webhook
      const isFromMe = webhookData.from_me === true || webhookData.fromMe === true;
      const eventType = webhookData.event_type || webhookData.type || 'message';
      
      // Ottieni il numero dell'agente dalla configurazione
      const agentPhoneNumber = config.agentPhoneNumber;
      
      // Verifica che sia un messaggio valido
      if (eventType !== 'message' && eventType !== 'chat') {
        console.log("[ULTRAMSG] Webhook ignorato: non è un messaggio", {
          event_type: eventType
        });
        return null;
      }
      
      // Se è un messaggio in uscita, verifica se è una conferma appuntamento
      if (isFromMe) {
        console.log("[ULTRAMSG-OUTBOUND] Elaborazione messaggio in uscita dal cellulare");
        
        try {
          const { isAppointmentConfirmation, extractAppointmentData, createCalendarEventFromAppointment } = await import('../services/appointmentExtractor');
          
          if (isAppointmentConfirmation(webhookData.body || '')) {
            console.log("[ULTRAMSG-APPOINTMENT] ✅ Rilevata conferma appuntamento nel messaggio in uscita");
            
            // Estrai il numero del destinatario per l'appuntamento
            const recipientPhone = (webhookData.to || '').replace(/@c\.us$/, '').replace(/^\+/, '').replace(/\s+/g, '').replace(/[-()]/g, '');
            
            const appointmentData = extractAppointmentData(webhookData.body || '', recipientPhone);
            
            if (appointmentData) {
              console.log("[ULTRAMSG-APPOINTMENT] ✅ Dati appuntamento estratti:", appointmentData);
              
              // Crea automaticamente l'evento in Google Calendar
              const calendarSuccess = await createCalendarEventFromAppointment(appointmentData);
              
              if (calendarSuccess) {
                console.log("[ULTRAMSG-APPOINTMENT] ✅ Evento creato automaticamente in Google Calendar per", appointmentData.clientName);
              } else {
                console.log("[ULTRAMSG-APPOINTMENT] ❌ Errore nella creazione automatica dell'evento in Calendar");
              }
            } else {
              console.log("[ULTRAMSG-APPOINTMENT] ❌ Impossibile estrarre i dati dell'appuntamento dal messaggio");
            }
          } else {
            console.log("[ULTRAMSG-APPOINTMENT] Messaggio in uscita non è una conferma appuntamento");
          }
        } catch (appointmentError) {
          console.error("[ULTRAMSG-APPOINTMENT] Errore nell'elaborazione automatica dell'appuntamento:", appointmentError);
        }
        
        // CONTINUIAMO IL PROCESSING PER SALVARE IL MESSAGGIO IN USCITA
        console.log("[ULTRAMSG-OUTBOUND] Procediamo a salvare il messaggio in uscita...");
      }
      
      console.log("[ULTRAMSG] Messaggio valido rilevato:", {
        event_type: eventType,
        from_me: isFromMe,
        from: webhookData.from,
        to: webhookData.to
      });

      // Estrai il numero di telefono del cliente (da "from" se inbound, da "to" se outbound)
      let phone = isFromMe 
        ? (webhookData.to || '') 
        : (webhookData.from || webhookData.author || webhookData.sender || '');
      console.log("[ULTRAMSG] Numero di telefono originale:", phone);
      
      // Gestisci il formato specifico di WhatsApp che aggiunge @c.us alla fine
      phone = phone.replace(/@c\.us$/i, '');
      console.log("[ULTRAMSG] Numero dopo rimozione @c.us:", phone);
      
      // Normalizza il numero di telefono (rimuovi +, spazi, e altri caratteri)
      phone = phone.replace(/^\+/, '').replace(/\s+/g, '').replace(/[-()]/g, '');
      console.log("[ULTRAMSG] Numero dopo normalizzazione:", phone);
      
      if (!phone) {
        console.warn('[ULTRAMSG] Numero di telefono mancante o non valido nel webhook');
        return null;
      }
      
      // CORREZIONE: Gestisci il caso in cui il numero del mittente corrisponde al numero dell'agente
      // In questo caso, nonostante UltraMsg indichi "fromMe=false", il messaggio è in realtà inviato dall'agente
      if (phone === agentPhoneNumber) {
        console.log("[ULTRAMSG] Il messaggio proviene dal numero dell'agente, ignoriamo");
        return null;
      }
      
      // Se il numero non inizia con il prefisso dell'Italia (39), aggiungiamolo
      // assumiamo che tutti i numeri sono italiani se non hanno prefisso
      if (!phone.startsWith('39') && phone.length === 10) {
        phone = '39' + phone;
        console.log("[ULTRAMSG] Aggiunto prefisso Italia al numero:", phone);
      }
      
      console.log("[ULTRAMSG] Numero di telefono finale per la ricerca:", phone);
      
      console.log("[ULTRAMSG] Ricerca cliente con numero di telefono normalizzato:", phone);
      
      // Cerca il cliente in base al numero di telefono
      let client = await storage.getClientByPhone(phone);
      
      // Verifica se il numero corrisponde al tuo numero di WhatsApp configurato
      // Utilizza la configurazione dal file config.ts che è già importato in cima al file
      const configuredNumber = (config.agentPhoneNumber || '').replace(/^\+/, '');
      // Normalizza il numero configurato nello stesso modo
      const normalizedConfiguredNumber = configuredNumber.replace(/\s+/g, '').replace(/[-()]/g, '');
      
      console.log(`[ULTRAMSG] Confronto numeri: ricevuto=${phone}, configurato=${normalizedConfiguredNumber}`);
      
      // Se il numero mittente è lo stesso numero configurato, non trattarlo come non registrato
      if (phone === normalizedConfiguredNumber) {
        console.log(`[ULTRAMSG] Il messaggio proviene dal numero dell'agente configurato, ma non è marcato come fromMe`);
        // In questo caso, il messaggio è probabilmente una risposta da un altro dispositivo con lo stesso numero
        // Lo trattiamo come un messaggio in uscita che è stato inviato da un altro strumento
        return null;
      }
      
      // Se il numero non è registrato, crea automaticamente un nuovo cliente
      if (!client) {
        console.log(`[ULTRAMSG] Cliente non trovato per numero ${phone}, creo automaticamente`);
        
        try {
          // Crea un nuovo cliente per questo numero
          const newClient = await storage.createClient({
            type: "buyer",
            firstName: "Cliente",
            lastName: "",
            phone: phone,
            salutation: "Gentile Cliente",
            isFriend: false,
            notes: `Cliente creato automaticamente da messaggio WhatsApp del ${new Date().toLocaleDateString('it-IT')}`
          });
          
          client = newClient;
          console.log(`[ULTRAMSG] ✅ Nuovo cliente creato automaticamente con ID: ${client.id} per numero ${phone}`);
        } catch (createError) {
          console.error("[ULTRAMSG] Errore nella creazione automatica cliente:", createError);
          return null;
        }
      }
      
      console.log("[ULTRAMSG] Cliente trovato:", `${client.id} ${client.firstName} ${client.lastName}`);

      // VERIFICA MESSAGGIO IN ARRIVO PER CONFERMA APPUNTAMENTO
      // Aggiunti pattern per gestire messaggi come "confermo la disponibilità per la visita di oggi pomeriggio alle 15:30" 
      const incomingMessageContent = webhookData.body || webhookData.text || webhookData.content || webhookData.message || '';
      
      try {
        const { isAppointmentConfirmation, extractAppointmentData, createCalendarEventFromAppointment } = await import('../services/appointmentExtractor');
        
        if (isAppointmentConfirmation(incomingMessageContent)) {
          console.log("[ULTRAMSG-APPOINTMENT-INCOMING] ✅ Rilevata conferma appuntamento nel messaggio IN ARRIVO da cliente:", client.firstName, client.lastName);
          
          const appointmentData = extractAppointmentData(incomingMessageContent, phone);
          
          if (appointmentData) {
            console.log("[ULTRAMSG-APPOINTMENT-INCOMING] ✅ Dati appuntamento estratti:", appointmentData);
            
            // Crea automaticamente l'evento in Google Calendar
            const calendarSuccess = await createCalendarEventFromAppointment(appointmentData);
            
            if (calendarSuccess) {
              console.log("[ULTRAMSG-APPOINTMENT-INCOMING] ✅ Evento creato automaticamente in Google Calendar per", appointmentData.clientName);
            } else {
              console.log("[ULTRAMSG-APPOINTMENT-INCOMING] ❌ Errore nella creazione automatica dell'evento in Calendar");
            }
          } else {
            console.log("[ULTRAMSG-APPOINTMENT-INCOMING] ❌ Impossibile estrarre i dati dell'appuntamento dal messaggio in arrivo");
          }
        } else {
          console.log("[ULTRAMSG-APPOINTMENT-INCOMING] Messaggio in arrivo non è una conferma appuntamento");
        }
      } catch (appointmentError) {
        console.error("[ULTRAMSG-APPOINTMENT-INCOMING] Errore nell'elaborazione automatica dell'appuntamento in arrivo:", appointmentError);
      }

      // CORRELAZIONE AUTOMATICA NOMI DA WHATSAPP
      // Se il cliente ha un nome generico e il messaggio contiene informazioni migliori, aggiorna il cliente
      if (client && (client.firstName === 'Cliente' || client.salutation === 'Gentile Cliente')) {
        console.log("[NAME-CORRELATION] Cliente con nome generico trovato, verifica messaggi in arrivo per informazioni migliori");
        
        const extractedInfo = this.extractNameFromMessage(incomingMessageContent);
        if (extractedInfo) {
          console.log(`[NAME-CORRELATION] ✅ Informazioni nome estratte dal messaggio: ${JSON.stringify(extractedInfo)}`);
          
          try {
            // Aggiorna il cliente con le informazioni reali
            const updatedClient = await storage.updateClient(client.id, {
              salutation: extractedInfo.salutation || client.salutation,
              firstName: extractedInfo.firstName || client.firstName, 
              lastName: extractedInfo.lastName || client.lastName,
              notes: `${client.notes || ''}\n[AGGIORNAMENTO AUTOMATICO] Nome aggiornato da messaggio WhatsApp il ${new Date().toLocaleDateString('it-IT')}: ${extractedInfo.salutation} ${extractedInfo.firstName} ${extractedInfo.lastName}`.trim()
            });
            
            client = updatedClient;
            console.log(`[NAME-CORRELATION] ✅ Cliente ${client!.id} aggiornato automaticamente: ${client!.salutation} ${client!.firstName} ${client!.lastName}`);
          } catch (updateError) {
            console.error("[NAME-CORRELATION] ❌ Errore nell'aggiornamento automatico del cliente:", updateError);
          }
        } else {
          console.log("[NAME-CORRELATION] Nessuna informazione nome formale trovata nel messaggio");
        }
      }

      // Estrai l'ID univoco del messaggio da UltraMsg
      const messageId = webhookData.data?.id || webhookData.id || webhookData.external_id;
      
      // Verifica se questo messaggio è già stato registrato (usando l'ID esterno)
      if (messageId) {
        const existingMessage = await storage.getCommunicationByExternalId(String(messageId));
        if (existingMessage) {
          console.log(`[ULTRAMSG] ⏭️ Messaggio duplicato con ID ${messageId} già esistente (evento: ${webhookData.event_type}), ignorato`);
          return existingMessage;
        }
      }

      // Estrai il contenuto del messaggio (gestisce diversi formati)
      const messageContent = webhookData.body || webhookData.text || webhookData.content || webhookData.message || '';
      console.log("[ULTRAMSG] Contenuto del messaggio:", messageContent);
      
      // Genera riassunto con AI se il messaggio è lungo
      let summary: string;
      if (messageContent.length > 100) {
        try {
          summary = await summarizeText(messageContent);
        } catch (aiError) {
          console.warn('Errore nella generazione del riassunto AI:', aiError);
          summary = messageContent.length > 50 ? `${messageContent.substring(0, 47)}...` : messageContent;
        }
      } else {
        summary = messageContent.length > 50 ? `${messageContent.substring(0, 47)}...` : messageContent;
      }

      // Trova l'ultima comunicazione in uscita per questo client per collegare questa risposta all'immobile
      const clientCommunications = await storage.getCommunicationsByClientId(client!.id);
      const lastOutboundComm = clientCommunications
        .filter((comm: any) => comm.direction === "outbound")
        .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())[0];
      
      // Se non c'è comunicazione outbound, prova a dedurre l'immobile dal contenuto
      let deducedPropertyId: number | null = null;
      if (!lastOutboundComm?.propertyId) {
        console.log(`[ULTRAMSG-CORRELATION] Nessuna comunicazione outbound trovata per cliente ${client!.id}, deduco immobile dal contenuto`);
        
        // Cerca riferimenti a indirizzi nel messaggio
        const addressPatterns = [
          /(?:via|viale|corso|piazza|largo)\s+[\w\s,]+\d+/gi,
          /\b[\w\s]+\s+\d+(?:,\s*\w+)?\b/gi // Pattern generale per indirizzi
        ];
        
        let mentionedAddresses: string[] = [];
        for (const pattern of addressPatterns) {
          const matches = messageContent.match(pattern);
          if (matches) {
            mentionedAddresses = mentionedAddresses.concat(matches);
          }
        }
        
        if (mentionedAddresses.length > 0) {
          console.log(`[ULTRAMSG-CORRELATION] Indirizzi trovati nel messaggio:`, mentionedAddresses);
          
          // Cerca immobili che contengono questi indirizzi
          const properties = await storage.getProperties();
          for (const address of mentionedAddresses) {
            const cleanAddress = address.trim().toLowerCase();
            const matchingProperty = properties.find(p => 
              p.address.toLowerCase().includes(cleanAddress) ||
              cleanAddress.includes(p.address.toLowerCase().split(',')[0].trim())
            );
            
            if (matchingProperty) {
              deducedPropertyId = matchingProperty.id;
              console.log(`[ULTRAMSG-CORRELATION] Immobile correlato: ${matchingProperty.id} - ${matchingProperty.address}`);
              break;
            }
          }
        }
        
        // Se non trova nessun indirizzo, cerca nell'ultima email immobiliare.it del cliente
        if (!deducedPropertyId) {
          console.log(`[ULTRAMSG-CORRELATION] Nessun indirizzo trovato, cerco nelle email immobiliare.it`);
          try {
            const { db } = await import('../db');
            const { immobiliareEmails } = await import('../../shared/schema');
            const { eq, desc } = await import('drizzle-orm');
            
            const emailQuery = await db
              .select()
              .from(immobiliareEmails)
              .where(eq(immobiliareEmails.clientPhone, phone))
              .orderBy(desc(immobiliareEmails.receivedAt))
              .limit(1);
              
            if (emailQuery.length > 0 && emailQuery[0].propertyId) {
              deducedPropertyId = emailQuery[0].propertyId;
              console.log(`[ULTRAMSG-CORRELATION] Immobile correlato da email: ${deducedPropertyId}`);
            }
          } catch (error) {
            console.log(`[ULTRAMSG-CORRELATION] Errore nella ricerca email:`, error);
          }
        }
      }
      
      // Prepara i dati per il database (diversi per inbound vs outbound)
      const communicationData: InsertCommunication = isFromMe ? {
        // Messaggio in USCITA (inviato dal cellulare)
        clientId: client!.id,
        type: 'whatsapp',
        subject: `Messaggio WhatsApp a ${phone}`,
        content: messageContent,
        summary,
        direction: 'outbound',
        needsFollowUp: false,
        needsResponse: false,
        status: 'completed',
        propertyId: lastOutboundComm?.propertyId || deducedPropertyId || null,
        responseToId: null,
        externalId: messageId || `outbound-${phone}-${Date.now()}`
      } : {
        // Messaggio in ENTRATA (ricevuto dal cliente)
        clientId: client!.id,
        type: 'whatsapp',
        subject: `Messaggio WhatsApp da ${phone}`,
        content: messageContent,
        summary,
        direction: 'inbound',
        needsFollowUp: true,
        needsResponse: true,
        status: 'pending',
        propertyId: lastOutboundComm?.propertyId || deducedPropertyId || null,
        responseToId: lastOutboundComm?.id || null,
        externalId: messageId || `inbound-${phone}-${Date.now()}`
      };
      
      // Salva nel database
      const communication = await storage.createCommunication(communicationData);
      
      console.log(`[ULTRAMSG] ✅ Comunicazione salvata: ID=${communication.id}, Direction=${isFromMe ? 'outbound' : 'inbound'}, Client=${client!.firstName} ${client!.lastName}`);
      
      // Verifica se l'agente virtuale è abilitato (SOLO per messaggi in entrata)
      if (!isFromMe && process.env.ENABLE_VIRTUAL_AGENT === 'true') {
        try {
          console.log(`[VIRTUAL-AGENT] Messaggio ricevuto da ${client!.firstName} ${client!.lastName}, attivazione elaborazione asincrona`);
          
          // Utilizziamo un import() dinamico per evitare dipendenze circolari
          // La risposta viene gestita in modo asincrono per non bloccare la risposta al webhook
          import('../services/virtualAgent')
            .then(module => {
              const { handleClientMessage } = module;
              return handleClientMessage(communication.id);
            })
            .then(result => {
              if (result.success) {
                console.log(`[VIRTUAL-AGENT] Risposta automatica generata e inviata con successo: ${result.message}`);
              } else {
                console.warn(`[VIRTUAL-AGENT] Impossibile generare risposta automatica: ${result.message}`);
              }
            })
            .catch(error => {
              console.error("[VIRTUAL-AGENT] Errore nell'elaborazione della risposta automatica:", error);
            });
        } catch (error) {
          console.error("[VIRTUAL-AGENT] Errore generale nell'attivazione dell'agente virtuale:", error);
          // Non interrompiamo il flusso in caso di errore dell'agente virtuale
        }
      }
      
      return communication;
    } catch (error) {
      console.error('Errore nel processare il webhook in arrivo:', error);
      return null;
    }
  }
}

// Crea un'istanza singleton del client
let ultraMsgClient: UltraMsgClient | null = null;

export function getUltraMsgClient(): UltraMsgClient {
  if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_API_KEY) {
    throw new Error('ULTRAMSG_INSTANCE_ID o ULTRAMSG_API_KEY non impostati nelle variabili d\'ambiente');
  }
  
  if (!ultraMsgClient) {
    ultraMsgClient = new UltraMsgClient(process.env.ULTRAMSG_INSTANCE_ID, process.env.ULTRAMSG_API_KEY);
  }
  
  return ultraMsgClient;
}

/**
 * Funzione semplificata per inviare messaggi WhatsApp tramite mail merge
 * @param phoneNumber Numero di telefono del destinatario
 * @param message Testo del messaggio
 * @returns Risultato dell'invio con informazioni di successo/errore
 */
export async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<{
  success: boolean;
  data?: { id: string };
  error?: string;
}> {
  try {
    console.log(`[MAIL MERGE WHATSAPP] Invio messaggio a ${phoneNumber}`);
    
    const client = getUltraMsgClient();
    const response = await client.sendMessage(phoneNumber, message);
    
    if (response.sent) {
      console.log(`[MAIL MERGE WHATSAPP] ✅ Messaggio inviato con successo: ID ${response.id}`);
      return {
        success: true,
        data: { id: response.id || "" }
      };
    } else {
      console.error(`[MAIL MERGE WHATSAPP] ❌ Errore nell'invio: ${response.error || response.message}`);
      return {
        success: false,
        error: response.error || response.message || 'Errore sconosciuto'
      };
    }
  } catch (error) {
    console.error(`[MAIL MERGE WHATSAPP] ❌ Errore durante l'invio del messaggio:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante l\'invio del messaggio'
    };
  }
}

/**
 * Messaggi personalizzati per la notifica di match immobili
 * 
 * Ogni messaggio può includere questi placeholder che verranno sostituiti con i dati reali:
 * - {clientName}: Nome del cliente
 * - {clientFullName}: Nome e cognome del cliente
 * - {clientSalutation}: Titolo/saluto del cliente (es. Dott., Sig., ecc)
 * - {propertyAddress}: Indirizzo dell'immobile
 * - {propertyCity}: Città dell'immobile
 * - {propertySize}: Dimensione in mq
 * - {propertyBedrooms}: Numero di locali
 * - {propertyBathrooms}: Numero di bagni
 * - {propertyPrice}: Prezzo formattato con la valuta
 * - {propertyUrl}: URL per visualizzare l'immobile nell'applicazione
 */
export const PROPERTY_MATCH_MESSAGES = {
  // Messaggi per clienti amici (informali con 'tu')
  FRIEND: [
    `Ciao {clientName}!

Buone notizie! Ho trovato un immobile che potrebbe piacerti molto, in base a quello che stavamo cercando.

*Ecco i dettagli:*
📍 *Indirizzo:* {propertyAddress}, {propertyCity}
🏠 *Dimensione:* {propertySize} mq
{propertyBedrooms?🛏️ *Locali:* {propertyBedrooms}\n}{propertyBathrooms?🚿 *Bagni:* {propertyBathrooms}\n}💰 *Prezzo:* {propertyPrice}

Puoi vedere i dettagli completi qui: {propertyUrl}

Cosa ne pensi? Vuoi che organizziamo un appuntamento per vederlo insieme?

Fammi sapere quando sei disponibile!`,
    
    `Hey {clientName}!

Ho appena trovato un immobile che potrebbe essere perfetto per te! 

*Dai un'occhiata:*
📍 {propertyAddress}, {propertyCity}
🏠 {propertySize} mq
{propertyBedrooms?🛏️ {propertyBedrooms} locali\n}{propertyBathrooms?🚿 {propertyBathrooms} bagni\n}💰 {propertyPrice}

Vedi tutti i dettagli: {propertyUrl}

Ti interessa? Potremmo organizzare una visita nei prossimi giorni.

A presto!`,
    
    `Ciao {clientName},

Mi sono appena imbattuto in questo immobile che corrisponde a ciò che stavi cercando!

*Dettagli veloci:*
📍 {propertyAddress}, {propertyCity}
🏠 {propertySize} mq
{propertyBedrooms?🛏️ {propertyBedrooms} locali\n}💰 {propertyPrice}

Per vedere tutte le foto e le informazioni: {propertyUrl}

Se sei interessato, fammi un fischio e organizziamo subito una visita!

Buona giornata!`
  ],
  
  // Messaggi per clienti formali (con 'Lei')
  FORMAL: [
    `Gentile {clientSalutation} {clientName},

Abbiamo individuato un immobile che corrisponde ai requisiti da Lei specificati.

*Dettagli dell'immobile:*
📍 *Indirizzo:* {propertyAddress}, {propertyCity}
🏠 *Dimensione:* {propertySize} mq
{propertyBedrooms?🛏️ *Locali:* {propertyBedrooms}\n}{propertyBathrooms?🚿 *Bagni:* {propertyBathrooms}\n}💰 *Prezzo:* {propertyPrice}

Può visualizzare maggiori dettagli a questo link: {propertyUrl}

Per ulteriori informazioni o per fissare un appuntamento, La invito a contattarci.

Cordiali saluti,
Il Suo consulente immobiliare`,
    
    `Egregio {clientSalutation} {clientName},

Le segnaliamo una nuova opportunità immobiliare che si allinea con i criteri di ricerca da Lei indicati.

*Specifiche dell'immobile:*
📍 *Ubicazione:* {propertyAddress}, {propertyCity}
🏠 *Superficie:* {propertySize} mq
{propertyBedrooms?🛏️ *Stanze:* {propertyBedrooms}\n}{propertyBathrooms?🚿 *Servizi:* {propertyBathrooms}\n}💰 *Prezzo:* {propertyPrice}

Per maggiori dettagli: {propertyUrl}

Restiamo a Sua disposizione per organizzare una visita o fornire maggiori informazioni.

Distinti saluti,
Il Suo agente immobiliare`,
    
    `Gentile {clientSalutation} {clientFullName},

Abbiamo il piacere di segnalarLe un immobile che potrebbe soddisfare le Sue esigenze abitative.

*Caratteristiche principali:*
📍 {propertyAddress}, {propertyCity}
🏠 {propertySize} mq
{propertyBedrooms?🛏️ {propertyBedrooms} locali\n}💰 {propertyPrice}

Per visualizzare l'immobile sul nostro portale: {propertyUrl}

Qualora fosse interessato, saremo lieti di fornirLe ulteriori informazioni e di accompagnarLa in un sopralluogo.

Con i migliori saluti,
La Sua agenzia immobiliare`
  ]
};

/**
 * Genera l'URL di visualizzazione per un immobile
 * @param propertyId ID dell'immobile
 * @returns URL per visualizzare l'immobile sulla piattaforma
 */
function generatePropertyUrl(propertyId: number): string {
  // Utilizza l'URL del server Replit
  // Otteniamo l'URL dalla richiesta o dall'ambiente
  const baseUrl = process.env.REPLIT_SLUG 
    ? `https://${process.env.REPLIT_SLUG}.replit.app` 
    : (process.env.BASE_URL || 'http://localhost:5000');
  
  return `${baseUrl}/properties/${propertyId}`;
}

/**
 * Compila un modello di messaggio con i dati del cliente e dell'immobile
 * @param template Modello di messaggio con placeholder
 * @param client Cliente destinatario
 * @param property Immobile da notificare
 * @returns Messaggio compilato
 */
function compileMessageTemplate(template: string, client: Client, property: Property): string {
  const propertyUrl = generatePropertyUrl(property.id);
  
  // Sostituzione dei placeholder relativi al cliente
  let message = template
    .replace(/\{clientName\}/g, client.firstName || '')
    .replace(/\{clientFullName\}/g, `${client.firstName || ''} ${client.lastName || ''}`.trim())
    .replace(/\{clientSalutation\}/g, client.salutation || '');
  
  // Sostituzione dei placeholder relativi all'immobile
  message = message
    .replace(/\{propertyAddress\}/g, property.address || '')
    .replace(/\{propertyCity\}/g, property.city || '')
    .replace(/\{propertyPrice\}/g, property.price ? `€${property.price.toLocaleString()}` : '')
    .replace(/\{propertyUrl\}/g, propertyUrl);
  
  // Gestione di tutti i campi, inclusi quelli opzionali
  message = message
    .replace(/\{propertySize\}/g, property.size?.toString() || '');
    
  // Gestione del numero di locali (bedrooms)
  if (property.bedrooms) {
    // Prima risolviamo i blocchi condizionali
    message = message.replace(/\{propertyBedrooms\?([^}]*)\}/g, (match, p1) => {
      return p1.replace(/\{propertyBedrooms\}/g, property.bedrooms?.toString() || '');
    });
    
    // Poi sostituiamo i placeholder normali
    message = message.replace(/\{propertyBedrooms\}/g, property.bedrooms.toString());
  } else {
    // Se il campo non è presente, rimuoviamo l'intero blocco condizionale
    message = message.replace(/\{propertyBedrooms\?[^}]*\}/g, '');
  }
  
  // Gestione del numero di bagni (bathrooms)
  if (property.bathrooms) {
    // Prima risolviamo i blocchi condizionali
    message = message.replace(/\{propertyBathrooms\?([^}]*)\}/g, (match, p1) => {
      return p1.replace(/\{propertyBathrooms\}/g, property.bathrooms?.toString() || '');
    });
    
    // Poi sostituiamo i placeholder normali
    message = message.replace(/\{propertyBathrooms\}/g, property.bathrooms.toString());
  } else {
    // Se il campo non è presente, rimuoviamo l'intero blocco condizionale
    message = message.replace(/\{propertyBathrooms\?[^}]*\}/g, '');
  }
  
  // Pulizia finale - rimuovi eventuali parentesi graffe spurie o altri caratteri non voluti
  message = message
    .replace(/\}\n\}/g, '\n')
    .replace(/\}\}/g, '')
    .replace(/\{\{/g, '')
    .replace(/\}\s*\n\s*\}/g, '\n');
  
  return message;
}

/**
 * Invia una notifica WhatsApp a un cliente quando viene trovato un immobile che corrisponde alle sue preferenze
 * @param client Il cliente a cui inviare la notifica
 * @param property L'immobile che corrisponde alle preferenze del cliente
 * @returns La comunicazione creata
 */
export async function sendPropertyMatchNotification(client: Client, property: Property): Promise<Communication | null> {
  try {
    // Verifica che il cliente abbia un numero di telefono
    if (!client.phone) {
      console.warn(`Impossibile inviare notifica WhatsApp: cliente ${client.id} non ha un numero di telefono`);
      return null;
    }
    
    console.log(`[MATCH NOTIFY] Invio notifica per immobile ${property.id} al cliente ${client.id} (${client.phone})`);
    
    // Determina se usare messaggi formali o informali in base al campo isFriend
    const messageType = client.isFriend ? 'FRIEND' : 'FORMAL';
    
    // Seleziona un messaggio casuale dalla lista appropriata
    const messages = PROPERTY_MATCH_MESSAGES[messageType];
    const randomIndex = Math.floor(Math.random() * messages.length);
    const messageTemplate = messages[randomIndex];
    
    // Compila il messaggio con i dati del cliente e dell'immobile
    const message = compileMessageTemplate(messageTemplate, client, property);

    // Utilizza l'istanza UltraMsg per inviare il messaggio e salvarlo nel database
    const ultraMsg = getUltraMsgClient();
    const communication = await ultraMsg.sendAndStoreCommunication(client.id, client.phone, message);
    
    if (!communication) {
      console.error(`[MATCH NOTIFY] Errore: Comunicazione non creata per il cliente ${client.id}`);
      return null;
    }
    
    console.log(`[MATCH NOTIFY] Notifica inviata con successo, comunicazione ${communication.id} creata`);
    
    // Aggiorna la comunicazione per collegare l'immobile
    const updatedCommunication = await storage.updateCommunication(communication.id, {
      propertyId: property.id,
      type: 'whatsapp',
      subject: 'Notifica immobile corrispondente',
      status: 'completed',
      needsFollowUp: true
    });
    
    return updatedCommunication || communication;
  } catch (error) {
    console.error('Errore nell\'invio della notifica di corrispondenza immobile:', error);
    return null;
  }
}