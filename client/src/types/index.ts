import { 
  Client, ClientWithDetails, Property, PropertyWithDetails, 
  Appointment, Task, MarketInsight, User 
} from "@shared/schema";

// Re-export types from shared schema
export type { Task, ClientWithDetails, Client, Property, PropertyWithDetails, Appointment, MarketInsight, User };

// Extended types for frontend

export interface MapLocation {
  lat: number;
  lng: number;
}

export interface GeoPolygon {
  type: 'Feature';
  properties: {
    name: string;
    priority: 'high' | 'medium' | 'low';
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface SearchParameters {
  minSize?: number;
  maxPrice?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: string;
}

export interface AppStats {
  totalClients: number;
  clientsChange: number;
  totalProperties: number;
  propertiesChange: number;
  todayAppointments: number;
  appointmentsDiff: number;
  activeTasks: number;
  dueTodayTasks: number;
}

export interface GreetingTemplate {
  formal: string[];
  informal: string[];
}

export interface WhatsAppTemplate {
  type: 'property' | 'birthday' | 'followup';
  messages: string[];
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  defaultView: 'buyers' | 'sellers' | 'all';
}

export interface FilterOptions {
  clientType?: 'buyer' | 'seller' | 'all';
  propertyStatus?: 'available' | 'pending' | 'sold' | 'all';
  appointmentType?: 'visit' | 'call' | 'all';
  taskStatus?: 'pending' | 'completed' | 'all';
  priceRange?: [number, number];
  sizeRange?: [number, number];
  dateRange?: [Date, Date];
}

export interface MarketAnalytics {
  areaDistribution: {
    name: string;
    percentage: number;
  }[];
  priceRanges: {
    range: string;
    percentage: number;
  }[];
  sizeDistribution: {
    range: string;
    percentage: number;
  }[];
  trends: {
    month: string;
    prices: number;
    demand: number;
  }[];
}

export type ClientType = 'buyer' | 'seller';
export type PropertyStatus = 'available' | 'pending' | 'sold';
export type AppointmentType = 'visit' | 'call';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';
export type TaskType = 'followUp' | 'noResponse' | 'birthday' | 'reminder' | 'call_response' | 'generic_call' | 'client_conversation';
export type TaskStatus = 'pending' | 'completed' | 'cancelled';
export type ReligionType = 'christian' | 'jewish' | 'muslim' | 'hindu' | 'buddhist' | 'none' | 'other';
export type ContractType = 'rent' | 'sale';
export type UrgencyLevel = 1 | 2 | 3 | 4 | 5;
export type RatingLevel = 1 | 2 | 3 | 4 | 5;
