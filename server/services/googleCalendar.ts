import { google } from 'googleapis';
import { db } from '../db';
import { calendarEvents } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface CalendarEventData {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  clientId?: number;
  propertyId?: number;
  appointmentConfirmationId?: number;
}

class GoogleCalendarService {
  private calendar: any = null;
  private isConfigured = false;

  constructor() {
    this.initializeCalendar();
  }

  private initializeCalendar() {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.log('[CALENDAR] Google Calendar credentials not configured');
      this.isConfigured = false;
      return;
    }

    try {
      // Use the correct redirect URI that matches Google Cloud Console configuration
      const auth = new google.auth.OAuth2(
        clientId, 
        clientSecret,
        'https://client-management-system-ilanboni.replit.app/oauth/callback'
      );
      auth.setCredentials({ refresh_token: refreshToken });
      
      this.calendar = google.calendar({ version: 'v3', auth });
      this.isConfigured = true;
      console.log('[CALENDAR] Google Calendar service initialized with correct redirect URI');
    } catch (error) {
      console.error('[CALENDAR] Error initializing Google Calendar:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Crea un evento nel calendario interno e su Google Calendar
   */
  async createEvent(eventData: CalendarEventData): Promise<any> {
    try {
      // Crea l'evento nel database locale
      const [localEvent] = await db
        .insert(calendarEvents)
        .values({
          title: eventData.title,
          description: eventData.description,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          location: eventData.location,
          clientId: eventData.clientId,
          propertyId: eventData.propertyId,
          appointmentConfirmationId: eventData.appointmentConfirmationId,
          syncStatus: 'pending'
        })
        .returning();

      console.log(`[CALENDAR] Created local event: ${localEvent.title}`);

      // Se Google Calendar è configurato, sincronizza
      if (this.isConfigured) {
        await this.syncEventToGoogle(localEvent.id);
      } else {
        console.log('[CALENDAR] Google Calendar not configured, event saved locally only');
      }

      return localEvent;
    } catch (error) {
      console.error('[CALENDAR] Error creating event:', error);
      throw error;
    }
  }

  /**
   * Sincronizza un evento locale con Google Calendar
   */
  async syncEventToGoogle(eventId: number): Promise<void> {
    if (!this.isConfigured) {
      console.log('[CALENDAR] Google Calendar not configured, skipping sync');
      return;
    }

    try {
      // Recupera l'evento dal database
      const [event] = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, eventId));

      if (!event) {
        throw new Error(`Event with ID ${eventId} not found`);
      }

      // Crea l'evento su Google Calendar
      const googleEvent = {
        summary: event.title,
        description: event.description || '',
        location: event.location || '',
        start: {
          dateTime: event.startDate.toISOString(),
          timeZone: 'Europe/Rome',
        },
        end: {
          dateTime: event.endDate.toISOString(),
          timeZone: 'Europe/Rome',
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: googleEvent,
      });

      // Aggiorna l'evento locale con l'ID di Google
      await db
        .update(calendarEvents)
        .set({
          googleEventId: response.data.id,
          syncStatus: 'synced',
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(calendarEvents.id, eventId));

      console.log(`[CALENDAR] Event synced to Google Calendar: ${response.data.id}`);
    } catch (error) {
      console.error('[CALENDAR] Error syncing to Google Calendar:', error);
      
      // Aggiorna lo stato dell'evento come fallito
      await db
        .update(calendarEvents)
        .set({
          syncStatus: 'failed',
          syncError: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date()
        })
        .where(eq(calendarEvents.id, eventId));
    }
  }

  /**
   * Crea un evento da una conferma appuntamento
   */
  async createEventFromAppointmentConfirmation(confirmation: any): Promise<any> {
    try {
      // Parse della data e ora dall'appuntamento
      const appointmentDateTime = this.parseAppointmentDate(confirmation.appointmentDate);
      
      if (!appointmentDateTime) {
        throw new Error(`Cannot parse appointment date: ${confirmation.appointmentDate}`);
      }

      // Crea evento di 30 minuti come richiesto
      const startDate = appointmentDateTime;
      const endDate = new Date(appointmentDateTime.getTime() + 30 * 60 * 1000); // +30 minuti

      // Formatta nome completo e telefono per il titolo
      const fullName = confirmation.firstName ? 
        `${confirmation.firstName} ${confirmation.lastName}` : 
        confirmation.lastName;

      const eventData: CalendarEventData = {
        title: `${fullName} - ${confirmation.phone}`,
        description: `Appuntamento confermato con ${confirmation.salutation} ${fullName}\nTelefono: ${confirmation.phone}\nIndirizzo: ${confirmation.address}`,
        startDate,
        endDate,
        location: confirmation.address,
        appointmentConfirmationId: confirmation.id
      };

      console.log(`[CALENDAR] Creating event for ${fullName} at ${confirmation.address} on ${appointmentDateTime}`);
      return await this.createEvent(eventData);
    } catch (error) {
      console.error('[CALENDAR] Error creating event from appointment confirmation:', error);
      throw error;
    }
  }

  /**
   * Parsing della data dell'appuntamento da testo libero
   */
  private parseAppointmentDate(dateString: string): Date | null {
    try {
      console.log(`[CALENDAR] Parsing appointment date: "${dateString}"`);
      
      // Pattern per date specifiche: "7 giugno 2025 ore 15:00"
      const specificDateRegex = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\s+ore?\s+(\d{1,2}):?(\d{2})?/i;
      const specificMatch = dateString.match(specificDateRegex);
      
      if (specificMatch) {
        const day = parseInt(specificMatch[1]);
        const monthName = specificMatch[2].toLowerCase();
        const year = parseInt(specificMatch[3]);
        const hour = parseInt(specificMatch[4]);
        const minute = parseInt(specificMatch[5] || '0');
        
        const monthMap: { [key: string]: number } = {
          gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
          luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11
        };
        
        const month = monthMap[monthName];
        if (month !== undefined) {
          const parsedDate = new Date(year, month, day, hour, minute);
          console.log(`[CALENDAR] Parsed specific date: ${parsedDate}`);
          return parsedDate;
        }
      }

      // Pattern per "domani alle 10:00"
      const tomorrowRegex = /domani\s+alle?\s+(\d{1,2}):?(\d{2})?/i;
      const tomorrowMatch = dateString.match(tomorrowRegex);
      
      if (tomorrowMatch) {
        const hour = parseInt(tomorrowMatch[1]);
        const minute = parseInt(tomorrowMatch[2] || '0');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hour, minute, 0, 0);
        console.log(`[CALENDAR] Parsed tomorrow date: ${tomorrow}`);
        return tomorrow;
      }

      // Pattern per "oggi alle 13:00"
      const todayRegex = /oggi\s+alle?\s+(\d{1,2}):?(\d{2})?/i;
      const todayMatch = dateString.match(todayRegex);
      
      if (todayMatch) {
        const hour = parseInt(todayMatch[1]);
        const minute = parseInt(todayMatch[2] || '0');
        const today = new Date();
        today.setHours(hour, minute, 0, 0);
        console.log(`[CALENDAR] Parsed today date: ${today}`);
        return today;
      }

      // Pattern per giorni della settimana con "alle": "Domenica 8/6, alle 9:30"
      const weekdayDateAlleRegex = /(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\s+(\d{1,2})\/(\d{1,2}),?\s*alle\s+(\d{1,2}):?(\d{2})?/i;
      const weekdayAlleMatch = dateString.match(weekdayDateAlleRegex);
      
      if (weekdayAlleMatch) {
        const day = parseInt(weekdayAlleMatch[2]);
        const month = parseInt(weekdayAlleMatch[3]) - 1; // JavaScript months are 0-based
        const hour = parseInt(weekdayAlleMatch[4]);
        const minute = parseInt(weekdayAlleMatch[5] || '0');
        
        // Assume current year if not specified
        const currentYear = new Date().getFullYear();
        
        // Mantieni l'orario locale - Google Calendar gestirà il fuso orario
        const localDate = new Date(currentYear, month, day, hour, minute);
        
        console.log(`[CALENDAR] Parsed weekday date (alle format) - Local: ${localDate}`);
        return localDate;
      }

      // Pattern per giorni della settimana senza data: "Domenica, ore 10:30"
      const weekdayOnlyRegex = /(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica),?\s*ore?\s+(\d{1,2}):?(\d{2})?/i;
      const weekdayOnlyMatch = dateString.match(weekdayOnlyRegex);
      
      if (weekdayOnlyMatch) {
        const weekdayName = weekdayOnlyMatch[1].toLowerCase();
        const hour = parseInt(weekdayOnlyMatch[2]);
        const minute = parseInt(weekdayOnlyMatch[3] || '0');
        
        const weekdayMap: { [key: string]: number } = {
          domenica: 0, lunedì: 1, martedì: 2, mercoledì: 3, giovedì: 4, venerdì: 5, sabato: 6
        };
        
        const targetWeekday = weekdayMap[weekdayName];
        const today = new Date();
        const currentWeekday = today.getDay();
        
        // Calcola i giorni da aggiungere per arrivare al prossimo giorno specificato
        let daysToAdd = targetWeekday - currentWeekday;
        if (daysToAdd <= 0) {
          daysToAdd += 7; // Se il giorno è oggi o è passato, va alla settimana prossima
        }
        
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysToAdd);
        targetDate.setHours(hour, minute, 0, 0);
        
        console.log(`[CALENDAR] Parsed weekday-only date - ${weekdayName} -> Local: ${targetDate}`);
        return targetDate;
      }

      // Pattern per giorni della settimana con "alle ore": "Martedì 10/6, alle ore 10" o "Lunedì 9/6 alle ore 15"
      const weekdayDateRegex = /(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\s+(\d{1,2})\/(\d{1,2}),?\s*alle?\s+ore?\s+(\d{1,2}):?(\d{2})?/i;
      const weekdayMatch = dateString.match(weekdayDateRegex);
      
      if (weekdayMatch) {
        const day = parseInt(weekdayMatch[2]);
        const month = parseInt(weekdayMatch[3]) - 1; // JavaScript months are 0-based
        const hour = parseInt(weekdayMatch[4]);
        const minute = parseInt(weekdayMatch[5] || '0');
        
        // Assume current year if not specified
        const currentYear = new Date().getFullYear();
        
        // Mantieni l'orario locale - Google Calendar gestirà il fuso orario
        const localDate = new Date(currentYear, month, day, hour, minute);
        
        console.log(`[CALENDAR] Parsed weekday date - Local: ${localDate}`);
        return localDate;
      }

      // Pattern per formato "Domenica 8/6, ore 9:30" (senza "alle")
      const weekdayDateDirectRegex = /(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\s+(\d{1,2})\/(\d{1,2}),?\s*ore?\s+(\d{1,2}):?(\d{2})?/i;
      const weekdayDirectMatch = dateString.match(weekdayDateDirectRegex);
      
      if (weekdayDirectMatch) {
        const day = parseInt(weekdayDirectMatch[2]);
        const month = parseInt(weekdayDirectMatch[3]) - 1; // JavaScript months are 0-based
        const hour = parseInt(weekdayDirectMatch[4]);
        const minute = parseInt(weekdayDirectMatch[5] || '0');
        
        // Assume current year if not specified
        const currentYear = new Date().getFullYear();
        
        // Crea la data in ora locale italiana e converte in UTC
        const localDate = new Date(currentYear, month, day, hour, minute);
        const utcDate = new Date(localDate.getTime() - (2 * 60 * 60 * 1000)); // UTC+2 -> UTC
        
        console.log(`[CALENDAR] Parsed weekday date (direct ore format) - Local: ${localDate} -> UTC: ${utcDate}`);
        return utcDate;
      }

      // Pattern alternativo per giorni senza virgola: "Lunedì 9/6 alle ore 15"
      const weekdayDateAltRegex = /(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\s+(\d{1,2})\/(\d{1,2})\s+alle?\s+ore?\s+(\d{1,2}):?(\d{2})?/i;
      const weekdayAltMatch = dateString.match(weekdayDateAltRegex);
      
      if (weekdayAltMatch) {
        const day = parseInt(weekdayAltMatch[2]);
        const month = parseInt(weekdayAltMatch[3]) - 1; // JavaScript months are 0-based
        const hour = parseInt(weekdayAltMatch[4]);
        const minute = parseInt(weekdayAltMatch[5] || '0');
        
        // Assume current year if not specified
        const currentYear = new Date().getFullYear();
        
        // Mantieni l'orario locale - Google Calendar gestirà il fuso orario
        const localDate = new Date(currentYear, month, day, hour, minute);
        
        console.log(`[CALENDAR] Parsed weekday date (alt format) - Local: ${localDate}`);
        return localDate;
      }

      // Pattern per ore semplici: "alle 10:00" o "ore 15:30"
      const timeOnlyRegex = /(alle?\s+|ore?\s+)(\d{1,2}):?(\d{2})?/i;
      const timeMatch = dateString.match(timeOnlyRegex);
      
      if (timeMatch) {
        const hour = parseInt(timeMatch[2]);
        const minute = parseInt(timeMatch[3] || '0');
        // Assume oggi se non specificato
        const today = new Date();
        today.setHours(hour, minute, 0, 0);
        console.log(`[CALENDAR] Parsed time-only as today: ${today}`);
        return today;
      }

      // Pattern per numeri di ore: "10:00" o "15"
      const pureTimeRegex = /^(\d{1,2}):?(\d{2})?$/;
      const pureTimeMatch = dateString.match(pureTimeRegex);
      
      if (pureTimeMatch) {
        const hour = parseInt(pureTimeMatch[1]);
        const minute = parseInt(pureTimeMatch[2] || '0');
        // Assume oggi
        const today = new Date();
        today.setHours(hour, minute, 0, 0);
        console.log(`[CALENDAR] Parsed pure time as today: ${today}`);
        return today;
      }

      // Fallback: prova a parsare come data ISO o formato standard
      const parsedDate = new Date(dateString);
      if (!isNaN(parsedDate.getTime())) {
        console.log(`[CALENDAR] Parsed ISO date: ${parsedDate}`);
        return parsedDate;
      }

      console.log(`[CALENDAR] Could not parse date: "${dateString}"`);
      return null;
    } catch (error) {
      console.error('[CALENDAR] Error parsing appointment date:', error);
      return null;
    }
  }

  /**
   * Recupera eventi dal calendario interno
   */
  async getEvents(startDate?: Date, endDate?: Date) {
    try {
      let query = db.select().from(calendarEvents);
      
      // TODO: Add date filtering if needed
      
      const events = await query;
      return events;
    } catch (error) {
      console.error('[CALENDAR] Error retrieving events:', error);
      throw error;
    }
  }

  /**
   * Verifica se Google Calendar è configurato
   */
  isGoogleCalendarConfigured(): boolean {
    return this.isConfigured;
  }
}

export const googleCalendarService = new GoogleCalendarService();