# Client Management System

## Overview
This project is a comprehensive real estate management system designed to streamline operations for property agents and enhance client interaction. It provides a full-stack solution for managing properties, clients, communications, and appointments. Key capabilities include WhatsApp integration, Google Calendar synchronization, AI-powered assistance for property matching and client interaction, and automated workflows for property acquisition and management. The system aims to leverage AI to improve efficiency and client satisfaction in the real estate sector, with a focus on comprehensive property data aggregation and intelligent client-property matching.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (2025-11-22)
**Bugfix: Price Tolerance in Buyer-Property Matching**
- Fixed critical bug: Changed preliminary price filter tolerance from +10% to -20% (now uses `price * 0.8` instead of `price * 1.1`)
- This allows buyers to be matched to cheaper properties (e.g., buyer with maxPrice 550K now matches property at 549K)
- The matching now correctly applies the 20% tolerance as per the bidirectional matching logic
- Bug was causing valid buyers to be excluded from "Potenziali Interessati" lists

**Feature: Interactive Property Ranking with Client Names Popover**
- Added interactive popover to the "Proprietà Condivise" dashboard widget
- When users click on "X potenziali interessati", a popover appears showing:
  - List of interested clients' names (firstName lastName)
  - Client phone numbers
  - Scrollable list if many clients are interested
- Improved UX: Number of interested clients is now visually clickable (blue, underlined text)

**Feature: "Immobili preferiti" (Favorites System) + Bidirectional Matching Views**

### Dual Favorites System:
- Implemented dual favorites system: global favorites + per-client favorites
- Added "Solo Privati" filter button in "Possibili Immobili" tab (shows only private properties)
- Color-coded property classification: 🟢 Green (private, 425), 🟡 Yellow (multi-agency 7+, 351), 🔴 Red (single-agency, 2230)
- Heart/favorite button on each property card with toggle functionality
- Clicking the heart button adds/removes property from both global favorites AND client-specific favorites
- Database table `client_favorites` created with unique constraint on (client_id, shared_property_id)

### Bidirectional Matching Views:
- **Per Property**: Shows "Potenziali Interessati" (matching clients) in shared property detail page using `SharedPropertyMatchingBuyers` component
- **Per Client**: Shows "Possibili Immobili" tab with monocondiviso, pluricondiviso, and private properties that match buyer criteria
- Both views use intelligent matching algorithm based on: property location (polygon matching), size tolerance (-20% to +40%), price tolerance (+20%), property type
- Matching score calculation: 0-100% based on how well property matches buyer preferences
- Supports multi-agency properties with all agency links displayed

### Dashboard Feature - Classifica Immobili:
- Added "Proprietà Condivise" ranking widget in dashboard
- Shows properties ranked by number of interested buyers
- Displays: ranking position, address, size/price, interested buyers count, match percentage
- Component: `SharedPropertiesRanking` (client/src/components/dashboard/SharedPropertiesRanking.tsx)
- Endpoint: `GET /api/analytics/shared-properties-ranking`

### API Endpoints:
- GET `/api/clients/:id/favorites` - Get client's favorite properties
- POST `/api/clients/:id/favorites` - Add property to client favorites
- DELETE `/api/clients/:id/favorites/:propertyId` - Remove property from client favorites
- PATCH `/api/shared-properties/:id/favorite` - Toggle global favorite status
- GET `/api/shared-properties/:id/matching-buyers` - Get clients interested in a property
- GET `/api/clients/:id/matching-shared-properties` - Get properties matching a client's criteria
- GET `/api/analytics/shared-properties-ranking` - Get properties ranked by interested buyers count

## Configuration - Milano Zones for Scraping
**IMPORTANT**: The 7-8 Milano location IDs for Idealista scraping are saved in:
```
server/config/milanZones.ts → MILANO_ZONES array
```
These IDs persist in the code so they won't get lost. When you have the location IDs, add them directly to this file in the `MILANO_ZONES` array. Format: `"0-EU-IT-MI-XX-XXX-XXX-XX"`

## System Architecture
The application features a modern full-stack architecture.
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter for routing, TanStack Query for server state, Leaflet for maps, and React Hook Form with Zod for form management. It includes mobile-responsive optimizations.
- **Backend**: Express.js with TypeScript, running on Node.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **UI/UX**: Utilizes shadcn/ui components built on Radix UI, styled with Tailwind CSS. Interactive maps are provided by Leaflet, and geocoding by Nominatim. The UI emphasizes a card-based interface with color-coded visual cues for property status.
- **Technical Implementations**: OAuth2 for Google services, UltraMsg for WhatsApp integration, and OpenAI for AI features. The system includes a custom scheduler, advanced property deduplication and matching algorithms using image hashing and fuzzy string matching, and a virtual secretary for prioritized contact management and task generation. It also features an advanced multi-agency property clustering system with intelligent filtering, automated reporting for property acquisition, and agency name normalization. An "Ignore" functionality for shared properties allows agents to dismiss unwanted listings. The system supports viewing of all matching competitor properties with accurate geographic filtering using FeatureCollection for multi-zone buyer searches. An automatic zone geocoding system uses Nominatim API to visualize buyer search areas.
    - **WhatsApp Integration**: Features 3-tier message deduplication and property context threading, where WhatsApp webhooks automatically link client replies to specific shared properties. Includes a dual-mode safety system for sending properties via WhatsApp, with test and production configurations to prevent accidental mass messages. An automated private seller outreach system is implemented with AI conversational bot capabilities, including personalized message generation, intent recognition, and automatic follow-ups.
    - **Google Calendar Integration**: Robust OAuth token management handles expired/revoked tokens, invalidating them and prompting for reauthorization to ensure seamless sync recovery.
    - **Property Deduplication**: Employs an intelligent bucketing algorithm combining geographic and price criteria to significantly reduce comparison complexity and improve performance. Includes robust agency name normalization to accurately identify multi-agency properties.
    - **Owner Classification System**: Accurately distinguishes between private sellers and agencies using a multi-signal classification algorithm that prioritizes agency keywords for improved accuracy.
    - **Automated Property Scraping**: Features a full-city scraping scheduler that downloads all properties from Milano using Apify, then filters them server-side based on buyer criteria. Includes instant property filtering for buyers, leveraging a unified approach for both normal and shared properties. Production-ready private property scraping uses `igolaizola/idealista-scraper` for accurate private seller identification.
    - **Asynchronous Job Queue System**: Solves timeout issues for long-running Apify operations by processing jobs in the background. Features auto-recovery for interrupted jobs, robust error handling with retry logic, and checkpoint persistence for server-restart recovery.
    - **Private Properties Section**: A dedicated UI for managing properties sold directly by private owners, featuring map/list views, favorites, and comprehensive filtering. Utilizes a classification system for accurate owner type detection, leveraging multiple signals and providing confidence scores.
- **Feature Specifications**:
    - **Client Management**: Detailed client profiles with AI-extracted preferences.
    - **Property Management**: Comprehensive listings with detailed property pages showing description, external links, and owner contact information (name, phone, email). Features external import and multi-agency property identification with refined deduplication. Property detail pages include a prominent blue-highlighted section displaying the original listing link (Immobiliare.it/Idealista.it) for accessing complete property details, along with dedicated sections for owner contact information when available, with clickable phone and email links for direct contact. The ingestion service automatically populates both `url` and `externalLink` fields to ensure all properties have accessible external listing links.
    - **Communication**: Integrated WhatsApp and email tracking with AI-powered response generation and automated reminders, including a WhatsApp Web-style chat interface.
    - **Appointment Management**: Google Calendar synchronization, automated follow-ups, and conflict prevention.
    - **Task Automation**: AI-generated follow-up tasks, prioritized dashboards, and automated workflows for property acquisition, including a multi-agency property acquisition workflow with a 5-stage pipeline visualization.
    - **Property Acquisition Management**: Comprehensive tracking system for favorite properties with timeline-based activity tracking and document management with secure upload and categorization.
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
- **Apify**: Web scraping platform for automated property data collection from Immobiliare.it and Idealista.it, including the `igolaizola/idealista-scraper` actor.
- **Nominatim**: Geocoding services for search area visualization
- **multer**: File upload middleware for property attachments
- **node-cron**: Cron-based task scheduler for automated buyer scraping