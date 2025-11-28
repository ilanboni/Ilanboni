import OpenAI from "openai";

// Use Replit AI Integrations (no personal API key needed)
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

/**
 * Classifica se un annuncio immobiliare è di un'agenzia o di un privato
 * basandosi sull'analisi della descrizione
 * @param description La descrizione dell'immobile
 * @returns 'agency' | 'private' | 'unknown'
 */
export async function classifyPropertyOwnerType(description: string): Promise<'agency' | 'private' | 'unknown'> {
  if (!description || description.trim().length < 50) {
    return 'unknown';
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Sei un esperto di annunci immobiliari italiani. Analizza la descrizione e determina se l'annuncio è stato scritto da:
- "agency": Un'agenzia immobiliare (linguaggio professionale, riferimenti a "contattateci", "proponiamo", "il nostro team", codici riferimento, menzione di servizi, tono commerciale)
- "private": Un privato cittadino (linguaggio informale, prima persona singolare "vendo la mia casa", descrizione personale)
- "unknown": Non è possibile determinarlo con certezza

Rispondi SOLO con una di queste parole: agency, private, unknown`
        },
        {
          role: "user",
          content: description.substring(0, 2000)
        }
      ],
      max_completion_tokens: 10,
      temperature: 0.1,
    });

    const result = response.choices[0].message.content?.trim().toLowerCase();
    
    if (result === 'agency' || result === 'private' || result === 'unknown') {
      return result;
    }
    return 'unknown';
  } catch (error) {
    console.error("[AI] Errore classificazione owner type:", error);
    return 'unknown';
  }
}

/**
 * Genera un riassunto conciso di un messaggio
 * @param text Il testo da riassumere
 * @returns Un riassunto breve del testo
 */
export async function summarizeText(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Sei un assistente che genera riassunti brevi e concisi in italiano. Riassumi il messaggio in non più di 50 caratteri, mantenendo le informazioni chiave."
        },
        {
          role: "user",
          content: text
        }
      ],
      max_completion_tokens: 50,
      temperature: 0.5,
    });

    return response.choices[0].message.content || "Riassunto non disponibile";
  } catch (error) {
    console.error("Errore durante la generazione del riassunto:", error);
    return "Errore nella generazione del riassunto";
  }
}