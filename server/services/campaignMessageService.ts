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

  return {
    name: ownerName || "Gentile proprietario",
    address: property.address || "",
    price: formatPrice(property.price),
    size: formatSize(property.size),
    rooms: formatRooms(rooms),
    bathrooms: formatBathrooms(bathrooms),
    floor: formatFloor(floor),
    propertyType: formatPropertyType(propertyType || "apartment"),
    description: description || ""
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

  // Pulisci spazi multipli e linee vuote
  rendered = rendered.replace(/\s+/g, " ").trim();
  rendered = rendered.replace(/\n\s*\n/g, "\n");

  return rendered;
}

/**
 * Genera messaggio AI-powered con mirroring tono/stile
 * 
 * Usa ChatGPT per generare un messaggio che:
 * - Rispecchia il tono della descrizione originale
 * - Include informazioni chiave dalla property
 * - Mantiene uno stile professionale ma amichevole
 */
export async function generateAIPoweredMessage(
  property: Property | SharedProperty,
  baseTemplate?: string
): Promise<string> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const variables = extractVariablesFromProperty(property);
    const propertyDescription = ("description" in property ? property.description : null) || "";

    const systemPrompt = `Sei un assistente AI che aiuta agenti immobiliari a scrivere messaggi WhatsApp personalizzati per proprietari privati.

Il tuo compito è generare un messaggio:
1. Breve e conversazionale (max 250 caratteri)
2. Professionale ma amichevole e naturale
3. CRITICO: Analizza la descrizione originale e identifica le caratteristiche che il proprietario ha evidenziato come importanti
4. Riprendi quelle stesse caratteristiche nel messaggio, dimostrando che le hai notate e apprezzate
5. Usa un linguaggio naturale, come se stessi commentando specificamente quello che hai visto nell'annuncio
6. In italiano

ESEMPI di feature mirroring:
- Se descrizione dice "luminoso e ristrutturato" → "sono rimasto impressionato dalla luminosità e dal fatto che sia già pronto per essere abitato"
- Se descrizione dice "balcone vista parco" → "in particolare mi ha colpito il balcone con vista sul verde"
- Se descrizione dice "silenzioso, zona tranquilla" → "ho notato che è in una zona molto tranquilla, perfetto per i miei clienti"

NON includere:
- Saluti formali eccessivi
- Frasi generiche tipo "bel immobile"
- Richieste di appuntamento immediate`;

    const userPrompt = baseTemplate
      ? `Template base: ${baseTemplate}

Descrizione immobile ORIGINALE (analizza bene per identificare le caratteristiche evidenziate dal proprietario): 
${propertyDescription}

Caratteristiche tecniche:
- Indirizzo: ${variables.address}
- Tipologia: ${variables.propertyType}
- Prezzo: ${variables.price}
- Dimensione: ${variables.size}
${variables.rooms ? `- Locali: ${variables.rooms}` : ""}

IMPORTANTE: 
1. Prima identifica quali caratteristiche il proprietario ha evidenziato nella descrizione originale (es: luminoso, ristrutturato, vista, balcone, silenzioso, ecc.)
2. Poi genera il messaggio riprendendo QUELLE SPECIFICHE caratteristiche con parole tue, come se le avessi notate tu stesso
3. Usa il template base come struttura ma personalizza fortemente con le feature identificate

Genera il messaggio personalizzato.`
      : `Descrizione immobile ORIGINALE (analizza bene per identificare le caratteristiche evidenziate dal proprietario): 
${propertyDescription}

Caratteristiche tecniche:
- Indirizzo: ${variables.address}
- Tipologia: ${variables.propertyType}
- Prezzo: ${variables.price}
- Dimensione: ${variables.size}
${variables.rooms ? `- Locali: ${variables.rooms}` : ""}

IMPORTANTE: 
1. Prima identifica quali caratteristiche il proprietario ha evidenziato nella descrizione originale (es: luminoso, ristrutturato, vista, balcone, silenzioso, ecc.)
2. Poi genera il messaggio riprendendo QUELLE SPECIFICHE caratteristiche con parole tue, come se le avessi notate tu stesso
3. Dimostra che hai letto l'annuncio con attenzione

Genera il messaggio WhatsApp personalizzato.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    return completion.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("[generateAIPoweredMessage] Errore generazione AI:", error);
    // Fallback al template base se AI fallisce
    return "";
  }
}

/**
 * Genera messaggio finale combinando template e AI
 * 
 * 1. Se aiPowered = true, usa AI per generare messaggio completo
 * 2. Altrimenti, usa template rendering standard
 */
export async function generateCampaignMessage(
  property: Property | SharedProperty,
  template: string,
  aiPowered: boolean = false
): Promise<string> {
  if (aiPowered) {
    const aiMessage = await generateAIPoweredMessage(property, template);
    if (aiMessage) return aiMessage;
  }

  // Fallback: template rendering standard
  const variables = extractVariablesFromProperty(property);
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
    "price",
    "size",
    "rooms",
    "bathrooms",
    "floor",
    "propertyType",
    "description"
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
