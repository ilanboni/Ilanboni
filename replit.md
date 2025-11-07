# Client Management System

## Recent Changes
- **Multi-Agency Property Consolidation (November 7, 2025)**: Implemented property grouping to show duplicate multi-agency listings as a single card with all agency links. Each multi-agency property now displays a scrollable list of all agencies offering the same property, with direct external links. This eliminates duplicate cards and makes it easier to compare all options for the same property.
- Implemented Casafari API integration for rating 4-5 clients, replacing dual scraping system (Immobiliare + Idealista Apify)
- Built property classification engine that groups listings by address/price and counts unique agencies to determine private/multi-agency/single-agency status
- Applied color-coded UI: green backgrounds for private listings, yellow for shared/multi-agency, red for single-agency
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