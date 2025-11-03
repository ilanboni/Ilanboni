# Client Management System

## Overview
This project is a comprehensive real estate management system designed to streamline operations for property agents and enhance client interaction. It provides a full-stack solution for managing properties, clients, communications, and appointments. Key capabilities include WhatsApp integration, Google Calendar synchronization, AI-powered assistance for property matching and client interaction, and automated workflows for property acquisition and management. The system aims to leverage AI to improve efficiency and client satisfaction in the real estate sector.

## Recent Changes (November 3, 2025)
- **All Competitor Properties Feature - FULLY COMPLETED & TESTED**: Comprehensive view of all matching properties for high-value clients (rating ≥ 4)
  - **Database Schema**: Added `owner_type` field to properties table, migrated 1039 properties (1035 private, 4 agency)
  - **Critical Fix - GPS Location Field**: Fixed ingestion service to populate `location` JSONB field with {lat, lng} coordinates
    - Root cause: `portalIngestionService.ts` was saving latitude/longitude as TEXT but NOT populating the `location` field
    - Solution: Added automatic population of `location` from coordinates during property import
    - Database migration: Updated 985 existing properties to populate `location` from latitude/longitude TEXT fields
    - Impact: Matching logic now works correctly - properties without GPS are rejected when buyer has searchArea
  - **Matching Logic Enhancement**: Added FeatureCollection support for multi-zone buyer searches
    - System now handles both single Point and FeatureCollection (multiple zones) formats
    - Properties verified against ALL buyer zones using point-in-polygon checks
    - Geographic filtering now accurate: 7 properties match (down from 53 false positives)
  - **Backend**: New endpoint `/api/clients/:id/all-competitor-properties` returns ONLY properties matching ALL buyer criteria (price, size, location)
  - **Frontend**: Modal with color-coded categorization for immediate property type identification:
    - **Green background**: Private properties (ownerType = 'private') - best acquisition opportunities
    - **Yellow background**: Duplicate properties (is_shared = true) - multi-agency listings with higher competition
    - **Red background**: Single agency properties (ownerType = 'agency', is_shared = false) - exclusive to one agency
  - **UI/UX**: Button "Vedi Tutti i Concorrenti" visible only in "Possibili Immobili" tab for clients with rating ≥ 4
  - **Testing**: Successfully tested with Playwright - exactly 7 accurate properties displayed for client Lidia Aliprandi (ID: 112, rating: 5)
    - Test client has 9 zones (Conciliazione, Pagano, Wagner, Buonarroti, Tiziano, Belisario, Citylife, Brera, Palestro)
    - All 7 properties verified to be within target zones with correct price/size
  - **Business Value**: Feature helps agents prioritize acquisition efforts based on competition level with accurate geographic targeting

## Recent Changes (November 1, 2025)
- **Deduplication GPS Fallback System**: Implementato sistema multi-livello con tolleranza 300m
  - GPS fallback: permette matching con coordinate GPS entro 300m anche con indirizzi generici
  - Blocco critico: impedisce matching tra proprietà con solo "Milano" senza GPS (previene mega-cluster)
  - Risultati: 10 cluster trovati (+43% rispetto a 7), nessun falso positivo
  - Strategia a 3 livelli: 1) Indirizzi specifici, 2) GPS fallback 300m, 3) Prezzo/size/floor
  - Match score graduato: GPS con indirizzi generici = 30 punti max, specifici = 40 punti max

- **Agencies Link Fix**: Risolto problema con link agenzie in shared properties
  - Sistema di deduplicazione ora salva oggetti completi `{name, link, sourcePropertyId}` invece di semplici stringhe
  - Campo JSONB `agencies` include tutti i dati necessari per mostrare link funzionanti
  - Frontend SharedPropertyCard mostra correttamente pulsanti "Vedi Annuncio" per ogni agenzia
  - Supporta backward compatibility: converte automaticamente dati legacy (stringhe) in oggetti
  - Fix applicato sia a `/api/run/scan` che a `deduplicationScheduler.runDeduplicationScan()`

- **Deduplication System Fix**: Risolto problema critico con falsi positivi giganti
  - Bug eliminato: il sistema creava cluster di 121+ proprietà su indirizzi generici ("Milano", "")
  - Implementata validazione rigorosa: proprietà DEVONO avere indirizzo specifico con numero civico
  - Funzione `isGenericAddress()` blocca matching su city-only addresses e indirizzi vuoti
  - Blacklist città italiane: Milano, Roma, Torino, Firenze, Bologna, Napoli, Genova, Venezia
  - Requisiti minimi indirizzo: deve contenere numero civico, lunghezza minima 5 caratteri
  - Anche con coordinate GPS disponibili, indirizzo specifico è obbligatorio per matching
  - Test results: ridotti da 129 falsi positivi a 14 multi-agency reali con 7 cluster corretti
  - Tutti i match ora hanno score 100% su indirizzi identici (variazioni punteggiatura)
  - Database pulito: eliminate shared_properties create con indirizzi generici

## Recent Changes (November 1, 2025)
- **Casafari API Integration**: Implemented professional B2B real estate data aggregator for Italian market
  - Replaced failed Playwright/Apify scraping approaches (blocked by anti-bot systems on Idealista/Immobiliare.it)
  - Installed `casafari` SDK package and created `CasafariAdapter` implementing `PortalAdapter` interface
  - Feed-based search system: automatically creates saved searches (feeds) for each zone/criteria combination with caching
  - Aggregates data from ALL Italian portals (Idealista, Immobiliare.it, Casa.it, etc.) in single API call
  - Pagination support: fetches up to 500 properties per zone (100 per batch) to ensure comprehensive coverage
  - Automatic feed cleanup: deletes temporary feeds after use to prevent accumulation on Casafari account
  - Successfully tested: 469 properties retrieved for client Lidia Aliprandi (6 zones completed before quota limit)
  - Dynamic import solution for CommonJS module compatibility with ESM project
  - Environment variable: CASAFARI_API_TOKEN required for authentication
  - Legal and reliable alternative to web scraping with no anti-bot blocking issues
  - **Known Limitation**: Geographic filtering (custom_locations) not supported in current SDK version - searches return results from all of Italy, requiring client-side filtering by address

- **Mobile Responsive Optimization**: Complete iPhone responsive design implementation
  - Fixed client detail page tabs: now horizontally scrollable on mobile, all 10+ tabs accessible via swipe
  - Added iOS safe area support for iPhone notch/home bar (env(safe-area-inset-*))
  - Touch-friendly targets: minimum 44x44px for all interactive elements
  - Mobile-optimized typography: 16px base font to prevent iOS zoom
  - Responsive grid layouts with appropriate spacing for mobile (gap-3) vs desktop (gap-6)
  - Bottom navigation bar with safe area padding for iPhone home indicator
  - Hidden heavy components on mobile (maps, complex visualizations) for better performance
  - Sticky header with responsive logo and touch-optimized menu controls
  - Verified with Playwright testing on iPhone 12 Pro emulation

## Recent Changes (October 31, 2025)
- **Automatic Zone Geocoding System**: Implemented full automation for buyer search area visualization
  - Zones extracted by AI are now automatically geolocated using Nominatim API with polygon boundaries when available
  - New `searchAreaGeocodingService` handles background geocoding with cache and 1.1s rate limiting
  - Database schema extended: `zoneGeocodeCache` table for Milano zones, `searchAreaStatus`/`searchAreaUpdatedAt` fields on buyers
  - GeoJSON FeatureCollection format stores Polygon boundaries (when available) or Point centroids with configurable radius
  - Automatic trigger on buyer POST/PATCH when zones present, non-blocking background processing
  - Manual endpoint: POST /api/clients/:id/search-area/geocode for re-triggering geocoding
  - Edge case handled: clearing zones (empty array) now resets search_area data
  - Successfully tested with Aliprandi client: 9 zones geocoded with polygon boundaries for Brera, Tiziano, and points for other zones

- **Multi-Agency Property Acquisition Workflow**: Transformed duplicates page into complete acquisition management system with card-based interface
  - Each shared property shown as expandable card with tabs: Details, Agencies, Pipeline, Activities, Interested Clients
  - Pipeline visualization with 5 stages: address_found → owner_found → owner_contact_found → owner_contacted → result (acquired/rejected/pending)
  - Automatic buyer matching on acquisition: when property acquired, system creates match records for all compatible buyers
  - Activity tracking: tasks can be created/linked to specific shared properties
  - JSONB `agencies` field in schema allows tracking unlimited number of agencies per property
  - Transaction-safe acquisition with duplicate match protection
  - Geographic filter removed: system now covers entire Milano commune without distance restrictions

- **Fixed Multi-Agency Duplicate Cards Issue**: Resolved critical bug where same property appeared as multiple cards
  - Root cause: deduplicationScheduler was not normalizing addresses before duplicate checking
  - Minor address variations (commas, spaces) created separate cards for same property
  - Solution: implemented address normalization (remove punctuation, normalize spaces) before duplicate detection
  - Database cleanup: eliminated 11 duplicate cards, consolidated agencies into unique arrays
  - Result: each property now appears as ONE card with all agencies consolidated
  - Verified: Via Monte Rosa, Via Dante, Via Torino now show as single cards with multiple agencies

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture.
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter for routing, TanStack Query for server state, Leaflet for maps, and React Hook Form with Zod for form management.
- **Backend**: Express.js with TypeScript, running on Node.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **UI/UX**: Utilizes shadcn/ui components built on Radix UI, styled with Tailwind CSS. Interactive maps are provided by Leaflet, and geocoding by Nominatim.
- **Technical Implementations**: OAuth2 for Google services, UltraMsg for WhatsApp integration, and OpenAI for AI features. The system includes a custom scheduler for automated follow-ups, advanced property deduplication and matching algorithms using image hashing and fuzzy string matching, and a virtual secretary for prioritized contact management and task generation. It also features an advanced multi-agency property clustering system and automated reporting for property acquisition.
- **Feature Specifications**:
    - **Client Management**: Detailed client profiles (buyers/sellers) with AI-extracted preferences.
    - **Property Management**: Comprehensive listings, external import, and multi-agency property identification.
    - **Communication**: Integrated WhatsApp and email tracking with AI-powered response generation and automated reminders.
    - **Appointment Management**: Google Calendar synchronization, automated follow-ups, and conflict prevention.
    - **Task Automation**: AI-generated follow-up tasks, prioritized dashboards, and automated workflows for property acquisition.
    - **Analytics**: Dashboard with daily goals, performance metrics, and AI insights.
    - **Data Correlation**: Smart correlation of communications, appointments, and properties.
    - **Natural Language Processing (NLP)**: AI-driven processing of client property requests, extracting structured filters for matching.
    - **Automated Property Ingestion**: Architecture for automatic import from real estate portals, including multi-source scraping.

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
- **OpenAI SDK + Replit AI Integrations**: AI features using GPT-5.
- **Casafari SDK**: Professional B2B real estate data aggregator for Italian market (replaces Apify/Playwright scraping).
- **Nominatim**: Geocoding services.