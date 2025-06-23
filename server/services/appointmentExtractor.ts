import { googleCalendarService } from './googleCalendar';

interface AppointmentData {
  clientName: string;
  clientPhone: string;
  appointmentDate: Date;
  address: string;
  salutation: string;
}

/**
 * Estrae i dati dell'appuntamento da un messaggio WhatsApp di conferma
 */
export function extractAppointmentData(messageContent: string, clientPhone: string): AppointmentData | null {
  try {
    console.log('[APPOINTMENT-EXTRACTOR] Analizzando messaggio:', messageContent);
    
    // Ignora messaggi di test per evitare duplicati
    if (messageContent.includes('TestSalutation') || 
        messageContent.includes('TestCalendar') || 
        messageContent.includes('TestOrario') ||
        messageContent.includes('Paganelli') ||
        messageContent.includes('Erba') ||
        messageContent.includes('ceruti') ||
        (messageContent.includes('Boni') && clientPhone === '393407992052')) {
      console.log('[APPOINTMENT-EXTRACTOR] Messaggio di test ignorato');
      return null;
    }
    
    // Pattern per estrarre il nome del cliente
    const namePatterns = [
      /(?:Egr\.|Egregio|Gentile|Dott\.|Sig\.|Dott\.ssa|Sig\.ra)\s+([^,]+)/i,
      /(?:egr_sig|egr_dott)\s+([^,]+)/i
    ];
    
    let clientName = '';
    for (const pattern of namePatterns) {
      const nameMatch = messageContent.match(pattern);
      if (nameMatch) {
        clientName = nameMatch[1].trim();
        break;
      }
    }
    
    if (!clientName) {
      console.log('[APPOINTMENT-EXTRACTOR] Nome cliente non trovato');
      return null;
    }
    
    // Estrai la salutazione
    const salutationMatch = messageContent.match(/(Egr\.|Egregio|Gentile|Dott\.|Sig\.|Dott\.ssa|Sig\.ra|egr_sig|egr_dott)/i);
    const salutation = salutationMatch ? salutationMatch[1] : 'Gentile';
    
    // Pattern per estrarre la data e l'ora dell'appuntamento
    const dateTimePatterns = [
      // "Martedì 10/6, alle ore 16:00" - handles accented characters
      /appuntamento di\s+((?:Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica)\s+\d{1,2}\/\d{1,2}),\s+alle\s+ore\s+(\d{1,2}:\d{2})/i,
      // "Lunedì 10/6, ore 14:00" - handles accented characters  
      /appuntamento di\s+((?:Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica)\s+\d{1,2}\/\d{1,2}),\s+ore\s+(\d{1,2}:\d{2})/i,
      // "Lunedì 23/6, ore 18" - handles single-digit hours without minutes
      /appuntamento di\s+((?:Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica)\s+\d{1,2}\/\d{1,2}),\s+ore\s+(\d{1,2})(?![:\d])/i,
      // "mercoledì 11/06 alle ore 09:00" (senza virgola) - handles accented characters
      /appuntamento di\s+((?:Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica)\s+\d{1,2}\/\d{1,2})\s+alle\s+ore\s+(\d{1,2}:\d{2})/i,
      // "17/06/2025 ore 10:00"
      /appuntamento di\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+ore\s+(\d{1,2}:\d{2})/i,
      // "2025-06-18 alle ore 13:12"
      /appuntamento di\s+(\d{4}-\d{1,2}-\d{1,2})\s+alle\s+ore\s+(\d{1,2}:\d{2})/i
    ];
    
    let appointmentDate: Date | null = null;
    
    for (const pattern of dateTimePatterns) {
      const dateTimeMatch = messageContent.match(pattern);
      if (dateTimeMatch) {
        const dateStr = dateTimeMatch[1];
        const timeStr = dateTimeMatch[2];
        
        console.log('[APPOINTMENT-EXTRACTOR] Trovata data:', dateStr, 'ora:', timeStr);
        
        try {
          appointmentDate = parseAppointmentDateTime(dateStr, timeStr);
          if (appointmentDate) break;
        } catch (error) {
          console.log('[APPOINTMENT-EXTRACTOR] Errore parsing data:', error);
          continue;
        }
      }
    }
    
    if (!appointmentDate) {
      console.log('[APPOINTMENT-EXTRACTOR] Data appuntamento non trovata');
      return null;
    }
    
    // Pattern per estrarre l'indirizzo
    const addressPatterns = [
      /in\s+([^.]+?)(?:\.\s+(?:Per|La)|\.\s*$)/i,
      /in\s+(.+?)(?:\.\s+La ringrazio)/i
    ];
    
    let address = '';
    for (const pattern of addressPatterns) {
      const addressMatch = messageContent.match(pattern);
      if (addressMatch) {
        address = addressMatch[1].trim().replace(/,$/, '');
        break;
      }
    }
    
    if (!address) {
      console.log('[APPOINTMENT-EXTRACTOR] Indirizzo non trovato');
      return null;
    }
    
    console.log('[APPOINTMENT-EXTRACTOR] Dati estratti:', {
      clientName,
      clientPhone,
      appointmentDate: appointmentDate.toISOString(),
      address,
      salutation
    });
    
    return {
      clientName,
      clientPhone,
      appointmentDate,
      address,
      salutation
    };
    
  } catch (error) {
    console.error('[APPOINTMENT-EXTRACTOR] Errore estrazione dati:', error);
    return null;
  }
}

/**
 * Parsifica data e ora dell'appuntamento
 */
function parseAppointmentDateTime(dateStr: string, timeStr: string): Date | null {
  try {
    const currentYear = new Date().getFullYear();
    let parsedDate: Date;
    
    // Formato ISO "2025-06-18"
    if (dateStr.includes('-') && dateStr.length === 10) {
      const [year, month, day] = dateStr.split('-').map(Number);
      parsedDate = new Date(year, month - 1, day);
    }
    // Formato "17/06/2025"
    else if (dateStr.includes('/') && dateStr.split('/').length === 3) {
      const parts = dateStr.split('/');
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      parsedDate = new Date(year, month - 1, day);
    }
    // Formato "Lunedì 10/6" o "10/6"
    else {
      const dayMonthMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
      if (dayMonthMatch) {
        const day = parseInt(dayMonthMatch[1]);
        const month = parseInt(dayMonthMatch[2]);
        parsedDate = new Date(currentYear, month - 1, day);
        
        // Se la data è più di 30 giorni nel passato, assumiamo l'anno prossimo
        // Altrimenti potrebbe essere un appuntamento per il mese corrente
        const daysDiff = (new Date().getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 30) {
          parsedDate.setFullYear(currentYear + 1);
        }
      } else {
        return null;
      }
    }
    
    // Aggiungi l'ora - gestisce sia "18:00" che "18"
    let hours: number, minutes: number;
    if (timeStr.includes(':')) {
      [hours, minutes] = timeStr.split(':').map(Number);
    } else {
      // Solo ore, senza minuti
      hours = parseInt(timeStr);
      minutes = 0;
    }
    parsedDate.setHours(hours, minutes, 0, 0);
    
    return parsedDate;
  } catch (error) {
    console.error('[APPOINTMENT-EXTRACTOR] Errore parsing data/ora:', error);
    return null;
  }
}

/**
 * Crea automaticamente un evento in Google Calendar da una conferma appuntamento WhatsApp
 */
export async function createCalendarEventFromAppointment(appointmentData: AppointmentData): Promise<boolean> {
  try {
    console.log('[APPOINTMENT-EXTRACTOR] Creando evento calendario per:', appointmentData.clientName);
    
    // Calcola data fine (1 ora dopo)
    const endDate = new Date(appointmentData.appointmentDate);
    endDate.setHours(endDate.getHours() + 1);
    
    // Formato titolo: "Nome Cognome - Numero telefono"
    const title = `${appointmentData.clientName} - ${appointmentData.clientPhone}`;
    
    // Crea l'evento
    const event = await googleCalendarService.createEvent({
      title,
      description: `Appuntamento per visita immobile - Estratto automaticamente da WhatsApp`,
      startDate: appointmentData.appointmentDate,
      endDate,
      location: appointmentData.address
    });
    
    console.log('[APPOINTMENT-EXTRACTOR] Evento calendario creato con ID:', event.id);
    return true;
    
  } catch (error) {
    console.error('[APPOINTMENT-EXTRACTOR] Errore creazione evento calendario:', error);
    return false;
  }
}

/**
 * Verifica se un messaggio è una conferma appuntamento
 */
export function isAppointmentConfirmation(messageContent: string): boolean {
  const confirmationKeywords = [
    'confermo appuntamento',
    'conferma appuntamento',
    'le confermo l\'appuntamento',
    'confermo l\'appuntamento'
  ];
  
  const lowerContent = messageContent.toLowerCase();
  return confirmationKeywords.some(keyword => lowerContent.includes(keyword));
}