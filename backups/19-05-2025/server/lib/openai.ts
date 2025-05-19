import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY non impostata. Alcune funzionalità AI non saranno disponibili.");
}

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Genera un riassunto conciso di un messaggio
 * @param text Il testo da riassumere
 * @returns Un riassunto breve del testo
 */
export async function summarizeText(text: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return "Riassunto non disponibile (API key mancante)";
  }

  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
      max_tokens: 50,
      temperature: 0.5,
    });

    return response.choices[0].message.content || "Riassunto non disponibile";
  } catch (error) {
    console.error("Errore durante la generazione del riassunto:", error);
    return "Errore nella generazione del riassunto";
  }
}