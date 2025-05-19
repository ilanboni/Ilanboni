import axios from 'axios';
import { Communication, InsertCommunication, Client, Property } from '@shared/schema';
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
      console.log("[ULTRAMSG] Elaborazione webhook:", JSON.stringify(webhookData, null, 2));
      
      // Gestisce diversi formati di webhook
      const isFromMe = webhookData.from_me === true || webhookData.fromMe === true;
      const eventType = webhookData.event_type || webhookData.type || 'message';
      
      // Verifica che sia un messaggio in arrivo e non un messaggio inviato da noi
      if ((eventType !== 'message' && eventType !== 'chat') || isFromMe) {
        console.log("[ULTRAMSG] Webhook ignorato: non è un messaggio in arrivo o è stato inviato da noi", {
          event_type: eventType,
          from_me: isFromMe
        });
        return null;
      }
      
      console.log("[ULTRAMSG] Messaggio in arrivo valido rilevato:", {
        event_type: eventType,
        from_me: isFromMe,
        from: webhookData.from
      });

      // Estrai il numero di telefono (gestisce diversi formati)
      let phone = webhookData.from || webhookData.author || webhookData.sender || '';
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
      
      // Se il numero non inizia con il prefisso dell'Italia (39), aggiungiamolo
      // assumiamo che tutti i numeri sono italiani se non hanno prefisso
      if (!phone.startsWith('39') && phone.length === 10) {
        phone = '39' + phone;
        console.log("[ULTRAMSG] Aggiunto prefisso Italia al numero:", phone);
      }
      
      console.log("[ULTRAMSG] Numero di telefono finale per la ricerca:", phone);
      
      console.log("[ULTRAMSG] Ricerca cliente con numero di telefono normalizzato:", phone);
      
      // Cerca il cliente in base al numero di telefono
      const client = await storage.getClientByPhone(phone);
      if (!client) {
        console.warn(`[ULTRAMSG] Messaggio da numero non registrato: ${phone}`);
        return null;
      }
      
      console.log("[ULTRAMSG] Cliente trovato:", client.id, client.firstName, client.lastName);

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
      const clientCommunications = await storage.getCommunicationsByClientId(client.id);
      const lastOutboundComm = clientCommunications
        .filter(comm => comm.direction === "outbound")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      // Prepara i dati per il database
      const communicationData: InsertCommunication = {
        clientId: client.id,
        type: 'whatsapp',
        subject: 'Messaggio WhatsApp ricevuto',
        content: messageContent,
        summary,
        direction: 'inbound',
        needsFollowUp: true,
        status: 'pending',
        // Collega alla proprietà dell'ultimo messaggio inviato se presente
        propertyId: lastOutboundComm?.propertyId || null,
        // Registra quale messaggio sta rispondendo
        responseToId: lastOutboundComm?.id || null
      };
      
      // Salva nel database
      const communication = await storage.createCommunication(communicationData);
      
      // Verifica se l'agente virtuale è abilitato
      if (process.env.ENABLE_VIRTUAL_AGENT === 'true') {
        try {
          console.log(`[VIRTUAL-AGENT] Messaggio ricevuto da ${client.firstName} ${client.lastName}, attivazione elaborazione asincrona`);
          
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
      type: 'property_match',
      subject: 'Notifica immobile corrispondente',
      status: 'completed',
      needsFollowUp: true,
      followUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 2 giorni dopo
    });
    
    return updatedCommunication || communication;
  } catch (error) {
    console.error('Errore nell\'invio della notifica di corrispondenza immobile:', error);
    return null;
  }
}