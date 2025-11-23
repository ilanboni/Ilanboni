# Client Management System

## Overview
This project is a comprehensive real estate management system designed to streamline operations for property agents and enhance client interaction. It provides a full-stack solution for managing properties, clients, communications, and appointments. Key capabilities include WhatsApp integration, Google Calendar synchronization, AI-powered assistance for property matching and client interaction, and automated workflows for property acquisition and management. The system aims to leverage AI to improve efficiency and client satisfaction in the real estate sector, with a focus on comprehensive property data aggregation and intelligent client-property matching.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture.
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter for routing, TanStack Query for server state, Leaflet for maps, and React Hook Form with Zod for form management. It includes mobile-responsive optimizations.
- **Backend**: Express.js with TypeScript, running on Node.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **UI/UX**: Utilizes shadcn/ui components built on Radix UI, styled with Tailwind CSS. Interactive maps are provided by Leaflet, and geocoding by Nominatim. The UI emphasizes a card-based interface with color-coded visual cues for property status (e.g., green for private, yellow for multi-agency, red for single-agency).
- **Technical Implementations**: OAuth2 for Google services, UltraMsg for WhatsApp integration, and OpenAI for AI features. The system includes a custom scheduler for daily private property scraping (CasaDaPrivato.it, ClickCase.it, Idealista private), advanced property deduplication and matching algorithms using image hashing and fuzzy string matching, and a virtual secretary for prioritized contact management and task generation. It also features an advanced multi-agency property clustering system with intelligent filtering, automated reporting for property acquisition, and agency name normalization. An "Ignore" functionality for shared properties allows agents to dismiss unwanted listings. The system supports viewing of all matching competitor properties with accurate geographic filtering using FeatureCollection for multi-zone buyer searches. An automatic zone geocoding system uses Nominatim API to visualize buyer search areas.
    - **WhatsApp Integration**: Features 3-tier message deduplication and property context threading, linking client replies to specific shared properties. Includes a dual-mode safety system for sending properties via WhatsApp (test/production configurations) and an automated private seller outreach system with AI conversational bot capabilities.
    - **Google Calendar Integration**: Robust OAuth token management handles expired/revoked tokens, prompting for reauthorization to ensure seamless sync recovery.
    - **Property Deduplication**: Employs an intelligent bucketing algorithm combining geographic and price criteria to reduce comparison complexity and uses robust agency name normalization.
    - **Owner Classification System**: Accurately distinguishes between private sellers and agencies using a multi-signal classification algorithm.
    - **Automated Property Scraping**: Features a full-city scraping scheduler that downloads all properties from Milano using Apify, then filters them server-side. Includes instant property filtering for buyers and production-ready private property scraping.
    - **Asynchronous Job Queue System**: Solves timeout issues for long-running operations by processing jobs in the background with auto-recovery, error handling, retry logic, and checkpoint persistence.
    - **Private Properties Section**: Dedicated UI for managing properties from private owners, featuring map/list views, favorites, and comprehensive filtering.
    - **Favorites System**: Implemented a dual favorites system (global and per-client) with a "Solo Privati" filter and a heart/favorite button on each property card.
    - **Per-Client Ignore Functionality**: Each client can ignore specific properties individually - the same property can be shown to different clients but hidden from those who ignored it. Ignored properties are automatically excluded from matching results.
    - **Bidirectional Matching Views**: Per property, shows "Potenziali Interessati" (matching clients); per client, shows "Possibili Immobili" (matching properties, including monocondiviso, pluricondiviso, and private properties). Matching uses property location (polygon), size tolerance (-20% to +40%), price tolerance (+20%), and property type. Automatically filters out client-ignored properties.
    - **Dashboard Feature - Classifica Immobili**: "Proprietà Condivise" ranking widget shows top properties by number of interested buyers with an interactive popover displaying client names and phone numbers.
- **Feature Specifications**:
    - **Client Management**: Detailed client profiles with AI-extracted preferences.
    - **Property Management**: Comprehensive listings with detailed property pages displaying descriptions, external links (Immobiliare.it/Idealista.it), and owner contact information. Features external import and multi-agency property identification with refined deduplication. The ingestion service automatically populates `url` and `externalLink` fields.
    - **Communication**: Integrated WhatsApp and email tracking with AI-powered response generation and automated reminders, including a WhatsApp Web-style chat interface.
    - **Appointment Management**: Google Calendar synchronization, automated follow-ups, and conflict prevention.
    - **Task Automation**: AI-generated follow-up tasks, prioritized dashboards, and automated workflows for property acquisition, including a multi-agency property acquisition workflow with a 5-stage pipeline visualization.
    - **Property Acquisition Management**: Comprehensive tracking system for favorite properties with timeline-based activity tracking and document management.
    - **Analytics**: Dashboard with daily goals, performance metrics, and AI insights.
    - **Data Correlation**: Smart correlation of communications, appointments, and properties.
    - **Natural Language Processing (NLP)**: AI-driven processing of client property requests, extracting structured filters.
    - **Automated Property Ingestion**: Architecture for automatic import from real estate portals.

## Recent Changes (2025-11-23)

**✅ COMPLETE: Per-Client Property Management System**

**New Feature - Client-Specific Ignore Functionality:**
- ✅ Added `clientIgnoredProperties` table with composite primary key (clientId, sharedPropertyId)
- ✅ Implemented storage methods: `getClientIgnoredProperties()`, `addClientIgnoredProperty()`, `removeClientIgnoredProperty()`, `isClientIgnoredProperty()`
- ✅ Created API endpoints:
  - GET `/api/clients/:id/ignored-properties` - List all ignored properties for a client
  - POST `/api/clients/:id/ignored-properties` - Add property to ignore list
  - DELETE `/api/clients/:id/ignored-properties/:propertyId` - Remove from ignore list
- ✅ Updated matching properties query to automatically exclude client-ignored properties
- ✅ Added UI buttons to client property cards:
  - Red "Ignora" button (toggles to "Ripristina" when ignored)
  - Heart "Preferito" button for per-client favorites
  - Real-time sync with backend mutations
- ✅ Per-client state management using React hooks and TanStack Query
- ✅ Dual-system implementation: Global property favorites + Client-specific ignore list

**Implementation Files Updated:**
- `shared/schema.ts` - Added `clientIgnoredProperties` table schema
- `server/storage.ts` - Added 4 new storage methods for ignore operations
- `server/routes.ts` - Added 3 new API endpoints for ignore management
- `client/src/pages/clients/[id].tsx` - Added UI buttons and React mutations for ignore/favorite
- Database created: `client_ignored_properties` table

**Key Design Decisions:**
- Per-client ignore list (not global) - same property can be shown to different clients
- Automatic filtering in matching query - clients never see ignored properties
- Separate from favorites system - ignore removes from view, favorites mark for priority follow-up
- Real-time UI updates with toast notifications

**Database Statistics:**
- Total properties: 1,075 from 5 sources
- All sources functioning and scraping daily
- 4km geographic filtering from Duomo di Milano
- Automatic classification: green (private), yellow (multi-agency), red (single-agency)
