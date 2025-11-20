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
    // Usa Replit AI Integrations (crediti Replit invece di API key personale)
    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    });

    const variables = extractVariablesFromProperty(property);
    const propertyDescription = ("description" in property ? property.description : null) || "";

    const systemPrompt = `Sei un assistente AI che aiuta agenti immobiliari a personalizzare messaggi WhatsApp.

COMPITO CRITICO:
Riceverai un TEMPLATE BASE con la presentazione dell'agente (nome, ruolo, credenziali).
Devi ARRICCHIRE il messaggio aggiungendo riferimenti SPECIFICI alle caratteristiche dell'immobile.

REGOLE FONDAMENTALI:
1. MANTIENI INTATTA la parte di presentazione dell'agente (chi è, cosa fa)
2. AGGIUNGI dopo la presentazione i riferimenti specifici alle caratteristiche dell'annuncio
3. USA "feature mirroring": riprendi le ESATTE parole che il proprietario ha usato
4. Lunghezza totale: max 350 caratteri
5. In italiano, tono professionale ma naturale

ESEMPI di COMBINAZIONE CORRETTA:

Template base: "Buongiorno, sono Mario Rossi, agente immobiliare con 15 anni di esperienza..."
+ Features estratte: "grande terrazzo mansardato", "molto luminoso e silenzioso"
= OUTPUT: "Buongiorno, sono Mario Rossi, agente immobiliare con 15 anni di esperienza. Ho visto il suo annuncio e sono rimasto particolarmente colpito dal grande terrazzo mansardato e dal fatto che sia molto luminoso e silenzioso. Possiamo organizzare una chiamata?"

ERRORE DA EVITARE:
❌ NON generare un messaggio completamente nuovo ignorando il template
✅ COMBINA: template base + features specifiche`;

    const userPrompt = baseTemplate
      ? `STEP 1 - Template base da mantenere:
${baseTemplate}

STEP 2 - Descrizione immobile ORIGINALE (identifica le caratteristiche evidenziate):
${propertyDescription}

STEP 3 - Dati tecnici:
- Indirizzo: ${variables.address}
- Prezzo: ${variables.price}
- Dimensione: ${variables.size}

ISTRUZIONI PER LA COMBINAZIONE:
1. INIZIA con il template base ESATTAMENTE come è scritto (mantieni presentazione agente)
2. IDENTIFICA max 2-3 caratteristiche chiave che il proprietario ha evidenziato (es: "grande terrazzo mansardato", "molto luminoso e silenzioso", "completamente arredato")
3. AGGIUNGI dopo il template una frase tipo: "Ho visto il suo annuncio e sono rimasto colpito da [caratteristica 1] e [caratteristica 2]"
4. CHIUDI con call-to-action naturale (es: "Possiamo organizzare una chiamata?")

OUTPUT: Messaggio completo = Template base + Features specifiche + CTA`
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
      model: "gpt-4o-mini", // Usa gpt-4o-mini per costi ridotti (gpt-5 disponibile se serve)
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_completion_tokens: 200 // Aumentato per messaggi più ricchi
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
