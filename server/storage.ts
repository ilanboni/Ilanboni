import { 
  users, type User, type InsertUser,
  clients, type Client, type InsertClient,
  buyers, type Buyer, type InsertBuyer,
  sellers, type Seller, type InsertSeller,
  properties, type Property, type InsertProperty,
  sharedProperties, type SharedProperty, type InsertSharedProperty,
  appointments, type Appointment, type InsertAppointment,
  tasks, type Task, type InsertTask,
  marketInsights, type MarketInsight, type InsertMarketInsight,
  type ClientWithDetails, type PropertyWithDetails
} from "@shared/schema";

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
  getClients(filters?: { type?: string; search?: string }): Promise<Client[]>;
  getClientWithDetails(id: number): Promise<ClientWithDetails | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  
  // Buyer methods
  getBuyer(id: number): Promise<Buyer | undefined>;
  getBuyerByClientId(clientId: number): Promise<Buyer | undefined>;
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
  createSharedProperty(sharedProperty: InsertSharedProperty): Promise<SharedProperty>;
  updateSharedProperty(id: number, data: Partial<InsertSharedProperty>): Promise<SharedProperty | undefined>;
  deleteSharedProperty(id: number): Promise<boolean>;
  
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
    this.marketInsightStore = new Map();
    
    this.userIdCounter = 1;
    this.clientIdCounter = 1;
    this.buyerIdCounter = 1;
    this.sellerIdCounter = 1;
    this.propertyIdCounter = 1;
    this.sharedPropertyIdCounter = 1;
    this.appointmentIdCounter = 1;
    this.taskIdCounter = 1;
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
      // Size check
      if (buyer.minSize && property.size < buyer.minSize) {
        return false;
      }
      
      // Price check
      if (buyer.maxPrice && property.price > buyer.maxPrice) {
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
  
  async matchBuyersForProperty(propertyId: number): Promise<Client[]> {
    const property = this.propertyStore.get(propertyId);
    if (!property) return [];
    
    // Get all buyers
    const buyers = Array.from(this.buyerStore.values());
    const matchedClients: Client[] = [];
    
    for (const buyer of buyers) {
      // Size check
      if (buyer.minSize && property.size < buyer.minSize) {
        continue;
      }
      
      // Price check
      if (buyer.maxPrice && property.price > buyer.maxPrice) {
        continue;
      }
      
      // Check if property is in the search area (simplified)
      if (buyer.searchArea) {
        // Simplified check
        // In reality, we'd use a proper GeoJSON library
        // to check if the property location is inside the polygon
      }
      
      // Add matched client
      const client = this.clientStore.get(buyer.clientId);
      if (client) {
        matchedClients.push(client);
      }
    }
    
    return matchedClients;
  }
}

// Export a single storage instance
export const storage = new MemStorage();
