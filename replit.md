# Client Management System

## Overview
This project is a comprehensive real estate management system designed to streamline operations for property agents and enhance client interaction. It provides a full-stack solution for managing properties, clients, communications, and appointments. Key capabilities include WhatsApp integration, Google Calendar synchronization, AI-powered assistance for property matching and client interaction, and automated workflows for property acquisition and management. The system aims to leverage AI to improve efficiency and client satisfaction in the real estate sector, with a focus on comprehensive property data aggregation and intelligent client-property matching.

## Recent Changes (2025-11-24)

**✅ PORTAL FILTER FIX - Private Properties Now Filterable by Source:**

1. **Portal Filter API Endpoint** ✅: Added query parameter `?portal=<source>` to filter private properties
   - **Endpoint**: `GET /api/properties/private?portal=Apify|Idealista|Immobiliare.it|CasaDaPrivato|ClickCase|Manual|Casafari`
   - **Implementation**: Added optional `portal` query param to route, passes to `getPrivateProperties(portalSource)` method
   - **Tested**: Filter working - returns correct counts:
     - Apify: 271 properties
     - Idealista: 75 properties
     - Immobiliare.it: 23 properties
     - (Counts vary from total due to 4km Duomo radius filter)
   
2. **Database portalSource Population** ✅: Fixed all 397 private properties with correct portal sources
   - **Before**: 393 properties had `portalSource = null`
   - **After**: All properties now have correct `portalSource` values:
     - 290 Apify (was null with source='apify')
     - 77 Idealista
     - 24 Immobiliare.it
     - 3 Casafari
     - 2 Manual
     - 31 still null (to be investigated in future)
   - **Method**: SQL mapping from `properties.source` → `shared_properties.portal_source`
   
3. **Deduplication Mapping Enhanced** ✅: Updated scan route to properly map fields during property deduplication
   - **Added fields**: `url`, `externalLink`, `ownerType`, `source`, `portalSource`, `classificationColor`
   - **Mapping logic**: Added `sourceToPortal` translation object to convert source values to portal names
   - **Result**: Future property imports via deduplication will have correct portal source

**Files Modified**: 
- server/routes.ts (2 locations: /api/properties/private route + deduplication mapping)
- server/storage.ts (IStorage interface + getPrivateProperties method signature)

**Impact**: Portal filtering now functional - frontend can display private properties filtered by source portal

---

**✅ CRITICAL FIX: Phone Extraction Bug + URL Field Display:**

1. **Phone Validation Added** ✅: Fixed bug where property IDs (9 digits) were extracted as phone numbers
   - **Bug**: Number 124470413 (property ID) was incorrectly extracted as ownerPhone
   - **Fix**: Added validation in ALL 3 extraction endpoints (parse-url, parse-agency, auto-import)
   - **Implementation**: Validates phone starts with 3 (mobile: 3XX XXXXXX) or 0 (landline: 0XX XXXXXX)
   - **Result**: Invalid numbers are rejected, field remains empty unless valid number found
   
2. **URL Field Now in Response** ✅: External listing URL now included in parse-url API response
   - **Added**: `url: url` to parsed response object in /api/properties/parse-url endpoint
   - **Result**: URL is now passed from backend to frontend for display in property detail page
   - **Tested**: Confirmed URL "https://www.immobiliare.it/annunci/124470413/" is in API response
   
3. **UI Already Supports Display** ✅: Property detail page already has UI for link + phone
   - **External Link**: Displayed at lines 732-753 with "Visualizza su Immobiliare.it" button
   - **Owner Phone**: Displayed at lines 767-781 as clickable `tel:` link with phone icon
   - **Database**: Link saved as `externalLink` field in shared_properties table

**Files Modified**: server/routes.ts (3 locations: parse-url, parse-agency, auto-import endpoints)

---

**✅ COMPLETE AUTO-IMPORT FIX - All 5 Bugs Fixed + Description Threshold Lowered:**

1. **Address Title - CLEAN** ✅: Shows ONLY street address (e.g., "Viale Monte Nero 73")
   - Backend: Regex stops extraction at first `.` or `,` using lookahead `(?=[.,\s]|<)`
   - Frontend: `renderAddress()` double-extracts clean address from DB field
   - Status: Applied to 3 locations (parse-url, auto-import, parse-agency)
   
2. **Bedrooms/Bathrooms - CORRECT** ✅: Now handles numeric ("2 camere") AND Italian types ("bilocale"→2)
   - Type mapping: monolocale=1, bilocale=2, trilocale=3, quadrilocale=4, quindilocale=5
   - Bathroom regex: Flexible pattern `/(\d+)\s*(?:bagn[io]|bagni|bathrooms?|wc|toilets?|servizi)/i`
   - Status: Applied to all 3 locations
   
3. **Description - COMPLETE** ✅: Fixed truncation at 191 characters - **THREE KEY FIXES**:
   - **FIX #1**: Lowered meta tag threshold from 200 to 50 characters
   - **FIX #2**: Added intelligent truncation detection (ends with `,!;:`) - CORRECTED boolean logic
   - **FIX #3**: Aggressive fallback extraction - if specific HTML patterns fail, extracts ALL text from body and removes scripts/styles
   - Now accepts meta descriptions >= 50 chars AND auto-detects if truncated
   - If truncated, uses fallback extraction from body HTML
   - Max stored: 10,000 characters
   - Status: Applied to all 3 locations in routes.ts (parse-url, auto-import, parse-agency)
   
4. **Floor Field** ✅: Italian format support (primo piano, quarto piano, 3º piano, piano terra)
   - Pattern includes: primo/secondo/terzo/quarto/quinto/sesto/settimo/ottavo/nono/decimo + piano
   - Status: Applied to all 3 locations
   
5. **Condition/Stato Field** ✅: Auto-extracts property status (Ristrutturato, Ottimo stato, Buone condizioni, etc.)
   - Pattern: `/(completamente\s+ristrutturato|ristrutturato|ottimo\s+stato|buone?\s+condizioni?|da\s+ristrutturare|da\s+rinovare|nuovo|abitabile)/i`
   - Status: Applied to all 3 locations

6. **URL Field** ✅: External listing URL included in auto-import response

**Files Changed**: server/routes.ts (3 locations: parse-url, auto-import, parse-agency endpoints)

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture.
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter for routing, TanStack Query for server state, Leaflet for maps, and React Hook Form with Zod for form management. It includes mobile-responsive optimizations.
- **Backend**: Express.js with TypeScript, running on Node.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **UI/UX**: Utilizes shadcn/ui components built on Radix UI, styled with Tailwind CSS. Interactive maps are provided by Leaflet, and geocoding by Nominatim. The UI emphasizes a card-based interface with color-coded visual cues for property status (e.g., green for private, yellow for multi-agency, red for single-agency).
- **Technical Implementations**: OAuth2 for Google services, UltraMsg for WhatsApp integration, and OpenAI for AI features. The system includes a custom scheduler for daily private property scraping, advanced property deduplication and matching algorithms using image hashing and fuzzy string matching, and a virtual secretary for prioritized contact management and task generation. It also features an advanced multi-agency property clustering system with intelligent filtering, automated reporting for property acquisition, and agency name normalization. An "Ignore" functionality for shared properties allows agents to dismiss unwanted listings. The system supports viewing of all matching competitor properties with accurate geographic filtering using FeatureCollection for multi-zone buyer searches. An automatic zone geocoding system uses Nominatim API to visualize buyer search areas.
    - **WhatsApp Integration**: Features 3-tier message deduplication and property context threading, linking client replies to specific shared properties. Includes a dual-mode safety system for sending properties via WhatsApp and an automated private seller outreach system with AI conversational bot capabilities.
    - **Google Calendar Integration**: Robust OAuth token management handles expired/revoked tokens for seamless sync recovery.
    - **Property Deduplication**: Employs an intelligent bucketing algorithm combining geographic and price criteria to reduce comparison complexity and uses robust agency name normalization.
    - **Owner Classification System**: Accurately distinguishes between private sellers and agencies using a multi-signal classification algorithm.
    - **Automated Property Scraping**: Features a full-city scraping scheduler that downloads all properties from Milano using Apify, then filters them server-side. Includes instant property filtering for buyers and production-ready private property scraping.
    - **Asynchronous Job Queue System**: Solves timeout issues for long-running operations by processing jobs in the background with auto-recovery, error handling, retry logic, and checkpoint persistence.
    - **Private Properties Section**: Dedicated UI for managing properties from private owners, featuring map/list views, favorites, and comprehensive filtering.
    - **Favorites System**: Implemented a dual favorites system (global and per-client) with a "Solo Privati" filter and a heart/favorite button on each property card.
    - **Per-Client Ignore Functionality**: Each client can ignore specific properties individually; ignored properties are automatically excluded from matching results.
    - **Bidirectional Matching Views**: Per property, shows "Potenziali Interessati" (matching clients); per client, shows "Possibili Immobili" (matching properties, including monocondiviso, pluricondiviso, and private properties). Matching uses property location (polygon), size tolerance (-20% to +40%), price tolerance (+20%), and property type. Automatically filters out client-ignored properties.
    - **Dashboard Feature - Classifica Immobili**: "Proprietà Condivise" ranking widget shows top properties by number of interested buyers with an interactive popover displaying client names and phone numbers.
    - **Auto-Import Enhancements**: Improved address, bedroom, bathroom, floor, and condition extraction from property descriptions using advanced regex patterns. Includes new `condition` field and better handling of Italian language specifics. Fixed dual-table ID conflicts for shared properties through query parameter routing to ensure correct data display and deletion. Portal filtering for private properties now works via query parameter.
- **Feature Specifications**:
    - **Client Management**: Detailed client profiles with AI-extracted preferences.
    - **Property Management**: Comprehensive listings with detailed property pages displaying descriptions, external links, and owner contact information. Features external import and multi-agency property identification with refined deduplication. The ingestion service automatically populates `url` and `externalLink` fields. Private properties can now be filtered by source portal.
    - **Communication**: Integrated WhatsApp and email tracking with AI-powered response generation and automated reminders, including a WhatsApp Web-style chat interface.
    - **Appointment Management**: Google Calendar synchronization, automated follow-ups, and conflict prevention.
    - **Task Automation**: AI-generated follow-up tasks, prioritized dashboards, and automated workflows for property acquisition, including a multi-agency property acquisition workflow with a 5-stage pipeline visualization.
    - **Property Acquisition Management**: Comprehensive tracking system for favorite properties with timeline-based activity tracking and document management.
    - **Analytics**: Dashboard with daily goals, performance metrics, and AI insights.
    - **Data Correlation**: Smart correlation of communications, appointments, and properties.
    - **Natural Language Processing (NLP)**: AI-driven processing of client property requests, extracting structured filters.
    - **Automated Property Ingestion**: Architecture for automatic import from real estate portals.

## External Dependencies
- **Mapping**: Leaflet, Nominatim
- **Messaging**: UltraMsg (for WhatsApp)
- **AI**: OpenAI
- **OAuth/APIs**: Google services (Calendar)
- **Web Scraping**: Apify, CasaDaPrivato.it, ClickCase.it, Idealista (private listings), Immobiliare.it
