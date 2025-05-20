import { pgTable, text, serial, integer, boolean, date, time, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users (agents)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").default("agent"),
  email: text("email").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url")
});

// Clients (base)
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "buyer" or "seller"
  salutation: text("salutation").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  isFriend: boolean("is_friend").default(false),
  email: text("email"),
  phone: text("phone").notNull(),
  religion: text("religion"),
  birthday: date("birthday"),
  contractType: text("contract_type"), // "rent" or "sale"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Buyers (extends clients)
export const buyers = pgTable("buyers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  searchArea: jsonb("search_area"), // GeoJSON polygon
  minSize: integer("min_size"), // in square meters
  maxPrice: integer("max_price"),
  urgency: integer("urgency").default(1), // 1-5 scale
  rating: integer("rating").default(3), // 1-5 scale
  searchNotes: text("search_notes")
});

// Sellers (extends clients)
export const sellers = pgTable("sellers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  propertyId: integer("property_id"),
});

// Properties
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  size: integer("size").notNull(), // in square meters
  price: integer("price").notNull(), // in EUR
  type: text("type").notNull(), // apartment, house, villa, etc.
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  yearBuilt: integer("year_built"),
  energyClass: text("energy_class"),
  description: text("description"),
  status: text("status").default("available"), // available, pending, sold
  isShared: boolean("is_shared").default(false), // if shared with other agencies
  isOwned: boolean("is_owned").default(true), // if our agency owns the listing
  externalLink: text("external_link"), // link to listing on website
  location: jsonb("location"), // lat/lng
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Shared properties (for multi-agency listings)
export const sharedProperties = pgTable("shared_properties", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id),
  address: text("address").notNull(),
  city: text("city"),
  size: integer("size"),
  price: integer("price"),
  type: text("type"), // apartment, house, villa, etc.
  ownerName: text("owner_name"),
  ownerPhone: text("owner_phone"),
  ownerEmail: text("owner_email"),
  ownerNotes: text("owner_notes"),
  floor: text("floor"), // piano dell'appartamento
  agency1Name: text("agency1_name"),
  agency1Link: text("agency1_link"),
  agency2Name: text("agency2_name"),
  agency2Link: text("agency2_link"),
  agency3Name: text("agency3_name"),
  agency3Link: text("agency3_link"),
  rating: integer("rating").default(3), // 1-5 scale of importance/quality
  stage: text("stage").default("address_found"), // address_found, owner_found, owner_contact_found, owner_contacted, result
  stageResult: text("stage_result"), // acquired, rejected, pending
  isAcquired: boolean("is_acquired").default(false),
  matchBuyers: boolean("match_buyers").default(false), // whether to match with buyers
  location: jsonb("location"), // lat/lng
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Appointments
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  date: date("date").notNull(),
  time: time("time").notNull(),
  type: text("type").notNull(), // visit, call
  status: text("status").default("scheduled"), // scheduled, completed, cancelled
  feedback: text("feedback"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow()
});

// Tasks and alerts
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // followUp, noResponse, birthday, etc.
  title: text("title").notNull(),
  description: text("description"),
  clientId: integer("client_id").references(() => clients.id),
  propertyId: integer("property_id").references(() => properties.id),
  sharedPropertyId: integer("shared_property_id").references(() => sharedProperties.id),
  dueDate: date("due_date").notNull(),
  status: text("status").default("pending"), // pending, completed, cancelled
  assignedTo: integer("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});

// Thread di conversazione
export const conversationThreads = pgTable("conversation_threads", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(), // Nome del thread (es. "Richiesta Via Roma", "Informazioni Vendita")
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  status: text("status").default("active"), // active, archived, closed
  createdAt: timestamp("created_at").defaultNow()
});

// Client communications
export const communications = pgTable("communications", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  propertyId: integer("property_id").references(() => properties.id),
  sharedPropertyId: integer("shared_property_id").references(() => sharedProperties.id),
  threadId: integer("thread_id").references(() => conversationThreads.id), // Riferimento al thread
  type: text("type").notNull(), // email, call, whatsapp, property_sent, meeting, etc.
  subject: text("subject").notNull(),
  content: text("content"),
  summary: text("summary"), // riassunto AI-generato
  direction: text("direction").notNull(), // inbound, outbound
  createdBy: integer("created_by").references(() => users.id),
  needsFollowUp: boolean("needs_follow_up").default(false),
  followUpDate: date("follow_up_date"),
  status: text("status").default("pending"), // pending, completed, no-response
  sentiment: text("sentiment"), // positive, negative, neutral - analisi del sentimento con AI
  sentimentScore: integer("sentiment_score"), // punteggio da 0 a 100
  responseToId: integer("response_to_id").references(() => communications.id), // per tracciare le risposte
  autoFollowUpSent: boolean("auto_follow_up_sent").default(false), // per sapere se è stato inviato un follow-up automatico
  createdAt: timestamp("created_at").defaultNow(),
  externalId: text("external_id") // ID esterno (es. ID messaggio WhatsApp)
});

// Associazioni tra messaggi e immobili
export const communicationProperties = pgTable("communication_properties", {
  id: serial("id").primaryKey(),
  communicationId: integer("communication_id").notNull().references(() => communications.id),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  relevance: integer("relevance").default(1), // 1-5 scale di rilevanza
  createdAt: timestamp("created_at").defaultNow()
});

// Analytics for market insights
export const marketInsights = pgTable("market_insights", {
  id: serial("id").primaryKey(),
  area: text("area").notNull(),
  propertyType: text("property_type").notNull(),
  minSize: integer("min_size"),
  maxSize: integer("max_size"),
  minPrice: integer("min_price"),
  maxPrice: integer("max_price"),
  demandScore: integer("demand_score"), // 1-100 scale
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
// Redefine client schema manually per avere maggiore controllo
export const insertClientSchema = z.object({
  type: z.string(),
  salutation: z.string(),
  firstName: z.string(),
  lastName: z.string(), 
  isFriend: z.boolean().optional().default(false),
  email: z.string().optional().nullable(),
  phone: z.string(),
  religion: z.string().optional().nullable(),
  birthday: z.any().optional().nullable(),
  contractType: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
// Redefine buyer schema manually to be more permissive
export const insertBuyerSchema = z.object({
  clientId: z.number(),
  searchArea: z.any().optional().nullable(),
  minSize: z.number().optional().nullable(),
  maxPrice: z.number().optional().nullable(),
  urgency: z.number().optional().nullable().default(3),
  rating: z.number().optional().nullable().default(3),
  searchNotes: z.string().optional().nullable()
});
// Redefine seller schema manually to be more permissive
export const insertSellerSchema = z.object({
  clientId: z.number(),
  propertyId: z.number().optional().nullable()
});
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSharedPropertySchema = createInsertSchema(sharedProperties)
  .omit({ id: true })
  .extend({
    propertyId: z.number().nullable().optional(), // Permettiamo sia null che undefined
  });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertCommunicationSchema = createInsertSchema(communications)
  .omit({ id: true, createdAt: true })
  .extend({
    threadId: z.number().optional().nullable(), // Permettiamo sia null che undefined
  });
export const insertConversationThreadSchema = createInsertSchema(conversationThreads)
  .omit({ id: true, createdAt: true, lastActivityAt: true });
export const insertCommunicationPropertySchema = createInsertSchema(communicationProperties)
  .omit({ id: true, createdAt: true });
export const insertMarketInsightSchema = createInsertSchema(marketInsights).omit({ id: true, createdAt: true });

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Buyer = typeof buyers.$inferSelect;
export type InsertBuyer = z.infer<typeof insertBuyerSchema>;

export type Seller = typeof sellers.$inferSelect;
export type InsertSeller = z.infer<typeof insertSellerSchema>;

export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

export type SharedProperty = typeof sharedProperties.$inferSelect;
export type InsertSharedProperty = z.infer<typeof insertSharedPropertySchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;

export type ConversationThread = typeof conversationThreads.$inferSelect;
export type InsertConversationThread = z.infer<typeof insertConversationThreadSchema>;

export type CommunicationProperty = typeof communicationProperties.$inferSelect;
export type InsertCommunicationProperty = z.infer<typeof insertCommunicationPropertySchema>;

export type MarketInsight = typeof marketInsights.$inferSelect;
export type InsertMarketInsight = z.infer<typeof insertMarketInsightSchema>;

// Custom types for front-end usage
export type ClientWithDetails = Client & {
  buyer?: Buyer;
  seller?: Seller;
  appointments?: Appointment[];
  properties?: Property[];
  tasks?: Task[];
  communications?: Communication[];
  lastCommunication?: Communication;
  daysSinceLastCommunication?: number;
  matchPercentage?: number; // Percentuale di match con l'immobile
};

export type PropertyWithDetails = Property & {
  sharedDetails?: SharedProperty;
  appointments?: Appointment[];
  interestedClients?: ClientWithDetails[];
  communications?: Communication[];
  lastCommunication?: Communication;
};

export type SharedPropertyWithDetails = SharedProperty & {
  tasks?: Task[];
  communications?: Communication[];
  lastActivity?: Communication | Task;
  matchingBuyers?: ClientWithDetails[];
};
