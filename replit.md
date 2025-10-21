# Client Management System

## Overview
This is a comprehensive real estate management system built for property agents and clients. The application provides a full-stack solution for managing properties, clients, communications, appointments, and automated workflows including WhatsApp integration and Google Calendar synchronization.

## System Architecture
The application follows a modern full-stack architecture with:
- **Frontend**: React with TypeScript, Vite build system, Tailwind CSS, and shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **External Integrations**: Google Calendar, Gmail, WhatsApp (UltraMsg), OpenAI for AI assistance

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state, React hooks for local state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Maps**: Leaflet for interactive maps and geocoding
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database Layer**: Drizzle ORM with PostgreSQL
- **Authentication**: OAuth2 for Google services (Calendar and Gmail)
- **External APIs**: UltraMsg for WhatsApp, OpenAI for AI features
- **Task Scheduling**: Custom follow-up scheduler for automated communications

### Database Schema
The application uses PostgreSQL with the following main entities:
- **clients**: Base client information (buyers and sellers)
- **buyers/sellers**: Extended client data with specific preferences
- **properties**: Property listings with comprehensive details
- **communications**: WhatsApp, email, and other communication records
- **appointments**: Scheduled property viewings and meetings
- **tasks**: Follow-up reminders and action items
- **oauth_tokens**: Secure storage for external service tokens

### External Service Integrations
- **Google Calendar**: Automated appointment scheduling and calendar management
- **Gmail**: Email monitoring for property inquiries from real estate platforms
- **WhatsApp (UltraMsg)**: Automated messaging and communication tracking
- **OpenAI**: AI-powered response generation and sentiment analysis
- **Nominatim**: Address geocoding and map integration

## Data Flow
1. **Client Management**: Clients are created with detailed preferences and contact information
2. **Property Matching**: Advanced algorithm matches properties to buyer criteria using geographic and preference filters
3. **Communication Tracking**: All WhatsApp, email, and phone communications are logged and analyzed
4. **Automated Workflows**: AI generates appropriate responses and creates follow-up tasks
5. **Calendar Integration**: Appointments are automatically synced with Google Calendar
6. **Analytics**: Comprehensive reporting on market trends, client preferences, and agent performance

## External Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection with WebSocket support
- **googleapis**: Google Calendar and Gmail API integration
- **@anthropic-ai/sdk**: AI assistant capabilities
- **axios**: HTTP client for external API calls
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **leaflet**: Interactive maps and geocoding
- **@turf/helpers**: Geographic calculations and analysis

## Deployment Strategy
The application is designed for deployment on Replit with:
- **Development**: `npm run dev` for local development with hot reload
- **Production Build**: `npm run build` creates optimized frontend and backend bundles
- **Production Server**: `npm run start` runs the production server
- **Database Migrations**: `npm run db:push` applies schema changes

The application includes comprehensive environment variable configuration for all external services and can be easily deployed to cloud platforms with PostgreSQL support.

## Changelog
- October 21, 2025. Sistema import immobili esterni da portali completato - Implementato workflow completo per importare immobili da portali esterni (immobiliare.it, idealista.it): web scraping tramite web_fetch per estrarre dati completi (indirizzo, prezzo, mq, piano, agenzie, foto), salvataggio nel database come immobili normali, esecuzione automatica /api/run/scan per rilevare duplicati con match 100%, creazione automatica schede in Proprietà Condivise, test confermato con immobili reali "Via Ponte Vetero Milano" da 2 agenzie diverse (MD Immobiliare e Coldwell Banker), sistema ora permette monitoraggio immobili pluricondivisi da portali esterni per acquisizione clienti
- October 21, 2025. Sistema creazione automatica schede Proprietà Condivise completato - Endpoint POST /api/run/scan ora crea automaticamente record nella tabella shared_properties quando rileva cluster di 2+ immobili duplicati (pluricondivisi), estrae nomi agenzie dai link esterni (es. "Immobiliare" da immobiliare.it), salva metadata match completi (score, motivi) in owner_notes, imposta stage="result" e stage_result="multiagency" per identificazione rapida, implementata protezione anti-duplicazione (verifica esistenza record prima di inserire), test E2E confermato: scheda "Viale Belisario 9" creata automaticamente con match 100% visualizzata correttamente in pagina Proprietà Condivise, sistema ora completamente autonomo nell'identificare e tracciare immobili pluricondivisi
- October 21, 2025. Sistema rilevamento proprietà pluricondivise implementato - Creati servizi imageHashService.ts (perceptual hashing con sharp-phash per similarità immagini) e propertyDeduplicationService.ts (fuzzy matching indirizzo/prezzo/mq/piano/camere con string-similarity), endpoint POST /api/run/scan ora analizza tutti gli immobili nel database per trovare duplicati tramite clustering intelligente, aggiornamento automatico flag isMultiagency (true per cluster 2+ immobili) e exclusivityHint (true per keyword "esclusiva/esclusività" in descrizione), sistema testato con match score 100% per duplicati perfetti e rilevamento corretto esclusività, approccio pragmatico senza web scraping reale (analisi DB esistente invece di scraping portali)
- October 21, 2025. Sistema visualizzazione matches e interactions completato - Implementati 7 endpoint API autenticati (GET /api/clients/:id/matches, /api/clients/:id/interactions, /api/properties/:id/matches, /api/properties/:id/interactions, /api/properties/:id/pipeline e equivalenti shared) con filtri temporali (since=1d, since=30d, since=today), creati 5 componenti React (ClientMatchesToday, ClientInteractionsHistory, PropertyInterestedClients, PropertyPipeline, PropertyInteractionsHistory), integrati nella pagina ClientDetailPage con 2 nuovi tab ("Match Oggi" e "Cronologia Invii") e nella SharedPropertyDetailPage con 3 nuovi tab ("Clienti Interessati", "Pipeline", "Cronologia Azioni"), sistema permette visualizzazione completa di tutti i match trovati dal virtual agent con score, urgenza, budget cliente, pipeline a 5 fasi per immobili condivisi, cronologia completa interazioni per debugging e monitoraggio
- September 9, 2025. Sistema identificatori immobiliare.it implementato per associazione automatica email-immobile - Aggiunto campo immobiliareItId alla tabella properties e form di gestione immobili, modificato processore email per utilizzare ID univoco immobiliare.it come metodo primario di associazione automatica (es. https://www.immobiliare.it/annunci/119032725/), aggiornato emailPropertyLinker per matching preciso tramite ID, sistema ora supporta associazioni automatiche accurate anche con indirizzi diversi o incompleti, risolto problema associazioni imprecise basate solo su matching indirizzi
- September 8, 2025. Sistema correlazione dati e appuntamenti completamente riparato - Correzione correlazione propertyId nelle comunicazioni WhatsApp, smart correlation per clienti senza outbound, pattern riconoscimento conferme appuntamenti da messaggi in arrivo (es. "confermo la disponibilità per la visita di oggi pomeriggio alle 15:30"), ricostruzione appuntamenti mancanti da conferme WhatsApp esistenti, sistema ora preciso con correlazione dati tra tutte le sezioni
- September 8, 2025. Problema fuso orario Google Calendar definitivamente risolto - Sostituita conversione toISOString() con funzione formatLocalDateTime che mantiene orario locale, eliminato offset di 2 ore tra appuntamenti WhatsApp e eventi Google Calendar, sincronizzazione ora perfettamente allineata
- September 3, 2025. Sistema follow-up appuntamenti implementato - Popup automatico il giorno dopo l'appuntamento con indirizzo, dati cliente, dropdown esito (Positivo/Negativo/Neutro), note, tracking visite complete con attività sincronizzate tra cliente e immobile, follow-up automatici per esiti positivi
- September 3, 2025. Duplicazione eventi Google Calendar eliminata - Aggiunto controllo per evitare creazione multipla eventi stesso appuntamento, verifica tramite appointmentConfirmationId prima di creare nuovo evento calendario
- September 3, 2025. Problema fuso orario Google Calendar risolto - Rimossa conversione manuale UTC nel parsing date che causava eventi spostati di 2 ore, tutti i pattern date ora usano orario locale lasciando che Google Calendar gestisca correttamente il timezone Europe/Rome
- September 3, 2025. Sistema salvataggio proprietà condivise completamente riparato - Risolto errore "Dati aggiornamento non validi" pulendo campi extra (tasks, communications, timestamps) prima invio API, metodi DatabaseStorage mancanti implementati, sistema CRUD proprietà condivise ora operativo
- September 3, 2025. Sistema associazione proprietari completo implementato - Aggiunti campi owner_name, owner_phone, owner_email alla tabella properties, form di creazione immobili include sezione "Informazioni Proprietario", componente PropertyAssociationModal per associazione da pagina cliente, endpoint API `/api/clients/:id/associate-property` per associazione programmatica, doppia integrazione: modifica immobile + selezione da cliente venditore
- September 3, 2025. Sistema eliminazione proprietà verificato e funzionante - Risolto problema eliminazione immobili, endpoint DELETE `/api/properties/:id` operativo con gestione completa dipendenze (immobiliare_emails, property_sent, shared_properties, eventi calendario, appuntamenti, task, comunicazioni), eliminazione "Corso Buenos Aires" completata con successo
- September 3, 2025. Sistema geocoding indirizzi completato e ottimizzato - API geocoding formatta automaticamente indirizzi puliti ("Via Nome 10, Città" invece di dettagli commerciali lunghi), risolto conflitto form annidato nella mappa, AddressAutocomplete e SimpleAddressAutocomplete utilizzano endpoint proxy `/api/geocode` per risultati consistenti, sistema completamente integrato e funzionante
- September 1, 2025. Sistema creazione appuntamenti completato - Form interattivo per appuntamenti con campi personalizzabili (titolo, data, orario, luogo, note), task salvato in database, Google Calendar riautenticato per sincronizzazione automatica, eliminati loop e duplicazioni nel polling messaggi, sistema completamente operativo
- August 28, 2025. Dashboard Analytics avanzata implementata - Creati componenti DailyGoals, PerformanceAnalytics e AIPerformanceInsights con API backend complete per tracking in tempo reale: obiettivi giornalieri (min 10 messaggi), grafici performance settimanali, raccomandazioni AI per ottimizzazione campagne, tutto collegato a dati reali PostgreSQL, sistema confermato operativo con 4 messaggi inviati, 1 risposta, 1 nuovo cliente
- August 27, 2025. Sistema automatico promemoria WhatsApp perfezionato - Corretto il bug del flag needsResponse: ora tutti i messaggi in arrivo vengono automaticamente impostati come "da rispondere" e appaiono nella dashboard senza intervento manuale, sistema completamente autonomo per uso pratico
- August 27, 2025. Interfaccia WhatsApp Web completata con stile autentico - Implementata interfaccia chat completa stile WhatsApp Web con sfondo verde per messaggi inviati, bianco per ricevuti, header con avatar cliente, barra input con invio tramite Enter/pulsante, auto-scroll automatico, integrazione completa con UltraMsg per invio/ricezione messaggi reali
- August 27, 2025. Webhook UltraMsg configurato e sistema completamente operativo - Risolti tutti errori TypeScript di compilazione, webhook endpoint funzionante al 100%, configurazione UltraMsg completata con eventi message_received/create/ack attivati, sistema pronto per ricezione automatica messaggi WhatsApp in produzione
- August 27, 2025. Sistema promemoria WhatsApp completato con protezione test - Implementato riconoscimento direzione messaggi, creazione automatica clienti per numeri sconosciuti, protezione invio limitata al numero test 393407992052 durante sviluppo per evitare messaggi indesiderati a clienti reali
- August 26, 2025. Rimosso sistema numerazione clienti e implementato nome semplice "Cliente" con saluto "Gentile Cliente" - Eliminati nomi problematici come "Cliente 0592", aggiornati 14 clienti esistenti a semplicemente "Cliente" con saluto appropriato "Gentile Cliente", modificato processore email per evitare nomi numerati futuri
- July 14, 2025. Risolto problema webview e automazione completata - App React funzionante, geocoding automatico attivato, workflow completo operativo
- June 25, 2025. Initial setup
- December 31, 2024. Fixed deployment issues after app rename - cleaned build cache and updated package name

## User Preferences
Preferred communication style: Simple, everyday language.