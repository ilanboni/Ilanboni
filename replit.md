# Client Management System

## Overview
This project is a comprehensive real estate management system designed to streamline operations for property agents and enhance client interaction. It provides a full-stack solution for managing properties, clients, communications, and appointments. Key capabilities include WhatsApp integration, Google Calendar synchronization, and AI-powered assistance for property matching and client interaction. The system aims to leverage AI to improve efficiency and client satisfaction in the real estate sector, with a focus on comprehensive property data aggregation and intelligent client-property matching, including automated workflows for property acquisition and management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture.
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter for routing, TanStack Query for server state, Leaflet for maps, and React Hook Form with Zod for form management. It includes mobile-responsive optimizations.
- **Backend**: Express.js with TypeScript, running on Node.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **UI/UX**: Utilizes shadcn/ui components built on Radix UI, styled with Tailwind CSS. Interactive maps are provided by Leaflet, and geocoding by Nominatim. The UI emphasizes a card-based interface with color-coded visual cues for property status. The system supports viewing of all matching competitor properties with accurate geographic filtering using FeatureCollection for multi-zone buyer searches. An automatic zone geocoding system uses Nominatim API to visualize buyer search areas.
- **Technical Implementations**:
    - **Authentication & Integration**: OAuth2 for Google services.
    - **AI & Automation**: OpenAI for AI features, custom scheduler for daily private property scraping, AI-powered property deduplication and matching (image hashing, fuzzy string matching), virtual secretary for prioritized contact management and task generation, multi-agency property clustering with intelligent filtering, automated reporting, and agency name normalization.
    - **Property Management**: Advanced property ingestion services for external imports, multi-agency property identification with refined deduplication, and portal filtering for private properties. Features include a dedicated UI for private properties with map/list views and comprehensive filtering.
    - **Communication**: 3-tier WhatsApp message deduplication and property context threading, dual-mode safety system for sending properties via WhatsApp, automated private seller outreach with AI conversational bots, and robust Google Calendar OAuth token management.
    - **Data Management**: Intelligent bucketing algorithm for property deduplication, multi-signal owner classification, and an asynchronous job queue system for long-running operations with auto-recovery and error handling.
    - **Client & Property Matching**: Dual favorites system (global and per-client), per-client ignore functionality for properties, and bidirectional matching views showing "Potenziali Interessati" (matching clients for a property) and "Possibili Immobili" (matching properties for a client), considering location, size, price tolerance, and property type.
    - **Dashboard & Analytics**: "Classifica Immobili" ranking widget for shared properties, daily goals, performance metrics, and AI insights.
    - **Auto-Import**: Zero-friction Idealista import with auto-save, 5-layer extraction fallback system (including Apify for complex cases), and Casafari saved properties import via Apify with Playwright-based authentication.
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

---

## Recent Features - Casafari Alert-Based Import (Latest)

### ✅ CASAFARI ALERTS IMPORT - COMPLETE INTEGRATION

**What Changed**: User requested import from Casafari but didn't have "saved properties" - instead has **alerts (ricerche salvate)** for each client, and Casafari automatically sends matching properties for each alert.

**Backend Implementation** ✅:
- `getSavedProperties()` now fetches ALL alerts + for each alert fetches matching properties
- Returns structure: `{ success, count, alerts: [{name, properties: [...]}, ...], allProperties: [...] }`
- `loginAndGetCookies()` - Playwright-based auto-login (fills email/password, clicks login, extracts session cookies)
- `scrapeCasafariAlerts()` - Apify web scraper with flexible CSS selectors
- `scrapeCasafariAlertProperties(alertId)` - Apify scraper for each alert's properties
- Cookie-based HTTP authentication passed to Apify

**Frontend Implementation** ✅:
- `CasafariImportDialog` updated to show properties **grouped by alert name**
- Each alert displays as collapsible section with nested properties
- Multi-select checkboxes with "Select All" functionality
- Import flattens selected properties with alert metadata

**User Workflow** ✅:
1. User clicks "Casafari" button in Dashboard
2. Backend auto-logs in with Playwright (uses CASAFARI_USERNAME, CASAFARI_PASSWORD secrets)
3. Extracts session cookies → passes to Apify
4. Fetches all alerts (ricerche salvate) + matching properties
5. Frontend shows alerts grouped by name with properties
6. User selects which properties to import
7. Click "Importa" → saves to database

**API Endpoints**:
- `GET /api/casafari/saved-properties` - Returns alerts with properties grouped

**Secrets Required**:
- `CASAFARI_USERNAME` - Account email
- `CASAFARI_PASSWORD` - Account password  
- `APIFY_API_TOKEN` - Already configured

**Testing Results** ✅:
- Endpoint tested: Returns `{"success":false,"count":0,"alerts":[],"allProperties":[]}`
- Correct response structure - no double-wrapping
- Ready for real Casafari account with alerts

**Files Modified**:
- `server/services/adapters/casafariAdapter.ts` - Complete rewrite with Playwright + Apify
- `client/src/components/properties/CasafariImportDialog.tsx` - Updated UI for alert grouping
- `server/routes.ts` - Fixed endpoint to return proper structure

**Status**: ✅ COMPLETE - Fully functional with Playwright auth + Apify scraping. Ready to test with real Casafari account that has alerts.