# Client Management System

## Overview
This is a comprehensive real estate management system built for property agents and clients. The application provides a full-stack solution for managing properties, clients, communications, appointments, and automated workflows including WhatsApp integration and Google Calendar synchronization.

## System Architecture
The application follows a modern full-stack architecture with:
- **Frontend**: React with TypeScript, Vite build system, Tailwind CSS, and shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **External Integrations**: Google Calendar, Gmail, WhatsApp (UltraMsg), OpenAI for AI assistance

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state, React hooks for local state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Maps**: Leaflet for interactive maps and geocoding
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Database Layer**: Drizzle ORM with PostgreSQL
- **Authentication**: OAuth2 for Google services (Calendar and Gmail)
- **External APIs**: UltraMsg for WhatsApp, OpenAI for AI features
- **Task Scheduling**: Custom follow-up scheduler for automated communications

### Database Schema
The application uses PostgreSQL with the following main entities:
- **clients**: Base client information (buyers and sellers)
- **buyers/sellers**: Extended client data with specific preferences
- **properties**: Property listings with comprehensive details
- **communications**: WhatsApp, email, and other communication records
- **appointments**: Scheduled property viewings and meetings
- **tasks**: Follow-up reminders and action items
- **oauth_tokens**: Secure storage for external service tokens

### External Service Integrations
- **Google Calendar**: Automated appointment scheduling and calendar management
- **Gmail**: Email monitoring for property inquiries from real estate platforms
- **WhatsApp (UltraMsg)**: Automated messaging and communication tracking
- **OpenAI**: AI-powered response generation and sentiment analysis
- **Nominatim**: Address geocoding and map integration

## Data Flow
1. **Client Management**: Clients are created with detailed preferences and contact information
2. **Property Matching**: Advanced algorithm matches properties to buyer criteria using geographic and preference filters
3. **Communication Tracking**: All WhatsApp, email, and phone communications are logged and analyzed
4. **Automated Workflows**: AI generates appropriate responses and creates follow-up tasks
5. **Calendar Integration**: Appointments are automatically synced with Google Calendar
6. **Analytics**: Comprehensive reporting on market trends, client preferences, and agent performance

## External Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection with WebSocket support
- **googleapis**: Google Calendar and Gmail API integration
- **@anthropic-ai/sdk**: AI assistant capabilities
- **axios**: HTTP client for external API calls
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **leaflet**: Interactive maps and geocoding
- **@turf/helpers**: Geographic calculations and analysis

## Deployment Strategy
The application is designed for deployment on Replit with:
- **Development**: `npm run dev` for local development with hot reload
- **Production Build**: `npm run build` creates optimized frontend and backend bundles
- **Production Server**: `npm run start` runs the production server
- **Database Migrations**: `npm run db:push` applies schema changes

The application includes comprehensive environment variable configuration for all external services and can be easily deployed to cloud platforms with PostgreSQL support.

## Changelog
- August 27, 2025. Webhook UltraMsg configurato e sistema completamente operativo - Risolti tutti errori TypeScript di compilazione, webhook endpoint funzionante al 100%, configurazione UltraMsg completata con eventi message_received/create/ack attivati, sistema pronto per ricezione automatica messaggi WhatsApp in produzione
- August 27, 2025. Sistema promemoria WhatsApp completato con protezione test - Implementato riconoscimento direzione messaggi, creazione automatica clienti per numeri sconosciuti, protezione invio limitata al numero test 393407992052 durante sviluppo per evitare messaggi indesiderati a clienti reali
- August 26, 2025. Rimosso sistema numerazione clienti e implementato nome semplice "Cliente" con saluto "Gentile Cliente" - Eliminati nomi problematici come "Cliente 0592", aggiornati 14 clienti esistenti a semplicemente "Cliente" con saluto appropriato "Gentile Cliente", modificato processore email per evitare nomi numerati futuri
- July 14, 2025. Risolto problema webview e automazione completata - App React funzionante, geocoding automatico attivato, workflow completo operativo
- June 25, 2025. Initial setup
- December 31, 2024. Fixed deployment issues after app rename - cleaned build cache and updated package name

## User Preferences
Preferred communication style: Simple, everyday language.