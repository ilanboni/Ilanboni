import type { Property, SharedProperty } from "@shared/schema";
import OpenAI from "openai";

/**
 * Sistema template messaggi per campagne WhatsApp Bot
 * 
 * Funzionalità:
 * - Parsing template con variabili personalizzabili ({{name}}, {{address}}, {{price}}, ecc.)
 * - Sostituzione variabili con dati property
 * - Generazione AI-powered per mirroring tono/stile descrizione originale
 */

interface TemplateVariables {
  name?: string;
  address?: string;
  price?: string;
  size?: string;
  rooms?: string;
  bathrooms?: string;
  floor?: string;
  propertyType?: string;
  description?: string;
  [key: string]: string | undefined;
}

/**
 * Estrae variabili disponibili da una proprietà
 */
export function extractVariablesFromProperty(
  property: Property | SharedProperty
): TemplateVariables {
  const formatPrice = (price: number | null): string => {
    if (!price) return "prezzo da concordare";
    return `€${price.toLocaleString("it-IT")}`;
  };

  const formatSize = (size: number | null): string => {
    if (!size) return "";
    return `${size}m²`;
  };

  const formatRooms = (rooms: number | null): string => {
    if (!rooms) return "";
    return `${rooms} ${rooms === 1 ? "locale" : "locali"}`;
  };

  const formatBathrooms = (bathrooms: number | null): string => {
    if (!bathrooms) return "";
    return `${bathrooms} ${bathrooms === 1 ? "bagno" : "bagni"}`;
  };

  const formatFloor = (floor: number | null): string => {
    if (floor === null) return "";
    if (floor === 0) return "piano terra";
    if (floor === -1) return "seminterrato";
    return `${floor}° piano`;
  };

  const formatPropertyType = (type: string): string => {
    const typeMap: Record<string, string> = {
      apartment: "appartamento",
      villa: "villa",
      house: "casa indipendente",
      loft: "loft",
      penthouse: "attico",
      studio: "monolocale",
      commercial: "locale commerciale",
      office: "ufficio",
      garage: "box/garage",
      land: "terreno",
      other: "immobile"
    };
    return typeMap[type] || type;
  };

  // Extract owner name from property if available
  const ownerName = "ownerName" in property ? property.ownerName : null;

  const rooms = "rooms" in property ? (property.rooms as number | null) : null;
  const floor = "floor" in property ? (typeof property.floor === 'string' ? null : property.floor as number | null) : null;
  const bathrooms = "bathrooms" in property ? property.bathrooms : null;
  const description = "description" in property ? property.description : null;
  const propertyType = "type" in property ? property.type : "apartment";

  // Estrae solo la via dall'indirizzo (rimuove città e dettagli)
  const extractStreetName = (fullAddress: string): string => {
    if (!fullAddress) return "";
    // Rimuove ", Milano" e tutto dopo (parentesi, dettagli, ecc.)
    const cleaned = fullAddress.replace(/,\s*Milano.*/i, "").replace(/\(.*?\)/g, "").trim();
    // Rimuove "Via " all'inizio se presente
    return cleaned.replace(/^Via\s+/i, "");
  };

  return {
    name: ownerName || "Gentile proprietario",
    address: property.address || "",
    via: extractStreetName(property.address || ""), // Nuova variabile per {{via}}
    price: formatPrice(property.price),
    size: formatSize(property.size),
    rooms: formatRooms(rooms),
    bathrooms: formatBathrooms(bathrooms),
    floor: formatFloor(floor),
    propertyType: formatPropertyType(propertyType || "apartment"),
    description: description || "",
    caratteristiche: "" // Verrà riempita dall'AI se attiva
  };
}

/**
 * Renderizza template sostituendo variabili {{name}} con valori
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  if (!template) {
    console.error('[renderTemplate] Template nullo o indefinito');
    return '';
  }
  
  let rendered = template;

  Object.keys(variables).forEach((key) => {
    const value = variables[key] || "";
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    rendered = rendered.replace(pattern, value);
  });

  // Rimuovi variabili non sostituite
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, "");

  // ✅ NUOVO: Preserva i paragrafi (doppi a capo) ma pulisci spazi multipli
  // 1. Sostituisci triple+ newline con doppio newline
  rendered = rendered.replace(/\n{3,}/g, "\n\n");
  
  // 2. Rimuovi spazi multipli SOLO all'interno delle righe (non i newline)
  rendered = rendered.split("\n").map(line => line.replace(/\s+/g, " ").trim()).join("\n");
  
  // 3. Rimuovi righe vuote multiple consecutive (max 1 riga vuota tra paragrafi)
  rendered = rendered.replace(/\n\s*\n\s*\n/g, "\n\n");
  
  return rendered.trim();
}

/**
 * Estrae caratteristiche chiave da descrizione immobile usando AI
 * 
 * Usa ChatGPT per identificare le 2-3 caratteristiche principali
 * che il proprietario ha evidenziato nell'annuncio.
 * 
 * @returns Stringa breve con caratteristiche (es: "grande terrazzo mansardato, molto luminoso e silenzioso, completamente arredato")
 */
export async function extractKeyFeatures(
  property: Property | SharedProperty
): Promise<string> {
  try {
    // Usa Replit AI Integrations (crediti Replit invece di API key personale)
    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });

    const propertyDescription = ("description" in property ? property.description : null) || "";

    if (!propertyDescription || propertyDescription.length < 50) {
      // Se non c'è descrizione sufficiente, restituisci caratteristiche generiche
      return "caratteristiche interessanti";
    }

    const systemPrompt = `Sei un assistente AI che analizza descrizioni di immobili per identificare le caratteristiche principali.

COMPITO:
Leggi la descrizione dell'immobile e identifica le 2-3 caratteristiche PRINCIPALI che il proprietario ha evidenziato.

REGOLE CRITICHE:
1. Estrai SOLO 2-3 caratteristiche chiave (non tutto)
2. Usa NOMI GENERICI senza metrature o dimensioni specifiche
3. FORMATO OBBLIGATORIO: "il/la/l' caratteristica1, il/la/l' caratteristica2"
4. SEMPRE con articolo determinativo (il, la, l')
5. In minuscolo
6. Breve e naturale (max 80 caratteri totali)
7. In italiano
8. IMPORTANTE: NON includere misure, metrature o numeri specifici

ESEMPI CORRETTI (nota: NO metrature):
- Descrizione: "...appartamento luminoso con balcone di 10mq vista parco..."
  OUTPUT: "la luminosità, il balcone con vista"

- Descrizione: "...terrazzo di 15mq mansardato... doppia esposizione... arredato..."
  OUTPUT: "il terrazzo, la doppia esposizione"

- Descrizione: "...box auto di 12mq e cantina di 8mq... teleriscaldamento..."
  OUTPUT: "il box e la cantina, il teleriscaldamento"

ERRORI DA EVITARE:
❌ "terrazzo di 15mq" → ✅ "il terrazzo"
❌ "box di 12mq" → ✅ "il box"
❌ "balcone da 10mq" → ✅ "il balcone"

IMPORTANTE: Restituisci SOLO la lista di caratteristiche GENERICHE CON ARTICOLI, senza misure.`;

    const userPrompt = `Descrizione immobile:
${propertyDescription}

Identifica ed estrai le 2-3 caratteristiche principali in formato con articoli: "il/la/l' caratteristica1, il/la/l' caratteristica2, il/la/l' caratteristica3"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5,
      max_completion_tokens: 100
    });

    const features = completion.choices[0]?.message?.content?.trim() || "caratteristiche interessanti";
    return features;
  } catch (error) {
    console.error("[extractKeyFeatures] Errore estrazione AI:", error);
    return "caratteristiche interessanti";
  }
}

/**
 * Genera messaggio finale combinando template e AI
 * 
 * 1. Se aiPowered = true, usa AI per estrarre caratteristiche e inserirle nel template
 * 2. Altrimenti, usa template rendering standard
 */
export async function generateCampaignMessage(
  property: Property | SharedProperty,
  template: string,
  aiPowered: boolean = false
): Promise<string> {
  // Estrai variabili base
  const variables = extractVariablesFromProperty(property);

  // Se AI è attivo, estrai caratteristiche chiave
  if (aiPowered) {
    const features = await extractKeyFeatures(property);
    variables.caratteristiche = features;
  }

  // Renderizza template con tutte le variabili
  return renderTemplate(template, variables);
}

/**
 * Valida template per verificare che usi variabili corrette
 */
export function validateTemplate(template: string): {
  isValid: boolean;
  errors: string[];
  variables: string[];
} {
  const errors: string[] = [];
  const variablePattern = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];

  const validVariables = [
    "name",
    "address",
    "via",
    "price",
    "size",
    "rooms",
    "bathrooms",
    "floor",
    "propertyType",
    "description",
    "caratteristiche"
  ];

  let match: RegExpExecArray | null;
  while ((match = variablePattern.exec(template)) !== null) {
    const variable = match[1].trim();
    variables.push(variable);

    if (!validVariables.includes(variable)) {
      errors.push(`Variabile non valida: {{${variable}}}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    variables
  };
}
