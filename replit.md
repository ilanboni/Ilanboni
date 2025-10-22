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
- **OpenAI**: AI features and response generation
- **Nominatim**: Geocoding services