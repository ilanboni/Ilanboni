import { 
  users, type User, type InsertUser,
  clients, type Client, type InsertClient,
  buyers, type Buyer, type InsertBuyer,
  sellers, type Seller, type InsertSeller,
  properties, type Property, type InsertProperty,
  sharedProperties, type SharedProperty, type InsertSharedProperty,
  appointments, type Appointment, type InsertAppointment,
  tasks, type Task, type InsertTask,
  communications, type Communication, type InsertCommunication,
  marketInsights, type MarketInsight, type InsertMarketInsight,
  type ClientWithDetails, type PropertyWithDetails, 
  type SharedPropertyWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, lt, and, or, gte, lte, like, not, isNull, SQL } from "drizzle-orm";

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
  getProperties(filters?: { status?: string; search?: string }): Promise<Property[]>;
  getPropertyWithDetails(id: number): Promise<PropertyWithDetails | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: number, data: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;
  
  // Shared property methods
  getSharedProperty(id: number): Promise<SharedProperty | undefined>;
  getSharedPropertyByPropertyId(propertyId: number): Promise<SharedProperty | undefined>;
  getSharedProperties(filters?: { stage?: string; search?: string }): Promise<SharedProperty[]>;
  getSharedPropertyWithDetails(id: number): Promise<SharedPropertyWithDetails | undefined>;
  createSharedProperty(sharedProperty: InsertSharedProperty): Promise<SharedProperty>;
  updateSharedProperty(id: number, data: Partial<InsertSharedProperty>): Promise<SharedProperty | undefined>;
  acquireSharedProperty(id: number): Promise<boolean>;
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
  getLastCommunicationByClientId(clientId: number): Promise<Communication | undefined>;
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  updateCommunication(id: number, data: Partial<InsertCommunication>): Promise<Communication | undefined>;
  deleteCommunication(id: number): Promise<boolean>;
  getClientsWithoutRecentCommunication(days: number, minRating: number): Promise<ClientWithDetails[]>;
  getCommunicationByExternalId(externalId: string): Promise<Communication | undefined>;
  
  // Task methods
  getTask(id: number): Promise<Task | undefined>;
  getTasks(filters?: { status?: string; type?: string }): Promise<Task[]>;
  getTasksByClientId(clientId: number): Promise<Task[]>;
  getTasksByPropertyId(propertyId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<InsertTask>): Promise<Task | undefined>;
  completeTask(id: number): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  
  // Market insight methods
  getMarketInsight(id: number): Promise<MarketInsight | undefined>;
  getMarketInsights(filters?: { area?: string; month?: number; year?: number }): Promise<MarketInsight[]>;
  createMarketInsight(insight: InsertMarketInsight): Promise<MarketInsight>;
  updateMarketInsight(id: number, data: Partial<InsertMarketInsight>): Promise<MarketInsight | undefined>;
  deleteMarketInsight(id: number): Promise<boolean>;
  
  // Matching methods
  matchPropertiesForBuyer(buyerId: number): Promise<Property[]>;
  matchBuyersForProperty(propertyId: number): Promise<Client[]>;
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
  
  async getProperties(filters?: { status?: string; search?: string }): Promise<Property[]> {
    let properties = Array.from(this.propertyStore.values());
    
    if (filters) {
      if (filters.status && filters.status !== "all") {
        properties = properties.filter((property) => property.status === filters.status);
      }
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        properties = properties.filter((property) => 
          property.address.toLowerCase().includes(search) ||
          property.city.toLowerCase().includes(search) ||
          property.type.toLowerCase().includes(search)
        );
      }
    }
    
    return properties;
  }
  
  async getPropertyWithDetails(id: number): Promise<PropertyWithDetails | undefined> {
    const property = this.propertyStore.get(id);
    if (!property) return undefined;
    
    let propertyWithDetails: PropertyWithDetails = { ...property };
    
    // Add shared property details if property is shared
    if (property.isShared) {
      const sharedProperty = Array.from(this.sharedPropertyStore.values()).find(
        (shared) => shared.propertyId === property.id
      );
      if (sharedProperty) {
        propertyWithDetails.sharedDetails = sharedProperty;
      }
    }
    
    // Add appointments
    const appointments = Array.from(this.appointmentStore.values()).filter(
      (appointment) => appointment.propertyId === property.id
    );
    if (appointments.length > 0) {
      propertyWithDetails.appointments = appointments;
    }
    
    // Add communications related to this property
    const communications = Array.from(this.communicationStore.values()).filter(
      (communication) => communication.propertyId === property.id
    );
    if (communications.length > 0) {
      propertyWithDetails.communications = communications;
      
      // Add last communication
      const sortedComms = [...communications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      if (sortedComms.length > 0) {
        propertyWithDetails.lastCommunication = sortedComms[0];
      }
    }
    
    // Find interested clients
    const interestedClients: ClientWithDetails[] = [];
    
    // Buyers matched to this property
    const matchedBuyers = await this.matchBuyersForProperty(property.id);
    if (matchedBuyers.length > 0) {
      propertyWithDetails.interestedClients = matchedBuyers;
    }
    
    return propertyWithDetails;
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
  async getSharedProperty(id: number): Promise<SharedProperty | undefined> {
    return this.sharedPropertyStore.get(id);
  }
  
  async getSharedPropertyByPropertyId(propertyId: number): Promise<SharedProperty | undefined> {
    return Array.from(this.sharedPropertyStore.values()).find(
      (shared) => shared.propertyId === propertyId
    );
  }
  
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
  
  async getAppointmentsByPropertyId(propertyId: number): Promise<Appointment[]> {
    return Array.from(this.appointmentStore.values()).filter(
      (appointment) => appointment.propertyId === propertyId
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
  
  async getTasks(filters?: { status?: string; type?: string }): Promise<Task[]> {
    let tasks = Array.from(this.taskStore.values());
    
    if (filters) {
      if (filters.status && filters.status !== "all") {
        tasks = tasks.filter((task) => task.status === filters.status);
      }
      
      if (filters.type && filters.type !== "all") {
        tasks = tasks.filter((task) => task.type === filters.type);
      }
    }
    
    // Add client details
    return tasks.map(task => {
      const extendedTask: any = { ...task };
      
      if (task.clientId) {
        const client = this.clientStore.get(task.clientId);
        if (client) {
          extendedTask.client = client;
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
  
  // Communication methods
  async getCommunication(id: number): Promise<Communication | undefined> {
    return this.communicationStore.get(id);
  }
  
  async getCommunicationByExternalId(externalId: string): Promise<Communication | undefined> {
    return Array.from(this.communicationStore.values()).find(
      comm => comm.externalId === externalId
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
   * - Poligono di ricerca (semplificato)
   * - Metratura fino al 10% in meno del minimo richiesto
   * - Prezzo fino al 10% in più del massimo richiesto
   */
  isPropertyMatchingBuyerCriteria(property: Property, buyer: Buyer): boolean {
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

  // Implementazione metodi per le proprietà condivise
  async getSharedProperty(id: number): Promise<SharedProperty | undefined> {
    return this.sharedPropertyStore.get(id);
  }
  
  async getSharedPropertyByPropertyId(propertyId: number): Promise<SharedProperty | undefined> {
    return Array.from(this.sharedPropertyStore.values()).find(
      (sp) => sp.propertyId === propertyId
    );
  }

  async getSharedProperties(filters?: { stage?: string; search?: string }): Promise<SharedProperty[]> {
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
  
  async createSharedProperty(sharedProperty: InsertSharedProperty): Promise<SharedProperty> {
    const id = this.sharedPropertyIdCounter++;
    const newSharedProperty: SharedProperty = { 
      id, 
      ...sharedProperty,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.sharedPropertyStore.set(id, newSharedProperty);
    return newSharedProperty;
  }
  
  async updateSharedProperty(id: number, data: Partial<InsertSharedProperty>): Promise<SharedProperty | undefined> {
    const existingSharedProperty = await this.getSharedProperty(id);
    if (!existingSharedProperty) return undefined;
    
    const updatedSharedProperty: SharedProperty = {
      ...existingSharedProperty,
      ...data,
      updatedAt: new Date()
    };
    
    this.sharedPropertyStore.set(id, updatedSharedProperty);
    return updatedSharedProperty;
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
  
  async deleteSharedProperty(id: number): Promise<boolean> {
    return this.sharedPropertyStore.delete(id);
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
            gte(buyers.maxPrice, sharedProperty.price * 1.1) // Tolleranza 10% sul prezzo
          ),
          or(
            isNull(buyers.minSize),
            lte(buyers.minSize, sharedProperty.size / 0.9) // Tolleranza 10% sulla dimensione
          )
        )
      );
    
    console.log(`[getMatchingBuyersForSharedProperty] Trovati ${potentialBuyers.length} potenziali acquirenti (filtro preliminare)`);
    
    // Verifica ogni potenziale acquirente con i criteri completi, inclusa la posizione geografica
    for (const buyer of potentialBuyers) {
      // Verifica tutti i criteri, inclusa la posizione geografica
      if (isPropertyMatchingBuyerCriteria(tempProperty, buyer)) {
        const client = await this.getClientWithDetails(buyer.clientId);
        if (client) {
          console.log(`[getMatchingBuyersForSharedProperty] Cliente ${client.id} (${client.firstName} ${client.lastName}) corrisponde alla proprietà condivisa ${sharedPropertyId}`);
          matchingBuyers.push(client);
        }
      }
    }
    
    console.log(`[getMatchingBuyersForSharedProperty] ${matchingBuyers.length} clienti corrispondono alla proprietà condivisa ${sharedPropertyId} dopo tutti i controlli`);
    return matchingBuyers;
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
    // First delete related records
    await db.delete(buyers).where(eq(buyers.clientId, id));
    await db.delete(sellers).where(eq(sellers.clientId, id));
    await db.delete(appointments).where(eq(appointments.clientId, id));
    await db.delete(tasks).where(eq(tasks.clientId, id));
    await db.delete(communications).where(eq(communications.clientId, id));
    
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
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

  async getProperties(filters?: { status?: string; search?: string }): Promise<Property[]> {
    let query = db.select().from(properties);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.status) {
        conditions.push(eq(properties.status, filters.status));
      }
      
      if (filters.search) {
        const search = `%${filters.search}%`;
        conditions.push(
          or(
            like(properties.address, search),
            like(properties.city, search),
            like(properties.type, search)
          )
        );
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(properties.updatedAt));
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
    // First delete related records
    await db.delete(sharedProperties).where(eq(sharedProperties.propertyId, id));
    await db.delete(appointments).where(eq(appointments.propertyId, id));
    await db.delete(tasks).where(eq(tasks.propertyId, id));
    await db.delete(communications).where(eq(communications.propertyId, id));
    
    // Update related sellers to remove property reference
    await db.update(sellers)
      .set({ propertyId: null })
      .where(eq(sellers.propertyId, id));
    
    const result = await db.delete(properties).where(eq(properties.id, id)).returning();
    return result.length > 0;
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

  async getSharedProperties(filters?: { stage?: string; search?: string }): Promise<SharedProperty[]> {
    let query = db.select().from(sharedProperties);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.stage) {
        conditions.push(eq(sharedProperties.stage, filters.stage));
      }
      
      if (filters.search) {
        const search = `%${filters.search}%`;
        conditions.push(
          or(
            like(sharedProperties.address, search),
            like(sharedProperties.city, search),
            like(sharedProperties.ownerName, search)
          )
        );
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
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

  async createSharedProperty(sharedProperty: InsertSharedProperty): Promise<SharedProperty> {
    const result = await db.insert(sharedProperties).values(sharedProperty).returning();
    return result[0];
  }

  async updateSharedProperty(id: number, data: Partial<InsertSharedProperty>): Promise<SharedProperty | undefined> {
    const result = await db.update(sharedProperties)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sharedProperties.id, id))
      .returning();
    return result.length > 0 ? result[0] : undefined;
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
    
    await this.createProperty(propertyData);
    return true;
  }

  async deleteSharedProperty(id: number): Promise<boolean> {
    // First delete related records
    await db.delete(tasks).where(eq(tasks.sharedPropertyId, id));
    await db.delete(communications).where(eq(communications.sharedPropertyId, id));
    
    const result = await db.delete(sharedProperties).where(eq(sharedProperties.id, id)).returning();
    return result.length > 0;
  }

  async getMatchingBuyersForSharedProperty(sharedPropertyId: number): Promise<ClientWithDetails[]> {
    const sharedProperty = await this.getSharedProperty(sharedPropertyId);
    if (!sharedProperty) return [];
    
    // Find buyers with matching criteria
    const matchingBuyers = await db
      .select()
      .from(buyers)
      .innerJoin(clients, eq(buyers.clientId, clients.id))
      .where(
        and(
          eq(clients.type, "buyer"),
          or(
            isNull(buyers.maxPrice),
            gte(buyers.maxPrice, sharedProperty.price || 0)
          ),
          or(
            isNull(buyers.minSize),
            lte(buyers.minSize, sharedProperty.size || 0)
          )
        )
      );
    
    // Get full client details for each matching buyer
    const clientDetails: ClientWithDetails[] = [];
    for (const match of matchingBuyers) {
      const clientDetail = await this.getClientWithDetails(match.clients.id);
      if (clientDetail) {
        clientDetails.push(clientDetail);
      }
    }
    
    return clientDetails;
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
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.clientId, clientId))
      .orderBy(desc(appointments.date));
  }

  async getAppointmentsByPropertyId(propertyId: number): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.propertyId, propertyId))
      .orderBy(desc(appointments.date));
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

  async getTasks(filters?: { status?: string; type?: string }): Promise<Task[]> {
    let query = db.select().from(tasks);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.status) {
        conditions.push(eq(tasks.status, filters.status));
      }
      
      if (filters.type) {
        conditions.push(eq(tasks.type, filters.type));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    return await query.orderBy(desc(tasks.dueDate));
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
    
    // Fase 1: Filtro preliminare nel database
    let query = db.select().from(properties).where(eq(properties.status, "available"));
    
    const conditions: SQL[] = [];
    
    if (buyer.maxPrice) {
      // Tolleranza 10% sul prezzo (può essere fino al 10% in più del massimo richiesto)
      conditions.push(lte(properties.price, buyer.maxPrice * 1.1));
    }
    
    if (buyer.minSize) {
      // Tolleranza 10% sulla dimensione (può essere fino al 10% in meno del minimo richiesto)
      conditions.push(gte(properties.size, buyer.minSize * 0.9));
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
    
    // Calcola il prezzo con tolleranza (+10%)
    const priceWithTolerance = Math.floor(property.price * 1.1);
    
    // Fase 1: Esegui un filtro preliminare nel database per dimensione e prezzo
    // Questo riduce il numero di clienti da verificare per la posizione geografica
    const preliminaryMatches = await db
      .select()
      .from(buyers)
      .innerJoin(clients, eq(buyers.clientId, clients.id))
      .where(
        and(
          eq(clients.type, "buyer"),
          or(
            isNull(buyers.maxPrice),
            gte(buyers.maxPrice, priceWithTolerance) // Tolleranza 10% sul prezzo
          ),
          or(
            isNull(buyers.minSize),
            lte(buyers.minSize, property.size / 0.9) // Tolleranza 10% sulla dimensione
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
}

// Export storage instance
export const storage = new DatabaseStorage();
