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
  propertyId: integer("property_id").notNull().references(() => properties.id),
  agencyName: text("agency_name").notNull(),
  contactPerson: text("contact_person"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  isAcquired: boolean("is_acquired").default(false)
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
  dueDate: date("due_date").notNull(),
  status: text("status").default("pending"), // pending, completed, cancelled
  assignedTo: integer("assigned_to").references(() => users.id),
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
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBuyerSchema = createInsertSchema(buyers).omit({ id: true });
export const insertSellerSchema = createInsertSchema(sellers).omit({ id: true });
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSharedPropertySchema = createInsertSchema(sharedProperties).omit({ id: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
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

export type MarketInsight = typeof marketInsights.$inferSelect;
export type InsertMarketInsight = z.infer<typeof insertMarketInsightSchema>;

// Custom types for front-end usage
export type ClientWithDetails = Client & {
  buyer?: Buyer;
  seller?: Seller;
  appointments?: Appointment[];
  properties?: Property[];
  tasks?: Task[];
};

export type PropertyWithDetails = Property & {
  sharedDetails?: SharedProperty;
  appointments?: Appointment[];
  interestedClients?: ClientWithDetails[];
};
