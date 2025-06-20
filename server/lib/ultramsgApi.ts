import axios from 'axios';
import { getUltraMsgClient } from './ultramsg';
import { storage } from '../storage';
import { config } from '../config';

/**
 * Invia un messaggio WhatsApp attraverso UltraMsg
 * @param phoneNumber Numero di telefono del destinatario
 * @param message Testo del messaggio da inviare
 * @returns Risultato dell'invio
 */
export async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<{success: boolean, messageId?: string, error?: string}> {
  try {
    const ultraMsgClient = getUltraMsgClient();
    const response = await ultraMsgClient.sendMessage(phoneNumber, message);
    
    if (response && response.sent) {
      return {
        success: true,
        messageId: response.id || undefined
      };
    } else {
      return {
        success: false,
        error: response.error || 'Errore sconosciuto nell\'invio del messaggio'
      };
    }
  } catch (error: any) {
    console.error('Errore nell\'invio del messaggio WhatsApp:', error);
    return {
      success: false,
      error: error.message || 'Errore durante l\'invio del messaggio WhatsApp'
    };
  }
}

interface UltraMsgApiMessage {
  id: string;
  body: string;
  type: string;
  from: string;
  to: string;
  author: string;
  time: number;
  chatId: string;
  isForwarded: boolean;
  fromMe: boolean;
}

export async function fetchRecentWhatsAppMessages(): Promise<{
  success: boolean;
  processedCount: number;
  ignoredCount: number;
  errorCount: number;
  messages: any[];
}> {
  try {
    const apiUrl = `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/chats`;
    
    // Recupera l'elenco delle chat recenti
    const chatsResponse = await axios.get(apiUrl, {
      params: {
        token: process.env.ULTRAMSG_API_KEY,
        page: 1,
        limit: 20 // Limita a 20 chat recenti
      }
    });
    
    // Recupera tutti i messaggi recenti senza filtro per chat
    const allMessagesUrl = `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages`;
    console.log(`[ULTRAMSG DEBUG] Esecuzione polling all'URL: ${allMessagesUrl}`);
    console.log(`[ULTRAMSG DEBUG] Instance ID: ${process.env.ULTRAMSG_INSTANCE_ID}`);
    console.log(`[ULTRAMSG DEBUG] API Key presente: ${process.env.ULTRAMSG_API_KEY ? 'Sì' : 'No'}`);
    
    // Test del sistema di polling - approccio alternativo
    // Usa un timestamp recente per recuperare solo i messaggi nuovi
    // ma abbastanza indietro da catturare messaggi che potrebbero essere stati persi
    const currentTime = Math.floor(Date.now() / 1000);
    // Imposta un intervallo di 15 minuti indietro per catturare tutti i messaggi recenti
    const fifteenMinutesAgo = currentTime - 900; 
    const lastPollTime = fifteenMinutesAgo;
    
    console.log(`[ULTRAMSG DEBUG] Polling WhatsApp eseguito alle ${new Date().toISOString()}`);
    console.log(`[ULTRAMSG DEBUG] Recupero messaggi dagli ultimi 15 minuti: ${new Date(fifteenMinutesAgo * 1000).toISOString()}`);
    
    const allMessagesResponse = await axios.get(allMessagesUrl, {
      params: {
        token: process.env.ULTRAMSG_API_KEY,
        limit: 50,
        order: "desc",
        // Se abbiamo un timestamp precedente, filtra per messaggi più recenti
        ...(lastPollTime > 0 ? { min_time: lastPollTime } : {})
      }
    });
    
    console.log(`[ULTRAMSG DEBUG] Messaggio più recente: ${
      allMessagesResponse.data.messages && allMessagesResponse.data.messages.length > 0 
      ? JSON.stringify(allMessagesResponse.data.messages[0]) 
      : 'Nessun messaggio trovato'
    }`);
    console.log(`[ULTRAMSG DEBUG] Numero totale messaggi recuperati: ${
      allMessagesResponse.data.messages ? allMessagesResponse.data.messages.length : 0
    }`);
    
    // Log originale mantenuto per compatibilità
    console.log("Risposta API messaggi recenti:", JSON.stringify(allMessagesResponse.data));
    
    const chatIds = chatsResponse.data.map((chat: any) => chat.id);
    console.log(`Trovate ${chatIds.length} chat recenti`);
    
    // Statistiche dei messaggi elaborati
    let processedCount = 0;
    let ignoredCount = 0;
    let errorCount = 0;
    const processedMessages: any[] = [];
    
    // Prima elaboriamo tutti i messaggi recenti
    if (allMessagesResponse.data && allMessagesResponse.data.messages) {
      const allMessages = allMessagesResponse.data.messages;
      console.log(`Verifica ${allMessages.length} messaggi recenti (approccio globale)...`);
      
      for (const message of allMessages) {
        // Per i messaggi in uscita, verifica se sono conferme appuntamento prima di ignorarli
        if (message.fromMe === true) {
          console.log(`[APPOINTMENT-CHECK] Verifica messaggio in uscita per conferma appuntamento: ${message.body.substring(0, 30)}...`);
          
          try {
            const { isAppointmentConfirmation, extractAppointmentData, createCalendarEventFromAppointment } = await import('../services/appointmentExtractor');
            
            if (isAppointmentConfirmation(message.body)) {
              console.log(`[APPOINTMENT-AUTO] ✅ Rilevata conferma appuntamento nel messaggio in uscita`);
              
              // Controlla se abbiamo già processato questo messaggio per evitare duplicati
              const messageId = message.id || `${message.from}:${message.time}`;
              const existingMessage = await storage.getCommunicationByExternalId(messageId);
              
              if (!existingMessage) {
                // Estrai il numero del destinatario per l'appuntamento
                const recipientPhone = message.to.replace(/@c\.us$/, '').replace(/^\+/, '').replace(/\s+/g, '').replace(/[-()]/g, '');
                
                const appointmentData = extractAppointmentData(message.body, recipientPhone);
                
                if (appointmentData) {
                  console.log(`[APPOINTMENT-AUTO] ✅ Dati appuntamento estratti:`, appointmentData);
                  
                  // Crea automaticamente l'evento in Google Calendar
                  const calendarSuccess = await createCalendarEventFromAppointment(appointmentData);
                  
                  if (calendarSuccess) {
                    console.log(`[APPOINTMENT-AUTO] ✅ Evento creato automaticamente in Google Calendar per ${appointmentData.clientName}`);
                  } else {
                    console.log(`[APPOINTMENT-AUTO] ❌ Errore nella creazione automatica dell'evento in Calendar`);
                  }
                } else {
                  console.log(`[APPOINTMENT-AUTO] ❌ Impossibile estrarre i dati dell'appuntamento dal messaggio`);
                }
              } else {
                console.log(`[APPOINTMENT-AUTO] Messaggio già processato, salto estrazione appuntamento`);
              }
            }
          } catch (appointmentError) {
            console.error(`[APPOINTMENT-AUTO] Errore nell'elaborazione automatica dell'appuntamento:`, appointmentError);
          }
          
          // Dopo aver verificato l'appuntamento, ignora il messaggio in uscita per il normale processing
          console.log(`Ignora messaggio in uscita dopo verifica appuntamento: ${message.body.substring(0, 20)}...`);
          ignoredCount++;
          continue;
        }
        
        // Tutti i messaggi in entrata potrebbero essere risposte che dobbiamo elaborare
        // Non filtriamo più per un numero specifico, ma solo per la direzione (inbound/outbound)
        // in base al flag fromMe che è l'indicatore affidabile
        console.log(`⚠️ Elaborazione messaggio in entrata da ${message.from}, fromMe=${message.fromMe}: ${message.body.substring(0, 20)}...`);
        
        console.log(`Trovato messaggio potenziale: da ${message.from}, a ${message.to}, corpo: ${message.body.substring(0, 20)}...`);
        
        // Controlla se abbiamo già questo messaggio nel database
        // Genera un ID univoco per questo messaggio
        const messageId = message.id || `${message.from}:${message.time}`;
        console.log(`[ULTRAMSG] Verifica esistenza messaggio con ID esterno: ${messageId}`);
        const existingMessage = await storage.getCommunicationByExternalId(messageId);
        
        if (existingMessage) {
          console.log(`[ULTRAMSG] Messaggio ${messageId} già presente nel database con ID: ${existingMessage.id}`);
          ignoredCount++;
          continue;
        }
        
        // Log extra per diagnosi problemi di numeri di telefono
        console.log(`[ULTRAMSG] Diagnosi formato numeri di telefono:`);
        // Normalizza il numero di telefono del mittente (rimuovi @c.us e altri formati speciali)
        let fromPhone = message.from.replace(/@c\.us$/i, '').replace(/^\+/, '').replace(/\s+/g, '').replace(/[-()]/g, '');
        console.log(`[ULTRAMSG] Numero mittente normalizzato: ${fromPhone}`);
        let clientTest = await storage.getClientByPhone(fromPhone);
        if (clientTest) {
          console.log(`[ULTRAMSG] ✅ SUCCESSO! Cliente trovato con numero normalizzato: ${clientTest.id}, ${clientTest.firstName} ${clientTest.lastName}`);
        } else {
          console.log(`[ULTRAMSG] ❌ ERRORE: Nessun cliente trovato con numero normalizzato: ${fromPhone}`);
        }
        
        // Utilizza la configurazione dell'agente importata all'inizio del file
        const agentNumber = (config.agentPhoneNumber || '').replace(/^\+/, '').replace(/\s+/g, '').replace(/[-()]/g, '');
        
        // Determina la direzione corretta del messaggio
        // Se il messaggio proviene dal numero dell'agente o ha come destinatario un numero diverso
        // dall'agente, allora è un messaggio in uscita (from_me = true)
        let isFromMe = false;
        
        // Normalizza i numeri per il confronto
        const normalizedFrom = message.from.replace(/@c\.us$/, '');
        const normalizedTo = message.to.replace(/@c\.us$/, '');
        
        // Verifica se il messaggio proviene effettivamente dal numero dell'agente
        if (normalizedFrom.includes(agentNumber)) {
            isFromMe = true;
            console.log(`[ULTRAMSG] Messaggio dal numero dell'agente ${normalizedFrom} identificato come in uscita`);
        }
        
        console.log(`[ULTRAMSG] Analisi direzione: from=${normalizedFrom}, agentNumber=${agentNumber}, isFromMe=${isFromMe}`);
        
        // Normalizza i dati del messaggio per il processore di webhook
        const webhookData = {
          event_type: "message",
          from_me: isFromMe,
          from: message.from,
          to: message.to,
          body: message.body,
          media_url: "",
          mime_type: message.type === "chat" ? "text/plain" : message.type,
          external_id: messageId
        };
        
        // Usa il processore di webhook esistente
        const ultraMsgClient = getUltraMsgClient();
        const communication = await ultraMsgClient.processIncomingWebhook(webhookData);
        
        if (communication) {
          processedMessages.push({
            id: communication.id,
            from: message.from,
            body: message.body,
            created_at: communication.createdAt
          });
          processedCount++;
          console.log(`✅ Elaborato nuovo messaggio da ${message.from}: ${message.body.substring(0, 30)}...`);
          
          // Se è un messaggio in uscita, verifica se è una conferma appuntamento
          if (isFromMe) {
            console.log(`[APPOINTMENT-AUTO] Analizzando messaggio in uscita per conferma appuntamento...`);
            
            try {
              const { extractAppointmentData, createCalendarEventFromAppointment, isAppointmentConfirmation } = await import('../services/appointmentExtractor');
              
              if (isAppointmentConfirmation(message.body)) {
                console.log(`[APPOINTMENT-AUTO] ✅ Rilevata conferma appuntamento nel messaggio`);
                
                // Estrai il numero del destinatario per l'appuntamento
                const recipientPhone = normalizedTo.replace(/^\+/, '').replace(/\s+/g, '').replace(/[-()]/g, '');
                
                const appointmentData = extractAppointmentData(message.body, recipientPhone);
                
                if (appointmentData) {
                  console.log(`[APPOINTMENT-AUTO] ✅ Dati appuntamento estratti:`, appointmentData);
                  
                  // Crea automaticamente l'evento in Google Calendar
                  const calendarSuccess = await createCalendarEventFromAppointment(appointmentData);
                  
                  if (calendarSuccess) {
                    console.log(`[APPOINTMENT-AUTO] ✅ Evento creato automaticamente in Google Calendar`);
                  } else {
                    console.log(`[APPOINTMENT-AUTO] ❌ Errore nella creazione automatica dell'evento in Calendar`);
                  }
                } else {
                  console.log(`[APPOINTMENT-AUTO] ❌ Impossibile estrarre i dati dell'appuntamento dal messaggio`);
                }
              } else {
                console.log(`[APPOINTMENT-AUTO] Messaggio non è una conferma appuntamento`);
              }
            } catch (appointmentError) {
              console.error(`[APPOINTMENT-AUTO] Errore nell'elaborazione automatica dell'appuntamento:`, appointmentError);
            }
          }
        } else {
          errorCount++;
          console.error(`❌ Errore nell'elaborazione del messaggio da ${message.from}`);
        }
      }
    }
    
    // Poi elaboriamo le chat singole come backup
    for (const chatId of chatIds) {
      try {
        // Recupera i messaggi recenti di questa chat
        const messagesUrl = `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages`;
        const messagesResponse = await axios.get(messagesUrl, {
          params: {
            token: process.env.ULTRAMSG_API_KEY,
            chatId,
            limit: 10, // Ultimi 10 messaggi per chat
            order: "desc" // Più recenti prima
          }
        });
        
        const messages = Array.isArray(messagesResponse.data) ? messagesResponse.data : [];
        
        // Elabora ogni messaggio
        for (const message of messages) {
          // Ignora i messaggi inviati da noi
          if (message.fromMe === true) {
            console.log(`Ignora messaggio in uscita [chat ${chatId}]: ${message.body?.substring(0, 20) || '(no body)'}...`);
            ignoredCount++;
            continue;
          }
          
          // Log più dettagliato per la diagnosi
          console.log(`Messaggio in entrata [chat ${chatId}]: ${message.from}, corpo: ${message.body?.substring(0, 20) || '(no body)'}...`);
          
          // Controlla se abbiamo già questo messaggio nel database
          const messageId = message.id || `${message.from}:${message.time}`;
          console.log(`[ULTRAMSG] Verifica esistenza messaggio con ID esterno: ${messageId}`);
          const existingMessage = await storage.getCommunicationByExternalId(messageId);
          
          if (existingMessage) {
            console.log(`[ULTRAMSG] Messaggio ${messageId} già presente nel database con ID: ${existingMessage.id}`);
            ignoredCount++;
            continue;
          }
          
          // Normalizza i dati del messaggio per il processore di webhook
          const webhookData = {
            event_type: "message",
            from_me: false,
            from: message.from,
            to: message.to,
            body: message.body,
            media_url: "",
            mime_type: message.type === "chat" ? "text/plain" : message.type,
            external_id: messageId
          };
          console.log(`[ULTRAMSG] Impostato external_id: ${messageId} per il messaggio`);
          
          
          // Usa il processore di webhook esistente
          const ultraMsgClient = getUltraMsgClient();
          const communication = await ultraMsgClient.processIncomingWebhook(webhookData);
          
          if (communication) {
            processedMessages.push({
              id: communication.id,
              from: message.from,
              body: message.body,
              created_at: communication.createdAt
            });
            processedCount++;
            
            // Se è un messaggio in uscita, verifica se è una conferma appuntamento
            if (message.fromMe === true) {
              console.log(`[APPOINTMENT-AUTO] Analizzando messaggio in uscita per conferma appuntamento...`);
              
              try {
                const { extractAppointmentData, createCalendarEventFromAppointment, isAppointmentConfirmation } = await import('../services/appointmentExtractor');
                
                if (isAppointmentConfirmation(message.body)) {
                  console.log(`[APPOINTMENT-AUTO] ✅ Rilevata conferma appuntamento nel messaggio`);
                  
                  // Estrai il numero del destinatario per l'appuntamento
                  const recipientPhone = message.to.replace(/@c\.us$/, '').replace(/^\+/, '').replace(/\s+/g, '').replace(/[-()]/g, '');
                  
                  const appointmentData = extractAppointmentData(message.body, recipientPhone);
                  
                  if (appointmentData) {
                    console.log(`[APPOINTMENT-AUTO] ✅ Dati appuntamento estratti:`, appointmentData);
                    
                    // Crea automaticamente l'evento in Google Calendar
                    const calendarSuccess = await createCalendarEventFromAppointment(appointmentData);
                    
                    if (calendarSuccess) {
                      console.log(`[APPOINTMENT-AUTO] ✅ Evento creato automaticamente in Google Calendar`);
                    } else {
                      console.log(`[APPOINTMENT-AUTO] ❌ Errore nella creazione automatica dell'evento in Calendar`);
                    }
                  } else {
                    console.log(`[APPOINTMENT-AUTO] ❌ Impossibile estrarre i dati dell'appuntamento dal messaggio`);
                  }
                } else {
                  console.log(`[APPOINTMENT-AUTO] Messaggio non è una conferma appuntamento`);
                }
              } catch (appointmentError) {
                console.error(`[APPOINTMENT-AUTO] Errore nell'elaborazione automatica dell'appuntamento:`, appointmentError);
              }
            }
          } else {
            errorCount++;
          }
        }
      } catch (chatError) {
        console.error(`Errore nell'elaborazione della chat ${chatId}:`, chatError);
        errorCount++;
      }
    }
    
    return {
      success: true,
      processedCount,
      ignoredCount,
      errorCount,
      messages: processedMessages
    };
  } catch (error) {
    console.error("Errore nel recupero dei messaggi WhatsApp:", error);
    throw error;
  }
}