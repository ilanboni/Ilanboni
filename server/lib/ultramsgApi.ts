import axios from 'axios';
import { getUltraMsgClient } from './ultramsg';
import { storage } from '../storage';

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
    
    const allMessagesResponse = await axios.get(allMessagesUrl, {
      params: {
        token: process.env.ULTRAMSG_API_KEY,
        limit: 50,
        order: "desc"
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
        // Ignora i messaggi inviati da noi
        if (message.from === "390235981509@c.us" || message.from === process.env.ULTRAMSG_PHONE_NUMBER) {
          console.log(`Ignora messaggio in uscita: ${message.body.substring(0, 20)}...`);
          ignoredCount++;
          continue;
        }
        
        console.log(`Trovato messaggio potenziale: da ${message.from}, a ${message.to}, corpo: ${message.body.substring(0, 20)}...`);
        
        // Controlla se abbiamo già questo messaggio nel database
        const messageId = message.id || `${message.from}:${message.created_at}`;
        const existingMessage = await storage.getCommunicationByExternalId(messageId);
        
        if (existingMessage) {
          console.log(`Messaggio ${messageId} già presente nel database`);
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
          if (message.fromMe) {
            ignoredCount++;
            continue;
          }
          
          // Controlla se abbiamo già questo messaggio nel database
          const messageId = message.id || `${message.from}:${message.time}`;
          const existingMessage = await storage.getCommunicationByExternalId(messageId);
          
          if (existingMessage) {
            console.log(`Messaggio ${messageId} già presente nel database`);
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