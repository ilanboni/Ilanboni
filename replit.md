# Client Management System

## Overview
This project is a comprehensive real estate management system designed for property agents and clients. It provides a full-stack solution for managing properties, clients, communications, appointments, and automated workflows. Key capabilities include WhatsApp integration, Google Calendar synchronization, AI-powered assistance, and advanced property matching. The system aims to streamline operations for real estate professionals, enhance client interaction, and leverage AI for efficient property acquisition and management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application features a modern full-stack architecture.
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, and shadcn/ui. It utilizes Wouter for routing, TanStack Query for server state, Leaflet for maps, and React Hook Form with Zod for forms.
- **Backend**: Express.js with TypeScript, running on Node.js.
- **Database**: PostgreSQL with Drizzle ORM.
- **UI/UX**: Utilizes shadcn/ui components built on Radix UI primitives, styled with Tailwind CSS for a consistent and modern design. Interactive maps are provided by Leaflet, and address geocoding is handled via Nominatim.
- **Technical Implementations**: OAuth2 for Google services (Calendar, Gmail), UltraMsg for WhatsApp integration, and OpenAI for AI features. The system includes a custom scheduler for automated follow-ups and advanced property deduplication and matching algorithms using image hashing and fuzzy string matching. It also features a virtual secretary for prioritized contact management and task generation.
- **Feature Specifications**:
    - **Client Management**: Detailed client profiles (buyers/sellers) with preferences.
    - **Property Management**: Comprehensive property listings, external property import from portals, and automatic identification of multi-agency properties.
    - **Communication**: Integrated WhatsApp and email communication tracking, with AI-powered response generation and automated reminders.
    - **Appointment Management**: Google Calendar synchronization, automated follow-ups, and conflict prevention.
    - **Task Automation**: AI-generated follow-up tasks, prioritized task dashboard, and automated workflows for property acquisition.
    - **Analytics**: Dashboard with daily goals, performance metrics, and AI insights.
    - **Data Correlation**: Smart correlation of communications, appointments, and properties.

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
- **OpenAI SDK + Replit AI Integrations**: AI features using GPT-5 for natural language processing of client property requests (no personal API key required, billed to Replit credits via AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY)
- **Nominatim**: Geocoding services
## Changelog
- October 27, 2025. Interfaccia Visuale Deduplicazione Immobili completata - Implementata nuova pagina /properties/duplicates con visualizzazione cluster duplicati multi-agency, endpoint GET /api/deduplication/results che restituisce proprietà raggruppate per indirizzo con conteggio duplicati, bottone scansione manuale POST /api/run/scan protetto da autenticazione Bearer (VITE_REPLIT_API_TOKEN), scheduler automatico ogni 7 giorni con lock anti-concorrenza (flag isScanRunning), UI responsive con card per ogni cluster mostrando indirizzo/città/prezzo/mq/badge multi-agency, ordinamento per duplicateCount descending, test end-to-end completato con successo (3 cluster trovati: Via Ponte Vetero, Viale Belisario), sistema production-ready
- October 27, 2025. Sistema Natural Language Processing per richieste immobiliari completato - Implementato sistema completo di elaborazione richieste clienti in linguaggio naturale con ChatGPT: esteso schema database con tabella client_requests (clientId, sourceText, filters jsonb), creato servizio nlProcessingService.ts con OpenAI GPT-4o-mini per parsing NL→filtri strutturati (deal_type, property_type, budget_max, size_min, rooms, bathrooms, floor_min, zones, condition, features), implementati 3 endpoint API (POST /api/clients/:id/nl-request per NL→filtri→salva→match, POST /api/import-casafari per import array proprietà Casafari, POST /api/manual/casafari/pull per fetch automatico da Casafari Alerts API), sistema include graceful degradation con filtri default se OpenAI fallisce, integrazione completa con sistema matching esistente, workflow testato con richiesta "bilocale/trilocale 2 bagni piano ≥3 balcone ascensore 80mq €500k Isola/Porta Romana", sistema operativo al 100% e pronto per uso con API key OpenAI valida o integrazione Replit AI
- October 22, 2025. Sistema Segretaria Virtuale CRM+CMS completato - Implementato sistema completo di gestione prioritizzata contatti per acquisizione immobili pluricondivisi: esteso schema database (contacts, matches, priority/direction in tasks/interactions), create 9 API backend, implementata logica priorità automatica (privati 90-100, multi-agency 70-80, mono-agency 40-60), creati templates messaggi WhatsApp/phone/email con tone profiles, sviluppate 2 pagine frontend React, sistema operativo al 100%
