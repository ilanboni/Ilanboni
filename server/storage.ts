import { 
  users, type User, type InsertUser,
  clients, type Client, type InsertClient,
  buyers, type Buyer, type InsertBuyer,
  sellers, type Seller, type InsertSeller,
  properties, type Property, type InsertProperty,
  sharedProperties, type SharedProperty, type InsertSharedProperty,
  sharedPropertyNotes, type SharedPropertyNote, type InsertSharedPropertyNote,
  appointments, type Appointment, type InsertAppointment,
  tasks, type Task, type InsertTask,
  communications, type Communication, type InsertCommunication,
  marketInsights, type MarketInsight, type InsertMarketInsight,
  immobiliareEmails, type ImmobiliareEmail, type InsertImmobiliareEmail,
  propertySent, type PropertySent, type InsertPropertySent,
  calendarEvents, type CalendarEvent, type InsertCalendarEvent,
  propertyActivities, type PropertyActivity, type InsertPropertyActivity,
  propertyAttachments, type PropertyAttachment, type InsertPropertyAttachment,
  scrapingJobs, type ScrapingJob, type InsertScrapingJob,
  type ClientWithDetails, type PropertyWithDetails, 
  type SharedPropertyWithDetails,
  privateContactTracking, type PrivateContactTracking, type InsertPrivateContactTracking,
  whatsappCampaigns, type WhatsappCampaign, type InsertWhatsappCampaign,
  campaignMessages, type CampaignMessage, type InsertCampaignMessage,
  botConversationLogs, type BotConversationLog, type InsertBotConversationLog,
  clientFavorites, type ClientFavorite, type InsertClientFavorite,
  clientIgnoredProperties, type ClientIgnoredProperty, type InsertClientIgnoredProperty,
  matches, type Match, type InsertMatch
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, lt, and, or, gte, lte, like, ilike, not, isNull, inArray, SQL, sql, count } from "drizzle-orm";
import { isPropertyMatchingBuyerCriteria } from "./lib/matchingLogic";
import { geocodeAddress } from "./lib/geocoding";
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, lineString } from '@turf/helpers';
import distance from '@turf/distance';
import pointToLineDistance from '@turf/point-to-line-distance';

// Storage interface with CRUD methods for all entities
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Client methods
  getClient(id: number): Promise<Client | undefined>;
  getClientByPhone(phone: string): Promise<Client | undefined>;
  getClients(filters?: { type?: string; search?: string }): Promise<Client[]>;
  getClientWithDetails(id: number): Promise<ClientWithDetails | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  
  // Buyer methods
  getBuyer(id: number): Promise<Buyer | undefined>;
  getBuyerByClientId(clientId: number): Promise<Buyer | undefined>;
  getBuyerPreferences(clientId: number): Promise<Buyer | undefined>;
  createBuyer(buyer: InsertBuyer): Promise<Buyer>;
  updateBuyer(id: number, data: Partial<InsertBuyer>): Promise<Buyer | undefined>;
  deleteBuyer(id: number): Promise<boolean>;
  
  // Seller methods
  getSeller(id: number): Promise<Seller | undefined>;
  getSellerByClientId(clientId: number): Promise<Seller | undefined>;
  createSeller(seller: InsertSeller): Promise<Seller>;
  updateSeller(id: number, data: Partial<InsertSeller>): Promise<Seller | undefined>;
  deleteSeller(id: number): Promise<boolean>;
  
  // Property methods
  getProperty(id: number): Promise<Property | undefined>;
  getPropertyByExternalId(externalId: string): Promise<Property | undefined>;
  getProperties(filters?: { status?: string; search?: string; ownerType?: string; page?: number; limit?: number; showPrivate?: boolean; showMonoShared?: boolean; showMultiShared?: boolean }): Promise<{ properties: Property[], total: number, page: number, limit: number, totalPages: number }>;
  getPropertiesByIds(ids: number[]): Promise<Property[]>;
  getPropertyWithDetails(id: number): Promise<PropertyWithDetails | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: number, data: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;
  
  // Shared property methods
  getSharedProperty(id: number): Promise<SharedProperty | undefined>;
  getSharedPropertyByPropertyId(propertyId: number): Promise<SharedProperty | undefined>;
  getSharedProperties(filters?: { stage?: string; search?: string; isFavorite?: boolean }): Promise<SharedProperty[]>;
  getSharedPropertyWithDetails(id: number): Promise<SharedPropertyWithDetails | undefined>;
  createSharedProperty(sharedProperty: InsertSharedProperty): Promise<SharedProperty>;
  updateSharedProperty(id: number, data: Partial<InsertSharedProperty>): Promise<SharedProperty | undefined>;
  acquireSharedProperty(id: number): Promise<boolean>;
  ignoreSharedProperty(id: number): Promise<boolean>;
  deleteSharedProperty(id: number): Promise<boolean>;
  getMatchingBuyersForSharedProperty(sharedPropertyId: number): Promise<ClientWithDetails[]>;
  
  // Appointment methods
  getAppointment(id: number): Promise<Appointment | undefined>;
  getAppointments(filters?: { status?: string; date?: string }): Promise<Appointment[]>;
  getAppointmentsByClientId(clientId: number): Promise<Appointment[]>;
  getAppointmentsByPropertyId(propertyId: number): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, data: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
  
  // Communication methods
  getCommunication(id: number): Promise<Communication | undefined>;
  getCommunications(filters?: { type?: string; status?: string }): Promise<Communication[]>;
  getCommunicationsByClientId(clientId: number): Promise<Communication[]>;
  getCommunicationsByPropertyId(propertyId: number): Promise<Communication[]>;
  getCommunicationsByResponseToId(responseToId: number): Promise<Communication[]>;
  getLastCommunicationByClientId(clientId: number): Promise<Communication | undefined>;
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  updateCommunication(id: number, data: Partial<InsertCommunication>): Promise<Communication | undefined>;
  deleteCommunication(id: number): Promise<boolean>;
  getClientsWithoutRecentCommunication(days: number, minRating: number): Promise<ClientWithDetails[]>;
  getCommunicationByExternalId(externalId: string): Promise<Communication | undefined>;
  getCommunicationByCorrelationId(correlationId: string): Promise<Communication | undefined>;
  
  // Task methods
  getTask(id: number): Promise<Task | undefined>;
  getTasks(filters?: { status?: string; type?: string; search?: string; limit?: number; clientId?: number; propertyId?: number; sharedPropertyId?: number }): Promise<TaskWithClient[]>;
  getTasksByClientId(clientId: number): Promise<Task[]>;
  getTasksByPropertyId(propertyId: number): Promise<Task[]>;
  getTasksBySharedPropertyId(sharedPropertyId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined>;
  completeTask(id: number): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  
  // Shared property notes methods
  getSharedPropertyNotes(sharedPropertyId: number): Promise<SharedPropertyNote[]>;
  createSharedPropertyNote(note: InsertSharedPropertyNote): Promise<SharedPropertyNote>;
  deleteSharedPropertyNote(noteId: number): Promise<boolean>;
  
  // Property activities methods
  getPropertyActivities(sharedPropertyId: number): Promise<PropertyActivity[]>;
  getPropertyActivity(id: number): Promise<PropertyActivity | undefined>;
  createPropertyActivity(activity: InsertPropertyActivity): Promise<PropertyActivity>;
  updatePropertyActivity(id: number, data: Partial<InsertPropertyActivity>): Promise<PropertyActivity | undefined>;
  deletePropertyActivity(id: number): Promise<boolean>;
  
  // Property attachments methods
  getPropertyAttachments(sharedPropertyId: number): Promise<PropertyAttachment[]>;
  getPropertyAttachment(id: number): Promise<PropertyAttachment | undefined>;
  createPropertyAttachment(attachment: InsertPropertyAttachment): Promise<PropertyAttachment>;
  deletePropertyAttachment(id: number): Promise<boolean>;
  
  // Client conversation task methods
  findClientConversationTask(clientId: number): Promise<Task | undefined>;
  upsertClientConversationTask(clientId: number, data: Partial<InsertTask>): Promise<Task>;
  getClientCommunicationsTimeline(clientId: number): Promise<Communication[]>;
  
  // Market insight methods
  getMarketInsight(id: number): Promise<MarketInsight | undefined>;
  getMarketInsights(filters?: { area?: string; month?: number; year?: number }): Promise<MarketInsight[]>;
  createMarketInsight(insight: InsertMarketInsight): Promise<MarketInsight>;
  updateMarketInsight(id: number, data: Partial<InsertMarketInsight>): Promise<MarketInsight | undefined>;
  deleteMarketInsight(id: number): Promise<boolean>;
  
  // Matching methods
  matchPropertiesForBuyer(buyerId: number): Promise<Property[]>;
  matchBuyersForProperty(propertyId: number): Promise<Client[]>;
  
  // AI Match methods (for matches table with reasoning)
  createMatch(match: InsertMatch): Promise<Match>;
  getMatchesByClientId(clientId: number): Promise<Match[]>;
  deleteMatchesByClientId(clientId: number): Promise<boolean>;
  
  // Scraping jobs methods
  getScrapingJob(id: number): Promise<ScrapingJob | undefined>;
  getAllScrapingJobs(): Promise<ScrapingJob[]>;
  createScrapingJob(job: InsertScrapingJob): Promise<ScrapingJob>;
  updateScrapingJob(id: number, data: Partial<InsertScrapingJob>): Promise<ScrapingJob | undefined>;
  
  // Private contact tracking methods (for WhatsApp campaigns)
  getPrivateContactTracking(phoneNumber: string): Promise<PrivateContactTracking | undefined>;
  createPrivateContactTracking(data: InsertPrivateContactTracking): Promise<PrivateContactTracking>;
  updatePrivateContactTracking(phoneNumber: string, data: Partial<InsertPrivateContactTracking>): Promise<PrivateContactTracking | undefined>;
  
  // WhatsApp campaign methods
  getWhatsappCampaign(id: number): Promise<WhatsappCampaign | undefined>;
  getAllWhatsappCampaigns(): Promise<WhatsappCampaign[]>;
  createWhatsappCampaign(campaign: InsertWhatsappCampaign): Promise<WhatsappCampaign>;
  updateWhatsappCampaign(id: number, data: Partial<InsertWhatsappCampaign>): Promise<WhatsappCampaign | undefined>;
  
  // Campaign message methods
  getCampaignMessage(id: number): Promise<CampaignMessage | undefined>;
  getCampaignMessagesByPhone(phoneNumber: string): Promise<CampaignMessage[]>;
  getCampaignMessagesByCampaign(campaignId: number): Promise<CampaignMessage[]>;
  createCampaignMessage(message: InsertCampaignMessage): Promise<CampaignMessage>;
  updateCampaignMessage(id: number, data: Partial<InsertCampaignMessage>): Promise<CampaignMessage | undefined>;
  
  // Bot conversation log methods
  createBotConversationLog(log: InsertBotConversationLog): Promise<BotConversationLog>;
  getBotConversationLogs(campaignMessageId: number): Promise<BotConversationLog[]>;
  
  // Client favorites methods (dual favorites system) - supports both shared and private properties
  getClientFavorites(clientId: number): Promise<ClientFavorite[]>;
  addClientFavorite(clientId: number, options: { sharedPropertyId?: number; propertyId?: number; notes?: string }): Promise<ClientFavorite>;
  removeClientFavorite(clientId: number, options: { sharedPropertyId?: number; propertyId?: number }): Promise<boolean>;
  isClientFavorite(clientId: number, options: { sharedPropertyId?: number; propertyId?: number }): Promise<boolean>;
  
  // Client ignored properties methods (per-client ignore list) - supports both shared and private properties
  getClientIgnoredProperties(clientId: number): Promise<ClientIgnoredProperty[]>;
  addClientIgnoredProperty(clientId: number, options: { sharedPropertyId?: number; propertyId?: number; reason?: string }): Promise<ClientIgnoredProperty>;
  removeClientIgnoredProperty(clientId: number, options: { sharedPropertyId?: number; propertyId?: number }): Promise<boolean>;
  isClientIgnoredProperty(clientId: number, options: { sharedPropertyId?: number; propertyId?: number }): Promise<boolean>;
  
  // Advanced property matching methods
  getMatchingPropertiesForClient(clientId: number, forceRecompute?: boolean): Promise<SharedProperty[]>;
  getMultiAgencyProperties(): Promise<SharedProperty[]>;
  getPrivateProperties(portalSource?: string): Promise<SharedProperty[]>;
  
  // Client match caching methods
  saveClientMatches(clientId: number, items: Array<{sharedPropertyId: number, score: number}>): Promise<void>;
  getClientMatchesFromCache(clientId: number): Promise<{matches: Match[], lastUpdated: Date | null}>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private userStore: Map<number, User>;
  private clientStore: Map<number, Client>;
  private buyerStore: Map<number, Buyer>;
  private sellerStore: Map<number, Seller>;
  private propertyStore: Map<number, Property>;
  private sharedPropertyStore: Map<number, SharedProperty>;
  private appointmentStore: Map<number, Appointment>;
  private taskStore: Map<number, Task>;
  private communicationStore: Map<number, Communication>;
  private marketInsightStore: Map<number, MarketInsight>;
  private propertyActivityStore: Map<number, PropertyActivity>;
  
  private userIdCounter: number;
  private clientIdCounter: number;
  private buyerIdCounter: number;
  private sellerIdCounter: number;
  private propertyIdCounter: number;
  private sharedPropertyIdCounter: number;
  private appointmentIdCounter: number;
  private taskIdCounter: number;
  private communicationIdCounter: number;
  private marketInsightIdCounter: number;
  private propertyActivityIdCounter: number;
  
  constructor() {
    this.userStore = new Map();
    this.clientStore = new Map();
    this.buyerStore = new Map();
    this.sellerStore = new Map();
    this.propertyStore = new Map();
    this.sharedPropertyStore = new Map();
    this.appointmentStore = new Map();
    this.taskStore = new Map();
    this.communicationStore = new Map();
    this.marketInsightStore = new Map();
    this.propertyActivityStore = new Map();
    
    this.userIdCounter = 1;
    this.clientIdCounter = 1;
    this.buyerIdCounter = 1;
    this.sellerIdCounter = 1;
    this.propertyIdCounter = 1;
    this.sharedPropertyIdCounter = 1;
    this.appointmentIdCounter = 1;
    this.taskIdCounter = 1;
    this.communicationIdCounter = 1;
    this.marketInsightIdCounter = 1;
    this.propertyActivityIdCounter = 1;
    
    // Add some initial data for testing
    this.initializeData();
  }
  
  private initializeData() {
    // Add sample agent
    this.createUser({
      username: "agent",
      password: "password",
      name: "Marco Rossi",
      role: "agent",
      email: "marco.rossi@example.com",
      phone: "+39 123 456 7890",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=200&h=200"
    });
    
    // Add sample clients
    const client1 = this.createClient({
      type: "buyer",
      salutation: "Sig.",
      firstName: "Mario",
      lastName: "Bianchi",
      phone: "345-1234567",
      email: "mario.bianchi@example.com",
      isFriend: false,
      religion: "catholic",
      birthday: "1985-06-15",
      contractType: "exclusive",
      notes: "Cliente interessato a appartamenti in centro città. Ha un budget definito e cerca qualcosa di pronto da abitare.",
    });
    
    const client2 = this.createClient({
      type: "seller",
      salutation: "Sig.ra",
      firstName: "Laura",
      lastName: "Verdi",
      phone: "348-7654321",
      email: "laura.verdi@example.com",
      isFriend: true,
      religion: null,
      birthday: "1978-03-22",
      contractType: "standard",
      notes: "Proprietaria di un appartamento in zona residenziale. Motivata a vendere entro 6 mesi.",
    });
    
    // Add sample properties
    const property1 = this.createProperty({
      type: "apartment",
      address: "Via Roma 123",
      city: "Milano",
      size: 95,
      price: 320000,
      bedrooms: 2,
      bathrooms: 1,
      yearBuilt: 2005,
      energyClass: "B",
      description: "Bellissimo appartamento ristrutturato in zona centrale, vicino a servizi e trasporti. Secondo piano con ascensore, riscaldamento autonomo, aria condizionata.",
      status: "available",
      externalLink: "https://example.com/property/123",
      location: null,
    });
    
    const property2 = this.createProperty({
      type: "house",
      address: "Via Dante 45",
      city: "Milano",
      size: 150,
      price: 480000,
      bedrooms: 3,
      bathrooms: 2,
      yearBuilt: 1998,
      energyClass: "C",
      description: "Villetta a schiera su due livelli con giardino privato e box auto. Zona tranquilla e ben servita.",
      status: "available",
      externalLink: null,
      location: null,
    });
    
    // Associate client2 as seller of property2
    this.createSeller({
      id: 1,
      clientId: client2.id,
      propertyId: property2.id,
    });
    
    // Create buyer profile for client1
    this.createBuyer({
      id: 1,
      clientId: client1.id,
      minSize: 80,
      maxPrice: 350000,
      searchArea: null,
      urgency: 4,
      rating: 4,
      searchNotes: "Cerca appartamento con 2+ camere da letto, preferibilmente con balcone o terrazzo.",
    });
    
    // Add sample communications
    this.createCommunication({
      type: "whatsapp",
      direction: "outbound",
      clientId: client1.id,
      subject: "Primo contatto",
      content: "Buongiorno Sig. Bianchi, sono Marco Rossi dell'agenzia immobiliare. Volevo contattarla per discutere le sue esigenze riguardo la ricerca di un immobile. Quando possiamo fissare un appuntamento?",
      status: "completed",
      createdBy: 1,
      propertyId: null,
      needsFollowUp: false,
      followUpDate: null,
    });
    
    this.createCommunication({
      type: "whatsapp",
      direction: "inbound",
      clientId: client1.id,
      subject: "Risposta primo contatto",
      content: "Buongiorno, grazie per il messaggio. Sarei disponibile per un appuntamento in agenzia giovedì pomeriggio. Va bene?",
      status: "completed",
      createdBy: null,
      propertyId: null,
      needsFollowUp: false,
      followUpDate: null,
    });
    
    this.createCommunication({
      type: "whatsapp",
      direction: "outbound",
      clientId: client2.id,
      subject: "Aggiornamento vendita",
      content: "Buongiorno Sig.ra Verdi, volevo informarla che abbiamo alcuni potenziali acquirenti interessati a visitare il suo immobile. Possiamo organizzare una visita per domani?",
      status: "completed",
      createdBy: 1,
      propertyId: property2.id,
      needsFollowUp: true,
      followUpDate: "2023-11-25",
    });
    
    // Add sample appointments
    this.createAppointment({
      date: "2023-11-20",
      time: "15:30",
      type: "meeting",
      clientId: client1.id,
      propertyId: 0,
      notes: "Primo incontro in agenzia per discutere le esigenze del cliente",
      status: "completed",
      feedback: "Cliente molto interessato, ha definito bene le sue esigenze",
      createdAt: new Date("2023-11-18"),
    });
    
    this.createAppointment({
      date: "2023-11-22",
      time: "10:00",
      type: "visit",
      clientId: client1.id,
      propertyId: property1.id,
      notes: "Visita all'appartamento in Via Roma",
      status: "completed",
      feedback: "Cliente interessato, ma preoccupato per il prezzo. Valuta di fare un'offerta.",
      createdAt: new Date("2023-11-19"),
    });
    
    this.createAppointment({
      date: "2023-11-25",
      time: "16:00",
      type: "visit",
      clientId: client1.id,
      propertyId: property2.id,
      notes: "Visita alla villetta in Via Dante",
      status: "scheduled",
      feedback: null,
      createdAt: new Date("2023-11-23"),
    });
    
    // Add sample tasks
    this.createTask({
      type: "follow_up",
      title: "Richiamare Sig. Bianchi per feedback dopo visita",
      dueDate: "2023-11-24",
      clientId: client1.id,
      description: "Chiedere impressioni sulla visita in Via Roma e se è interessato a fare un'offerta",
      status: "pending",
      propertyId: property1.id,
      assignedTo: 1,
    });
    
    this.createTask({
      type: "document",
      title: "Preparare documentazione per Sig.ra Verdi",
      dueDate: "2023-11-26",
      clientId: client2.id,
      description: "Preparare i documenti necessari per la vendita dell'immobile",
      status: "pending",
      propertyId: property2.id,
      assignedTo: 1,
    });
    // Add sample clients, properties, appointments, tasks, etc.
    // This would be populated in a real implementation
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.userStore.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.userStore.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = { 
      ...user, 
      id,
      role: user.role || null,
      phone: user.phone || null,
      avatarUrl: user.avatarUrl || null
    };
    this.userStore.set(id, newUser);
    return newUser;
  }
  
  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.userStore.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser = { ...existingUser, ...data };
    this.userStore.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.userStore.delete(id);
  }
  
  // Client methods
  async getClient(id: number): Promise<Client | undefined> {
    return this.clientStore.get(id);
  }
  
  async getClientByPhone(phone: string): Promise<Client | undefined> {
    console.log("[STORAGE] Ricerca cliente per telefono:", phone);
    
    // Normalizza il numero di telefono rimuovendo spazi, trattini e il prefisso + iniziale
    let normalizedPhone = phone.replace(/[\s\-\+]/g, '');
    
    // Rimuovi anche eventuali prefissi internazionali (es. 39 per Italia)
    // Se il numero inizia con prefisso Italia (39), rimuovilo
    if (normalizedPhone.startsWith('39') && normalizedPhone.length > 10) {
      normalizedPhone = normalizedPhone.substring(2);
    }
    
    console.log("[STORAGE] Telefono normalizzato:", normalizedPhone);
    
    // Cerca il cliente per numero di telefono normalizzato
    const client = Array.from(this.clientStore.values()).find(client => {
      let clientPhone = client.phone?.replace(/[\s\-\+]/g, '') || '';
      
      // Rimuovi anche dal numero del cliente eventuali prefissi internazionali
      if (clientPhone.startsWith('39') && clientPhone.length > 10) {
        clientPhone = clientPhone.substring(2);
      }
      
      // Log per debug
      console.log("[STORAGE] Confronto: ", 
                 { clientId: client.id, 
                   clientName: `${client.firstName} ${client.lastName}`, 
                   clientPhone, 
                   normalizedPhone,
                   match: clientPhone === normalizedPhone });
      
      return clientPhone === normalizedPhone;
    });
    
    if (client) {
      console.log("[STORAGE] Cliente trovato:", client.id, client.firstName, client.lastName);
    } else {
      console.log("[STORAGE] Nessun cliente trovato con il numero:", normalizedPhone);
    }
    
    return client;
  }
  
  async getClients(filters?: { type?: string; search?: string }): Promise<Client[]> {
    let clients = Array.from(this.clientStore.values());
    
    if (filters) {
      if (filters.type && filters.type !== "all") {
        clients = clients.filter((client) => client.type === filters.type);
      }
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        clients = clients.filter((client) => 
          client.firstName.toLowerCase().includes(search) ||
          client.lastName.toLowerCase().includes(search) ||
          (client.email && client.email.toLowerCase().includes(search)) ||
          client.phone.toLowerCase().includes(search)
        );
      }
    }
    
    return clients;
  }
  
  async getClientWithDetails(id: number): Promise<ClientWithDetails | undefined> {
    const client = this.clientStore.get(id);
    if (!client) return undefined;
    
    let clientWithDetails: ClientWithDetails = { ...client };
    
    // Add buyer details if client is a buyer
    if (client.type === "buyer") {
      const buyer = Array.from(this.buyerStore.values()).find(
        (buyer) => buyer.clientId === client.id
      );
      if (buyer) {
        clientWithDetails.buyer = buyer;
      }
    }
    
    // Add seller details if client is a seller
    if (client.type === "seller") {
      const seller = Array.from(this.sellerStore.values()).find(
        (seller) => seller.clientId === client.id
      );
      if (seller) {
        clientWithDetails.seller = seller;
        
        // Add property if seller has one
        if (seller.propertyId) {
          const property = this.propertyStore.get(seller.propertyId);
          if (property) {
            clientWithDetails.properties = [property];
          }
        }
      }
    }
    
    // Add appointments
    const appointments = Array.from(this.appointmentStore.values()).filter(
      (appointment) => appointment.clientId === client.id
    );
    if (appointments.length > 0) {
      clientWithDetails.appointments = appointments;
    }
    
    // Add tasks
    const tasks = Array.from(this.taskStore.values()).filter(
      (task) => task.clientId === client.id
    );
    if (tasks.length > 0) {
      clientWithDetails.tasks = tasks;
    }
    
    // Add communications
    const communications = Array.from(this.communicationStore.values()).filter(
      (communication) => communication.clientId === client.id
    );
    if (communications.length > 0) {
      clientWithDetails.communications = communications;
      
      // Add last communication
      const sortedComms = [...communications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      if (sortedComms.length > 0) {
        clientWithDetails.lastCommunication = sortedComms[0];
        
        // Calculate days since last communication
        const now = new Date();
        const lastCommDate = new Date(sortedComms[0].createdAt);
        const diffTime = Math.abs(now.getTime() - lastCommDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        clientWithDetails.daysSinceLastCommunication = diffDays;
      }
    }
    
    return clientWithDetails;
  }
  
  async createClient(client: InsertClient): Promise<Client> {
    const id = this.clientIdCounter++;
    const now = new Date();
    
    const newClient: Client = {
      ...client,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.clientStore.set(id, newClient);
    return newClient;
  }
  
  async updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined> {
    const existingClient = this.clientStore.get(id);
    if (!existingClient) return undefined;
    
    const updatedClient: Client = {
      ...existingClient,
      ...data,
      updatedAt: new Date()
    };
    
    this.clientStore.set(id, updatedClient);
    return updatedClient;
  }
  
  async deleteClient(id: number): Promise<boolean> {
    // Delete related buyers or sellers
    const client = this.clientStore.get(id);
    if (client) {
      if (client.type === "buyer") {
        const buyer = Array.from(this.buyerStore.values()).find(
          (buyer) => buyer.clientId === id
        );
        if (buyer) {
          this.buyerStore.delete(buyer.id);
        }
      } else if (client.type === "seller") {
        const seller = Array.from(this.sellerStore.values()).find(
          (seller) => seller.clientId === id
        );
        if (seller) {
          this.sellerStore.delete(seller.id);
        }
      }
      
      // Delete related appointments
      Array.from(this.appointmentStore.values())
        .filter((appointment) => appointment.clientId === id)
        .forEach((appointment) => this.appointmentStore.delete(appointment.id));
      
      // Delete related tasks
      Array.from(this.taskStore.values())
        .filter((task) => task.clientId === id)
        .forEach((task) => this.taskStore.delete(task.id));
      
      // Delete related communications
      Array.from(this.communicationStore.values())
        .filter((communication) => communication.clientId === id)
        .forEach((communication) => this.communicationStore.delete(communication.id));
    }
    
    return this.clientStore.delete(id);
  }
  
  // Buyer methods
  async getBuyer(id: number): Promise<Buyer | undefined> {
    return this.buyerStore.get(id);
  }
  
  async getBuyerByClientId(clientId: number): Promise<Buyer | undefined> {
    return Array.from(this.buyerStore.values()).find(
      (buyer) => buyer.clientId === clientId
    );
  }
  
  async getBuyerPreferences(clientId: number): Promise<Buyer | undefined> {
    // In MemStorage, this is the same as getBuyerByClientId
    return this.getBuyerByClientId(clientId);
  }
  
  async createBuyer(buyer: InsertBuyer): Promise<Buyer> {
    const id = this.buyerIdCounter++;
    const newBuyer = { ...buyer, id };
    this.buyerStore.set(id, newBuyer);
    return newBuyer;
  }
  
  async updateBuyer(id: number, data: Partial<InsertBuyer>): Promise<Buyer | undefined> {
    const existingBuyer = this.buyerStore.get(id);
    if (!existingBuyer) return undefined;
    
    const updatedBuyer = { ...existingBuyer, ...data };
    this.buyerStore.set(id, updatedBuyer);
    return updatedBuyer;
  }
  
  async deleteBuyer(id: number): Promise<boolean> {
    return this.buyerStore.delete(id);
  }
  
  // Seller methods
  async getSeller(id: number): Promise<Seller | undefined> {
    return this.sellerStore.get(id);
  }
  
  async getSellerByClientId(clientId: number): Promise<Seller | undefined> {
    return Array.from(this.sellerStore.values()).find(
      (seller) => seller.clientId === clientId
    );
  }
  
  async createSeller(seller: InsertSeller): Promise<Seller> {
    const id = this.sellerIdCounter++;
    const newSeller = { ...seller, id };
    this.sellerStore.set(id, newSeller);
    return newSeller;
  }
  
  async updateSeller(id: number, data: Partial<InsertSeller>): Promise<Seller | undefined> {
    const existingSeller = this.sellerStore.get(id);
    if (!existingSeller) return undefined;
    
    const updatedSeller = { ...existingSeller, ...data };
    this.sellerStore.set(id, updatedSeller);
    return updatedSeller;
  }
  
  async deleteSeller(id: number): Promise<boolean> {
    return this.sellerStore.delete(id);
  }
  
  // Property methods
  async getProperty(id: number): Promise<Property | undefined> {
    return this.propertyStore.get(id);
  }
  
  async getPropertyByExternalId(externalId: string): Promise<Property | undefined> {
    return Array.from(this.propertyStore.values()).find(
      property => property.externalId === externalId
    );
  }
  
  async getProperties(filters?: { status?: string; search?: string; ownerType?: string; page?: number; limit?: number; showPrivate?: boolean; showMonoShared?: boolean; showMultiShared?: boolean }): Promise<{ properties: Property[], total: number, page: number, limit: number, totalPages: number }> {
    let properties = Array.from(this.propertyStore.values());
    
    if (filters) {
      if (filters.status && filters.status !== "all") {
        properties = properties.filter((property) => property.status === filters.status);
      }
      
      if (filters.ownerType) {
        properties = properties.filter((property) => property.ownerType === filters.ownerType);
      }
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        properties = properties.filter((property) => 
          property.address.toLowerCase().includes(search) ||
          property.city.toLowerCase().includes(search) ||
          property.type.toLowerCase().includes(search)
        );
      }
      
      // Apply property type filters
      const showPrivate = filters.showPrivate !== false;
      const showMonoShared = filters.showMonoShared !== false;
      const showMultiShared = filters.showMultiShared !== false;
      
      properties = properties.filter((property) => {
        // Pluricondivisi: is_multiagency = true (more than one agency)
        if (property.isMultiagency) {
          return showMultiShared;
        }
        // Monocondivisi: ownerType = 'agency' AND NOT multiagency (single agency)
        if (property.ownerType === 'agency') {
          return showMonoShared;
        }
        // Privati: ownerType = 'private' (private owners)
        if (property.ownerType === 'private') {
          return showPrivate;
        }
        // Default: show if private is enabled
        return showPrivate;
      });
    }
    
    const total = properties.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 100;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    
    const paginatedProperties = properties.slice(offset, offset + limit);
    
    return {
      properties: paginatedProperties,
      total,
      page,
      limit,
      totalPages
    };
  }
  

  
  async createProperty(property: InsertProperty): Promise<Property> {
    const id = this.propertyIdCounter++;
    const now = new Date();
    
    const newProperty: Property = {
      ...property,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    this.propertyStore.set(id, newProperty);
    
    // Create shared property if needed
    if (property.isShared) {
      const sharedPropertyData: InsertSharedProperty = {
        propertyId: id,
        agencyName: "", // These would be provided separately
        isAcquired: false
      };
      await this.createSharedProperty(sharedPropertyData);
    }
    
    return newProperty;
  }
  
  async updateProperty(id: number, data: Partial<InsertProperty>): Promise<Property | undefined> {
    const existingProperty = this.propertyStore.get(id);
    if (!existingProperty) return undefined;
    
    const updatedProperty: Property = {
      ...existingProperty,
      ...data,
      updatedAt: new Date()
    };
    
    this.propertyStore.set(id, updatedProperty);
    
    // Update shared property status if needed
    if ('isShared' in data) {
      const sharedProperty = Array.from(this.sharedPropertyStore.values()).find(
        (shared) => shared.propertyId === id
      );
      
      if (data.isShared && !sharedProperty) {
        // Create new shared property entry
        const sharedPropertyData: InsertSharedProperty = {
          propertyId: id,
          agencyName: "", // These would be provided separately
          isAcquired: false
        };
        await this.createSharedProperty(sharedPropertyData);
      } else if (!data.isShared && sharedProperty) {
        // Remove shared property entry
        await this.deleteSharedProperty(sharedProperty.id);
      }
    }
    
    return updatedProperty;
  }
  
  async deleteProperty(id: number): Promise<boolean> {
    // Delete related shared property
    const sharedProperty = Array.from(this.sharedPropertyStore.values()).find(
      (shared) => shared.propertyId === id
    );
    if (sharedProperty) {
      this.sharedPropertyStore.delete(sharedProperty.id);
    }
    
    // Delete related appointments
    Array.from(this.appointmentStore.values())
      .filter((appointment) => appointment.propertyId === id)
      .forEach((appointment) => this.appointmentStore.delete(appointment.id));
    
    // Delete related tasks
    Array.from(this.taskStore.values())
      .filter((task) => task.propertyId === id)
      .forEach((task) => this.taskStore.delete(task.id));
    
    // Delete related communications
    Array.from(this.communicationStore.values())
      .filter((communication) => communication.propertyId === id)
      .forEach((communication) => this.communicationStore.delete(communication.id));
    
    // Update seller references
    Array.from(this.sellerStore.values())
      .filter((seller) => seller.propertyId === id)
      .forEach((seller) => {
        seller.propertyId = undefined;
        this.sellerStore.set(seller.id, seller);
      });
    
    return this.propertyStore.delete(id);
  }
  
  // Shared property methods
  
  async createSharedProperty(sharedProperty: InsertSharedProperty): Promise<SharedProperty> {
    const id = this.sharedPropertyIdCounter++;
    const newSharedProperty = { ...sharedProperty, id };
    this.sharedPropertyStore.set(id, newSharedProperty);
    return newSharedProperty;
  }
  
  async updateSharedProperty(id: number, data: Partial<InsertSharedProperty>): Promise<SharedProperty | undefined> {
    const existingSharedProperty = this.sharedPropertyStore.get(id);
    if (!existingSharedProperty) return undefined;
    
    const updatedSharedProperty = { ...existingSharedProperty, ...data };
    this.sharedPropertyStore.set(id, updatedSharedProperty);
    return updatedSharedProperty;
  }
  
  async deleteSharedProperty(id: number): Promise<boolean> {
    return this.sharedPropertyStore.delete(id);
  }
  
  // Appointment methods
  async getAppointment(id: number): Promise<Appointment | undefined> {
    return this.appointmentStore.get(id);
  }
  
  async getAppointments(filters?: { status?: string; date?: string }): Promise<Appointment[]> {
    let appointments = Array.from(this.appointmentStore.values());
    
    if (filters) {
      if (filters.status && filters.status !== "all") {
        appointments = appointments.filter((appointment) => appointment.status === filters.status);
      }
      
      if (filters.date) {
        appointments = appointments.filter((appointment) => 
          appointment.date === filters.date
        );
      }
    }
    
    // Add client and property details
    return appointments.map(appointment => {
      const extendedAppointment: any = { ...appointment };
      
      const client = this.clientStore.get(appointment.clientId);
      if (client) {
        extendedAppointment.client = client;
      }
      
      const property = this.propertyStore.get(appointment.propertyId);
      if (property) {
        extendedAppointment.property = property;
      }
      
      return extendedAppointment;
    });
  }
  
  async getAppointmentsByClientId(clientId: number): Promise<Appointment[]> {
    return Array.from(this.appointmentStore.values()).filter(
      (appointment) => appointment.clientId === clientId
    );
  }
  

  
  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const id = this.appointmentIdCounter++;
    const newAppointment: Appointment = {
      ...appointment,
      id,
      createdAt: new Date()
    };
    
    this.appointmentStore.set(id, newAppointment);
    return newAppointment;
  }
  
  async updateAppointment(id: number, data: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const existingAppointment = this.appointmentStore.get(id);
    if (!existingAppointment) return undefined;
    
    const updatedAppointment = { ...existingAppointment, ...data };
    this.appointmentStore.set(id, updatedAppointment);
    return updatedAppointment;
  }
  
  async deleteAppointment(id: number): Promise<boolean> {
    return this.appointmentStore.delete(id);
  }
  
  // Task methods
  async getTask(id: number): Promise<Task | undefined> {
    return this.taskStore.get(id);
  }
  
  async getTasks(filters?: { status?: string; type?: string; search?: string; limit?: number; clientId?: number; propertyId?: number; sharedPropertyId?: number }): Promise<TaskWithClient[]> {
    let tasks = Array.from(this.taskStore.values());
    
    // Apply filters
    if (filters) {
      if (filters.status && filters.status !== "all") {
        tasks = tasks.filter((task) => task.status === filters.status);
      }
      
      if (filters.type && filters.type !== "all") {
        tasks = tasks.filter((task) => task.type === filters.type);
      }
      
      if (filters.clientId !== undefined) {
        tasks = tasks.filter((task) => task.clientId === filters.clientId);
      }
      
      if (filters.propertyId !== undefined) {
        tasks = tasks.filter((task) => task.propertyId === filters.propertyId);
      }
      
      if (filters.sharedPropertyId !== undefined) {
        tasks = tasks.filter((task) => task.sharedPropertyId === filters.sharedPropertyId);
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        tasks = tasks.filter((task) => 
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower)
        );
      }
    }
    
    // Add client details
    const tasksWithClient = tasks.map(task => {
      const extendedTask: any = { ...task };
      
      if (task.clientId) {
        const client = this.clientStore.get(task.clientId);
        if (client) {
          extendedTask.client = client;
          extendedTask.clientFirstName = client.firstName;
          extendedTask.clientLastName = client.lastName;
        }
      }
      
      if (task.propertyId) {
        const property = this.propertyStore.get(task.propertyId);
        if (property) {
          extendedTask.property = property;
        }
      }
      
      return extendedTask;
    });
    
    // Apply limit if specified
    if (filters?.limit) {
      return tasksWithClient.slice(0, filters.limit);
    }
    
    return tasksWithClient;
  }
  
  async getTasksByClientId(clientId: number): Promise<Task[]> {
    return Array.from(this.taskStore.values()).filter(
      (task) => task.clientId === clientId
    );
  }
  
  async getTasksByPropertyId(propertyId: number): Promise<Task[]> {
    return Array.from(this.taskStore.values()).filter(
      (task) => task.propertyId === propertyId
    );
  }
  
  async getTasksBySharedPropertyId(sharedPropertyId: number): Promise<Task[]> {
    return Array.from(this.taskStore.values()).filter(
      (task) => task.sharedPropertyId === sharedPropertyId
    );
  }
  
  async createTask(task: InsertTask): Promise<Task> {
    const id = this.taskIdCounter++;
    const newTask: Task = {
      ...task,
      id,
      createdAt: new Date()
    };
    
    this.taskStore.set(id, newTask);
    return newTask;
  }
  
  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const existingTask = this.taskStore.get(id);
    if (!existingTask) return undefined;
    
    const updatedTask = { ...existingTask, ...data };
    this.taskStore.set(id, updatedTask);
    return updatedTask;
  }
  
  async completeTask(id: number): Promise<Task | undefined> {
    const existingTask = this.taskStore.get(id);
    if (!existingTask) return undefined;
    
    const updatedTask = { ...existingTask, status: "completed" };
    this.taskStore.set(id, updatedTask);
    return updatedTask;
  }
  
  async deleteTask(id: number): Promise<boolean> {
    return this.taskStore.delete(id);
  }
  
  // Client conversation task methods
  async findClientConversationTask(clientId: number): Promise<Task | undefined> {
    return Array.from(this.taskStore.values()).find(
      task => task.type === 'client_conversation' && task.clientId === clientId
    );
  }
  
  async upsertClientConversationTask(clientId: number, data: Partial<InsertTask>): Promise<Task> {
    const existingTask = await this.findClientConversationTask(clientId);
    
    if (existingTask) {
      // Update existing task
      const updatedTask: Task = {
        ...existingTask,
        ...data,
        id: existingTask.id,
        createdAt: existingTask.createdAt
      };
      this.taskStore.set(existingTask.id, updatedTask);
      return updatedTask;
    } else {
      // Create new task
      return await this.createTask({
        ...data,
        type: 'client_conversation',
        clientId: clientId,
        title: data.title || `Gestire comunicazioni con cliente ${clientId}`,
        dueDate: data.dueDate || new Date().toISOString().split('T')[0],
        status: data.status || 'pending'
      } as InsertTask);
    }
  }
  
  async getClientCommunicationsTimeline(clientId: number): Promise<Communication[]> {
    return await this.getCommunicationsByClientId(clientId);
  }
  
  // Communication methods
  async getCommunication(id: number): Promise<Communication | undefined> {
    return this.communicationStore.get(id);
  }
  
  async getCommunicationByExternalId(externalId: string): Promise<Communication | undefined> {
    return Array.from(this.communicationStore.values()).find(
      comm => comm.externalId === externalId
    );
  }
  
  async getCommunicationByCorrelationId(correlationId: string): Promise<Communication | undefined> {
    return Array.from(this.communicationStore.values()).find(
      comm => comm.correlationId === correlationId
    );
  }
  
  async getCommunications(filters?: { type?: string; status?: string }): Promise<Communication[]> {
    let communications = Array.from(this.communicationStore.values());
    
    if (filters) {
      if (filters.type && filters.type !== "all") {
        communications = communications.filter((comm) => comm.type === filters.type);
      }
      
      if (filters.status && filters.status !== "all") {
        communications = communications.filter((comm) => comm.status === filters.status);
      }
    }
    
    // Add client and property details
    return communications.map(comm => {
      const extendedComm: any = { ...comm };
      
      if (comm.clientId) {
        const client = this.clientStore.get(comm.clientId);
        if (client) {
          extendedComm.client = client;
        }
      }
      
      if (comm.propertyId) {
        const property = this.propertyStore.get(comm.propertyId);
        if (property) {
          extendedComm.property = property;
        }
      }
      
      return extendedComm;
    });
  }
  
  async getCommunicationsByClientId(clientId: number): Promise<Communication[]> {
    return Array.from(this.communicationStore.values())
      .filter((comm) => comm.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getCommunicationsByPropertyId(propertyId: number): Promise<Communication[]> {
    return Array.from(this.communicationStore.values())
      .filter((comm) => comm.propertyId === propertyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getCommunicationsByResponseToId(responseToId: number): Promise<Communication[]> {
    return Array.from(this.communicationStore.values())
      .filter((comm) => comm.responseToId === responseToId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getLastCommunicationByClientId(clientId: number): Promise<Communication | undefined> {
    const communications = await this.getCommunicationsByClientId(clientId);
    return communications.length > 0 ? communications[0] : undefined;
  }
  
  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    const id = this.communicationIdCounter++;
    const newCommunication: Communication = {
      ...communication,
      id,
      createdAt: new Date()
    };
    
    this.communicationStore.set(id, newCommunication);
    return newCommunication;
  }
  
  async updateCommunication(id: number, data: Partial<InsertCommunication>): Promise<Communication | undefined> {
    const existingCommunication = this.communicationStore.get(id);
    if (!existingCommunication) return undefined;
    
    const updatedCommunication = { ...existingCommunication, ...data };
    this.communicationStore.set(id, updatedCommunication);
    return updatedCommunication;
  }
  
  async deleteCommunication(id: number): Promise<boolean> {
    return this.communicationStore.delete(id);
  }
  
  async createPropertyActivity(activity: InsertPropertyActivity): Promise<PropertyActivity> {
    const id = this.propertyActivityIdCounter++;
    const newActivity: PropertyActivity = {
      ...activity,
      id,
      createdAt: new Date()
    };
    
    this.propertyActivityStore.set(id, newActivity);
    return newActivity;
  }
  
  async getClientsWithoutRecentCommunication(days: number, minRating: number): Promise<ClientWithDetails[]> {
    const clients = Array.from(this.clientStore.values());
    const result: ClientWithDetails[] = [];
    
    for (const client of clients) {
      const buyer = await this.getBuyerByClientId(client.id);
      // Check if client has high priority rating
      if (buyer && buyer.rating && buyer.rating >= minRating) {
        // Get last communication
        const lastComm = await this.getLastCommunicationByClientId(client.id);
        
        // If no communication or last communication is older than specified days
        if (!lastComm || this.isDaysOlderThan(lastComm.createdAt, days)) {
          const clientWithDetails = await this.getClientWithDetails(client.id);
          if (clientWithDetails) {
            result.push(clientWithDetails);
          }
        }
      }
    }
    
    return result;
  }
  
  private isDaysOlderThan(date: Date, days: number): boolean {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(date).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > days;
  }
  
  // Market insight methods
  async getMarketInsight(id: number): Promise<MarketInsight | undefined> {
    return this.marketInsightStore.get(id);
  }
  
  async getMarketInsights(filters?: { area?: string; month?: number; year?: number }): Promise<MarketInsight[]> {
    let insights = Array.from(this.marketInsightStore.values());
    
    if (filters) {
      if (filters.area) {
        insights = insights.filter((insight) => insight.area === filters.area);
      }
      
      if (filters.month !== undefined) {
        insights = insights.filter((insight) => insight.month === filters.month);
      }
      
      if (filters.year !== undefined) {
        insights = insights.filter((insight) => insight.year === filters.year);
      }
    }
    
    return insights;
  }
  
  async createMarketInsight(insight: InsertMarketInsight): Promise<MarketInsight> {
    const id = this.marketInsightIdCounter++;
    const newInsight: MarketInsight = {
      ...insight,
      id,
      createdAt: new Date()
    };
    
    this.marketInsightStore.set(id, newInsight);
    return newInsight;
  }
  
  async updateMarketInsight(id: number, data: Partial<InsertMarketInsight>): Promise<MarketInsight | undefined> {
    const existingInsight = this.marketInsightStore.get(id);
    if (!existingInsight) return undefined;
    
    const updatedInsight = { ...existingInsight, ...data };
    this.marketInsightStore.set(id, updatedInsight);
    return updatedInsight;
  }
  
  async deleteMarketInsight(id: number): Promise<boolean> {
    return this.marketInsightStore.delete(id);
  }
  
  // Helper method to normalize property types for matching
  private normalizePropertyType(type: string | undefined | null): string {
    if (!type) return '';
    const normalized = type.toLowerCase().trim();
    
    // Map common synonyms to standardized types
    if (normalized === 'appartamento' || normalized === 'apartment') return 'apartment';
    if (normalized === 'attico' || normalized === 'penthouse') return 'penthouse';
    if (normalized === 'monolocale') return 'apartment'; // Monolocale is a type of apartment
    if (normalized === 'villa') return 'villa';
    if (normalized === 'loft') return 'loft';
    
    return normalized;
  }

  // Matching methods
  async matchPropertiesForBuyer(buyerId: number): Promise<Property[]> {
    const buyer = this.buyerStore.get(buyerId);
    if (!buyer) return [];
    
    // Get all available properties
    const properties = Array.from(this.propertyStore.values()).filter(
      (property) => property.status === "available"
    );
    
    // Filter properties based on buyer criteria
    return properties.filter(property => {
      // Property type check - strict matching required if buyer specifies a type
      if (buyer.propertyType) {
        const buyerType = this.normalizePropertyType(buyer.propertyType);
        const propertyType = this.normalizePropertyType(property.type);
        
        if (buyerType && propertyType !== buyerType) {
          return false;
        }
      }
      
      // Size check with 10% tolerance (può essere fino al 10% in meno della metratura minima richiesta)
      if (buyer.minSize && property.size < buyer.minSize * 0.9) {
        return false;
      }
      
      // Price check with 10% tolerance (può essere fino al 10% in più del prezzo massimo richiesto)
      if (buyer.maxPrice && property.price > buyer.maxPrice * 1.1) {
        return false;
      }
      
      // Check if property is in the search area (simplified)
      // In a real implementation, we'd use a proper geospatial check
      if (buyer.searchArea) {
        // This is a simplified check, in reality we'd use a proper GeoJSON library
        // to check if the property location is inside the polygon
        return true; // Assume it's in the area for now
      }
      
      return true;
    });
  }
  
  /**
   * Verifica se un immobile corrisponde alle preferenze di un acquirente,
   * applicando i criteri di tolleranza richiesti:
   * - Tipologia proprietà (matching esatto)
   * - Poligono di ricerca (semplificato)
   * - Metratura fino al 10% in meno del minimo richiesto
   * - Prezzo fino al 10% in più del massimo richiesto
   */
  isPropertyMatchingBuyerCriteria(property: Property, buyer: Buyer): boolean {
    // Property type check - strict matching required if buyer specifies a type
    if (buyer.propertyType) {
      const buyerType = this.normalizePropertyType(buyer.propertyType);
      const propertyType = this.normalizePropertyType(property.type);
      
      if (buyerType && propertyType !== buyerType) {
        return false;
      }
    }
    
    // Size check with 10% tolerance
    if (buyer.minSize && property.size < buyer.minSize * 0.9) {
      return false;
    }
    
    // Price check with 10% tolerance
    if (buyer.maxPrice && property.price > buyer.maxPrice * 1.1) {
      return false;
    }
    
    // Check if property is in the search area (simplified)
    if (buyer.searchArea) {
      // This is a simplified check, in reality we'd use a proper GeoJSON library
      // to check if the property location is inside the polygon
      return true; // Assume it's in the area for now
    }
    
    return true;
  }
  
  async matchBuyersForProperty(propertyId: number): Promise<Client[]> {
    const property = this.propertyStore.get(propertyId);
    if (!property) return [];
    
    // Get all buyers
    const buyers = Array.from(this.buyerStore.values());
    const matchedClients: Client[] = [];
    
    for (const buyer of buyers) {
      // Apply the same criteria using isPropertyMatchingBuyerCriteria
      if (this.isPropertyMatchingBuyerCriteria(property, buyer)) {
        // Add matched client
        const client = this.clientStore.get(buyer.clientId);
        if (client) {
          matchedClients.push(client);
        }
      }
    }
    
    return matchedClients;
  }

  // AI Match methods (for matches table with reasoning) - MemStorage implementation
  private matchStore: Map<number, Match> = new Map();
  private matchIdCounter = 1;

  async createMatch(match: InsertMatch): Promise<Match> {
    const id = this.matchIdCounter++;
    const newMatch: Match = {
      ...match,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Match;
    this.matchStore.set(id, newMatch);
    return newMatch;
  }

  async getMatchesByClientId(clientId: number): Promise<Match[]> {
    return Array.from(this.matchStore.values())
      .filter(m => m.clientId === clientId)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  async deleteMatchesByClientId(clientId: number): Promise<boolean> {
    const toDelete = Array.from(this.matchStore.entries())
      .filter(([_, m]) => m.clientId === clientId)
      .map(([id, _]) => id);
    toDelete.forEach(id => this.matchStore.delete(id));
    return true;
  }

  // Implementazione metodi per le proprietà condivise
  async getSharedProperty(id: number): Promise<SharedProperty | undefined> {
    return this.sharedPropertyStore.get(id);
  }
  
  async getSharedPropertyByPropertyId(propertyId: number): Promise<SharedProperty | undefined> {
    return Array.from(this.sharedPropertyStore.values()).find(
      (sp) => sp.propertyId === propertyId
    );
  }

  async getSharedProperties(filters?: { stage?: string; search?: string; isFavorite?: boolean }): Promise<SharedProperty[]> {
    let sharedProperties = Array.from(this.sharedPropertyStore.values());
    
    if (filters) {
      if (filters.stage) {
        sharedProperties = sharedProperties.filter(sp => sp.stage === filters.stage);
      }
      
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        sharedProperties = sharedProperties.filter(sp => 
          sp.address.toLowerCase().includes(searchTerm) ||
          (sp.city && sp.city.toLowerCase().includes(searchTerm)) ||
          (sp.ownerName && sp.ownerName.toLowerCase().includes(searchTerm))
        );
      }
      
      if (filters.isFavorite !== undefined) {
        sharedProperties = sharedProperties.filter(sp => sp.isFavorite === filters.isFavorite);
      }
    }
    
    return sharedProperties;
  }
  
  async getSharedPropertyWithDetails(id: number): Promise<SharedPropertyWithDetails | undefined> {
    const sharedProperty = await this.getSharedProperty(id);
    if (!sharedProperty) return undefined;
    
    // Get tasks associated with this shared property
    const tasks = Array.from(this.taskStore.values()).filter(
      task => task.sharedPropertyId === id
    );
    
    // Get communications associated with this shared property
    const communications = Array.from(this.communicationStore.values()).filter(
      comm => comm.sharedPropertyId === id
    );
    
    // Get potential matching buyers
    const matchingBuyers: ClientWithDetails[] = [];
    if (sharedProperty.matchBuyers && sharedProperty.size && sharedProperty.price) {
      // Find potential buyers based on basic criteria
      const buyers = Array.from(this.buyerStore.values());
      for (const buyer of buyers) {
        if (
          (!buyer.minSize || sharedProperty.size >= buyer.minSize) &&
          (!buyer.maxPrice || sharedProperty.price <= buyer.maxPrice)
        ) {
          const client = await this.getClientWithDetails(buyer.clientId);
          if (client) {
            matchingBuyers.push(client);
          }
        }
      }
    }
    
    // Combine all activities (tasks and communications) to find the latest
    const allActivities = [...tasks, ...communications];
    allActivities.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    const lastActivity = allActivities.length > 0 ? allActivities[0] : undefined;
    
    return {
      ...sharedProperty,
      tasks,
      communications,
      lastActivity,
      matchingBuyers
    };
  }
  

  
  async acquireSharedProperty(id: number): Promise<boolean> {
    const sharedProperty = await this.getSharedProperty(id);
    if (!sharedProperty) return false;
    
    // Mark property as acquired
    const updatedProperty = await this.updateSharedProperty(id, {
      isAcquired: true,
      stage: 'result',
      stageResult: 'acquired'
    });
    
    if (!updatedProperty) return false;
    
    // If we have owner info, create a new client (seller) 
    if (sharedProperty.ownerName) {
      const nameParts = sharedProperty.ownerName.split(' ');
      const firstName = nameParts[0] || 'Nome';
      const lastName = nameParts.slice(1).join(' ') || 'Cognome';
      
      // Create client
      const client = await this.createClient({
        type: 'seller',
        salutation: 'Sig.',
        firstName,
        lastName,
        phone: sharedProperty.ownerPhone || '',
        email: sharedProperty.ownerEmail || '',
        notes: sharedProperty.ownerNotes || '',
        isFriend: false,
        contractType: 'standard'
      });
      
      // Create/update property information
      const propertyData: InsertProperty = {
        address: sharedProperty.address,
        city: sharedProperty.city || 'Sconosciuta',
        type: sharedProperty.type || 'apartment',
        size: sharedProperty.size || 0,
        price: sharedProperty.price || 0,
        bedrooms: 0,
        bathrooms: 0,
        description: '',
        status: 'available',
        isShared: false,
        isOwned: true,
        location: sharedProperty.location,
      };
      
      let property;
      if (sharedProperty.propertyId) {
        // Update existing property
        property = await this.updateProperty(sharedProperty.propertyId, propertyData);
      } else {
        // Create new property
        property = await this.createProperty(propertyData);
      }
      
      if (property) {
        // Associate client as seller with this property
        await this.createSeller({
          clientId: client.id,
          propertyId: property.id
        });
        
        // Copy tasks and communications to the new property/client
        const tasks = Array.from(this.taskStore.values()).filter(
          task => task.sharedPropertyId === id
        );
        
        for (const task of tasks) {
          await this.createTask({
            ...task,
            propertyId: property.id,
            clientId: client.id,
            sharedPropertyId: undefined
          });
        }
        
        const communications = Array.from(this.communicationStore.values()).filter(
          comm => comm.sharedPropertyId === id
        );
        
        for (const comm of communications) {
          await this.createCommunication({
            ...comm,
            propertyId: property.id,
            clientId: client.id,
            sharedPropertyId: undefined
          });
        }
        
        // If matchBuyers is true, automatically send property to matching buyers
        if (sharedProperty.matchBuyers) {
          const matchingBuyers = await this.getMatchingBuyersForSharedProperty(id);
          
          for (const buyer of matchingBuyers) {
            // Create a communication for each matching buyer
            await this.createCommunication({
              clientId: buyer.id,
              propertyId: property.id,
              type: 'property_sent',
              subject: 'Nuovo immobile corrispondente ai tuoi criteri',
              content: `Gentile ${buyer.firstName},\nAbbiamo appena acquisito un immobile che potrebbe interessarti: ${property.address} (${property.size}mq a ${property.price}€).`,
              direction: 'outbound',
              status: 'pending',
              needsFollowUp: true,
              followUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
              createdBy: 1,
            });
          }
        }
      }
    }
    
    return true;
  }
  
  async getMatchingBuyersForSharedProperty(sharedPropertyId: number): Promise<ClientWithDetails[]> {
    const sharedProperty = await this.getSharedProperty(sharedPropertyId);
    if (!sharedProperty || !sharedProperty.size || !sharedProperty.price) {
      return [];
    }
    
    // Crea un oggetto property temporaneo con le stesse proprietà della proprietà condivisa
    // necessario per poter utilizzare la funzione isPropertyMatchingBuyerCriteria
    const tempProperty: Property = {
      id: -1, // ID temporaneo, non serve per il matching
      address: sharedProperty.address,
      city: sharedProperty.city,
      price: sharedProperty.price,
      size: sharedProperty.size,
      type: sharedProperty.type || 'generic',
      status: 'available',
      location: sharedProperty.location,
      createdAt: new Date(),
      updatedAt: new Date(),
      isShared: true,
      isOwned: false
    };
    
    console.log(`[getMatchingBuyersForSharedProperty] Verifico matching per proprietà condivisa ${sharedPropertyId}`);
    
    // Importa la funzione di matching dalla libreria centralizzata
    const { isPropertyMatchingBuyerCriteria } = await import('./lib/matchingLogic');
    
    const matchingBuyers: ClientWithDetails[] = [];
    
    // Esegui query per trovare potenziali compratori (filtro iniziale)
    const potentialBuyers = await db
      .select()
      .from(buyers)
      .where(
        and(
          or(
            isNull(buyers.maxPrice),
            gte(buyers.maxPrice, Math.round(sharedProperty.price * 0.8)) // Tolleranza -20%: includi buyer che cercano proprietà più economiche
          ),
          or(
            isNull(buyers.minSize),
            lte(buyers.minSize, Math.round(sharedProperty.size / 0.9)) // Tolleranza 10% sulla dimensione
          )
        )
      );
    
    console.log(`[getMatchingBuyersForSharedProperty] Trovati ${potentialBuyers.length} potenziali acquirenti (filtro preliminare)`);
    
    // Verifica ogni potenziale acquirente con i criteri completi, inclusa la posizione geografica
    for (const buyer of potentialBuyers) {
      const client = await this.getClientWithDetails(buyer.clientId);
      if (client) {
        console.log(`[getMatchingBuyersForSharedProperty] Verifico client ${client.id} (${client.firstName} ${client.lastName}) per proprietà condivisa ${sharedPropertyId}`);
        
        try {
          // Verifica tutti i criteri, inclusa la posizione geografica
          const isMatch = isPropertyMatchingBuyerCriteria(tempProperty, buyer);
          console.log(`[getMatchingBuyersForSharedProperty] Risultato matching per ${client.firstName} ${client.lastName}: ${isMatch}`);
          
          if (isMatch) {
            console.log(`[getMatchingBuyersForSharedProperty] ✓ Cliente ${client.id} (${client.firstName} ${client.lastName}) corrisponde alla proprietà condivisa ${sharedPropertyId}`);
            matchingBuyers.push(client);
          } else {
            console.log(`[getMatchingBuyersForSharedProperty] ✗ Cliente ${client.id} (${client.firstName} ${client.lastName}) NON corrisponde alla proprietà condivisa ${sharedPropertyId}`);
          }
        } catch (error) {
          console.error(`[getMatchingBuyersForSharedProperty] Errore nel controllo matching per ${client.firstName} ${client.lastName}:`, error);
        }
      }
    }
    
    console.log(`[getMatchingBuyersForSharedProperty] ${matchingBuyers.length} clienti corrispondono alla proprietà condivisa ${sharedPropertyId} dopo tutti i controlli`);
    return matchingBuyers;
  }
  
  // Private contact tracking methods (stub - MemStorage not used in production)
  async getPrivateContactTracking(phoneNumber: string): Promise<PrivateContactTracking | undefined> {
    return undefined;
  }
  
  async createPrivateContactTracking(data: InsertPrivateContactTracking): Promise<PrivateContactTracking> {
    return { id: 1, phoneNumber: data.phoneNumber, firstContactedAt: new Date(), lastContactedAt: new Date(), contactCount: 1, status: 'active', ...data} as PrivateContactTracking;
  }
  
  async updatePrivateContactTracking(phoneNumber: string, data: Partial<InsertPrivateContactTracking>): Promise<PrivateContactTracking | undefined> {
    return undefined;
  }
  
  // WhatsApp campaign methods (stub)
  async getWhatsappCampaign(id: number): Promise<WhatsappCampaign | undefined> {
    return undefined;
  }
  
  async getAllWhatsappCampaigns(): Promise<WhatsappCampaign[]> {
    return [];
  }
  
  async createWhatsappCampaign(campaign: InsertWhatsappCampaign): Promise<WhatsappCampaign> {
    return { id: 1, createdAt: new Date(), ...campaign } as WhatsappCampaign;
  }
  
  async updateWhatsappCampaign(id: number, data: Partial<InsertWhatsappCampaign>): Promise<WhatsappCampaign | undefined> {
    return undefined;
  }
  
  // Campaign message methods (stub)
  async getCampaignMessage(id: number): Promise<CampaignMessage | undefined> {
    return undefined;
  }
  
  async getCampaignMessagesByPhone(phoneNumber: string): Promise<CampaignMessage[]> {
    return [];
  }
  
  async getCampaignMessagesByCampaign(campaignId: number): Promise<CampaignMessage[]> {
    return [];
  }
  
  async createCampaignMessage(message: InsertCampaignMessage): Promise<CampaignMessage> {
    return { id: 1, createdAt: new Date(), ...message } as CampaignMessage;
  }
  
  async updateCampaignMessage(id: number, data: Partial<InsertCampaignMessage>): Promise<CampaignMessage | undefined> {
    return undefined;
  }
  
  // Bot conversation log methods (stub)
  async createBotConversationLog(log: InsertBotConversationLog): Promise<BotConversationLog> {
    return { id: 1, timestamp: new Date(), ...log } as BotConversationLog;
  }
  
  async getBotConversationLogs(campaignMessageId: number): Promise<BotConversationLog[]> {
    return [];
  }
  
  // Client match caching methods (stub)
  async saveClientMatches(clientId: number, items: Array<{sharedPropertyId: number, score: number}>): Promise<void> {
    return;
  }
  
  async getClientMatchesFromCache(clientId: number): Promise<{matches: Match[], lastUpdated: Date | null}> {
    return { matches: [], lastUpdated: null };
  }
  
  async getMatchingPropertiesForClient(clientId: number, forceRecompute?: boolean): Promise<SharedProperty[]> {
    return [];
  }
  
  async getMultiAgencyProperties(): Promise<SharedProperty[]> {
    return [];
  }
  
  async getPrivateProperties(portalSource?: string): Promise<SharedProperty[]> {
    return [];
  }
}

// Export a single storage instance
// Database storage implementation
export class DatabaseStorage implements IStorage {
  async getCommunicationByExternalId(externalId: string): Promise<Communication | undefined> {
    const [communication] = await db
      .select()
      .from(communications)
      .where(eq(communications.externalId, externalId));
    return communication;
  }
  
  async getCommunicationByCorrelationId(correlationId: string): Promise<Communication | undefined> {
    const [communication] = await db
      .select()
      .from(communications)
      .where(eq(communications.correlationId, correlationId));
    return communication;
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result.length > 0 ? result[0] : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Client methods
  async getClient(id: number): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getClientByPhone(phone: string): Promise<Client | undefined> {
    console.log("[DB STORAGE] Ricerca cliente per telefono:", phone);
    
    // Normalizza il numero di telefono rimuovendo spazi, trattini, il prefisso + iniziale e @c.us
    let normalizedPhone = phone.replace(/@c\.us$/i, '').replace(/[\s\-\+]/g, '');
    
    // Gestisci sia numeri con prefisso Italia che senza
    let phoneWithoutPrefix = normalizedPhone;
    let phoneWithPrefix = normalizedPhone;
    
    // Se il numero inizia con il prefisso Italia (39), crea una versione senza prefisso
    if (normalizedPhone.startsWith('39') && normalizedPhone.length > 10) {
      phoneWithoutPrefix = normalizedPhone.substring(2);
    } 
    // Se il numero non ha prefisso, crea una versione con prefisso
    else if (!normalizedPhone.startsWith('39') && normalizedPhone.length === 10) {
      phoneWithPrefix = '39' + normalizedPhone;
    }
    
    console.log("[DB STORAGE] Varianti numeri di telefono per ricerca:", {
      normalizedPhone,
      phoneWithoutPrefix, 
      phoneWithPrefix
    });
    
    // Cerca il cliente usando OR con tutte le possibili varianti del numero
    const result = await db.select().from(clients).where(
      or(
        like(clients.phone, `%${normalizedPhone}%`),
        like(clients.phone, `%${phoneWithoutPrefix}%`),
        like(clients.phone, `%${phoneWithPrefix}%`)
      )
    );
    
    if (result.length > 0) {
      console.log("[DB STORAGE] Cliente trovato:", result[0]);
    } else {
      console.log("[DB STORAGE] Nessun cliente trovato con questi numeri di telefono");
    }
    
    return result.length > 0 ? result[0] : undefined;
  }

  async getClients(filters?: { type?: string; search?: string }): Promise<Client[]> {
    let query = db.select().from(clients);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.type) {
        conditions.push(eq(clients.type, filters.type));
      }
      
      if (filters.search) {
        const search = `%${filters.search}%`;
        conditions.push(
          or(
            like(clients.firstName, search),
            like(clients.lastName, search),
            like(clients.email, search),
            like(clients.phone, search)
          )
        );
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(clients.updatedAt));
  }

  async getClientWithDetails(id: number): Promise<ClientWithDetails | undefined> {
    const client = await this.getClient(id);
    if (!client) return undefined;
    
    const clientWithDetails: ClientWithDetails = { ...client };
    
    if (client.type === "buyer") {
      clientWithDetails.buyer = await this.getBuyerByClientId(id);
    } else if (client.type === "seller") {
      clientWithDetails.seller = await this.getSellerByClientId(id);
    }
    
    clientWithDetails.communications = await this.getCommunicationsByClientId(id);
    clientWithDetails.tasks = await this.getTasksByClientId(id);
    clientWithDetails.appointments = await this.getAppointmentsByClientId(id);
    
    // Get last communication
    const lastComm = await db.select()
      .from(communications)
      .where(eq(communications.clientId, id))
      .orderBy(desc(communications.createdAt))
      .limit(1);
    
    if (lastComm.length > 0) {
      clientWithDetails.lastCommunication = lastComm[0];
      
      // Calculate days since last communication
      const lastCommDate = new Date(lastComm[0].createdAt!);
      const currentDate = new Date();
      const diffTime = Math.abs(currentDate.getTime() - lastCommDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      clientWithDetails.daysSinceLastCommunication = diffDays;
    }
    
    return clientWithDetails;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(client).returning();
    return result[0];
  }

  async updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db.update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteClient(id: number): Promise<boolean> {
    try {
      // First delete related records
      await db.delete(buyers).where(eq(buyers.clientId, id));
      await db.delete(sellers).where(eq(sellers.clientId, id));
      await db.delete(appointments).where(eq(appointments.clientId, id));
      await db.delete(tasks).where(eq(tasks.clientId, id));
      await db.delete(communications).where(eq(communications.clientId, id));
      
      // Delete mail merge messages
      await db.execute(sql`DELETE FROM mail_merge_messages WHERE client_id = ${id}`);
      
      const result = await db.delete(clients).where(eq(clients.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("[DatabaseStorage.deleteClient] Errore durante l'eliminazione del cliente:", error);
      throw error;
    }
  }

  // Buyer methods
  async getBuyer(id: number): Promise<Buyer | undefined> {
    const result = await db.select().from(buyers).where(eq(buyers.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getBuyerByClientId(clientId: number): Promise<Buyer | undefined> {
    const result = await db.select().from(buyers).where(eq(buyers.clientId, clientId));
    return result.length > 0 ? result[0] : undefined;
  }
  
  async getBuyerPreferences(clientId: number): Promise<Buyer | undefined> {
    // For now, this is the same as getBuyerByClientId in this implementation
    return this.getBuyerByClientId(clientId);
  }

  async createBuyer(buyer: InsertBuyer): Promise<Buyer> {
    const result = await db.insert(buyers).values(buyer).returning();
    return result[0];
  }

  async updateBuyer(id: number, data: Partial<InsertBuyer>): Promise<Buyer | undefined> {
    const result = await db.update(buyers)
      .set(data)
      .where(eq(buyers.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteBuyer(id: number): Promise<boolean> {
    const result = await db.delete(buyers).where(eq(buyers.id, id)).returning();
    return result.length > 0;
  }

  // Seller methods
  async getSeller(id: number): Promise<Seller | undefined> {
    const result = await db.select().from(sellers).where(eq(sellers.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getSellerByClientId(clientId: number): Promise<Seller | undefined> {
    const result = await db.select().from(sellers).where(eq(sellers.clientId, clientId));
    return result.length > 0 ? result[0] : undefined;
  }

  async createSeller(seller: InsertSeller): Promise<Seller> {
    const result = await db.insert(sellers).values(seller).returning();
    return result[0];
  }

  async updateSeller(id: number, data: Partial<InsertSeller>): Promise<Seller | undefined> {
    const result = await db.update(sellers)
      .set(data)
      .where(eq(sellers.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteSeller(id: number): Promise<boolean> {
    const result = await db.delete(sellers).where(eq(sellers.id, id)).returning();
    return result.length > 0;
  }

  // Property methods
  async getProperty(id: number): Promise<Property | undefined> {
    const result = await db.select().from(properties).where(eq(properties.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getPropertyByExternalId(externalId: string): Promise<Property | undefined> {
    const result = await db.select().from(properties).where(eq(properties.externalId, externalId));
    return result.length > 0 ? result[0] : undefined;
  }

  async getProperties(filters?: { status?: string; search?: string; ownerType?: string; page?: number; limit?: number; showPrivate?: boolean; showMonoShared?: boolean; showMultiShared?: boolean }): Promise<{ properties: Property[], total: number, page: number, limit: number, totalPages: number }> {
    // Build where conditions
    const conditions: SQL[] = [];
    
    if (filters) {
      if (filters.status) {
        conditions.push(eq(properties.status, filters.status));
      }
      
      if (filters.ownerType) {
        conditions.push(eq(properties.ownerType, filters.ownerType));
      }
      
      if (filters.search) {
        // Split search query into words and search for each word
        const searchWords = filters.search.trim().split(/\s+/).filter(word => word.length > 0);
        
        if (searchWords.length > 0) {
          // For each word, create a condition that checks if it exists in address, city, or type
          const wordConditions = searchWords.map(word => {
            const searchPattern = `%${word}%`;
            return or(
              ilike(properties.address, searchPattern),
              ilike(properties.city, searchPattern),
              ilike(properties.type, searchPattern)
            );
          });
          
          // All words must match (AND logic)
          if (wordConditions.length === 1) {
            conditions.push(wordConditions[0]!);
          } else {
            conditions.push(and(...wordConditions)!);
          }
        }
      }
      
      // Apply property type filters
      const showPrivate = filters.showPrivate !== false;
      const showMonoShared = filters.showMonoShared !== false;
      const showMultiShared = filters.showMultiShared !== false;
      
      // Build property type condition
      const typeConditions: SQL[] = [];
      
      if (showPrivate) {
        // Privati: ownerType = 'private' (gestiti da privati)
        typeConditions.push(
          and(
            eq(properties.ownerType, 'private'),
            or(
              eq(properties.isMultiagency, false),
              sql`${properties.isMultiagency} IS NULL`
            )
          )!
        );
      }
      
      if (showMonoShared) {
        // Monocondivisi: ownerType = 'agency' AND NOT multiagency (una sola agenzia)
        typeConditions.push(
          and(
            eq(properties.ownerType, 'agency'),
            or(
              eq(properties.isMultiagency, false),
              sql`${properties.isMultiagency} IS NULL`
            )
          )!
        );
      }
      
      if (showMultiShared) {
        // Pluricondivisi: isMultiagency = true (più agenzie)
        typeConditions.push(eq(properties.isMultiagency, true));
      }
      
      // If not all types are shown, add filter
      if (!showPrivate || !showMonoShared || !showMultiShared) {
        if (typeConditions.length > 0) {
          conditions.push(or(...typeConditions)!);
        } else {
          // No types selected - return empty result
          conditions.push(sql`1 = 0`);
        }
      }
    }
    
    // Get total count
    let countQuery = db.select({ count: count() }).from(properties);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ count: total }] = await countQuery;
    
    // Get paginated results
    const page = filters?.page || 1;
    const limit = filters?.limit || 100;
    const offset = (page - 1) * limit;
    
    let query = db.select().from(properties);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const propertiesList = await query
      .orderBy(desc(properties.updatedAt))
      .limit(limit)
      .offset(offset);
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      properties: propertiesList,
      total,
      page,
      limit,
      totalPages
    };
  }

  async getPropertiesByIds(ids: number[]): Promise<Property[]> {
    if (ids.length === 0) return [];
    
    // Use inArray for efficient batch query
    const result = await db.select().from(properties).where(inArray(properties.id, ids));
    return result;
  }

  async getPropertyWithDetails(id: number): Promise<PropertyWithDetails | undefined> {
    const property = await this.getProperty(id);
    if (!property) return undefined;
    
    const propertyWithDetails: PropertyWithDetails = { ...property };
    
    if (property.isShared) {
      propertyWithDetails.sharedDetails = await this.getSharedPropertyByPropertyId(id);
    }
    
    propertyWithDetails.appointments = await this.getAppointmentsByPropertyId(id);
    propertyWithDetails.communications = await this.getCommunicationsByPropertyId(id);
    
    // Get last communication
    const lastComm = await db.select()
      .from(communications)
      .where(eq(communications.propertyId, id))
      .orderBy(desc(communications.createdAt))
      .limit(1);
    
    if (lastComm.length > 0) {
      propertyWithDetails.lastCommunication = lastComm[0];
    }
    
    return propertyWithDetails;
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const result = await db.insert(properties).values(property).returning();
    
    // If property is marked as shared, create a shared property entry
    const newProperty = result[0];
    if (newProperty.isShared && !newProperty.isOwned) {
      const sharedPropertyData: InsertSharedProperty = {
        propertyId: newProperty.id,
        address: newProperty.address,
        city: newProperty.city,
        size: newProperty.size,
        price: newProperty.price,
        type: newProperty.type,
        location: newProperty.location,
        stage: "address_found"
      };
      await this.createSharedProperty(sharedPropertyData);
    }
    
    return newProperty;
  }

  async updateProperty(id: number, data: Partial<InsertProperty>): Promise<Property | undefined> {
    const result = await db.update(properties)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();
    
    if (result.length > 0) {
      const updatedProperty = result[0];
      
      // Update related shared property if it exists and property is shared
      if (updatedProperty.isShared) {
        const sharedProperty = await this.getSharedPropertyByPropertyId(id);
        
        if (sharedProperty) {
          const sharedPropertyData: Partial<InsertSharedProperty> = {};
          
          if ('address' in data) sharedPropertyData.address = data.address!;
          if ('city' in data) sharedPropertyData.city = data.city!;
          if ('size' in data) sharedPropertyData.size = data.size!;
          if ('price' in data) sharedPropertyData.price = data.price!;
          if ('type' in data) sharedPropertyData.type = data.type!;
          if ('location' in data) sharedPropertyData.location = data.location!;
          
          await this.updateSharedProperty(sharedProperty.id, sharedPropertyData);
        } else if (updatedProperty.isShared && !updatedProperty.isOwned) {
          // Create a new shared property entry if it doesn't exist
          const sharedPropertyData: InsertSharedProperty = {
            propertyId: updatedProperty.id,
            address: updatedProperty.address,
            city: updatedProperty.city,
            size: updatedProperty.size,
            price: updatedProperty.price,
            type: updatedProperty.type,
            location: updatedProperty.location,
            stage: "address_found"
          };
          await this.createSharedProperty(sharedPropertyData);
        }
      }
      
      return updatedProperty;
    }
    
    return undefined;
  }

  async deleteProperty(id: number): Promise<boolean> {
    console.log(`[DELETE PROPERTY] Inizio eliminazione immobile ${id}`);
    
    try {
      // 1. Prima elimina tutti i riferimenti da immobiliareEmails
      console.log(`[DELETE PROPERTY] Gestione riferimenti immobiliare_emails per immobile ${id}`);
      
      // Trova tutti i task collegati a questo immobile
      const relatedTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.propertyId, id));
      
      if (relatedTasks.length > 0) {
        const taskIds = relatedTasks.map(t => t.id);
        console.log(`[DELETE PROPERTY] Rimozione ${relatedTasks.length} riferimenti task da immobiliare_emails: ${taskIds.join(', ')}`);
        
        // Rimuovi i riferimenti ai task da immobiliareEmails
        for (const taskId of taskIds) {
          await db.update(immobiliareEmails)
            .set({ taskId: null })
            .where(eq(immobiliareEmails.taskId, taskId));
        }
      }

      // Trova tutte le comunicazioni collegate a questo immobile
      const relatedCommunications = await db.select({ id: communications.id }).from(communications).where(eq(communications.propertyId, id));
      
      if (relatedCommunications.length > 0) {
        const communicationIds = relatedCommunications.map(c => c.id);
        console.log(`[DELETE PROPERTY] Rimozione ${relatedCommunications.length} riferimenti comunicazioni da immobiliare_emails: ${communicationIds.join(', ')}`);
        
        // Rimuovi i riferimenti alle comunicazioni da immobiliareEmails
        for (const communicationId of communicationIds) {
          await db.update(immobiliareEmails)
            .set({ communicationId: null })
            .where(eq(immobiliareEmails.communicationId, communicationId));
        }
      }

      // Rimuovi anche i riferimenti diretti all'immobile da immobiliareEmails
      console.log(`[DELETE PROPERTY] Rimozione riferimenti diretti all'immobile ${id} da immobiliare_emails`);
      await db.update(immobiliareEmails)
        .set({ propertyId: null })
        .where(eq(immobiliareEmails.propertyId, id));

      // 2. Elimina i record property_sent collegati
      console.log(`[DELETE PROPERTY] Eliminazione property_sent per immobile ${id}`);
      await db.delete(propertySent).where(eq(propertySent.propertyId, id));

      // 3. Elimina gli shared properties collegati
      console.log(`[DELETE PROPERTY] Eliminazione shared properties per immobile ${id}`);
      await db.delete(sharedProperties).where(eq(sharedProperties.propertyId, id));
      
      // 4. Elimina gli eventi del calendario collegati
      console.log(`[DELETE PROPERTY] Eliminazione eventi calendario per immobile ${id}`);
      try {
        const calendarEventsResult = await db.delete(calendarEvents).where(eq(calendarEvents.propertyId, id));
        console.log(`[DELETE PROPERTY] Eventi calendario eliminati: ${calendarEventsResult.length || 0}`);
      } catch (calendarError) {
        console.log(`[DELETE PROPERTY] Errore eliminazione eventi calendario: ${calendarError}`);
        // Continua comunque con l'eliminazione
      }

      // 5. Elimina gli appuntamenti collegati
      console.log(`[DELETE PROPERTY] Eliminazione appuntamenti per immobile ${id}`);
      await db.delete(appointments).where(eq(appointments.propertyId, id));
      
      // 6. Elimina i task collegati (ora sicuro dopo aver rimosso i riferimenti)
      console.log(`[DELETE PROPERTY] Eliminazione task per immobile ${id}`);
      await db.delete(tasks).where(eq(tasks.propertyId, id));
      
      // 7. Elimina le comunicazioni collegate
      console.log(`[DELETE PROPERTY] Eliminazione comunicazioni per immobile ${id}`);
      await db.delete(communications).where(eq(communications.propertyId, id));
      
      // 8. Aggiorna i venditori per rimuovere il riferimento all'immobile
      console.log(`[DELETE PROPERTY] Aggiornamento venditori per immobile ${id}`);
      await db.update(sellers)
        .set({ propertyId: null })
        .where(eq(sellers.propertyId, id));
      
      // 8.5. Elimina i record in private_contact_tracking collegati
      console.log(`[DELETE PROPERTY] Eliminazione private_contact_tracking per immobile ${id}`);
      await db.delete(privateContactTracking).where(eq(privateContactTracking.propertyId, id));
      
      // 8.6. Elimina i campaign messages collegati
      console.log(`[DELETE PROPERTY] Eliminazione campaign_messages per immobile ${id}`);
      await db.delete(campaignMessages).where(eq(campaignMessages.propertyId, id));
      
      // 9. Infine elimina l'immobile stesso
      console.log(`[DELETE PROPERTY] Eliminazione immobile ${id}`);
      const result = await db.delete(properties).where(eq(properties.id, id)).returning();
      
      const success = result.length > 0;
      console.log(`[DELETE PROPERTY] Immobile ${id} eliminato: ${success}`);
      return success;
    } catch (error) {
      console.error(`[DELETE PROPERTY] Errore durante l'eliminazione dell'immobile ${id}:`, error);
      throw error;
    }
  }

  // Implementazione restante dei metodi richiesti...
  // Per brevità, implementerò solo i metodi più importanti e 
  // quelli necessari per il funzionamento di base dell'applicazione

  // Shared property methods
  async getSharedProperty(id: number): Promise<SharedProperty | undefined> {
    const result = await db.select().from(sharedProperties).where(eq(sharedProperties.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getSharedPropertyByPropertyId(propertyId: number): Promise<SharedProperty | undefined> {
    const result = await db.select().from(sharedProperties).where(eq(sharedProperties.propertyId, propertyId));
    return result.length > 0 ? result[0] : undefined;
  }

  async getSharedProperties(filters?: { stage?: string; search?: string; isFavorite?: boolean }): Promise<SharedProperty[]> {
    let query = db.select().from(sharedProperties);
    
    const conditions: SQL[] = [];
    
    // Always exclude ignored properties
    conditions.push(eq(sharedProperties.isIgnored, false));
    
    if (filters) {
      if (filters.stage) {
        conditions.push(eq(sharedProperties.stage, filters.stage));
      }
      
      if (filters.search) {
        const search = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(sharedProperties.address, search),
            ilike(sharedProperties.city, search),
            ilike(sharedProperties.ownerName, search)
          )
        );
      }
      
      if (filters.isFavorite !== undefined) {
        conditions.push(eq(sharedProperties.isFavorite, filters.isFavorite));
      }
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(sharedProperties.updatedAt));
  }

  async getSharedPropertyWithDetails(id: number): Promise<SharedPropertyWithDetails | undefined> {
    const sharedProperty = await this.getSharedProperty(id);
    if (!sharedProperty) return undefined;
    
    const sharedPropertyWithDetails: SharedPropertyWithDetails = { ...sharedProperty };
    
    // Get related tasks
    sharedPropertyWithDetails.tasks = await db.select()
      .from(tasks)
      .where(eq(tasks.sharedPropertyId, id));
    
    // Get related communications
    sharedPropertyWithDetails.communications = await db.select()
      .from(communications)
      .where(eq(communications.sharedPropertyId, id));
    
    return sharedPropertyWithDetails;
  }



  async acquireSharedProperty(id: number): Promise<boolean> {
    const sharedProperty = await this.getSharedProperty(id);
    if (!sharedProperty) return false;
    
    // Update the shared property
    await db.update(sharedProperties)
      .set({ 
        isAcquired: true, 
        stage: "result", 
        stageResult: "acquired",
        matchBuyers: true,
        updatedAt: new Date()
      })
      .where(eq(sharedProperties.id, id));
    
    // Create a new property in our portfolio
    const propertyData: InsertProperty = {
      address: sharedProperty.address,
      city: sharedProperty.city || "",
      size: sharedProperty.size || 0,
      price: sharedProperty.price || 0,
      type: sharedProperty.type || "apartment",
      isShared: false,
      isOwned: true,
      status: "available",
      location: sharedProperty.location
    };
    
    const newProperty = await this.createProperty(propertyData);
    
    // Trigger automatic matching with interested buyers
    console.log(`[acquireSharedProperty] Avvio matching automatico per proprietà ${id}`);
    const matchingBuyers = await this.getMatchingBuyersForSharedProperty(id);
    
    // Create match records for each matching buyer (con protezione duplicati)
    for (const buyer of matchingBuyers) {
      try {
        // Verifica se esiste già un match per evitare duplicati
        const existingMatch = await db.select()
          .from(matches)
          .where(and(
            eq(matches.clientId, buyer.id),
            eq(matches.sharedPropertyId, id)
          ))
          .limit(1);

        if (existingMatch.length === 0) {
          await db.insert(matches).values({
            clientId: buyer.id,
            sharedPropertyId: id,
            propertyId: newProperty.id,
            score: 85, // Default match score
            createdAt: new Date()
          });
          console.log(`[acquireSharedProperty] Match creato per cliente ${buyer.id} (${buyer.firstName} ${buyer.lastName})`);
        } else {
          console.log(`[acquireSharedProperty] Match già esistente per cliente ${buyer.id}, skip`);
        }
      } catch (error) {
        console.error(`[acquireSharedProperty] Errore creazione match per cliente ${buyer.id}:`, error);
      }
    }
    
    console.log(`[acquireSharedProperty] Matching completato: ${matchingBuyers.length} clienti interessati`);
    return true;
  }

  async ignoreSharedProperty(id: number): Promise<boolean> {
    const sharedProperty = await this.getSharedProperty(id);
    if (!sharedProperty) {
      console.log(`[ignoreSharedProperty] Proprietà ${id} non trovata`);
      return false;
    }
    
    console.log(`[ignoreSharedProperty] Proprietà ${id} trovata, aggiornamento in corso...`);
    
    // Mark as ignored
    const result = await db.update(sharedProperties)
      .set({ 
        isIgnored: true,
        updatedAt: new Date()
      })
      .where(eq(sharedProperties.id, id))
      .returning();
    
    console.log(`[ignoreSharedProperty] Update completato. Righe aggiornate: ${result.length}`);
    if (result.length > 0) {
      console.log(`[ignoreSharedProperty] isIgnored ora è: ${result[0].isIgnored}`);
    }
    
    return result.length > 0;
  }

  async getMatchingBuyersForSharedProperty(sharedPropertyId: number): Promise<ClientWithDetails[]> {
    const sharedProperty = await this.getSharedProperty(sharedPropertyId);
    if (!sharedProperty || !sharedProperty.size || !sharedProperty.price) {
      return [];
    }
    
    // Crea un oggetto property temporaneo con le stesse proprietà della proprietà condivisa
    // necessario per poter utilizzare la funzione isPropertyMatchingBuyerCriteria
    const tempProperty: Property = {
      id: -1, // ID temporaneo, non serve per il matching
      address: sharedProperty.address,
      city: sharedProperty.city,
      price: sharedProperty.price,
      size: sharedProperty.size,
      type: sharedProperty.type || 'generic',
      status: 'available',
      location: sharedProperty.location,
      createdAt: new Date(),
      updatedAt: new Date(),
      isShared: true,
      isOwned: false
    };
    
    console.log(`[getMatchingBuyersForSharedProperty] Verifico matching per proprietà condivisa ${sharedPropertyId}`);
    
    const matchingBuyers: ClientWithDetails[] = [];
    
    // Esegui query per trovare potenziali compratori (filtro iniziale)
    const potentialBuyers = await db
      .select()
      .from(buyers)
      .where(
        and(
          or(
            isNull(buyers.maxPrice),
            gte(buyers.maxPrice, Math.round(sharedProperty.price * 0.8)) // Tolleranza -20%: includi buyer che cercano proprietà più economiche
          ),
          or(
            isNull(buyers.minSize),
            lte(buyers.minSize, Math.round(sharedProperty.size / 0.9)) // Tolleranza 10% sulla dimensione
          )
        )
      );
    
    console.log(`[getMatchingBuyersForSharedProperty] Trovati ${potentialBuyers.length} potenziali acquirenti (filtro preliminare)`);
    
    // Verifica ogni potenziale acquirente con i criteri completi, inclusa la posizione geografica
    for (const buyer of potentialBuyers) {
      const client = await this.getClientWithDetails(buyer.clientId);
      if (client) {
        console.log(`[getMatchingBuyersForSharedProperty] Verifico client ${client.id} (${client.firstName} ${client.lastName}) per proprietà condivisa ${sharedPropertyId}`);
        
        try {
          // Verifica tutti i criteri, inclusa la posizione geografica
          const isMatch = isPropertyMatchingBuyerCriteria(tempProperty, buyer);
          console.log(`[getMatchingBuyersForSharedProperty] Risultato matching per ${client.firstName} ${client.lastName}: ${isMatch}`);
          
          if (isMatch) {
            console.log(`[getMatchingBuyersForSharedProperty] ✓ Cliente ${client.id} (${client.firstName} ${client.lastName}) corrisponde alla proprietà condivisa ${sharedPropertyId}`);
            matchingBuyers.push(client);
          } else {
            console.log(`[getMatchingBuyersForSharedProperty] ✗ Cliente ${client.id} (${client.firstName} ${client.lastName}) NON corrisponde alla proprietà condivisa ${sharedPropertyId}`);
          }
        } catch (error) {
          console.error(`[getMatchingBuyersForSharedProperty] Errore nel controllo matching per ${client.firstName} ${client.lastName}:`, error);
        }
      }
    }
    
    console.log(`[getMatchingBuyersForSharedProperty] ${matchingBuyers.length} clienti corrispondono alla proprietà condivisa ${sharedPropertyId} dopo tutti i controlli`);
    return matchingBuyers;
  }

  // Communication methods
  async getCommunication(id: number): Promise<Communication | undefined> {
    const result = await db.select().from(communications).where(eq(communications.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getCommunications(filters?: { type?: string; status?: string }): Promise<Communication[]> {
    let query = db.select().from(communications);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.type) {
        conditions.push(eq(communications.type, filters.type));
      }
      
      if (filters.status) {
        conditions.push(eq(communications.status, filters.status));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(communications.createdAt));
  }

  async getCommunicationsByClientId(clientId: number): Promise<Communication[]> {
    return await db
      .select()
      .from(communications)
      .where(eq(communications.clientId, clientId))
      .orderBy(desc(communications.createdAt));
  }

  async getCommunicationsByPropertyId(propertyId: number): Promise<Communication[]> {
    return await db
      .select()
      .from(communications)
      .where(eq(communications.propertyId, propertyId))
      .orderBy(desc(communications.createdAt));
  }
  
  async getCommunicationsByResponseToId(responseToId: number): Promise<Communication[]> {
    return await db
      .select()
      .from(communications)
      .where(eq(communications.responseToId, responseToId))
      .orderBy(desc(communications.createdAt));
  }

  async getLastCommunicationByClientId(clientId: number): Promise<Communication | undefined> {
    const result = await db
      .select()
      .from(communications)
      .where(eq(communications.clientId, clientId))
      .orderBy(desc(communications.createdAt))
      .limit(1);
    
    return result.length > 0 ? result[0] : undefined;
  }

  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    const result = await db.insert(communications).values(communication).returning();
    return result[0];
  }

  async updateCommunication(id: number, data: Partial<InsertCommunication>): Promise<Communication | undefined> {
    const result = await db.update(communications)
      .set(data)
      .where(eq(communications.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteCommunication(id: number): Promise<boolean> {
    const result = await db.delete(communications).where(eq(communications.id, id)).returning();
    return result.length > 0;
  }
  
  async createPropertyActivity(activity: InsertPropertyActivity): Promise<PropertyActivity> {
    const result = await db.insert(propertyActivities).values(activity).returning();
    return result[0];
  }

  async getClientsWithoutRecentCommunication(days: number, minRating: number): Promise<ClientWithDetails[]> {
    // This query is more complex, we will implement a simpler version
    // First, get all clients
    const allClients = await this.getClients();
    const clientsWithoutCommunication: ClientWithDetails[] = [];
    
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    for (const client of allClients) {
      // Get last communication for this client
      const lastComm = await this.getLastCommunicationByClientId(client.id);
      
      // If no communication or last communication is older than cutoff date
      if (!lastComm || new Date(lastComm.createdAt!) < cutoffDate) {
        // Get buyer details to check rating
        if (client.type === "buyer") {
          const buyer = await this.getBuyerByClientId(client.id);
          if (buyer && (!minRating || (buyer.rating && buyer.rating >= minRating))) {
            const clientWithDetails = await this.getClientWithDetails(client.id);
            if (clientWithDetails) {
              clientsWithoutCommunication.push(clientWithDetails);
            }
          }
        } else {
          const clientWithDetails = await this.getClientWithDetails(client.id);
          if (clientWithDetails) {
            clientsWithoutCommunication.push(clientWithDetails);
          }
        }
      }
    }
    
    return clientsWithoutCommunication;
  }

  // Appointment methods (implementazione base)
  async getAppointment(id: number): Promise<Appointment | undefined> {
    const result = await db.select().from(appointments).where(eq(appointments.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getAppointments(filters?: { status?: string; date?: string }): Promise<Appointment[]> {
    let query = db.select().from(appointments);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.status) {
        conditions.push(eq(appointments.status, filters.status));
      }
      
      if (filters.date) {
        conditions.push(eq(appointments.date, filters.date));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(appointments.date));
  }

  async getAppointmentsByClientId(clientId: number): Promise<Appointment[]> {
    console.log(`[DB STORAGE] Getting appointments for client ${clientId}`);
    
    // Use database query with JOIN to include property details
    const appointmentsWithProperties = await db
      .select({
        // Appointment fields
        id: appointments.id,
        clientId: appointments.clientId,
        propertyId: appointments.propertyId,
        date: appointments.date,
        time: appointments.time,
        type: appointments.type,
        status: appointments.status,
        feedback: appointments.feedback,
        notes: appointments.notes,
        createdAt: appointments.createdAt,
        // Property fields mapped correctly
        propertyAddress: properties.address,
        propertyCity: properties.city,
        propertyPrice: properties.price,
        propertySize: properties.size,
        propertyType: properties.type
      })
      .from(appointments)
      .leftJoin(properties, eq(appointments.propertyId, properties.id))
      .where(eq(appointments.clientId, clientId))
      .orderBy(desc(appointments.date));
    
    console.log(`[DB STORAGE] Raw query result for client ${clientId}:`, appointmentsWithProperties.map(row => ({
      id: row.id,
      propertyId: row.propertyId,
      propertyAddress: row.propertyAddress,
      propertyCity: row.propertyCity
    })));
    
    // Transform results to include property data in the expected format
    const result = appointmentsWithProperties.map(row => ({
      id: row.id,
      clientId: row.clientId,
      propertyId: row.propertyId,
      date: row.date,
      time: row.time,
      type: row.type,
      status: row.status,
      feedback: row.feedback,
      notes: row.notes,
      createdAt: row.createdAt,
      property: row.propertyAddress ? {
        id: row.propertyId,
        address: row.propertyAddress,
        city: row.propertyCity,
        price: row.propertyPrice,
        size: row.propertySize,
        type: row.propertyType
      } : null
    }));
    
    console.log(`[DB STORAGE] Transformed result for client ${clientId}:`, result.map(r => ({
      id: r.id,
      propertyId: r.propertyId,
      property: r.property ? { address: r.property.address, city: r.property.city } : null
    })));
    
    return result;
  }

  async getAppointmentsByPropertyId(propertyId: number): Promise<Appointment[]> {
    console.log(`[DB STORAGE] Getting appointments for property ${propertyId}`);
    
    // Use database query with JOIN to include client details
    const appointmentsWithClients = await db
      .select({
        // Appointment fields
        id: appointments.id,
        clientId: appointments.clientId,
        propertyId: appointments.propertyId,
        date: appointments.date,
        time: appointments.time,
        type: appointments.type,
        status: appointments.status,
        feedback: appointments.feedback,
        notes: appointments.notes,
        createdAt: appointments.createdAt,
        // Client fields mapped correctly
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientPhone: clients.phone,
        clientEmail: clients.email,
        clientType: clients.type,
        clientSalutation: clients.salutation
      })
      .from(appointments)
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .where(eq(appointments.propertyId, propertyId))
      .orderBy(desc(appointments.date));
    
    console.log(`[DB STORAGE] Raw query result:`, appointmentsWithClients.map(row => ({
      id: row.id,
      clientId: row.clientId,
      clientFirstName: row.clientFirstName,
      clientLastName: row.clientLastName
    })));
    
    // Transform results to include client data in the expected format
    const result = appointmentsWithClients.map(row => ({
      id: row.id,
      clientId: row.clientId,
      propertyId: row.propertyId,
      date: row.date,
      time: row.time,
      type: row.type,
      status: row.status,
      feedback: row.feedback,
      notes: row.notes,
      createdAt: row.createdAt,
      client: row.clientFirstName ? {
        id: row.clientId,
        firstName: row.clientFirstName,
        lastName: row.clientLastName,
        phone: row.clientPhone,
        email: row.clientEmail,
        type: row.clientType,
        salutation: row.clientSalutation
      } : null
    }));
    
    console.log(`[DB STORAGE] Transformed result:`, result.map(r => ({
      id: r.id,
      clientId: r.clientId,
      client: r.client ? { firstName: r.client.firstName, lastName: r.client.lastName } : null
    })));
    
    return result;
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const result = await db.insert(appointments).values(appointment).returning();
    return result[0];
  }

  async updateAppointment(id: number, data: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const result = await db.update(appointments)
      .set(data)
      .where(eq(appointments.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const result = await db.delete(appointments).where(eq(appointments.id, id)).returning();
    return result.length > 0;
  }

  // Task methods (implementazione base)
  async getTask(id: number): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getTasks(filters?: { status?: string; type?: string; search?: string; limit?: number; clientId?: number; propertyId?: number; sharedPropertyId?: number }): Promise<TaskWithClient[]> {
    let query = db.select({
      ...tasks,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName
    }).from(tasks).leftJoin(clients, eq(tasks.clientId, clients.id));
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.status) {
        conditions.push(eq(tasks.status, filters.status));
      }
      
      if (filters.type) {
        conditions.push(eq(tasks.type, filters.type));
      }
      
      if (filters.clientId !== undefined) {
        conditions.push(eq(tasks.clientId, filters.clientId));
      }
      
      if (filters.propertyId !== undefined) {
        conditions.push(eq(tasks.propertyId, filters.propertyId));
      }
      
      if (filters.sharedPropertyId !== undefined) {
        conditions.push(eq(tasks.sharedPropertyId, filters.sharedPropertyId));
      }
      
      if (filters.search) {
        conditions.push(
          or(
            like(tasks.title, `%${filters.search}%`),
            like(tasks.description, `%${filters.search}%`)
          )
        );
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    const result = query.orderBy(desc(tasks.createdAt));
    
    if (filters?.limit) {
      return await result.limit(filters.limit);
    }
    
    return await result;
  }

  async getTasksByClientId(clientId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.clientId, clientId))
      .orderBy(desc(tasks.dueDate));
  }

  async getTasksByPropertyId(propertyId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.propertyId, propertyId))
      .orderBy(desc(tasks.dueDate));
  }

  async getTasksBySharedPropertyId(sharedPropertyId: number): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.sharedPropertyId, sharedPropertyId))
      .orderBy(desc(tasks.dueDate));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(task).returning();
    return result[0];
  }

  async updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined> {
    const result = await db.update(tasks)
      .set(data)
      .where(eq(tasks.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async completeTask(id: number): Promise<Task | undefined> {
    const result = await db.update(tasks)
      .set({ status: "completed" })
      .where(eq(tasks.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }

  // Shared property notes methods
  async getSharedPropertyNotes(sharedPropertyId: number): Promise<SharedPropertyNote[]> {
    return await db
      .select()
      .from(sharedPropertyNotes)
      .where(eq(sharedPropertyNotes.sharedPropertyId, sharedPropertyId))
      .orderBy(desc(sharedPropertyNotes.createdAt));
  }

  async createSharedPropertyNote(note: InsertSharedPropertyNote): Promise<SharedPropertyNote> {
    const result = await db.insert(sharedPropertyNotes).values(note).returning();
    return result[0];
  }

  async deleteSharedPropertyNote(noteId: number): Promise<boolean> {
    const result = await db.delete(sharedPropertyNotes).where(eq(sharedPropertyNotes.id, noteId)).returning();
    return result.length > 0;
  }

  // Market insight methods (implementazione minimale)
  async getMarketInsight(id: number): Promise<MarketInsight | undefined> {
    const result = await db.select().from(marketInsights).where(eq(marketInsights.id, id));
    return result.length > 0 ? result[0] : undefined;
  }

  async getMarketInsights(filters?: { area?: string; month?: number; year?: number }): Promise<MarketInsight[]> {
    let query = db.select().from(marketInsights);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.area) {
        conditions.push(eq(marketInsights.area, filters.area));
      }
      
      if (filters.month !== undefined) {
        conditions.push(eq(marketInsights.month, filters.month));
      }
      
      if (filters.year !== undefined) {
        conditions.push(eq(marketInsights.year, filters.year));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query;
  }

  async createMarketInsight(insight: InsertMarketInsight): Promise<MarketInsight> {
    const result = await db.insert(marketInsights).values(insight).returning();
    return result[0];
  }

  async updateMarketInsight(id: number, data: Partial<InsertMarketInsight>): Promise<MarketInsight | undefined> {
    const result = await db.update(marketInsights)
      .set(data)
      .where(eq(marketInsights.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteMarketInsight(id: number): Promise<boolean> {
    const result = await db.delete(marketInsights).where(eq(marketInsights.id, id)).returning();
    return result.length > 0;
  }

  // Matching methods (implementazione minimale)
  async matchPropertiesForBuyer(buyerId: number): Promise<Property[]> {
    const buyer = await this.getBuyer(buyerId);
    if (!buyer) return [];
    
    console.log(`[matchPropertiesForBuyer] Cercando immobili per l'acquirente ${buyerId}`);
    
    // Calcola i valori con tolleranza per uso in SQL
    const maxPriceWithTolerance = buyer.maxPrice ? Math.floor(buyer.maxPrice * 1.1) : null;
    const minSizeWithTolerance = buyer.minSize ? Math.floor(buyer.minSize * 0.9) : null;
    
    // Fase 1: Filtro preliminare nel database
    let query = db.select().from(properties).where(eq(properties.status, "available"));
    
    const conditions: SQL[] = [];
    
    if (maxPriceWithTolerance) {
      // Tolleranza 10% sul prezzo (può essere fino al 10% in più del massimo richiesto)
      conditions.push(lte(properties.price, maxPriceWithTolerance));
    }
    
    if (minSizeWithTolerance) {
      // Tolleranza 10% sulla dimensione (può essere fino al 10% in meno del minimo richiesto)
      conditions.push(gte(properties.size, minSizeWithTolerance));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const preliminaryProperties = await query;
    console.log(`[matchPropertiesForBuyer] Trovati ${preliminaryProperties.length} immobili potenzialmente compatibili (filtro preliminare)`);
    
    // Se non ci sono immobili nel filtro preliminare, non serve procedere
    if (preliminaryProperties.length === 0) {
      return [];
    }
    
    // Fase 2: Filtro più preciso con il controllo geografico
    // Importa la funzione di matching dalla libreria centralizzata
    const { isPropertyMatchingBuyerCriteria } = await import('./lib/matchingLogic');
    
    // Filtra ulteriormente usando la funzione completa che verifica anche la posizione geografica
    const matchingProperties = preliminaryProperties.filter(property => {
      const isMatching = isPropertyMatchingBuyerCriteria(property, buyer);
      
      if (isMatching) {
        console.log(`[matchPropertiesForBuyer] Immobile ${property.id} (${property.address}) corrisponde all'acquirente ${buyerId}`);
      } else {
        console.log(`[matchPropertiesForBuyer] Immobile ${property.id} (${property.address}) NON corrisponde all'acquirente ${buyerId} dopo controllo completo`);
      }
      
      return isMatching;
    });
    
    console.log(`[matchPropertiesForBuyer] ${matchingProperties.length} immobili corrispondono all'acquirente ${buyerId} dopo tutti i controlli`);
    return matchingProperties;
  }

  async matchBuyersForProperty(propertyId: number): Promise<Client[]> {
    const property = await this.getProperty(propertyId);
    if (!property) return [];
    
    console.log(`[matchBuyersForProperty] Cercando acquirenti per immobile ${propertyId}: prezzo €${property.price}, dimensione ${property.size} mq`);
    
    // CORRETTO: La tolleranza deve essere applicata al budget del cliente, non al prezzo dell'immobile
    // Un cliente con budget €600k dovrebbe vedere immobili fino a €660k (600k * 1.1), non dover avere budget €715k per un immobile da €650k
    
    // Calcolo i limiti di tolleranza per una query più semplice
    const maxPriceForTolerance = Math.floor(property.price / 1.2); // Prezzo minimo del budget cliente per vedere questo immobile (+20% tolleranza)
    const minSizeForTolerance = Math.ceil(property.size / 0.8); // Dimensione massima richiesta dal cliente per accettare questo immobile (-20% tolleranza)
    
    console.log(`[matchBuyersForProperty] Cerco clienti con budget ≥ €${maxPriceForTolerance} e dimensione richiesta ≤ ${minSizeForTolerance} mq`);
    
    // Fase 1: Esegui un filtro preliminare nel database per dimensione e prezzo
    const preliminaryMatches = await db
      .select()
      .from(buyers)
      .innerJoin(clients, eq(buyers.clientId, clients.id))
      .where(
        and(
          eq(clients.type, "buyer"),
          or(
            isNull(buyers.maxPrice),
            // Cliente deve avere budget sufficiente per l'immobile (con tolleranza 10%)
            gte(buyers.maxPrice, maxPriceForTolerance)
          ),
          or(
            isNull(buyers.minSize),
            // Cliente deve accettare immobili di questa dimensione (con tolleranza 10%)
            lte(buyers.minSize, minSizeForTolerance)
          )
        )
      );
    
    console.log(`[matchBuyersForProperty] Trovati ${preliminaryMatches.length} potenziali acquirenti per l'immobile ${propertyId} (filtro preliminare)`);
    
    // Fase 2: Filtra ulteriormente utilizzando la funzione isPropertyMatchingBuyerCriteria
    // che verificherà anche la posizione geografica (punto in poligono)
    const matchingClients: Client[] = [];
    
    // Importa la funzione di matching dalla libreria centralizzata
    const { isPropertyMatchingBuyerCriteria } = await import('./lib/matchingLogic');
    
    for (const match of preliminaryMatches) {
      const buyer = match.buyers;
      const client = match.clients;
      
      // Verifica tutti i criteri, inclusa la posizione geografica
      if (isPropertyMatchingBuyerCriteria(property, buyer)) {
        console.log(`[matchBuyersForProperty] Cliente ${client.id} (${client.firstName} ${client.lastName}) corrisponde all'immobile ${propertyId}`);
        matchingClients.push(client);
      } else {
        console.log(`[matchBuyersForProperty] Cliente ${client.id} (${client.firstName} ${client.lastName}) NON corrisponde all'immobile ${propertyId} dopo controllo completo`);
      }
    }
    
    console.log(`[matchBuyersForProperty] ${matchingClients.length} clienti corrispondono all'immobile ${propertyId} dopo tutti i controlli`);
    return matchingClients;
  }

  // AI Match methods (for matches table with reasoning)
  async createMatch(match: InsertMatch): Promise<Match> {
    const result = await db.insert(matches).values(match).returning();
    return result[0];
  }

  async getMatchesByClientId(clientId: number): Promise<Match[]> {
    return await db.select()
      .from(matches)
      .where(eq(matches.clientId, clientId))
      .orderBy(desc(matches.score));
  }

  async deleteMatchesByClientId(clientId: number): Promise<boolean> {
    await db.delete(matches).where(eq(matches.clientId, clientId));
    return true;
  }

  // Shared property methods
  async createSharedProperty(sharedProperty: InsertSharedProperty): Promise<SharedProperty> {
    // Se non ha location ma ha un indirizzo, geocodifica automaticamente
    let propertyToSave = { ...sharedProperty };
    
    if (!propertyToSave.location && propertyToSave.address) {
      try {
        console.log(`[createSharedProperty] Geocodificando indirizzo: ${propertyToSave.address}`);
        const geoResults = await geocodeAddress(propertyToSave.address);
        
        if (geoResults && geoResults.length > 0) {
          const firstResult = geoResults[0];
          propertyToSave.location = {
            lat: firstResult.lat,
            lng: firstResult.lng
          } as any;
          console.log(`[createSharedProperty] ✓ Geocodificato: (${firstResult.lat}, ${firstResult.lng})`);
        } else {
          console.warn(`[createSharedProperty] Nessun risultato geocoding per: ${propertyToSave.address}`);
        }
      } catch (error) {
        console.error(`[createSharedProperty] Errore geocoding: ${error}`);
        // Continua comunque senza location se il geocoding fallisce
      }
    }
    
    const result = await db.insert(sharedProperties).values(propertyToSave).returning();
    return result[0];
  }

  async updateSharedProperty(id: number, data: Partial<InsertSharedProperty>): Promise<SharedProperty | undefined> {
    const result = await db.update(sharedProperties)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sharedProperties.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }

  async getSharedPropertyByAddressAndPrice(address: string, price: number): Promise<SharedProperty | undefined> {
    const result = await db.select()
      .from(sharedProperties)
      .where(and(eq(sharedProperties.address, address), eq(sharedProperties.price, price)))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteSharedProperty(id: number): Promise<boolean> {
    try {
      // Delete related records first (order matters due to foreign keys)
      await db.delete(matches).where(eq(matches.sharedPropertyId, id));
      await db.delete(tasks).where(eq(tasks.sharedPropertyId, id));
      await db.delete(communications).where(eq(communications.sharedPropertyId, id));
      await db.delete(sharedPropertyNotes).where(eq(sharedPropertyNotes.sharedPropertyId, id));
      await db.delete(clientFavorites).where(eq(clientFavorites.sharedPropertyId, id));
      await db.delete(clientIgnoredProperties).where(eq(clientIgnoredProperties.sharedPropertyId, id));
      
      // Delete the shared property
      const result = await db.delete(sharedProperties).where(eq(sharedProperties.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error("[DatabaseStorage.deleteSharedProperty] Error deleting shared property:", error);
      return false;
    }
  }

  // Client conversation task methods
  async findClientConversationTask(clientId: number): Promise<Task | undefined> {
    const result = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.type, 'client_conversation'), eq(tasks.clientId, clientId)))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async upsertClientConversationTask(clientId: number, data: Partial<InsertTask>): Promise<Task> {
    const existingTask = await this.findClientConversationTask(clientId);
    
    if (existingTask) {
      // Update existing task
      const result = await db.update(tasks)
        .set(data)
        .where(eq(tasks.id, existingTask.id))
        .returning();
      return result[0];
    } else {
      // Create new task
      return await this.createTask({
        ...data,
        type: 'client_conversation',
        clientId: clientId,
        title: data.title || `Gestire comunicazioni con cliente ${clientId}`,
        dueDate: data.dueDate || new Date().toISOString().split('T')[0],
        status: data.status || 'pending'
      } as InsertTask);
    }
  }

  async getClientCommunicationsTimeline(clientId: number): Promise<Communication[]> {
    return await this.getCommunicationsByClientId(clientId);
  }

  // Scraping jobs methods
  async getScrapingJob(id: number): Promise<ScrapingJob | undefined> {
    const result = await db
      .select()
      .from(scrapingJobs)
      .where(eq(scrapingJobs.id, id))
      .limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async getAllScrapingJobs(): Promise<ScrapingJob[]> {
    return await db.select().from(scrapingJobs);
  }

  async createScrapingJob(job: InsertScrapingJob): Promise<ScrapingJob> {
    const result = await db.insert(scrapingJobs).values(job).returning();
    return result[0];
  }

  async updateScrapingJob(id: number, data: Partial<InsertScrapingJob>): Promise<ScrapingJob | undefined> {
    const result = await db
      .update(scrapingJobs)
      .set(data)
      .where(eq(scrapingJobs.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
  }
  
  // Private contact tracking methods
  async getPrivateContactTracking(phoneNumber: string): Promise<PrivateContactTracking | undefined> {
    const [result] = await db
      .select()
      .from(privateContactTracking)
      .where(eq(privateContactTracking.phoneNumber, phoneNumber))
      .limit(1);
    return result;
  }
  
  async createPrivateContactTracking(data: InsertPrivateContactTracking): Promise<PrivateContactTracking> {
    const [result] = await db
      .insert(privateContactTracking)
      .values(data)
      .returning();
    return result;
  }
  
  async updatePrivateContactTracking(phoneNumber: string, data: Partial<InsertPrivateContactTracking>): Promise<PrivateContactTracking | undefined> {
    if (Object.keys(data).length === 0) return undefined;
    
    const [result] = await db
      .update(privateContactTracking)
      .set(data)
      .where(eq(privateContactTracking.phoneNumber, phoneNumber))
      .returning();
    return result;
  }
  
  // WhatsApp campaign methods
  async getWhatsappCampaign(id: number): Promise<WhatsappCampaign | undefined> {
    const [result] = await db
      .select()
      .from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.id, id))
      .limit(1);
    return result;
  }
  
  async getAllWhatsappCampaigns(): Promise<WhatsappCampaign[]> {
    return await db
      .select()
      .from(whatsappCampaigns)
      .orderBy(desc(whatsappCampaigns.createdAt));
  }
  
  async createWhatsappCampaign(campaign: InsertWhatsappCampaign): Promise<WhatsappCampaign> {
    const [result] = await db
      .insert(whatsappCampaigns)
      .values(campaign)
      .returning();
    return result;
  }
  
  async updateWhatsappCampaign(id: number, data: Partial<InsertWhatsappCampaign>): Promise<WhatsappCampaign | undefined> {
    if (Object.keys(data).length === 0) return undefined;
    
    const [result] = await db
      .update(whatsappCampaigns)
      .set(data)
      .where(eq(whatsappCampaigns.id, id))
      .returning();
    return result;
  }
  
  // Campaign message methods
  async getCampaignMessage(id: number): Promise<CampaignMessage | undefined> {
    const [result] = await db
      .select()
      .from(campaignMessages)
      .where(eq(campaignMessages.id, id))
      .limit(1);
    return result;
  }
  
  async getCampaignMessagesByPhone(phoneNumber: string): Promise<CampaignMessage[]> {
    return await db
      .select()
      .from(campaignMessages)
      .where(eq(campaignMessages.phoneNumber, phoneNumber))
      .orderBy(desc(campaignMessages.createdAt));
  }
  
  async getCampaignMessagesByCampaign(campaignId: number): Promise<CampaignMessage[]> {
    return await db
      .select()
      .from(campaignMessages)
      .where(eq(campaignMessages.campaignId, campaignId))
      .orderBy(desc(campaignMessages.createdAt));
  }
  
  async createCampaignMessage(message: InsertCampaignMessage): Promise<CampaignMessage> {
    const [result] = await db
      .insert(campaignMessages)
      .values(message)
      .returning();
    return result;
  }
  
  async updateCampaignMessage(id: number, data: Partial<InsertCampaignMessage>): Promise<CampaignMessage | undefined> {
    if (Object.keys(data).length === 0) return undefined;
    
    const [result] = await db
      .update(campaignMessages)
      .set(data)
      .where(eq(campaignMessages.id, id))
      .returning();
    return result;
  }
  
  // Bot conversation log methods
  async createBotConversationLog(log: InsertBotConversationLog): Promise<BotConversationLog> {
    const [result] = await db
      .insert(botConversationLogs)
      .values(log)
      .returning();
    return result;
  }
  
  async getBotConversationLogs(campaignMessageId: number): Promise<BotConversationLog[]> {
    return await db
      .select()
      .from(botConversationLogs)
      .where(eq(botConversationLogs.campaignMessageId, campaignMessageId))
      .orderBy(botConversationLogs.timestamp);
  }
  
  // Client favorites methods (dual favorites system) - supports both shared and private properties
  async getClientFavorites(clientId: number): Promise<ClientFavorite[]> {
    return await db
      .select()
      .from(clientFavorites)
      .where(eq(clientFavorites.clientId, clientId))
      .orderBy(desc(clientFavorites.addedAt));
  }
  
  async addClientFavorite(clientId: number, options: { sharedPropertyId?: number; propertyId?: number; notes?: string }): Promise<ClientFavorite> {
    const { sharedPropertyId, propertyId, notes } = options;
    
    if (!sharedPropertyId && !propertyId) {
      throw new Error('Either sharedPropertyId or propertyId must be provided');
    }
    
    // Insert with proper null handling for the optional fields
    const insertValues: any = { clientId };
    if (sharedPropertyId) insertValues.sharedPropertyId = sharedPropertyId;
    if (propertyId) insertValues.propertyId = propertyId;
    if (notes) insertValues.notes = notes;
    
    const [result] = await db
      .insert(clientFavorites)
      .values(insertValues)
      .onConflictDoNothing()
      .returning();
    
    // If conflict (already exists), fetch the existing record
    if (!result) {
      const whereConditions = [eq(clientFavorites.clientId, clientId)];
      if (sharedPropertyId) {
        whereConditions.push(eq(clientFavorites.sharedPropertyId, sharedPropertyId));
      }
      if (propertyId) {
        whereConditions.push(eq(clientFavorites.propertyId, propertyId));
      }
      
      const [existing] = await db
        .select()
        .from(clientFavorites)
        .where(and(...whereConditions))
        .limit(1);
      
      if (!existing) {
        throw new Error(`Failed to create or fetch favorite for client ${clientId}`);
      }
      return existing;
    }
    
    return result;
  }
  
  async removeClientFavorite(clientId: number, options: { sharedPropertyId?: number; propertyId?: number }): Promise<boolean> {
    const { sharedPropertyId, propertyId } = options;
    
    if (!sharedPropertyId && !propertyId) {
      throw new Error('Either sharedPropertyId or propertyId must be provided');
    }
    
    try {
      const whereConditions = [eq(clientFavorites.clientId, clientId)];
      if (sharedPropertyId) {
        whereConditions.push(eq(clientFavorites.sharedPropertyId, sharedPropertyId));
      }
      if (propertyId) {
        whereConditions.push(eq(clientFavorites.propertyId, propertyId));
      }
      
      const result = await db
        .delete(clientFavorites)
        .where(and(...whereConditions))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('[removeClientFavorite] Error:', error);
      return false;
    }
  }
  
  async isClientFavorite(clientId: number, options: { sharedPropertyId?: number; propertyId?: number }): Promise<boolean> {
    const { sharedPropertyId, propertyId } = options;
    
    if (!sharedPropertyId && !propertyId) {
      return false;
    }
    
    const whereConditions = [eq(clientFavorites.clientId, clientId)];
    if (sharedPropertyId) {
      whereConditions.push(eq(clientFavorites.sharedPropertyId, sharedPropertyId));
    }
    if (propertyId) {
      whereConditions.push(eq(clientFavorites.propertyId, propertyId));
    }
    
    const result = await db
      .select()
      .from(clientFavorites)
      .where(and(...whereConditions))
      .limit(1);
    return result.length > 0;
  }
  
  // Client ignored properties methods (per-client ignore list) - supports both shared and private properties
  async getClientIgnoredProperties(clientId: number): Promise<ClientIgnoredProperty[]> {
    return await db
      .select()
      .from(clientIgnoredProperties)
      .where(eq(clientIgnoredProperties.clientId, clientId))
      .orderBy(desc(clientIgnoredProperties.ignoredAt));
  }
  
  async addClientIgnoredProperty(clientId: number, options: { sharedPropertyId?: number; propertyId?: number; reason?: string }): Promise<ClientIgnoredProperty> {
    const { sharedPropertyId, propertyId, reason } = options;
    
    if (!sharedPropertyId && !propertyId) {
      throw new Error('Either sharedPropertyId or propertyId must be provided');
    }
    
    // Insert with proper null handling for the optional fields
    const insertValues: any = { clientId };
    if (sharedPropertyId) insertValues.sharedPropertyId = sharedPropertyId;
    if (propertyId) insertValues.propertyId = propertyId;
    if (reason) insertValues.reason = reason;
    
    const [result] = await db
      .insert(clientIgnoredProperties)
      .values(insertValues)
      .onConflictDoNothing()
      .returning();
    
    // If conflict (already exists), fetch the existing record
    if (!result) {
      const whereConditions = [eq(clientIgnoredProperties.clientId, clientId)];
      if (sharedPropertyId) {
        whereConditions.push(eq(clientIgnoredProperties.sharedPropertyId, sharedPropertyId));
      }
      if (propertyId) {
        whereConditions.push(eq(clientIgnoredProperties.propertyId, propertyId));
      }
      
      const [existing] = await db
        .select()
        .from(clientIgnoredProperties)
        .where(and(...whereConditions))
        .limit(1);
      
      if (!existing) {
        throw new Error(`Failed to create or fetch ignored property for client ${clientId}`);
      }
      return existing;
    }
    
    return result;
  }
  
  async removeClientIgnoredProperty(clientId: number, options: { sharedPropertyId?: number; propertyId?: number }): Promise<boolean> {
    const { sharedPropertyId, propertyId } = options;
    
    if (!sharedPropertyId && !propertyId) {
      throw new Error('Either sharedPropertyId or propertyId must be provided');
    }
    
    try {
      const whereConditions = [eq(clientIgnoredProperties.clientId, clientId)];
      if (sharedPropertyId) {
        whereConditions.push(eq(clientIgnoredProperties.sharedPropertyId, sharedPropertyId));
      }
      if (propertyId) {
        whereConditions.push(eq(clientIgnoredProperties.propertyId, propertyId));
      }
      
      const result = await db
        .delete(clientIgnoredProperties)
        .where(and(...whereConditions))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('[removeClientIgnoredProperty] Error:', error);
      return false;
    }
  }
  
  async isClientIgnoredProperty(clientId: number, options: { sharedPropertyId?: number; propertyId?: number }): Promise<boolean> {
    const { sharedPropertyId, propertyId } = options;
    
    if (!sharedPropertyId && !propertyId) {
      return false;
    }
    
    const whereConditions = [eq(clientIgnoredProperties.clientId, clientId)];
    if (sharedPropertyId) {
      whereConditions.push(eq(clientIgnoredProperties.sharedPropertyId, sharedPropertyId));
    }
    if (propertyId) {
      whereConditions.push(eq(clientIgnoredProperties.propertyId, propertyId));
    }
    
    const result = await db
      .select()
      .from(clientIgnoredProperties)
      .where(and(...whereConditions))
      .limit(1);
    return result.length > 0;
  }
  
  // Advanced property matching methods with persistent caching
  async getMatchingPropertiesForClient(clientId: number, forceRecompute: boolean = false): Promise<SharedProperty[]> {
    const CACHE_TTL_MINUTES = 15;
    
    if (!forceRecompute) {
      const { matches: cachedMatches, lastUpdated } = await this.getClientMatchesFromCache(clientId);
      
      if (cachedMatches.length > 0 && lastUpdated) {
        const cacheAge = (Date.now() - lastUpdated.getTime()) / 1000 / 60;
        console.log(`[getMatchingPropertiesForClient] Client ${clientId} cache age: ${cacheAge.toFixed(1)} minutes`);
        
        if (cacheAge < CACHE_TTL_MINUTES) {
          // Get buyer for private property matching
          const buyer = await this.getBuyerByClientId(clientId);
          if (!buyer) return [];
          
          // Get cached shared properties
          const sharedPropertyIds = cachedMatches
            .filter(m => m.sharedPropertyId !== null)
            .map(m => m.sharedPropertyId as number);
          
          const cachedSharedProperties = sharedPropertyIds.length > 0
            ? await db
                .select()
                .from(sharedProperties)
                .where(inArray(sharedProperties.id, sharedPropertyIds))
            : [];
          
          const matchScoreMap = new Map(cachedMatches.map(m => [m.sharedPropertyId, m.score]));
          
          const sortedSharedProps = cachedSharedProperties
            .map(prop => ({
              ...prop,
              matchScore: matchScoreMap.get(prop.id) || 0
            }));
          
          // Also get matching private properties (not cached, but fast to compute)
          const privateProps = await db
            .select()
            .from(properties)
            .where(
              and(
                eq(properties.ownerType, 'private'),
                eq(properties.status, 'available')
              )
            );
          
          const derivePortalSource = (source: string | null, portal: string | null): string | null => {
            const sourceStr = (source || '').toLowerCase();
            const portalStr = (portal || '').toLowerCase();
            if (sourceStr.includes('idealista') || portalStr.includes('idealista')) return 'Idealista.it';
            if (sourceStr.includes('immobiliare') || portalStr.includes('immobiliare')) return 'Immobiliare.it';
            if (sourceStr.includes('clickcase') || portalStr.includes('clickcase')) return 'ClickCase.it';
            if (sourceStr.includes('casadaprivato') || portalStr.includes('casadaprivato')) return 'CasaDaPrivato.it';
            if (sourceStr === 'manual') return 'Manuale';
            return null;
          };
          
          const convertedPrivateProps: SharedProperty[] = privateProps.map((p: any) => ({
            id: p.id,
            propertyId: p.id,
            address: p.address || '',
            city: p.city || 'Milano',
            province: p.province || 'MI',
            type: p.type || 'apartment',
            size: p.size,
            price: p.price,
            rooms: p.bedrooms,
            bathrooms: p.bathrooms,
            description: p.description,
            images: p.images || [],
            location: p.location,
            agencyName: p.ownerName || 'Privato',
            agencyUrl: p.url || p.externalLink || '',
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            externalId: p.externalId,
            source: p.source || 'manual',
            portalSource: derivePortalSource(p.source, p.portal),
            classificationColor: 'green' as const,
            isIgnored: false,
            isFavorite: p.isFavorite || false,
            isAcquired: false,
            matchBuyers: false,
            ownerName: p.ownerName,
            ownerPhone: p.ownerPhone,
            ownerEmail: p.ownerEmail,
            ownerType: 'private',
            elevator: p.elevator,
            balconyOrTerrace: p.balconyOrTerrace,
            parking: p.parking,
            garden: p.garden,
            url: p.url || p.externalLink
          } as SharedProperty));
          
          // Filter private properties using the same matching logic
          const matchingPrivateProps = convertedPrivateProps
            .map(prop => {
              const matchResult = this.evaluatePropertyMatch(prop, buyer);
              return matchResult.isMatch ? { ...prop, matchScore: matchResult.score } : null;
            })
            .filter((p): p is SharedProperty & { matchScore: number } => p !== null);
          
          // Combine and sort all properties by score
          const allMatches = [...sortedSharedProps, ...matchingPrivateProps]
            .sort((a, b) => b.matchScore - a.matchScore);
          
          console.log(`[getMatchingPropertiesForClient] Returning ${cachedMatches.length} cached shared + ${matchingPrivateProps.length} private matches for client ${clientId}`);
          
          return this.postProcessMatchedProperties(allMatches);
        }
        
        console.log(`[getMatchingPropertiesForClient] Cache stale for client ${clientId}, recomputing...`);
      } else {
        console.log(`[getMatchingPropertiesForClient] No cache found for client ${clientId}, computing matches...`);
      }
    } else {
      console.log(`[getMatchingPropertiesForClient] Force recompute requested for client ${clientId}`);
    }
    
    const buyer = await this.getBuyerByClientId(clientId);
    if (!buyer) return [];
    
    const sharedProps = await db
      .select()
      .from(sharedProperties)
      .where(
        and(
          eq(sharedProperties.isIgnored, false),
          eq(sharedProperties.isAcquired, false)
        )
      );
    
    const privateProps = await db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.ownerType, 'private'),
          eq(properties.status, 'available')
        )
      );
    
    const derivePortalSource = (source: string | null, portal: string | null): string | null => {
      const sourceStr = (source || '').toLowerCase();
      const portalStr = (portal || '').toLowerCase();
      
      if (sourceStr.includes('idealista') || portalStr.includes('idealista')) {
        return 'Idealista.it';
      }
      if (sourceStr.includes('immobiliare') || portalStr.includes('immobiliare')) {
        return 'Immobiliare.it';
      }
      if (sourceStr.includes('clickcase') || portalStr.includes('clickcase')) {
        return 'ClickCase.it';
      }
      if (sourceStr.includes('casadaprivato') || portalStr.includes('casadaprivato')) {
        return 'CasaDaPrivato.it';
      }
      if (sourceStr === 'manual') {
        return 'Manuale';
      }
      return null;
    };
    
    const convertedPrivateProps: SharedProperty[] = privateProps.map((p: any) => ({
      id: p.id,
      propertyId: p.id,
      address: p.address || '',
      city: p.city || 'Milano',
      province: p.province || 'MI',
      type: p.type || 'apartment',
      size: p.size,
      price: p.price,
      rooms: p.bedrooms,
      bathrooms: p.bathrooms,
      description: p.description,
      images: p.images || [],
      location: p.location,
      agencyName: p.ownerName || 'Privato',
      agencyUrl: p.url || p.externalLink || '',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      externalId: p.externalId,
      source: p.source || 'manual',
      portalSource: derivePortalSource(p.source, p.portal),
      classificationColor: 'green' as const,
      isIgnored: false,
      isFavorite: p.isFavorite || false,
      isAcquired: false,
      matchBuyers: false,
      ownerName: p.ownerName,
      ownerPhone: p.ownerPhone,
      ownerEmail: p.ownerEmail,
      ownerType: 'private',
      elevator: p.elevator,
      balconyOrTerrace: p.balconyOrTerrace,
      parking: p.parking,
      garden: p.garden,
      url: p.url || p.externalLink
    } as SharedProperty));
    
    // Track which IDs are from sharedProperties table (for proper foreign key reference)
    const sharedPropertyIds = new Set(sharedProps.map(p => p.id));
    
    const allProperties = [...sharedProps, ...convertedPrivateProps];
    
    const matchedPropertiesWithScores: Array<{property: SharedProperty, score: number, isShared: boolean}> = [];
    
    for (const prop of allProperties) {
      const matchResult = this.evaluatePropertyMatch(prop, buyer);
      if (matchResult.isMatch) {
        matchedPropertiesWithScores.push({
          property: prop,
          score: matchResult.score,
          isShared: sharedPropertyIds.has(prop.id)
        });
      }
    }
    
    matchedPropertiesWithScores.sort((a, b) => b.score - a.score);
    
    // Only save matches for sharedProperties (which have valid foreign key reference)
    // Private properties from 'properties' table have different IDs and would violate FK constraint
    const matchesToSave = matchedPropertiesWithScores
      .filter(({ isShared }) => isShared)
      .map(({ property, score }) => ({
        sharedPropertyId: property.id,
        score
      }));
    
    const privateMatchCount = matchedPropertiesWithScores.filter(m => !m.isShared).length;
    console.log(`[getMatchingPropertiesForClient] Found ${matchesToSave.length} shared + ${privateMatchCount} private matches for client ${clientId}`);
    
    try {
      await this.saveClientMatches(clientId, matchesToSave);
      console.log(`[getMatchingPropertiesForClient] Saved ${matchesToSave.length} matches to cache for client ${clientId}`);
    } catch (error) {
      console.error(`[getMatchingPropertiesForClient] Failed to save matches cache:`, error);
    }
    
    const matchedProperties = matchedPropertiesWithScores.map(({ property, score }) => ({
      ...property,
      matchScore: score
    }));
    
    return this.postProcessMatchedProperties(matchedProperties);
  }
  
  private evaluatePropertyMatch(prop: SharedProperty, buyer: Buyer): { isMatch: boolean, score: number } {
    let score = 100;
    
    // Filter by rooms if buyer specified
    if (buyer.rooms && prop.rooms) {
      // Allow properties with rooms <= buyer.rooms + 1 (slight tolerance)
      if (prop.rooms > buyer.rooms + 1) {
        return { isMatch: false, score: 0 };
      }
      // Exact match gets bonus, close match is ok
      if (prop.rooms === buyer.rooms) {
        score += 5;
      } else if (prop.rooms < buyer.rooms) {
        score -= 5; // Slightly penalize smaller
      }
    }
    
    if (buyer.minSize && prop.size) {
      const minAcceptable = buyer.minSize * 0.80;
      const maxAcceptable = buyer.minSize * 2.5; // Limite superiore ragionevole (es. 50mq -> max 125mq)
      
      if (prop.size < minAcceptable) {
        return { isMatch: false, score: 0 };
      }
      if (prop.size > maxAcceptable) {
        return { isMatch: false, score: 0 };
      }
      if (prop.size >= buyer.minSize) {
        score += 0;
      } else {
        const sizeRatio = prop.size / buyer.minSize;
        score -= Math.round((1 - sizeRatio) * 20);
      }
    }
    
    if (buyer.maxPrice && prop.price) {
      const maxAcceptable = buyer.maxPrice * 1.20;
      if (prop.price > maxAcceptable) {
        return { isMatch: false, score: 0 };
      }
      if (prop.price <= buyer.maxPrice) {
        const savings = (buyer.maxPrice - prop.price) / buyer.maxPrice;
        score += Math.round(savings * 10);
      } else {
        const overBudget = (prop.price - buyer.maxPrice) / buyer.maxPrice;
        score -= Math.round(overBudget * 30);
      }
    }
    
    if (buyer.searchArea) {
      // Se il buyer ha una searchArea ma la proprietà non ha location, la escludiamo
      if (!prop.location) {
        return { isMatch: false, score: 0 };
      }
      
      try {
        const propLoc = prop.location as any;
        let propLat: number, propLng: number;
        
        if (propLoc.coordinates) {
          propLng = propLoc.coordinates[0];
          propLat = propLoc.coordinates[1];
        } else if (propLoc.lat !== undefined && propLoc.lng !== undefined) {
          propLat = propLoc.lat;
          propLng = propLoc.lng;
        } else {
          return { isMatch: false, score: 0 };
        }
        
        const searchArea = buyer.searchArea as any;
        
        let features: any[] = [];
        if (searchArea.type === 'FeatureCollection' && searchArea.features) {
          features = searchArea.features;
        } else if (searchArea.type === 'Feature') {
          features = [searchArea];
        }
        
        if (features.length > 0) {
          const propertyPoint = point([propLng, propLat]);
          let isInAnyZone = false;
          
          for (const feature of features) {
            if (booleanPointInPolygon(propertyPoint, feature)) {
              isInAnyZone = true;
              break;
            }
          }
          
          if (!isInAnyZone) {
            const POLYGON_DISTANCE_TOLERANCE_KM = 0.5;
            const POINT_RADIUS_KM = 0.5; // Maximum 500 meters from search area
            let minDistance = Infinity;
            let hasPointFeature = false;
            
            for (const feature of features) {
              if (feature.geometry?.type === 'Point' && feature.geometry?.coordinates) {
                hasPointFeature = true;
                const pointCoords = feature.geometry.coordinates;
                const zoneCenterLng = pointCoords[0];
                const zoneCenterLat = pointCoords[1];
                
                const R = 6371;
                const dLat = (propLat - zoneCenterLat) * Math.PI / 180;
                const dLng = (propLng - zoneCenterLng) * Math.PI / 180;
                const a = 
                  Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(zoneCenterLat * Math.PI / 180) * Math.cos(propLat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distanceKm = R * c;
                
                if (distanceKm <= POINT_RADIUS_KM) {
                  isInAnyZone = true;
                  score -= Math.round((distanceKm / POINT_RADIUS_KM) * 10);
                  break;
                }
                if (distanceKm < minDistance) minDistance = distanceKm;
              }
              else if (feature.geometry?.type === 'Polygon') {
                const coordinates = feature.geometry?.coordinates?.[0] || [];
                if (coordinates.length < 2) continue;
                
                const line = lineString(coordinates);
                const d = pointToLineDistance(propertyPoint, line, { units: 'kilometers' });
                if (d < minDistance) minDistance = d;
              }
            }
            
            if (!isInAnyZone) {
              const threshold = hasPointFeature ? POINT_RADIUS_KM : POLYGON_DISTANCE_TOLERANCE_KM;
              if (minDistance > threshold) {
                return { isMatch: false, score: 0 };
              }
              score -= Math.round((minDistance / threshold) * 15);
            }
          }
        }
        else if (searchArea.type === 'Point' || (searchArea.center && searchArea.radius)) {
          let centerLat: number, centerLng: number;
          let radiusKm = 1;
          
          if (searchArea.center) {
            centerLat = searchArea.center.lat;
            centerLng = searchArea.center.lng;
            radiusKm = searchArea.radius || 1;
          } else if (searchArea.coordinates) {
            centerLng = searchArea.coordinates[0];
            centerLat = searchArea.coordinates[1];
          } else {
            return { isMatch: true, score: Math.max(0, score) };
          }
          
          const R = 6371;
          const dLat = (propLat - centerLat) * Math.PI / 180;
          const dLng = (propLng - centerLng) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(centerLat * Math.PI / 180) * Math.cos(propLat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distanceKm = R * c;
          
          if (distanceKm > radiusKm) {
            return { isMatch: false, score: 0 };
          }
          score -= Math.round((distanceKm / radiusKm) * 10);
        }
      } catch (error) {
        console.warn('[evaluatePropertyMatch] Zone check error:', error);
      }
    }
    
    return { isMatch: true, score: Math.max(0, Math.min(100, score)) };
  }
  
  private postProcessMatchedProperties(matchedProperties: any[]): SharedProperty[] {
    // Debug: count private vs shared properties
    const privateCount = matchedProperties.filter(p => p.ownerType === 'private').length;
    console.log(`[postProcessMatchedProperties] Processing ${matchedProperties.length} properties (${privateCount} with ownerType='private')`);
    
    return matchedProperties.map(prop => {
      const agencyCount = (prop.agencies && Array.isArray(prop.agencies)) ? prop.agencies.length : 0;
      const isMultiagency = agencyCount > 1;
      // Preserve 'private' ownerType, otherwise set to 'shared' for proper frontend routing
      const ownerType = prop.ownerType === 'private' ? 'private' : 'shared';
      const images = (prop as any).imageUrls || (prop as any).images || [];
      
      return {
        ...prop,
        isMultiagency,
        ownerType,
        images
      } as any;
    });
  }
  
  async getMultiAgencyProperties(): Promise<SharedProperty[]> {
    return await db
      .select()
      .from(sharedProperties)
      .where(
        and(
          eq(sharedProperties.classificationColor, 'yellow'),
          eq(sharedProperties.isIgnored, false)
        )
      )
      .orderBy(desc(sharedProperties.createdAt));
  }
  
  async getPrivateProperties(portalSource?: string): Promise<SharedProperty[]> {
    // Get private properties from sharedProperties table where ownerType = 'private'
    const whereConditions: any[] = [
      eq(sharedProperties.ownerType, 'private'),
      eq(sharedProperties.isIgnored, false)
    ];
    
    // Add portal filter if provided
    if (portalSource) {
      whereConditions.push(eq(sharedProperties.portalSource, portalSource));
    }
    
    const privateProps = await db
      .select()
      .from(sharedProperties)
      .where(and(...whereConditions))
      .orderBy(desc(sharedProperties.createdAt));
    
    // Also get private properties from properties table (exclusivity_hint = true)
    // These are properties that were incorrectly classified and saved in the wrong table
    const privateFromPropertiesTable = await db
      .select()
      .from(properties)
      .where(eq(properties.exclusivityHint, true))
      .orderBy(desc(properties.createdAt));
    
    // Convert properties to SharedProperty-like format
    const convertedFromProperties: any[] = privateFromPropertiesTable.map((p: any) => ({
      id: p.id,
      address: p.address,
      city: p.city,
      price: p.price,
      size: p.size,
      type: p.type,
      ownerType: 'private',
      ownerPhone: p.ownerPhone,
      ownerEmail: p.ownerEmail,
      ownerName: p.ownerName,
      description: p.description,
      externalLink: p.externalLink || p.url,
      portalSource: p.portal || p.source || 'Idealista',
      createdAt: p.createdAt,
      location: p.location,
      classificationColor: 'green',
      isFromPropertiesTable: true // Flag to identify source
    }));
    
    // Combine both sources
    const allPrivateProps = [...privateProps, ...convertedFromProperties];
    
    // Filter properties within 4km radius of Duomo di Milano
    const DUOMO_LAT = 45.464204;
    const DUOMO_LNG = 9.191383;
    const RADIUS_KM = 4;
    const duomoPoint = point([DUOMO_LNG, DUOMO_LAT]);
    
    const filteredByRadius = allPrivateProps.filter((p: any) => {
      let lat, lng;
      
      // Try to get coordinates from location object first
      if (p.location && typeof p.location === 'object') {
        lat = p.location.lat;
        lng = p.location.lng;
      }
      
      // If no valid coordinates, still include the property (will be shown in list but may not have map pin)
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        return true; // Include properties without coordinates
      }
      
      // Calculate distance from Duomo
      const propertyPoint = point([lng, lat]);
      const dist = distance(duomoPoint, propertyPoint, { units: 'kilometers' });
      
      // Include only if within 4km radius
      return dist <= RADIUS_KM;
    });
    
    return filteredByRadius as SharedProperty[];
  }
  
  async saveClientMatches(clientId: number, items: Array<{sharedPropertyId: number, score: number}>): Promise<void> {
    console.log(`[saveClientMatches] Saving ${items.length} matches for client ${clientId}`);
    
    await db.delete(matches).where(eq(matches.clientId, clientId));
    
    if (items.length === 0) {
      console.log(`[saveClientMatches] No matches to save for client ${clientId}`);
      return;
    }
    
    const matchRecords = items
      .filter(item => !isNaN(item.score) && isFinite(item.score))
      .map(item => ({
        clientId,
        sharedPropertyId: item.sharedPropertyId,
        score: Math.round(item.score)
      }));
    
    await db.insert(matches).values(matchRecords);
    console.log(`[saveClientMatches] Successfully saved ${items.length} matches for client ${clientId}`);
  }
  
  async getClientMatchesFromCache(clientId: number): Promise<{matches: Match[], lastUpdated: Date | null}> {
    const cachedMatches = await db
      .select()
      .from(matches)
      .where(eq(matches.clientId, clientId))
      .orderBy(desc(matches.score));
    
    if (cachedMatches.length === 0) {
      return { matches: [], lastUpdated: null };
    }
    
    const oldestMatch = cachedMatches.reduce((oldest, m) => 
      m.createdAt < oldest.createdAt ? m : oldest
    );
    
    return { 
      matches: cachedMatches, 
      lastUpdated: oldestMatch.createdAt 
    };
  }
}

// Export storage instance
export const storage = new DatabaseStorage();
