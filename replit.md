# Client Management System

## Overview
This project is a comprehensive real estate management system designed to streamline operations for property agents and enhance client interaction. It provides a full-stack solution for managing properties, clients, communications, and appointments. Key capabilities include WhatsApp integration, Google Calendar synchronization, and AI-powered assistance for property matching and client interaction. The system aims to leverage AI to improve efficiency and client satisfaction in the real estate sector, with a focus on comprehensive property data aggregation and intelligent client-property matching, including automated workflows for property acquisition and management.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes

### November 25, 2025: Main Properties Page - Default Matching Sort
- **Request**: Sort main properties page (`/properties`) by matching buyers count by default
- **Implementation**:
  - Modified `/api/properties` endpoint to support `sortBy=matching` parameter
  - When `sortBy=matching`, backend calculates `matchingBuyersCount` for each property using `isPropertyMatchingBuyerCriteria`
  - Properties are sorted server-side by matching count (descending)
  - Changed default sort order from "newest" to "matching"
  - Added "Più matching" option to sort dropdown (first option)
- **Files Modified**:
  - `server/routes.ts`: Added sortBy=matching support to /api/properties endpoint
  - `client/src/pages/properties/index.tsx`: Default sort "matching", new dropdown option
- **Results**: Properties with more potential matching buyers now appear first by default

### November 25, 2025: Unified Ranking Page & Private Properties Enhancement
- **Request**: Create unified ranking page showing all property types (private, mono-shared, multi-shared) sorted by matching buyer count with server-side pagination, and enhance private properties page with chronological ordering and source distinction badges
- **Implementation**:
  - **New Ranking Endpoint** (`/api/properties/ranking`):
    - Server-side pagination with `page` and `limit` parameters
    - Returns all properties (private, mono-shared, multi-shared) with calculated `matchingBuyersCount`
    - Normalized `isAlsoFromAgency` flag using address/price comparison (trim, lowercase, whitespace collapse)
    - Paginated response structure: `{properties, total, page, limit, totalPages}`
  - **New Ranking Page** (`/properties/ranking`):
    - Client-side filters for property type (mono/pluri/private) with toggle switches
    - Stats dashboard showing total properties, with matches, and favorites
    - Property type badges (blue for private, green for mono-shared, purple for multi-shared)
    - Manual refresh button with cache invalidation
    - Favorite toggle with optimistic cache updates
    - String-based query key pattern: `['/api/properties/ranking', 'page-${page}-limit-${limit}']` to ensure TanStack Query cache coherence
    - Navigation link added to sidebar menu
  - **Private Properties Enhancement** (`/api/properties/private` & `/properties/private`):
    - Changed default sort order to **chronological** (newest first) instead of matching count
    - Added `isAlsoFromAgency` flag to distinguish exclusive private listings from those also published by agencies
    - Visual badges: Green "Solo Privato" for exclusive listings, Orange "Privato + Agenzia" for duplicates
    - Address normalization ensures reliable duplicate detection across sources
- **Files Modified**:
  - `server/routes.ts`: New ranking endpoint + enhanced private endpoint with isAlsoFromAgency
  - `client/src/pages/properties/ranking.tsx`: New ranking page with filters, pagination, and cache management
  - `client/src/pages/properties/private/index.tsx`: Chronological sorting + badge display
  - `client/src/App.tsx`: Ranking route registration
  - `client/src/components/layouts/Sidebar.tsx`: Navigation link
- **Technical Details**:
  - **Query Key Pattern**: Centralized `rankingQueryKey(page, limit)` helper using string-based params to avoid object reference issues in TanStack Query cache operations
  - **Performance**: Backend loads all buyers once and calculates matching in-memory (acceptable for current scale of ~3,000 properties, ~40 buyers)
  - **Cache Coherence**: All cache operations (optimistic updates, invalidations, refetch) use the same query key helper to ensure consistency
  - **Data-testid Attributes**: Comprehensive test IDs added for automated testing
- **Results**: 
  - Unified view of all property types with intelligent filtering
  - Clear visual distinction between exclusive private listings and agency duplicates
  - Efficient pagination prevents UI blocking with large datasets
  - Reliable cache management ensures smooth user interactions (favorite toggles, pagination, manual refresh)

### November 25, 2025 (earlier): Private Properties Sorting by Matching Buyers
- **Request**: Sort private properties by number of potential matching buyers instead of date
- **Implementation**:
  - Modified `/api/properties/private` endpoint to calculate `matchingBuyersCount` for each property
  - Added "Più matching" sort option to private properties page (now default sort order)
  - Display matching count badge on property cards with User icon
  - Uses same matching logic as shared properties (`isSharedPropertyMatchingBuyerCriteria`)
- **Files Modified**:
  - `server/routes.ts`: Backend endpoint to calculate matching buyers
  - `client/src/pages/properties/private/index.tsx`: Frontend sorting and badge display
- **Results**: Properties with more potential buyers appear first (e.g., Via Montecatini with 2 matches appears before 6-month-old properties with 0 matches)
- **Performance**: In-memory calculation acceptable for current volumes (420 properties, ~40 buyers)

### November 25, 2025 (earlier): Matching Tolerances Adjustment
- **Request**: Adjust property matching tolerances for buyer criteria
- **Changes**:
  - Price tolerance: Changed from +20% to **+10%** (e.g., €400k budget now accepts up to €440k)
  - Size tolerance (minimum): Changed from -20% to **-2%** (e.g., 50mq requirement now accepts down to 49mq)
  - Size tolerance (maximum): Kept at +40% for flexibility
- **Files Modified**:
  - `server/lib/matchingLogic.ts`: Updated `isPropertyMatchingBuyerCriteria` and `isSharedPropertyMatchingBuyerCriteria`
  - `server/storage.ts`: Updated `getMatchingPropertiesForClient` hardcoded tolerances
- **Impact**: More precise matching reduces false positives while maintaining reasonable flexibility
- **Example**: Via Motta properties (45mq, €440k) no longer match client Cattaneo (50mq min, €400k max) because 45mq < 49mq (50 * 0.98)

### November 25, 2025 (earlier): Properties Page Pagination Implementation
- **Issue**: Properties page (/properties) was freezing when trying to load all 29,118 properties at once
- **Solution**: Implemented server-side pagination with default 100 properties per page
- **Technical Changes**:
  - Updated `IStorage.getProperties()` interface to return `{properties, total, page, limit, totalPages}` instead of `Property[]`
  - Implemented pagination in `DatabaseStorage.getProperties()` using SQL LIMIT/OFFSET with separate count query
  - Updated `MemStorage.getProperties()` to mirror pagination behavior for testing consistency
  - Modified `/api/properties` route to accept `page` and `limit` query parameters
  - Frontend updated with pagination controls (Previous/Next buttons) and page information display
- **Performance**: Query time reduced from 3.5+ seconds (loading all records) to milliseconds with pagination
- **Impact**: Page now loads instantly without freezing, displaying 100 properties per page across 292 pages
- **Testing**: End-to-end tests confirm pagination works correctly with proper button states and navigation

### November 25, 2025 (earlier): Geographic Tolerance & Property Classification Fix
- **Fixed**: Via Vittoria Colonna 51 (ID 6298) now appears in matching properties for buyer 80 (client 121)
- **Root Cause**: 24,847 properties were incorrectly classified as `owner_type = 'agency'` despite having no `owner_name` (imported from Apify)
- **Solution**: Reclassified all properties with `owner_type = 'agency'` AND empty `owner_name` to `owner_type = 'private'`
- **Impact**: Matching properties for buyers increased from 431 to 539 properties
- **Enhancement**: Implemented 200m geographic tolerance for polygon zones - properties within 200m of polygon edges are now included (previously only properties inside polygons were matched)
- **Technical**: Added support for both `Feature` and `FeatureCollection` GeoJSON formats in searchArea, using `@turf/point-to-line-distance` for accurate edge-distance calculations

## System Architecture
The application features a modern full-stack architecture.
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter for routing, TanStack Query for server state, Leaflet for maps, and React Hook Form with Zod for form management. It includes mobile-responsive optimizations.
- **Backend**: Express.js with TypeScript, running on Node.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **UI/UX**: Utilizes shadcn/ui components built on Radix UI, styled with Tailwind CSS. Interactive maps are provided by Leaflet, and geocoding by Nominatim. The UI emphasizes a card-based interface with color-coded visual cues for property status. The system supports viewing of all matching competitor properties with accurate geographic filtering using FeatureCollection for multi-zone buyer searches. An automatic zone geocoding system uses Nominatim API to visualize buyer search areas.
- **Technical Implementations**:
    - **Authentication & Integration**: OAuth2 for Google services.
    - **AI & Automation**: OpenAI for AI features, daily private property scraping, AI-powered property deduplication and matching (image hashing, fuzzy string matching), virtual secretary for prioritized contact management and task generation, multi-agency property clustering with intelligent filtering, automated reporting, and agency name normalization.
    - **Property Management**: Advanced property ingestion services, multi-agency property identification with refined deduplication, and portal filtering for private properties. Features include a dedicated UI for private properties with map/list views and comprehensive filtering.
    - **Communication**: 3-tier WhatsApp message deduplication and property context threading, dual-mode safety system for sending properties via WhatsApp, automated private seller outreach with AI conversational bots, and robust Google Calendar OAuth token management.
    - **Data Management**: Intelligent bucketing algorithm for property deduplication, multi-signal owner classification, and an asynchronous job queue system for long-running operations with auto-recovery and error handling.
    - **Client & Property Matching**: Dual favorites system (global and per-client), per-client ignore functionality for properties, and bidirectional matching views showing "Potenziali Interessati" (matching clients for a property) and "Possibili Immobili" (matching properties for a client), considering location, size, price tolerance, and property type.
    - **Dashboard & Analytics**: "Classifica Immobili" ranking widget for shared properties, daily goals, performance metrics, and AI insights.
    - **Auto-Import**: Zero-friction Idealista import with auto-save, 5-layer extraction fallback system (including Apify for complex cases), and Casafari saved properties import via Apify with Playwright-based authentication (with known limitations due to anti-bot detection).
- **Feature Specifications**:
    - **Client Management**: Detailed client profiles with AI-extracted preferences.
    - **Property Management**: Comprehensive listings with detailed pages, external links, owner contact info, and refined deduplication.
    - **Communication**: Integrated WhatsApp and email tracking with AI-powered response generation and automated reminders.
    - **Appointment Management**: Google Calendar synchronization, automated follow-ups, and conflict prevention.
    - **Task Automation**: AI-generated follow-up tasks, prioritized dashboards, and automated workflows for property acquisition (e.g., 5-stage pipeline visualization).
    - **Property Acquisition Management**: Tracking system for favorite properties with timeline-based activity and document management.
    - **Analytics**: Dashboard with performance metrics and AI insights.
    - **Data Correlation**: Smart correlation of communications, appointments, and properties.
    - **Natural Language Processing (NLP)**: AI-driven processing of client property requests for structured filter extraction.
    - **Automated Property Ingestion**: Architecture for automatic import from real estate portals.

## External Dependencies
- **Mapping**: Leaflet, Nominatim
- **Messaging**: UltraMsg (for WhatsApp)
- **AI**: OpenAI
- **OAuth/APIs**: Google services (Calendar)
- **Web Scraping**: Apify, CasaDaPrivato.it, ClickCase.it, Idealista (private listings), Immobiliare.it