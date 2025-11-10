# Client Management System

## Recent Changes
- **Enhanced Task Management System (November 10, 2025)**: Implemented comprehensive task management with timeline visualization and manual property addition:
  1. **Activity Timeline Component**: Replaced table view with visual card-based timeline showing tasks with icons, status badges, priority indicators, and clickable navigation to task details.
  2. **Task Detail Page** (`/tasks/:id`): Full-featured task editing page with form validation, pipeline visualization (Da Fare → In Corso → Completata → Annullata), complete/delete actions, and automatic query invalidation.
  3. **"Ricerca" Task Type**: Added new task type for property research activities, with auto-creation when properties are added manually.
  4. **Manual Property Addition**: New "Aggiungi Immobile" button on client pages opens dialog to manually add properties with URL, address, characteristics. Backend endpoint `/api/shared-properties/manual` creates property with `isAcquired=false` (temporary), `isFavorite=true`, and auto-generates "Immobile in linea con ricerca cliente X" task using transactional service (`manualSharedPropertyService`).
  5. **Architecture Pattern**: Followed architect recommendations: dedicated endpoint for manual flow, service layer with transaction for property+task creation, proper separation from automated scraping logic.
- **Client Task Creation (November 10, 2025)**: Implemented direct task creation from client detail pages:
  1. **New "Nuova Attività" button**: Added to "Note e Attività" tab in client details, opening a modal dialog pre-filled with client ID.
  2. **CreateTaskDialog component**: Built with react-hook-form + zodResolver for type-safe validation using insertTaskSchema.pick() + extend() pattern to avoid Zod type inference issues.
  3. **Form fields**: Task type (follow-up, call, meeting, email, viewing, document, other), title (required), description (optional), due date (required, locale-safe using date-fns), priority (1-3, coerced from string select to number).
  4. **API integration**: POST /api/tasks with automatic query invalidation for both client tasks and global task list.
  5. **End-to-End Tested**: Playwright test confirms dialog opens, form submission works, toast appears, and tasks table refreshes with new task immediately.
- **Multi-Agency Properties Performance & Favorites (November 10, 2025)**: Fixed critical browser crash issue on multi-agency properties page and implemented favorites system:
  1. **Performance Optimizations**: Implemented pagination (50 properties per page), memoized classification calculations, hoisted expensive functions outside component scope, preventing browser freeze when loading hundreds of properties.
  2. **Favorites System**: Added star button on each property card to mark favorites, with optimistic UI updates and "Solo preferiti" filter button to show only favorited properties. Backend stores `isFavorite` boolean field with PATCH endpoint for toggling state.
  3. **React Query Fix**: Corrected cache key structure to include filters object, ensuring optimistic mutations update UI immediately. Added `onSettled` invalidation to sync related queries.
  4. **End-to-End Tested**: Playwright test confirms page loads without crash, favorites toggle works correctly, filter shows only favorites, and pagination handles large datasets.
- **WhatsApp Webhook Diagnostic Tool (November 10, 2025)**: Created diagnostic page (`/settings/whatsapp-diagnostic`) to verify and configure UltraMsg webhook for automatic message synchronization from mobile devices. The system already supports receiving WhatsApp messages from mobile via webhook, but requires correct UltraMsg webhook configuration. The diagnostic tool provides: webhook status verification, automatic configuration button, manual setup instructions with step-by-step guide, recent messages testing from UltraMsg API, and secure display of configuration details (masked sensitive data). Accessible via sidebar link "Diagnostica WhatsApp" under "Analisi e Strumenti" section. Fixes issue where messages sent/received on mobile WhatsApp were not appearing in the chat view.
- **WhatsApp Web-Style Chat Interface (November 10, 2025)**: Implemented WhatsApp Web-style chat view in the Communications tab of client detail pages, replacing the table-only view with a dual-view system:
  1. **Chat View (default)**: Displays WhatsApp messages in a familiar chat interface with message bubbles (green for outbound, white for inbound) and timestamps. Includes an inline composer for sending new messages with auto-scroll to latest messages and automatic cache invalidation after sending.
  2. **Table View**: Preserves the original full communications table showing all communication types (email, phone, meetings, WhatsApp) with complete functionality including the "Nuova Comunicazione" button, status badges, and follow-up indicators.
  3. **Toggle Controls**: Two buttons allow users to switch between "Chat WhatsApp" (default) and "Tutte" (table) views, providing quick access to both focused WhatsApp conversations and comprehensive communication history.
- **Property Deduplication Fix (November 7, 2025)**: Fixed two critical bugs in property classification:
  1. **Agency name normalization**: Properties from same agency with name variations (e.g., "F.I.L. Casa Agency S.r.l." vs "FIL Casa Agency SRL") were incorrectly classified as multi-agency. Now normalizes names (lowercase, remove punctuation, standardize legal suffixes) before counting unique agencies.
  2. **Consolidate ALL duplicates**: Previously only multi-agency properties were consolidated. Now ALL duplicate listings (same address/price) are consolidated into single cards with multiple links, regardless of whether they're from multiple agencies (yellow) or same agency (red). This eliminates the "sacco di doppioni" issue.
- **Multi-Agency Property Consolidation (November 7, 2025)**: Implemented property grouping to show duplicate listings as a single card with all agency links. Each consolidated property displays a scrollable list of all listings with direct external links. This makes it easier to compare all options for the same property.
- Implemented Casafari API integration for rating 4-5 clients, replacing dual scraping system (Immobiliare + Idealista Apify)
- Built property classification engine that groups listings by address/price and counts unique agencies to determine private/multi-agency/single-agency status
- Applied color-coded UI: green backgrounds for private listings, yellow for multi-agency, red for single-agency
- Unified UI to single "Aggiorna" button (removed "Vedi Tutti i Concorrenti")
- Fixed critical SecurityError where external property URLs incorrectly used internal routing - now use anchor tags with target="_blank"
- Ensured classification applies to both freshly scraped and saved properties from database

## Overview
This project is a comprehensive real estate management system designed to streamline operations for property agents and enhance client interaction. It provides a full-stack solution for managing properties, clients, communications, and appointments. Key capabilities include WhatsApp integration, Google Calendar synchronization, AI-powered assistance for property matching and client interaction, and automated workflows for property acquisition and management. The system aims to leverage AI to improve efficiency and client satisfaction in the real estate sector, with a focus on comprehensive property data aggregation and intelligent client-property matching.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture.
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter for routing, TanStack Query for server state, Leaflet for maps, and React Hook Form with Zod for form management. It includes mobile-responsive optimizations across all views, including safe area support and touch-friendly elements.
- **Backend**: Express.js with TypeScript, running on Node.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **UI/UX**: Utilizes shadcn/ui components built on Radix UI, styled with Tailwind CSS. Interactive maps are provided by Leaflet, and geocoding by Nominatim. The UI emphasizes a card-based interface for managing properties and clients, with clear visual cues for property status (e.g., color-coded backgrounds for private, duplicate, or single-agency properties).
- **Technical Implementations**: OAuth2 for Google services, UltraMsg for WhatsApp integration, and OpenAI for AI features. The system includes a custom scheduler for automated follow-ups, advanced property deduplication and matching algorithms using image hashing and fuzzy string matching, and a virtual secretary for prioritized contact management and task generation. It also features an advanced multi-agency property clustering system with intelligent filtering that distinguishes true multi-agency listings from same-agency duplicates (exclusives), and automated reporting for property acquisition. Agency names are tracked from data sources (e.g., Casafari) and used to filter out false multi-agency properties where the same agency publishes the same listing multiple times. A key feature is the "Ignore" functionality for shared properties, allowing agents to permanently dismiss unwanted listings. The system also supports comprehensive viewing of all matching competitor properties for high-value clients, with accurate geographic filtering using FeatureCollection for multi-zone buyer searches. An automatic zone geocoding system uses Nominatim API to visualize buyer search areas, storing polygon boundaries or point centroids.
- **Feature Specifications**:
    - **Client Management**: Detailed client profiles (buyers/sellers) with AI-extracted preferences.
    - **Property Management**: Comprehensive listings, external import, and multi-agency property identification with a refined deduplication system that accounts for address variations and GPS fallback.
    - **Communication**: Integrated WhatsApp and email tracking with AI-powered response generation and automated reminders.
    - **Appointment Management**: Google Calendar synchronization, automated follow-ups, and conflict prevention.
    - **Task Automation**: AI-generated follow-up tasks, prioritized dashboards, and automated workflows for property acquisition, including a multi-agency property acquisition workflow with a 5-stage pipeline visualization.
    - **Analytics**: Dashboard with daily goals, performance metrics, and AI insights.
    - **Data Correlation**: Smart correlation of communications, appointments, and properties.
    - **Natural Language Processing (NLP)**: AI-driven processing of client property requests, extracting structured filters for matching.
    - **Automated Property Ingestion**: Architecture for automatic import from real estate portals, utilizing the Casafari API for comprehensive data aggregation across Italian portals.

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
- **OpenAI SDK + Replit AI Integrations**: AI features.
- **Casafari SDK**: Professional B2B real estate data aggregator for the Italian market.
- **Nominatim**: Geocoding services for search area visualization.