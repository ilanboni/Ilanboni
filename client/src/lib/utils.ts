import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { GREETING_TEMPLATES, WHATSAPP_TEMPLATES } from "./constants";
import { GeoPolygon } from "../types";
import { Client, Property, SearchParameters, PropertyWithDetails, ClientWithDetails } from "@shared/schema";

// Merge class names with Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format price (alias for formatCurrency)
export function formatPrice(amount: number): string {
  return formatCurrency(amount);
}

// Format date
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Format time
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  return `${hours}:${minutes}`;
}

// Generate a formal or informal greeting based on client status
export function generateGreeting(client: Client): string {
  // Caso speciale per clienti generici
  if (client.firstName === 'Cliente' && client.salutation === 'Gentile') {
    return "Gentile Cliente";
  }
  
  // Determina se il saluto è amichevole in base al salutation
  const friendlySalutations = ['Cara', 'Caro', 'Ciao'];
  const isInformalSalutation = friendlySalutations.includes(client.salutation);
  
  // Se il saluto è amichevole, usa format amichevole con il nome
  if (isInformalSalutation) {
    return `${client.salutation} ${client.firstName}`;
  }
  
  // Altrimenti usa il formato formale con cognome
  return `${client.salutation} ${client.lastName}`;
}

// Get a random message template for WhatsApp
export function getRandomWhatsAppMessage(type: string): string {
  const template = WHATSAPP_TEMPLATES[type];
  if (!template) return "";
  
  const randomIndex = Math.floor(Math.random() * template.messages.length);
  return template.messages[randomIndex];
}

// Convert client's search area to GeoJSON polygon
export function searchAreaToGeoJSON(searchArea: any, clientName: string, priority: string): GeoPolygon | null {
  if (!searchArea || !searchArea.coordinates) return null;
  
  return {
    type: 'Feature',
    properties: {
      name: `Area di ricerca: ${clientName}`,
      priority: priority as 'high' | 'medium' | 'low'
    },
    geometry: {
      type: 'Polygon',
      coordinates: searchArea.coordinates
    }
  };
}

// Calculate match percentage between property and buyer's requirements
export function calculateMatchPercentage(
  property: Property,
  searchParams: SearchParameters
): number {
  let matchPoints = 0;
  let totalPoints = 0;
  
  // Size match (30% weight)
  if (searchParams.minSize) {
    totalPoints += 30;
    if (property.size >= searchParams.minSize) {
      matchPoints += 30;
    }
  }
  
  // Price match (40% weight)
  if (searchParams.maxPrice) {
    totalPoints += 40;
    if (property.price <= searchParams.maxPrice) {
      matchPoints += 40;
    } else {
      // Partial match if within 10% above max price
      const priceDifference = (property.price - searchParams.maxPrice) / searchParams.maxPrice;
      if (priceDifference <= 0.1) {
        matchPoints += Math.floor(40 * (1 - priceDifference * 10));
      }
    }
  }
  
  // Property type match (15% weight)
  if (searchParams.propertyType) {
    totalPoints += 15;
    if (property.type === searchParams.propertyType) {
      matchPoints += 15;
    }
  }
  
  // Bedrooms match (10% weight)
  if (searchParams.bedrooms && property.bedrooms) {
    totalPoints += 10;
    if (property.bedrooms >= searchParams.bedrooms) {
      matchPoints += 10;
    }
  }
  
  // Bathrooms match (5% weight)
  if (searchParams.bathrooms && property.bathrooms) {
    totalPoints += 5;
    if (property.bathrooms >= searchParams.bathrooms) {
      matchPoints += 5;
    }
  }
  
  // Calculate percentage
  return totalPoints > 0 ? Math.round((matchPoints / totalPoints) * 100) : 0;
}

// Get property status color
export function getStatusColor(status: string): string {
  switch (status) {
    case "available":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "sold":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Format client type for display
export function formatClientType(type: string): string {
  return type === "buyer" ? "Compratore" : "Venditore";
}

// Format appointment type for display
export function formatAppointmentType(type: string): string {
  return type === "visit" ? "Visita" : "Telefonata";
}

// Calculate days left until date
export function getDaysUntil(date: Date | string): number {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  const today = new Date();
  
  // Reset time part for accurate day calculation
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Check if a point is inside a polygon
export function isPointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  // Implementation of ray casting algorithm for point-in-polygon test
  const [lng, lat] = point;
  const polyCoords = polygon[0]; // Assuming single polygon
  
  let inside = false;
  for (let i = 0, j = polyCoords.length - 1; i < polyCoords.length; j = i++) {
    const [xi, yi] = polyCoords[i];
    const [xj, yj] = polyCoords[j];
    
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

// Get today's date in YYYY-MM-DD format
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// Get current time in HH:MM format
export function getCurrentTimeString(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// Safely format date with a fallback value
export function safeFormatDate(dateValue: string | Date | null | undefined, formatStr: string = "dd/MM/yyyy", fallback: string = "Data non disponibile"): string {
  if (!dateValue) return fallback;
  
  try {
    const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return fallback;
    
    // Import dynamically to avoid bundling issues
    const { format } = require('date-fns');
    return format(date, formatStr);
  } catch (e) {
    console.error("Errore formattazione data:", e);
    return fallback;
  }
}
