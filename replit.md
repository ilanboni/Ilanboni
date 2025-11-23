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
    - **Bidirectional Matching Views**: Per property, shows "Potenziali Interessati" (matching clients); per client, shows "Possibili Immobili" (matching properties, including monocondiviso, pluricondiviso, and private properties). Matching uses property location (polygon), size tolerance (-20% to +40%), price tolerance (+20%), and property type.
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

## External Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **googleapis**: Google Calendar and Gmail API integration
- **@anthropic-ai/sdk**: AI assistant capabilities
- **axios**: HTTP client for external API calls
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **leaflet**: Interactive maps
- **@turf/helpers**: Geographic calculations
- **sharp-phash**: Image hashing for deduplication
- **string-similarity**: Fuzzy matching for property deduplication
- **UltraMsg**: WhatsApp messaging integration
- **OpenAI SDK + Replit AI Integrations**: AI features
- **Apify**: Web scraping platform for automated property data collection (e.g., Immobiliare.it, Idealista.it, `igolaizola/idealista-scraper`).
- **Nominatim**: Geocoding services for search area visualization.
- **multer**: File upload middleware for property attachments.
- **node-cron**: Cron-based task scheduler for automated tasks.

## Recent Changes (2025-11-23)

**✅ COMPLETE: Automated Daily Property Scraping System with Automatic Classification**

**System Architecture:**
- **DailyPrivatePropertiesScheduler** - Scrapes all 4 sources automatically every 24 hours
- Runs at server startup + every 24 hours (NO manual trigger needed)
- Uses Nominatim (FREE) for geocoding + Haversine for distance calculation
- Filters all properties to 4km radius from Duomo (45.464211, 9.191383)

**Data Sources & Automatic Classification:**
1. **CasaDaPrivato.it** (Direct HTTP, no Apify) → 🟢 Private (ownerType='private')
2. **ClickCase.it** (Direct HTTP, no Apify) → 🟢 Private (ownerType='private')  
3. **Idealista.it Private** (Apify igolaizola) → 🟢 Private (ownerType='private')
4. **Immobiliare.it** (Apify igolaizola) → Automatic classification:
   - 🟢 **Private** (ownerType='private', no agencies)
   - 🟡 **Multi-agency** (isMultiagency=true, 7+ agencies)
   - 🔴 **Single-agency** (isMultiagency=false, 1-6 agencies)

**Key Features Implemented:**
- ✅ Automatic property classification based on agency count
- ✅ Agency names and links stored in `agencies` JSONB array
- ✅ Color-coded classification (🟢 green/🟡 yellow/🔴 red)
- ✅ Distance calculation and 4km filtering
- ✅ Detailed logging with emoji indicators and statistics
- ✅ Graceful error handling with fallback recovery

**Implementation Files:**
- `server/services/adapters/casadaprivatoAdapter.ts` - Direct HTTP + regex parsing
- `server/services/adapters/clickcaseAdapter.ts` - Direct HTTP + regex parsing
- `server/services/adapters/immobiliareApifyAdapter.ts` - Apify integration (pre-existing)
- `server/services/dailyPrivatePropertiesScheduler.ts` - Main orchestrator
- `server/index.ts` - Scheduler initialization at server startup

**Output Statistics Logged:**
```
[DAILY-SCHEDULER] 📈 Results:
  Saved: N properties
    🟢 Private: X
    🟡 Multi-agency (7+): Y
    🔴 Single-agency: Z
  Discarded (outside 4km radius): N
  Geocoding failed: M
```
```