import OpenAI from "openai";

// Use Replit AI Integrations (no personal API key needed)
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

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