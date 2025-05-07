import axios from 'axios';
import { Communication, InsertCommunication } from '@shared/schema';
import { storage } from '../storage';
import { summarizeText } from './openai';

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
   * Invia un messaggio WhatsApp tramite UltraMsg
   * @param phoneNumber Numero di telefono del destinatario (formato internazionale con o senza +)
   * @param message Testo del messaggio
   * @param priority Priorità del messaggio (opzionale, 0-10)
   * @returns Response from UltraMsg API
   */
  async sendMessage(phoneNumber: string, message: string, priority?: number): Promise<UltraMsgMessageResponse> {
    try {
      // Formatta il numero di telefono (rimuovi eventuali + iniziali)
      const formattedPhone = phoneNumber.replace(/^\+/, '');
      
      // Prepara il payload
      const payload: UltraMsgMessage = {
        to: formattedPhone,
        body: message,
      };
      
      // Se è specificata una priorità, aggiungila
      if (priority !== undefined && priority >= 0 && priority <= 10) {
        payload.priority = priority;
      }

      // Effettua la chiamata API
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([key, value]) => {
        params.append(key, String(value));
      });

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

      return response.data;
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
  async sendAndStoreCommunication(clientId: number, phone: string, message: string): Promise<Communication> {
    try {
      // Invia messaggio tramite UltraMsg
      const ultraMsgResponse = await this.sendMessage(phone, message);
      
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
      
      // Prepara i dati per il database
      const communicationData: InsertCommunication = {
        clientId,
        type: 'whatsapp',
        subject: 'Messaggio WhatsApp',
        content: message,
        summary,
        direction: 'outbound',
        needsFollowUp: false,
        status: 'completed'
      };
      
      // Salva nel database
      const communication = await storage.createCommunication(communicationData);
      
      return communication;
    } catch (error) {
      console.error('Errore nell\'invio e registrazione del messaggio WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Processa un webhook in arrivo da UltraMsg
   * @param webhookData Dati del webhook
   * @returns La comunicazione creata
   */
  async processIncomingWebhook(webhookData: any): Promise<Communication | null> {
    try {
      // Verifica che sia un messaggio in arrivo e non un messaggio inviato da noi
      if (webhookData.event_type !== 'message' || webhookData.from_me) {
        return null;
      }

      // Estrai il numero di telefono
      const phone = webhookData.from?.replace(/^\+/, '');
      if (!phone) {
        console.warn('Numero di telefono mancante nel webhook');
        return null;
      }
      
      // Cerca il cliente in base al numero di telefono
      const client = await storage.getClientByPhone(phone);
      if (!client) {
        console.warn(`Ricevuto messaggio da numero non registrato: ${phone}`);
        return null;
      }

      // Estrai il contenuto del messaggio
      const messageContent = webhookData.body || '';
      
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

      // Prepara i dati per il database
      const communicationData: InsertCommunication = {
        clientId: client.id,
        type: 'whatsapp',
        subject: 'Messaggio WhatsApp ricevuto',
        content: messageContent,
        summary,
        direction: 'inbound',
        needsFollowUp: true,
        status: 'pending'
      };
      
      // Salva nel database
      const communication = await storage.createCommunication(communicationData);
      
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