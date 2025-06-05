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
      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({ refresh_token: refreshToken });
      
      this.calendar = google.calendar({ version: 'v3', auth });
      this.isConfigured = true;
      console.log('[CALENDAR] Google Calendar service initialized');
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

      // Crea evento di 1 ora per default
      const startDate = appointmentDateTime;
      const endDate = new Date(appointmentDateTime.getTime() + 60 * 60 * 1000); // +1 ora

      const eventData: CalendarEventData = {
        title: `Appuntamento - ${confirmation.lastName}`,
        description: `Appuntamento confermato con ${confirmation.salutation} ${confirmation.lastName}\nTelefono: ${confirmation.phone}`,
        startDate,
        endDate,
        location: confirmation.address,
        appointmentConfirmationId: confirmation.id
      };

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
      // Esempi: "7 giugno 2025 ore 15:00", "domani alle 10:00", "oggi alle 13:00"
      
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
          return new Date(year, month, day, hour, minute);
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
        return today;
      }

      // Fallback: prova a parsare come data ISO o formato standard
      const parsedDate = new Date(dateString);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }

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