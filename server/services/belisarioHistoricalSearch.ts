import { google } from 'googleapis';
import { db } from '../db';
import { communications, clients } from '../../shared/schema';
import { processImmobiliareEmail } from './immobiliareEmailProcessor';

/**
 * Ricerca storica delle comunicazioni relative al Viale Belisario (Rif. Bel)
 * negli ultimi 2 mesi utilizzando Gmail API
 */
export async function searchBelisarioHistoricalEmails() {
  try {
    console.log('[BELISARIO SEARCH] Avvio ricerca storica per Viale Belisario (Rif. Bel)');
    
    // Configurazione OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Calcola la data di 2 mesi fa
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const afterDate = twoMonthsAgo.toISOString().split('T')[0].replace(/-/g, '/');

    // Query di ricerca per il riferimento Belisario
    const searchQueries = [
      `after:${afterDate} (Bel OR Belisario OR "Rif. Bel" OR "Ref. Bel" OR "32962055")`,
      `after:${afterDate} subject:(Bel OR Belisario)`,
      `after:${afterDate} from:immobiliare.it (Bel OR Belisario)`
    ];

    const foundEmails: any[] = [];

    for (const query of searchQueries) {
      console.log(`[BELISARIO SEARCH] Esecuzione query: ${query}`);
      
      try {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 50
        });

        if (response.data.messages) {
          console.log(`[BELISARIO SEARCH] Trovati ${response.data.messages.length} messaggi per query: ${query}`);
          
          for (const message of response.data.messages) {
            const messageDetail = await gmail.users.messages.get({
              userId: 'me',
              id: message.id!
            });

            const headers = messageDetail.data.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value || '';

            // Estrai il corpo del messaggio
            let body = '';
            if (messageDetail.data.payload?.body?.data) {
              body = Buffer.from(messageDetail.data.payload.body.data, 'base64').toString();
            } else if (messageDetail.data.payload?.parts) {
              for (const part of messageDetail.data.payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                  body += Buffer.from(part.body.data, 'base64').toString();
                }
              }
            }

            foundEmails.push({
              id: message.id,
              subject,
              from,
              date,
              body: body.substring(0, 1000), // Primi 1000 caratteri
              fullBody: body
            });
          }
        }
      } catch (error) {
        console.error(`[BELISARIO SEARCH] Errore nella query ${query}:`, error);
      }
    }

    // Rimuovi duplicati basati sull'ID del messaggio
    const uniqueEmails = foundEmails.filter((email, index, self) => 
      index === self.findIndex(e => e.id === email.id)
    );

    console.log(`[BELISARIO SEARCH] Totale email uniche trovate: ${uniqueEmails.length}`);

    // Elabora le email trovate
    const processedResults = [];
    for (const email of uniqueEmails) {
      console.log(`[BELISARIO SEARCH] Elaborazione email: ${email.subject}`);
      
      // Verifica se l'email è già stata processata
      const existingComm = await db.query.communications.findFirst({
        where: (communications, { eq }) => eq(communications.externalId, `gmail-${email.id}`)
      });

      if (existingComm) {
        console.log(`[BELISARIO SEARCH] Email già processata: ${email.subject}`);
        processedResults.push({
          ...email,
          status: 'already_processed',
          communicationId: existingComm.id
        });
        continue;
      }

      // Processa l'email se proviene da immobiliare.it
      if (email.from.includes('immobiliare.it')) {
        try {
          console.log(`[BELISARIO SEARCH] Processamento email immobiliare.it: ${email.subject}`);
          
          const processResult = await processImmobiliareEmail({
            emailId: `gmail-${email.id}`,
            from: email.from,
            subject: email.subject,
            content: email.fullBody,
            receivedAt: new Date(email.date)
          });

          processedResults.push({
            ...email,
            status: 'processed',
            processResult
          });
        } catch (error) {
          console.error(`[BELISARIO SEARCH] Errore nel processamento:`, error);
          processedResults.push({
            ...email,
            status: 'error',
            error: error.message
          });
        }
      } else {
        // Per email non di immobiliare.it, crea una comunicazione manuale
        try {
          const newComm = await db.insert(communications).values({
            clientId: null,
            propertyId: 14, // ID di Viale Belisario
            type: 'email',
            subject: email.subject,
            content: email.fullBody,
            summary: email.body,
            direction: 'inbound',
            status: 'pending',
            managementStatus: 'to_manage',
            externalId: `gmail-${email.id}`,
            createdAt: new Date(email.date)
          }).returning();

          processedResults.push({
            ...email,
            status: 'created_communication',
            communicationId: newComm[0].id
          });
        } catch (error) {
          console.error(`[BELISARIO SEARCH] Errore nella creazione comunicazione:`, error);
          processedResults.push({
            ...email,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    return {
      success: true,
      totalFound: uniqueEmails.length,
      processed: processedResults.filter(r => r.status === 'processed').length,
      alreadyProcessed: processedResults.filter(r => r.status === 'already_processed').length,
      created: processedResults.filter(r => r.status === 'created_communication').length,
      errors: processedResults.filter(r => r.status === 'error').length,
      results: processedResults
    };

  } catch (error) {
    console.error('[BELISARIO SEARCH] Errore generale:', error);
    return {
      success: false,
      error: error.message
    };
  }
}