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