import { pgTable, text, serial, integer, boolean, date, time, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// OAuth tokens storage
export const oauthTokens = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  service: text("service").notNull().unique(), // "google_calendar", "gmail", etc.
  accessToken: text("access_token"),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at"),
  scopes: text("scopes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

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

// Contacts (generic contacts: owners, agencies, etc.)
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "client", "owner", "agency"
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
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
  searchLink: text("search_link"), // Casafari search link
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Buyers (extends clients)
export const buyers = pgTable("buyers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  searchArea: jsonb("search_area"), // GeoJSON FeatureCollection with zone polygons/circles
  searchAreaStatus: text("search_area_status"), // 'pending', 'success', 'partial', 'failed'
  searchAreaUpdatedAt: timestamp("search_area_updated_at"),
  minSize: integer("min_size"), // in square meters
  maxPrice: integer("max_price"),
  urgency: integer("urgency").default(1), // 1-5 scale
  rating: integer("rating").default(3), // 1-5 scale
  searchNotes: text("search_notes"),
  // AI-extracted preferences
  propertyType: text("property_type"), // apartment, house, office, other
  rooms: integer("rooms"),
  bathrooms: integer("bathrooms"),
  zones: jsonb("zones"), // Array of zone names
  elevator: boolean("elevator").default(false),
  balconyOrTerrace: boolean("balcony_or_terrace").default(false),
  parking: boolean("parking").default(false),
  garden: boolean("garden").default(false)
});

// Scraping jobs (for async scraping status tracking)
export const scrapingJobs = pgTable("scraping_jobs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id), // Nullable for full-city jobs
  jobType: text("job_type").notNull().default('buyer'), // 'buyer' | 'full-city'
  status: text("status").notNull().default('queued'), // 'queued', 'running', 'completed', 'failed'
  buyerCriteria: jsonb("buyer_criteria"), // Criteri usati per lo scraping (for buyer jobs)
  config: jsonb("config"), // { maxItems, portals: ['immobiliare', 'idealista'] }
  checkpoint: jsonb("checkpoint"), // { portal, offset, apifyRunIds: {}, completedPortals: [] }
  results: jsonb("results"), // { totalFetched, imported, updated, failed, errors, portalResults: {} }
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at")
});

export const insertScrapingJobSchema = createInsertSchema(scrapingJobs)
  .omit({ id: true, createdAt: true });

export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type InsertScrapingJob = z.infer<typeof insertScrapingJobSchema>;

// Sellers (extends clients)
export const sellers = pgTable("sellers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  propertyId: integer("property_id"),
});

// Matches (property-client matching results with AI reasoning)
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  buyerId: integer("buyer_id").references(() => buyers.id),
  propertyId: integer("property_id").references(() => properties.id),
  sharedPropertyId: integer("shared_property_id").references(() => sharedProperties.id),
  score: integer("score").notNull(), // match score 0-100
  reasoning: text("reasoning"), // AI-generated explanation of match quality
  isAiGenerated: boolean("is_ai_generated").default(false), // true if score was computed by OpenAI
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Client requests (natural language property requests from clients)
export const clientRequests = pgTable("client_requests", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  sourceText: text("source_text").notNull(), // original NL text from client
  filters: jsonb("filters").notNull(), // structured filters from ChatGPT
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Properties
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  size: integer("size"), // in square meters (optional - not all listings provide it)
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
  immobiliareItId: text("immobiliare_it_id"), // ID annuncio immobiliare.it per associazione automatica email
  ownerName: text("owner_name"), // nome del proprietario
  ownerType: text("owner_type"), // 'private' or 'agency' - tipo di proprietario
  // Geocoding for fuzzy address matching
  latitude: text("latitude"), // stored as text for precision
  longitude: text("longitude"),
  geocodeStatus: text("geocode_status").default("pending"), // pending, success, failed
  ownerPhone: text("owner_phone"), // telefono del proprietario  
  ownerEmail: text("owner_email"), // email del proprietario
  location: jsonb("location"), // lat/lng
  // Campi per agente virtuale
  floor: text("floor"), // piano dell'appartamento
  portal: text("portal"), // portale di provenienza (immobiliare.it, idealista.it, etc.)
  agencyName: text("agency_name"), // nome dell'agenzia che gestisce l'annuncio (estratto da Casafari)
  isMultiagency: boolean("is_multiagency").default(false), // se è pluricondiviso (presente su più portali)
  exclusivityHint: boolean("exclusivity_hint").default(false), // se è probabilmente in esclusiva (un solo portale, testo "esclusiva")
  // Campi per ingestion tracking
  externalId: text("external_id"), // ID dell'annuncio sul portale esterno
  source: text("source"), // fonte import: "casafari", "scraper-immobiliare", "scraper-idealista", "manual"
  firstSeenAt: timestamp("first_seen_at"), // prima volta che l'annuncio è stato visto
  lastSeenAt: timestamp("last_seen_at"), // ultimo aggiornamento
  url: text("url"), // URL completo dell'annuncio
  isFavorite: boolean("is_favorite").default(false), // properties marked as favorites for follow-up
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Geocode cache (reduce Nominatim API calls)
export const geocodeCache = pgTable("geocode_cache", {
  id: serial("id").primaryKey(),
  normalizedAddress: text("normalized_address").notNull().unique(), // "via milano 10, milano" normalized
  latitude: text("latitude"),
  longitude: text("longitude"),
  status: text("status").notNull(), // success, failed, pending
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Zone geocode cache (for Milano neighborhoods/zones)
export const zoneGeocodeCache = pgTable("zone_geocode_cache", {
  id: serial("id").primaryKey(),
  zoneName: text("zone_name").notNull().unique(), // "Pagano, Milano, Italy" normalized
  city: text("city").notNull().default("Milano"), // city name
  latitude: text("latitude"), // centroid latitude
  longitude: text("longitude"), // centroid longitude
  boundaryGeoJSON: jsonb("boundary_geojson"), // Polygon boundary if available from Nominatim
  status: text("status").notNull(), // 'success', 'failed', 'pending'
  errorMessage: text("error_message"),
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
  description: text("description"), // property description
  bedrooms: integer("bedrooms"), // number of bedrooms
  bathrooms: integer("bathrooms"), // number of bathrooms
  condition: text("condition"), // property condition (Ristrutturato, Ottimo stato, etc.)
  agency1Name: text("agency1_name"),
  agency1Link: text("agency1_link"),
  agency2Name: text("agency2_name"),
  agency2Link: text("agency2_link"),
  agency3Name: text("agency3_name"),
  agency3Link: text("agency3_link"),
  agencies: jsonb("agencies"), // Array of {name: string, link: string, sourcePropertyId?: number} - supporto dinamico per N agenzie
  rating: integer("rating").default(3), // 1-5 scale of importance/quality
  stage: text("stage").default("address_found"), // address_found, owner_found, owner_contact_found, owner_contacted, result
  stageResult: text("stage_result"), // acquired, rejected, pending
  isAcquired: boolean("is_acquired").default(false),
  isIgnored: boolean("is_ignored").default(false), // properties that the agent is not interested in
  isFavorite: boolean("is_favorite").default(false), // properties marked as favorites for follow-up
  matchBuyers: boolean("match_buyers").default(false), // whether to match with buyers
  location: jsonb("location"), // lat/lng
  externalId: text("external_id"), // ID from external portal (Immobiliare, Idealista, etc.)
  portalSource: text("portal_source"), // "Immobiliare.it", "Idealista.it", etc.
  url: text("url"), // Link to external listing
  externalLink: text("external_link"), // Link to external listing (alternative field)
  imageUrls: jsonb("image_urls"), // Array of image URLs from scraping
  ownerType: text("owner_type"), // "private" or "agency"
  isMultiagency: boolean("is_multiagency").default(false), // true if 7+ agencies
  hasWebContact: boolean("has_web_contact").default(false), // true if property can only be contacted via website (no phone)
  scrapedForClientId: integer("scraped_for_client_id").references(() => clients.id), // Which client requested the scraping
  lastScrapedAt: timestamp("last_scraped_at"), // Last time this property was scraped
  classificationColor: text("classification_color").default("red"), // "red" (single agency), "yellow" (multi-agency), "green" (private)
  matchScore: integer("match_score"), // 0-100 matching score with buyer criteria
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  // Unique constraint on URL to prevent duplicate listings from same source
  urlIdx: uniqueIndex("shared_properties_url_idx").on(table.url),
  // Unique constraint on address+price to prevent duplicate manual entries
  addressPriceIdx: uniqueIndex("shared_properties_address_price_idx").on(table.address, table.price)
}));

// Client-specific favorites (dual favorites system) - supports both shared and private properties
export const clientFavorites = pgTable("client_favorites", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  sharedPropertyId: integer("shared_property_id").references(() => sharedProperties.id, { onDelete: 'cascade' }), // Optional - for shared properties
  propertyId: integer("property_id").references(() => properties.id, { onDelete: 'cascade' }), // Optional - for private properties
  addedAt: timestamp("added_at").defaultNow(),
  notes: text("notes"), // client-specific notes about this property
}, (table) => ({
  uniqueClientSharedFav: uniqueIndex("client_favorites_shared_unique_idx").on(table.clientId, table.sharedPropertyId),
  uniqueClientPrivateFav: uniqueIndex("client_favorites_private_unique_idx").on(table.clientId, table.propertyId)
}));

// Client-specific ignored properties (per-client ignore list) - supports both shared and private properties
export const clientIgnoredProperties = pgTable("client_ignored_properties", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  sharedPropertyId: integer("shared_property_id").references(() => sharedProperties.id, { onDelete: 'cascade' }), // Optional - for shared properties
  propertyId: integer("property_id").references(() => properties.id, { onDelete: 'cascade' }), // Optional - for private properties
  ignoredAt: timestamp("ignored_at").defaultNow(),
  reason: text("reason"), // optional reason for ignoring
}, (table) => ({
  uniqueClientSharedIgnored: uniqueIndex("client_ignored_shared_unique_idx").on(table.clientId, table.sharedPropertyId),
  uniqueClientPrivateIgnored: uniqueIndex("client_ignored_private_unique_idx").on(table.clientId, table.propertyId)
}));

// Shared property notes (for tracking considerations and activities)
export const sharedPropertyNotes = pgTable("shared_property_notes", {
  id: serial("id").primaryKey(),
  sharedPropertyId: integer("shared_property_id").notNull().references(() => sharedProperties.id, { onDelete: 'cascade' }),
  subject: text("subject").notNull(), // oggetto/titolo della nota
  notes: text("notes").notNull(), // contenuto/considerazioni
  attachmentUrl: text("attachment_url"), // URL del file allegato (se presente)
  attachmentName: text("attachment_name"), // nome originale del file
  attachmentType: text("attachment_type"), // tipo MIME del file
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  type: text("type").notNull(), // followUp, noResponse, birthday, WHATSAPP_SEND, CALL_OWNER, CALL_AGENCY, etc.
  title: text("title").notNull(),
  description: text("description"),
  clientId: integer("client_id").references(() => clients.id),
  propertyId: integer("property_id").references(() => properties.id),
  sharedPropertyId: integer("shared_property_id").references(() => sharedProperties.id),
  contactId: integer("contact_id").references(() => contacts.id),
  priority: integer("priority").default(50), // 0-100 scale for task prioritization
  dueDate: date("due_date").notNull(),
  status: text("status").default("pending"), // pending, completed, cancelled, open, done, skip
  assignedTo: integer("assigned_to").references(() => users.id),
  // Campi aggiuntivi per chiamate generiche
  contactName: text("contact_name"), // Nome contatto per chiamate generiche
  contactPhone: text("contact_phone"), // Telefono contatto
  contactEmail: text("contact_email"), // Email contatto  
  propertyInterest: text("property_interest"), // Tipo immobile di interesse
  // Campi per agente virtuale
  action: text("action"), // descrizione azione (es. "Invia scheda immobile su WhatsApp")
  target: text("target"), // destinatario/target (es. numero WhatsApp, "PROPRIETARIO", "AGENZIA")
  notes: text("notes"), // Note libere (può contenere link wa.me, istruzioni, etc.)
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  // Unique constraint to prevent duplicate search tasks for same property+client
  searchTaskIdx: uniqueIndex("tasks_search_unique_idx").on(table.sharedPropertyId, table.clientId, table.type)
}));

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
  responseToId: integer("response_to_id"), // per tracciare le risposte - self-reference aggiunta dopo
  autoFollowUpSent: boolean("auto_follow_up_sent").default(false), // per sapere se è stato inviato un follow-up automatico
  managementStatus: text("management_status").default("to_manage"), // "to_manage", "managed", "client_created"
  needsResponse: boolean("needs_response").default(false), // per messaggi in entrata non risposti
  respondedAt: timestamp("responded_at"), // timestamp quando è stata data una risposta
  createdAt: timestamp("created_at").defaultNow(),
  externalId: text("external_id"), // ID esterno (es. ID messaggio WhatsApp)
  correlationId: text("correlation_id"), // UUID locale per deduplicazione
  source: text("source"), // "app", "webhook", "phone" - origine della comunicazione
  deliveryStatus: text("delivery_status") // "pending", "sent", "delivered", "failed" - stato di consegna
}, (table) => ({
  // Index su correlationId per deduplicazione veloce
  correlationIdIdx: index("communications_correlation_id_idx").on(table.correlationId),
  // Index su externalId per ricerca veloce
  externalIdIdx: index("communications_external_id_idx").on(table.externalId)
}));

// Associazioni tra messaggi e immobili
export const communicationProperties = pgTable("communication_properties", {
  id: serial("id").primaryKey(),
  communicationId: integer("communication_id").notNull().references(() => communications.id),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  relevance: integer("relevance").default(1), // 1-5 scale di rilevanza
  createdAt: timestamp("created_at").defaultNow()
});

// Interazioni agente virtuale - per anti-duplicazione
export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(), // whatsapp, call, email, meeting
  direction: text("direction"), // out, in (nullable for backwards compatibility)
  clientId: integer("client_id").references(() => clients.id),
  propertyId: integer("property_id").references(() => properties.id),
  sharedPropertyId: integer("shared_property_id").references(() => sharedProperties.id),
  contactId: integer("contact_id").references(() => contacts.id),
  text: text("text"), // message content or notes
  outcome: text("outcome"), // positive, negative, neutral, no_response
  payloadJson: jsonb("payload_json"), // dati aggiuntivi in formato JSON
  createdAt: timestamp("created_at").defaultNow().notNull()
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

// Tabella per tracciare le visite agli immobili con esiti
export const propertyVisits = pgTable("property_visits", {
  id: serial("id").primaryKey(),
  appointmentConfirmationId: integer("appointment_confirmation_id").notNull().references(() => appointmentConfirmations.id),
  clientId: integer("client_id").notNull().references(() => clients.id),
  propertyId: integer("property_id").references(() => properties.id),
  sharedPropertyId: integer("shared_property_id").references(() => sharedProperties.id),
  visitDate: timestamp("visit_date").notNull(),
  outcome: text("outcome"), // "positive", "negative", "neutral"
  notes: text("notes"),
  propertyAddress: text("property_address").notNull(),
  propertyCode: text("property_code"),
  clientName: text("client_name").notNull(),
  followUpRequired: boolean("follow_up_required").default(false),
  reminderShown: boolean("reminder_shown").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMatchSchema = createInsertSchema(matches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientRequestSchema = createInsertSchema(clientRequests).omit({ id: true, createdAt: true, updatedAt: true });
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
export const insertPropertySchema = createInsertSchema(properties)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    // Owner/Seller client information fields for form
    ownerSalutation: z.string().optional(),
    ownerFirstName: z.string().optional(), 
    ownerLastName: z.string().optional(),
    ownerPhone: z.string().optional(),
    ownerEmail: z.string().optional(),
    ownerNotes: z.string().optional(),
    ownerBirthday: z.string().optional(),
    ownerReligion: z.string().optional(),
    ownerIsFriend: z.boolean().optional(),
    createOwnerAsClient: z.boolean().optional(),
    // Additional fields
    immobiliareItId: z.string().optional(),
  });
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
export const insertInteractionSchema = createInsertSchema(interactions)
  .omit({ id: true, createdAt: true });
export const insertMarketInsightSchema = createInsertSchema(marketInsights).omit({ id: true, createdAt: true });
export const insertPropertyVisitSchema = createInsertSchema(propertyVisits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSharedPropertyNoteSchema = createInsertSchema(sharedPropertyNotes).omit({ id: true, createdAt: true, updatedAt: true });

export const insertClientFavoriteSchema = createInsertSchema(clientFavorites)
  .omit({ id: true, addedAt: true })
  .extend({
    sharedPropertyId: z.number().optional().nullable(),
    propertyId: z.number().optional().nullable(),
  });
export type ClientFavorite = typeof clientFavorites.$inferSelect;
export type InsertClientFavorite = z.infer<typeof insertClientFavoriteSchema>;

export const insertClientIgnoredPropertySchema = createInsertSchema(clientIgnoredProperties)
  .omit({ id: true, ignoredAt: true })
  .extend({
    sharedPropertyId: z.number().optional().nullable(),
    propertyId: z.number().optional().nullable(),
  });
export type ClientIgnoredProperty = typeof clientIgnoredProperties.$inferSelect;
export type InsertClientIgnoredProperty = z.infer<typeof insertClientIgnoredPropertySchema>;

// Tabella per tracciare gli immobili inviati ai clienti
export const propertySent = pgTable("property_sent", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  propertyId: integer("property_id").references(() => properties.id),
  sharedPropertyId: integer("shared_property_id").references(() => sharedProperties.id),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  messageType: text("message_type").notNull(), // 'formal' | 'informal'
  messageContent: text("message_content").notNull(),
  clientResponseReceived: boolean("client_response_received").default(false),
  responseContent: text("response_content"),
  responseSentiment: text("response_sentiment"), // 'positive' | 'negative' | 'neutral'
  responseAnalysis: text("response_analysis"), // Analisi dettagliata dell'IA
  responseReceivedAt: timestamp("response_received_at"),
  resendScheduled: boolean("resend_scheduled").default(true),
  resendAt: timestamp("resend_at"), // Data programmata per il reinvio
  resendTaskId: integer("resend_task_id").references(() => tasks.id),
  communicationId: integer("communication_id").references(() => communications.id),
});

export const insertPropertySentSchema = createInsertSchema(propertySent).omit({ id: true, sentAt: true });

// Tabella per gli eventi del calendario
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  location: text("location"),
  clientId: integer("client_id").references(() => clients.id),
  propertyId: integer("property_id").references(() => properties.id),
  appointmentConfirmationId: integer("appointment_confirmation_id").references(() => appointmentConfirmations.id),
  googleEventId: text("google_event_id"), // ID dell'evento su Google Calendar
  dedupeKey: text("dedupe_key"), // Hash MD5 per idempotenza: md5(title|startDate|location)
  syncStatus: text("sync_status").default("pending"), // 'pending', 'synced', 'failed'
  syncError: text("sync_error"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Tabella per tracciare le email da immobiliare.it
export const immobiliareEmails = pgTable("immobiliare_emails", {
  id: serial("id").primaryKey(),
  emailId: text("email_id").notNull().unique(), // ID univoco dell'email
  fromAddress: text("from_address").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  htmlBody: text("html_body"),
  receivedAt: timestamp("received_at").notNull(),
  processed: boolean("processed").default(false),
  processingError: text("processing_error"),
  // Dati estratti dall'email
  clientName: text("client_name"),
  clientEmail: text("client_email"), 
  clientPhone: text("client_phone"),
  propertyAddress: text("property_address"),
  propertyType: text("property_type"),
  propertyPrice: integer("property_price"),
  propertySize: integer("property_size"),
  requestType: text("request_type"), // "visita", "informazioni", "contatto"
  // Collegamenti ai record creati
  clientId: integer("client_id").references(() => clients.id),
  propertyId: integer("property_id").references(() => properties.id),
  taskId: integer("task_id").references(() => tasks.id),
  communicationId: integer("communication_id").references(() => communications.id),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertImmobiliareEmailSchema = createInsertSchema(immobiliareEmails)
  .omit({ id: true, createdAt: true });

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Buyer = typeof buyers.$inferSelect;
export type InsertBuyer = z.infer<typeof insertBuyerSchema>;

export type Seller = typeof sellers.$inferSelect;
export type InsertSeller = z.infer<typeof insertSellerSchema>;

export type Match = typeof matches.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;

export type ClientRequest = typeof clientRequests.$inferSelect;
export type InsertClientRequest = z.infer<typeof insertClientRequestSchema>;

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

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;

export type MarketInsight = typeof marketInsights.$inferSelect;
export type InsertMarketInsight = z.infer<typeof insertMarketInsightSchema>;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

export type PropertySent = typeof propertySent.$inferSelect;
export type InsertPropertySent = z.infer<typeof insertPropertySentSchema>;

export type PropertyVisit = typeof propertyVisits.$inferSelect;
export type InsertPropertyVisit = z.infer<typeof insertPropertyVisitSchema>;

export type SharedPropertyNote = typeof sharedPropertyNotes.$inferSelect;
export type InsertSharedPropertyNote = z.infer<typeof insertSharedPropertyNoteSchema>;

// Custom types for front-end usage
export type ClientType = "buyer" | "seller";

export type TaskWithClient = Task & {
  clientFirstName?: string | null;
  clientLastName?: string | null;
};

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

// Tabella per la gestione delle conferme appuntamenti
export const appointmentConfirmations = pgTable("appointment_confirmations", {
  id: serial("id").primaryKey(),
  salutation: text("salutation").notNull(), // "egr_dott", "gentma_sigra", etc
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  appointmentDate: text("appointment_date").notNull(), // Data e ora dell'appuntamento
  address: text("address").notNull().default("viale Abruzzi 78"), // Indirizzo dell'appuntamento
  sent: boolean("sent").default(false),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertAppointmentConfirmationSchema = createInsertSchema(appointmentConfirmations)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type AppointmentConfirmation = typeof appointmentConfirmations.$inferSelect;
export type InsertAppointmentConfirmation = z.infer<typeof insertAppointmentConfirmationSchema>;

export type ImmobiliareEmail = typeof immobiliareEmails.$inferSelect;
export type InsertImmobiliareEmail = z.infer<typeof insertImmobiliareEmailSchema>;

// Tabella per tracciare i messaggi di mail merge ai proprietari
export const mailMergeMessages = pgTable("mail_merge_messages", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  appellativo: text("appellativo").notNull(),
  cognome: text("cognome").notNull(),
  indirizzo: text("indirizzo").notNull(),
  telefono: text("telefono").notNull(),
  vistoSu: text("visto_su").notNull(),
  caratteristiche: text("caratteristiche").notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  responseStatus: text("response_status").default("no_response"), // "positive", "negative", "no_response"
  responseText: text("response_text"),
  responseReceivedAt: timestamp("response_received_at"),
  communicationId: integer("communication_id").references(() => communications.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Schema di inserimento per mail merge messages
export const insertMailMergeMessageSchema = createInsertSchema(mailMergeMessages)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type MailMergeMessage = typeof mailMergeMessages.$inferSelect;
export type InsertMailMergeMessage = z.infer<typeof insertMailMergeMessageSchema>;

// Tabella per tracciare gli obiettivi giornalieri
export const dailyGoals = pgTable("daily_goals", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  messageGoal: integer("message_goal").default(10).notNull(),
  messagesSent: integer("messages_sent").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertDailyGoalSchema = createInsertSchema(dailyGoals)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type DailyGoal = typeof dailyGoals.$inferSelect;
export type InsertDailyGoal = z.infer<typeof insertDailyGoalSchema>;

// Tabella per tracciare le attività custom per le proprietà condivise
export const propertyActivities = pgTable("property_activities", {
  id: serial("id").primaryKey(),
  sharedPropertyId: integer("shared_property_id").notNull().references(() => sharedProperties.id),
  type: text("type").notNull(), // "phone_call", "site_visit", "email_sent", "document_request", "negotiation", "custom"
  title: text("title").notNull(),
  description: text("description"),
  activityDate: timestamp("activity_date").notNull(), // data/ora dell'attività
  status: text("status").default("pending").notNull(), // "pending", "completed", "cancelled"
  completedAt: timestamp("completed_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertPropertyActivitySchema = createInsertSchema(propertyActivities)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type PropertyActivity = typeof propertyActivities.$inferSelect;
export type InsertPropertyActivity = z.infer<typeof insertPropertyActivitySchema>;

// Tabella per gli allegati delle proprietà condivise
export const propertyAttachments = pgTable("property_attachments", {
  id: serial("id").primaryKey(),
  sharedPropertyId: integer("shared_property_id").notNull().references(() => sharedProperties.id),
  category: text("category").notNull(), // "visura", "planimetria", "foto", "contratto", "altro"
  filename: text("filename").notNull(), // nome file originale
  filepath: text("filepath").notNull(), // percorso del file sul server
  filesize: integer("filesize"), // dimensione in bytes
  mimetype: text("mimetype"), // tipo MIME del file
  notes: text("notes"), // note opzionali sull'allegato
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertPropertyAttachmentSchema = createInsertSchema(propertyAttachments)
  .omit({ id: true, createdAt: true });

export type PropertyAttachment = typeof propertyAttachments.$inferSelect;
export type InsertPropertyAttachment = z.infer<typeof insertPropertyAttachmentSchema>;

// Tabella per tracking contatti WhatsApp privati (anti-duplicazione)
export const privateContactTracking = pgTable("private_contact_tracking", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().unique(), // Numero normalizzato (es: 393123456789)
  propertyId: integer("property_id").references(() => properties.id), // Ultima proprietà per cui è stato contattato
  firstContactedAt: timestamp("first_contacted_at").defaultNow().notNull(),
  lastContactedAt: timestamp("last_contacted_at").defaultNow().notNull(),
  contactCount: integer("contact_count").default(1).notNull(), // Contatore contatti totali
  lastCampaignId: integer("last_campaign_id"), // ID ultima campagna
  status: text("status").default("active").notNull(), // "active", "do_not_contact", "responded", "converted"
  notes: text("notes"), // Note agente
  metadata: jsonb("metadata") // { propertyIds: [], campaignIds: [], lastResponse: "", etc. }
}, (table) => ({
  phoneIdx: uniqueIndex("private_contact_tracking_phone_idx").on(table.phoneNumber)
}));

export const insertPrivateContactTrackingSchema = createInsertSchema(privateContactTracking)
  .omit({ id: true, firstContactedAt: true, lastContactedAt: true });

export type PrivateContactTracking = typeof privateContactTracking.$inferSelect;
export type InsertPrivateContactTracking = z.infer<typeof insertPrivateContactTrackingSchema>;

// Campagne WhatsApp per privati
export const whatsappCampaigns = pgTable("whatsapp_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Nome campagna (es: "Milano Zona 1 - Nov 2025")
  template: text("template").notNull(), // Template messaggio con variabili {{name}}, {{address}}, etc.
  instructions: text("instructions"), // Istruzioni per il bot ChatGPT
  objectionHandling: jsonb("objection_handling"), // Array di obiezioni: [{ keywords: ["no agenzie"], response: "..." }]
  followUpTemplate: text("followup_template"), // Template follow-up
  followUpDelayDays: integer("followup_delay_days").default(3), // Giorni prima del follow-up
  useAiPersonalization: boolean("use_ai_personalization").default(false), // Usa AI per personalizzazione avanzata
  status: text("status").default("draft").notNull(), // "draft", "active", "paused", "completed"
  totalTargets: integer("total_targets").default(0), // Totale destinatari
  sentCount: integer("sent_count").default(0), // Messaggi inviati
  respondedCount: integer("responded_count").default(0), // Risposte ricevute
  convertedCount: integer("converted_count").default(0), // Conversioni (appuntamenti, ecc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata") // { filters: {}, settings: {}, stats: {} }
});

export const insertWhatsappCampaignSchema = createInsertSchema(whatsappCampaigns)
  .omit({ id: true, createdAt: true });

export type WhatsappCampaign = typeof whatsappCampaigns.$inferSelect;
export type InsertWhatsappCampaign = z.infer<typeof insertWhatsappCampaignSchema>;

// Messaggi campagna (tracking individuale per ogni destinatario)
export const campaignMessages = pgTable("campaign_messages", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => whatsappCampaigns.id, { onDelete: 'cascade' }),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  phoneNumber: text("phone_number").notNull(), // Numero destinatario
  ownerName: text("owner_name"), // Nome estratto dall'annuncio
  messageContent: text("message_content").notNull(), // Messaggio personalizzato inviato
  status: text("status").default("pending").notNull(), // "pending", "sent", "delivered", "read", "responded", "failed"
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  respondedAt: timestamp("responded_at"),
  response: text("response"), // Prima risposta ricevuta
  followUpSent: boolean("followup_sent").default(false),
  followUpSentAt: timestamp("followup_sent_at"),
  followUpResponse: text("followup_response"),
  conversationActive: boolean("conversation_active").default(false), // Bot conversazionale attivo
  lastBotMessage: text("last_bot_message"), // Ultimo messaggio bot
  lastBotMessageAt: timestamp("last_bot_message_at"),
  errorMessage: text("error_message"), // Eventuali errori
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: jsonb("metadata") // { propertyDetails: {}, extractedInfo: {}, botContext: {} }
}, (table) => ({
  campaignPhoneIdx: index("campaign_messages_campaign_phone_idx").on(table.campaignId, table.phoneNumber)
}));

export const insertCampaignMessageSchema = createInsertSchema(campaignMessages)
  .omit({ id: true, createdAt: true });

export type CampaignMessage = typeof campaignMessages.$inferSelect;
export type InsertCampaignMessage = z.infer<typeof insertCampaignMessageSchema>;

// Log conversazioni bot (per analisi e miglioramento)
export const botConversationLogs = pgTable("bot_conversation_logs", {
  id: serial("id").primaryKey(),
  campaignMessageId: integer("campaign_message_id").notNull().references(() => campaignMessages.id, { onDelete: 'cascade' }),
  phoneNumber: text("phone_number").notNull(),
  userMessage: text("user_message").notNull(), // Messaggio utente
  botResponse: text("bot_response").notNull(), // Risposta bot
  intent: text("intent"), // Intent riconosciuto (es: "schedule_visit", "ask_price", "not_interested")
  confidence: integer("confidence"), // Confidence score 0-100
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metadata: jsonb("metadata") // { context: {}, extracted: {}, model: "gpt-4" }
});

export const insertBotConversationLogSchema = createInsertSchema(botConversationLogs)
  .omit({ id: true, timestamp: true });

export type BotConversationLog = typeof botConversationLogs.$inferSelect;
export type InsertBotConversationLog = z.infer<typeof insertBotConversationLogSchema>;

// Schema per validazione request body "send property to client"
export const sendPropertyToClientSchema = z.object({
  clientId: z.number().int().positive(),
  messageType: z.string().optional(),
  message: z.string().optional(),
  agencyLinks: z.array(z.object({
    name: z.string(),
    url: z.string()
  })).optional(),
  notes: z.string().optional() // Keep for backward compatibility
});

export type SendPropertyToClientRequest = z.infer<typeof sendPropertyToClientSchema>;
