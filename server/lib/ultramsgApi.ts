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
    
    const chatIds = chatsResponse.data.map((chat: any) => chat.id);
    console.log(`Trovate ${chatIds.length} chat recenti`);
    
    // Statistiche dei messaggi elaborati
    let processedCount = 0;
    let ignoredCount = 0;
    let errorCount = 0;
    const processedMessages: any[] = [];
    
    // Elabora ogni chat
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
        
        const messages = messagesResponse.data as UltraMsgApiMessage[];
        console.log(`Chat ${chatId}: trovati ${messages.length} messaggi`);
        
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