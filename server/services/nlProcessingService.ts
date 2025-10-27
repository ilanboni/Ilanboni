import OpenAI from "openai";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface PropertyFilters {
  dealType: "sale" | "rent";
  propertyType: "apartment" | "house" | "office" | "other";
  budgetMax: number | null;
  sizeMin: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floorMin: number | null;
  zones: string[];
  condition: "to_renovate" | "new_or_renovated" | null;
  features: {
    elevator: boolean;
    balconyOrTerrace: boolean;
    parking: boolean;
    garden: boolean;
  };
}

const DEFAULT_FILTERS: PropertyFilters = {
  dealType: "sale",
  propertyType: "apartment",
  budgetMax: null,
  sizeMin: null,
  rooms: null,
  bathrooms: null,
  floorMin: null,
  zones: [],
  condition: null,
  features: {
    elevator: false,
    balconyOrTerrace: false,
    parking: false,
    garden: false
  }
};

export async function nlToFilters(text: string): Promise<PropertyFilters> {
  try {
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Sei un assistente immobiliare specializzato nel mercato di Milano. Estrai dati strutturati da richieste in italiano. Rispondi SOLO con JSON valido."
        },
        {
          role: "user",
          content: `Analizza questa richiesta immobiliare e restituisci un JSON con:
{
  "deal_type": "sale|rent",
  "property_type": "apartment|house|office|other",
  "budget_max": number|null,
  "size_min": number|null,
  "rooms": number|null,
  "bathrooms": number|null,
  "floor_min": number|null,
  "zones": string[] (nomi quartieri Milano se presenti, es. ["Isola", "Porta Romana"]),
  "condition": "to_renovate|new_or_renovated|null",
  "features": { "elevator": boolean, "balcony_or_terrace": boolean, "parking": boolean, "garden": boolean }
}

Regole:
- "bilocale" = 2 rooms, "trilocale" = 3 rooms, "quadrilocale" = 4 rooms
- Se dice "piano almeno X" o "piano ≥X", metti floor_min: X
- Se dice "balcone" o "terrazzo", metti balcony_or_terrace: true
- Converti budget in euro (es. "500k" = 500000)
- Converti superfici in mq (es. "80 mq" = 80)
- Riconosci zone di Milano (Isola, Porta Romana, Brera, Navigli, etc.)

Testo richiesta cliente:
${text}`
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[NL-PROCESSING] No content from OpenAI");
      return DEFAULT_FILTERS;
    }

    const parsed = JSON.parse(content);

    const filters: PropertyFilters = {
      dealType: parsed.deal_type || DEFAULT_FILTERS.dealType,
      propertyType: parsed.property_type || DEFAULT_FILTERS.propertyType,
      budgetMax: parsed.budget_max !== undefined && parsed.budget_max !== null ? Number(parsed.budget_max) : null,
      sizeMin: parsed.size_min !== undefined && parsed.size_min !== null ? Number(parsed.size_min) : null,
      rooms: parsed.rooms !== undefined && parsed.rooms !== null ? Number(parsed.rooms) : null,
      bathrooms: parsed.bathrooms !== undefined && parsed.bathrooms !== null ? Number(parsed.bathrooms) : null,
      floorMin: parsed.floor_min !== undefined && parsed.floor_min !== null ? Number(parsed.floor_min) : null,
      zones: Array.isArray(parsed.zones) ? parsed.zones : DEFAULT_FILTERS.zones,
      condition: parsed.condition || null,
      features: {
        elevator: parsed.features?.elevator || false,
        balconyOrTerrace: parsed.features?.balcony_or_terrace || false,
        parking: parsed.features?.parking || false,
        garden: parsed.features?.garden || false
      }
    };

    console.log("[NL-PROCESSING] Parsed filters:", JSON.stringify(filters, null, 2));
    return filters;

  } catch (error) {
    console.error("[NL-PROCESSING] Error parsing NL request:", error);
    return DEFAULT_FILTERS;
  }
}
