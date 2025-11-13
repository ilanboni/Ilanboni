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
- **UI/UX**: Utilizes shadcn/ui components built on Radix UI, styled with Tailwind CSS. Interactive maps are provided by Leaflet, and geocoding by Nominatim. The UI emphasizes a card-based interface with color-coded visual cues for property status.
- **Technical Implementations**: OAuth2 for Google services, UltraMsg for WhatsApp integration, and OpenAI for AI features. The system includes a custom scheduler, advanced property deduplication and matching algorithms using image hashing and fuzzy string matching, and a virtual secretary for prioritized contact management and task generation. It also features an advanced multi-agency property clustering system with intelligent filtering, and automated reporting for property acquisition. Agency name normalization is used for accurate classification. An "Ignore" functionality for shared properties allows agents to dismiss unwanted listings. The system supports viewing of all matching competitor properties with accurate geographic filtering using FeatureCollection for multi-zone buyer searches. An automatic zone geocoding system uses Nominatim API to visualize buyer search areas.
    - **WhatsApp Message Deduplication**: 3-tier deduplication system prevents message triplication from racing webhooks. Pre-creates communication records before API calls to avoid race conditions. Tier 1: externalId matching, Tier 2: correlationId (UUID) matching, Tier 3: content+time matching (workaround for UltraMsg not returning referenceId). Tracks source ('app', 'phone', 'webhook') and deliveryStatus ('pending' → 'sent' → 'delivered' for outbound, 'received' for inbound). Database columns: correlationId (UUID, indexed), source (TEXT), deliveryStatus (TEXT), externalId (TEXT).
- **Feature Specifications**:
    - **Client Management**: Detailed client profiles with AI-extracted preferences.
    - **Property Management**: Comprehensive listings, external import, and multi-agency property identification with refined deduplication.
    - **Communication**: Integrated WhatsApp and email tracking with AI-powered response generation and automated reminders, including a WhatsApp Web-style chat interface.
    - **Appointment Management**: Google Calendar synchronization, automated follow-ups, and conflict prevention. Appointments are created with automatic Google Calendar sync and reminders, supporting a dual-table architecture for backwards compatibility. **OAuth Token Management**: Robust error handling for expired/revoked Google Calendar tokens - automatically detects `invalid_grant` errors, invalidates stale tokens, marks affected events as 'needs_auth', and displays reconnection banner across all pages. Events created while disconnected are immediately marked for reauthorization to ensure seamless sync recovery after reconnection.
    - **Task Automation**: AI-generated follow-up tasks, prioritized dashboards, and automated workflows for property acquisition, including a multi-agency property acquisition workflow with a 5-stage pipeline visualization. Task management includes an activity timeline, detailed task editing pages, and direct task creation from client pages.
    - **Property Acquisition Management**: Comprehensive tracking system for favorite properties with dedicated tabs for activities and documents. Features include: timeline-based activity tracking (phone calls, site visits, emails, document requests, negotiations) with create/edit/delete operations; document management with drag-and-drop file upload, categorization (visura, planimetria, foto, contratto, altro), and secure download; full Zod schema validation for data integrity; path traversal protection with filename sanitization for security; real-time UI updates with TanStack Query cache invalidation; and integration with existing property pipeline visualization.
    - **Analytics**: Dashboard with daily goals, performance metrics, and AI insights.
    - **Data Correlation**: Smart correlation of communications, appointments, and properties.
    - **Natural Language Processing (NLP)**: AI-driven processing of client property requests, extracting structured filters.
    - **Automated Property Ingestion**: Architecture for automatic import from real estate portals, utilizing the Casafari API.
    - **Property Deduplication**: Consolidates all duplicate listings into single cards regardless of agency, using normalized agency names and address/price grouping.
    - **Private Properties Section**: Dedicated page (`/properties/private`) for viewing properties sold directly by private owners (non-agencies) within 4km radius of Milan's Duomo. Features multi-layered filtering: ownerType validation, Apify source verification (Immobiliare.it/Idealista.it), geographic filtering using Haversine distance calculation from Duomo coordinates (45.464204, 9.191383), optional phone number filter, portal-specific filtering, text search, and multi-criteria sorting. Implements performance optimization with useMemo for filtered/sorted results, robust coordinate validation (handling null/undefined/empty/NaN), and awaited query invalidation for real-time UI updates.
    - **WhatsApp Webhook Diagnostic Tool**: A page to verify and configure UltraMsg webhook for automatic message synchronization.

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
- **Apify**: Web scraping platform for automated property data collection from Immobiliare.it and Idealista.it
- **Nominatim**: Geocoding services for search area visualization
- **multer**: File upload middleware for property attachments with security constraints (50MB limit, allowed MIME types)