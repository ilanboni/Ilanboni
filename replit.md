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

## Recent Changes (2025-11-24)

**✅ FEATURE COMPLETE: Auto-Import Now Extracts Description, Bedrooms, Bathrooms, and Floor**

**Issue Resolved:**
- ✅ Added `description`, `bedrooms`, `bathrooms` columns to `sharedProperties` table
  - Previously missing columns prevented description/bedrooms/bathrooms from being saved
  - Now fully extracted and persisted to database
- ✅ Auto-import now extracts floor information (piano terra, 1º piano, 2º piano, etc.)
  - Added floor extraction regex with Italian language variants
  - Handles: "piano terra", "piano rialzato", "1º/2º/3º piano", "primo/secondo/terzo piano"
- ✅ Backend endpoints now save ALL extracted data to sharedProperties:
  - `manual-private`: saves description, bedrooms, bathrooms, floor
  - `manual-agency`: saves description, bedrooms, bathrooms, floor
- ✅ Frontend passes floor, bedrooms, bathrooms in import payload
- ✅ Database schema synchronized with new columns

**Implementation Files Updated:**
- `shared/schema.ts` - Added description, bedrooms, bathrooms to sharedProperties (lines 219-221)
- `server/routes.ts` - Floor extraction regex (lines 2396-2404)
- `server/routes.ts` - Manual-private save updated (lines 2285-2304)
- `server/routes.ts` - Manual-agency save updated (lines 2861-2879)
- `server/routes.ts` - Auto-import response includes floor (line 2798)
- `client/src/components/properties/AutoImportPropertyDialog.tsx` - Frontend passes floor in payload (lines 52, 88)
- Database: Added columns via SQL ALTER TABLE

**Data Now Fully Extracted & Persisted:**
- ✅ Address
- ✅ Price
- ✅ Bedrooms
- ✅ Bathrooms
- ✅ Floor (new)
- ✅ Description (now saved to sharedProperties)
- ✅ Size/Surface area
- ✅ Property type

**Testing:**
- Try importing a private property with the "Rapido" button
- Should see all extracted data populated in the import form
- Delete still works correctly with `?type=shared` parameter

---

**✅ BUG FIX: Delete Endpoint Not Recognizing Shared Properties**

**Issue Resolved:**
- ✅ Fixed DELETE endpoint to handle `?type=shared` query parameter
  - Same issue as GET: dual-table ID conflict required routing logic
  - Frontend now passes `?type=shared` when deleting private properties
  - Backend DELETE endpoint checks parameter and routes to correct table
  - Private properties can now be deleted without 404 errors

**Implementation Files Updated:**
- `server/routes.ts` - Lines 3191-3222 (added parameter check in DELETE endpoint)
- `client/src/pages/properties/private/index.tsx` - Line 173 (added `?type=shared` to DELETE URL)

**Testing:**
- ✅ Delete private property (Viale Monte Nero) - returns 204 (success) instead of 404
- ✅ Delete shared property - still works correctly
- ✅ Cache invalidation updates list after deletion

---

**✅ BUG FIX: Auto-Import Not Extracting All Data (Description, Rooms, Bathrooms, Phone)**

**Issue Resolved:**
- ✅ Fixed phone extraction regex - now removes URLs and numeric IDs from HTML before searching
  - Prevents extracting property IDs (like 102541589) as phone numbers
  - Added context-aware patterns: looks for "telefono", "phone", "contatti" keywords
  - Applied fix to both private sellers and agencies
- ✅ Enhanced bedroom extraction regex - now matches Italian variants:
  - "camere", "camere da letto", "room", "rooms", "locali", "locale", "bedrooms"
- ✅ Enhanced bathroom extraction regex - now matches Italian variants:
  - "bagno", "bagni", "bathrooms", "wc", "toilets", "servizi"
- ✅ Description extraction - now pulls from:
  - Meta tags (name="description", property="og:description")
  - Content divs with classes: description, desc, detail, content, testo, descrizione
  - Fallback to section/paragraph patterns
- ✅ All extracted data now properly returned and displayed in form

**Implementation Files Updated:**
- `server/routes.ts` - Lines 2382-2393 (bedrooms/bathrooms), Lines 2691-2703 (agency phone), Lines 2715-2738 (owner phone)

**Data Now Fully Extracted:**
- ✅ Address with street type and number
- ✅ Price (via JSON patterns or € symbol parsing)
- ✅ Bedrooms (with Italian locale variations)
- ✅ Bathrooms (with Italian locale variations)
- ✅ Description (from meta tags or content)
- ✅ Property type (apartment, villa, loft, etc.)
- ✅ Size/surface area in m²
- ✅ Owner/Agency name
- ✅ Phone number (without extracting URL IDs)

---

**✅ BUG FIX: Private Properties Detail Page Showing Wrong Data**

**Issue Resolved:**
- ✅ Fixed critical dual-table ID conflict: Same IDs existed in `properties` and `sharedProperties` with different data (e.g., ID 10039: "via Gallarate" in properties vs "Viale Monte Nero" in sharedProperties)
- ✅ Implemented query parameter routing system:
  - Frontend passes `?type=shared` when navigating to private properties
  - Backend endpoint checks parameter and routes to correct table
  - Property detail page now reads and passes `?type=shared` parameter correctly
- ✅ Fixed `getPrivateProperties()` function in `server/storage.ts` (line 3771)
  - Was searching in wrong table: `properties` instead of `sharedProperties`
  - Now correctly queries `sharedProperties` table where `ownerType = 'private'`
  - Now includes properties without GPS coordinates in the list
  - Dramatically simplified implementation (removed unnecessary Property→SharedProperty conversion)
- ✅ Corrected database entry with erroneous price (31198957 → €450,000)
- ✅ Auto-import form now shows minimalist UI for incomplete data (only requests missing price field)
- ✅ Playwright-based price extraction for JavaScript-rendered sites (e.g., Idealista.it)

**Implementation Files Updated:**
- `server/storage.ts` - Rewrote `getPrivateProperties()` to use correct table
- `server/routes.ts` - Added `?type=shared` parameter handling in GET `/api/properties/:id` endpoint
- `client/src/pages/properties/[id].tsx` - Added query parameter reading and passing to fetch
- `client/src/pages/properties/private/index.tsx` - Added `?type=shared` to all private property links

**Testing Verified:**
- Auto-import endpoint successfully extracts: address ✅, size ✅, description ✅, price ✅
- Manual property import (via Immobiliare.it) successfully saves to database
- Private properties list (`GET /api/properties/private`) now returns correct data
- Properties without GPS coordinates now properly included in list
- Detail page shows correct data from `sharedProperties` table when `?type=shared` parameter present ✅
- Test property: "Viale Monte Nero 73" (€620,000) now displays correct info ✅

**Key Design Decisions:**
- Changed from geographic filtering (exclude no-coordinates) to inclusion (show all private properties)
- Simplified function by removing unnecessary table conversions
- Per-client ignore list remains separate and functional
- Query parameter routing ensures clean separation between properties from different tables

**Database Statistics:**
- Total properties: 1,075 from 5 sources
- All sources functioning and scraping daily
- 4km geographic filtering from Duomo di Milano for properties with GPS
- Automatic classification: green (private), yellow (multi-agency), red (single-agency)
- Private properties now correctly visible regardless of GPS availability
