# Client Management System

## Overview
This project is a comprehensive real estate management system designed to streamline operations for property agents and enhance client interaction. It provides a full-stack solution for managing properties, clients, communications, and appointments. Key capabilities include WhatsApp integration, Google Calendar synchronization, AI-powered assistance for property matching and client interaction, and automated workflows for property acquisition and management. The system aims to leverage AI to improve efficiency and client satisfaction in the real estate sector.

## Recent Changes (October 31, 2025)
- **Multi-Agency Property Acquisition Workflow**: Transformed duplicates page into complete acquisition management system with card-based interface
  - Each shared property shown as expandable card with tabs: Details, Agencies, Pipeline, Activities, Interested Clients
  - Pipeline visualization with 5 stages: address_found → owner_found → owner_contact_found → owner_contacted → result (acquired/rejected/pending)
  - Automatic buyer matching on acquisition: when property acquired, system creates match records for all compatible buyers
  - Activity tracking: tasks can be created/linked to specific shared properties
  - JSONB `agencies` field in schema allows tracking unlimited number of agencies per property
  - Transaction-safe acquisition with duplicate match protection
  - Geographic filter removed: system now covers entire Milano commune without distance restrictions

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
- **Apify**: Automated web scraping service for property ingestion.
- **Nominatim**: Geocoding services.