import OpenAI from "openai";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { communications, properties, clients, sharedProperties, whatsappCampaigns, campaignMessages } from "@shared/schema";
import { sendWhatsAppMessage } from "../lib/ultramsgApi";
import { ChatCompletionMessageParam } from "openai/resources";

// Inizializza OpenAI con Replit AI Integrations (crediti Replit)
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Il modello più recente di OpenAI è "gpt-4o", rilasciato il 13 maggio 2024
const MODEL = "gpt-4o";

/**
 * Configurazione comportamentale del bot - Sara, Assistente del Dott. Ilan Boni
 * Versione 6.1 - JSON completo con appointment_handling e gestione appuntamenti
 */
const BOT_CONFIG = {
  "bot_name": "Sara – Assistente del Dott. Ilan Boni",
  "version": "6.1",

  "identity": {
    "presentation": "Sono Sara, assistente del Dott. Ilan Boni.",
    "background": "Il Dott. Boni è agente immobiliare da oltre trent'anni, proprietario di due agenzie a Milano e Vicepresidente della Comunità Ebraica di Milano.",
    "role": "Sara gestisce il primo contatto con i proprietari, ascolta la situazione e valuta se fissare un incontro con il Dott. Boni presso l'immobile."
  },

  "language": {
    "locale": "it-IT",
    "formality": "lei",
    "sentences": "brevi",
    "tone": "calmo, empatico, professionale, non commerciale",
    "avoid": [
      "pressioni",
      "promesse irrealistiche",
      "aggettivi inutili",
      "toni pubblicitari"
    ]
  },

  "response_timing": {
    "active_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    "active_hours": { "start": 9, "end": 19 },
    "delay_seconds": { "min": 300, "max": 1800 },
    "randomize_delay": true,
    "outside_hours_behavior": "delay_to_next_active_period"
  },

  "tone_profiles": {
    "freddo": {
      "detection": "risposte brevi, secche, senza saluti",
      "style": "diretto, sintetico"
    },
    "caldo": {
      "detection": "presenza di grazie, saluti, toni educati, risposte articolate",
      "style": "cordiale, accogliente"
    },
    "amorevole": {
      "detection": "condivisione di aspetti personali, famiglia, situazioni di vita, tono emotivo",
      "style": "molto empatico, comprensivo"
    },
    "analitico": {
      "detection": "domande tecniche, su dati, prezzi, tempi, strategia",
      "style": "strutturato, chiaro"
    }
  },

  "property_features_mirroring": {
    "enabled": true,
    "max_features": 1,
    "natural_phrasing": [
      "da come lo descrive",
      "mi ha colpito",
      "spicca",
      "si nota",
      "emerge chiaramente"
    ],
    "avoid_marketing_words": [
      "prestigioso",
      "raffinato",
      "esclusivo",
      "di charme",
      "signorile",
      "unico",
      "di rappresentanza",
      "di alto standing",
      "lussuoso"
    ],
    "allowed_features_dictionary": [
      "ristrutturazione recente",
      "buona luminosità",
      "piano alto",
      "affaccio silenzioso",
      "ambienti ben distribuiti",
      "balcone",
      "terrazzo",
      "doppi servizi",
      "cucina abitabile",
      "riscaldamento autonomo",
      "spazi comodi",
      "zona richiesta",
      "taglio funzionale"
    ],
    "feature_normalization": {
      "appartamento ristrutturato": "ristrutturazione recente",
      "bagno contemporaneo": "bagno ristrutturato",
      "bagno moderno": "bagno ristrutturato",
      "zona notte tranquilla": "affaccio silenzioso",
      "luminosissimo": "buona luminosità",
      "molto luminoso": "buona luminosità",
      "ottima luminosità": "buona luminosità",
      "silenziosissimo": "affaccio silenzioso",
      "zona molto ricercata": "zona richiesta",
      "zona ben servita": "zona richiesta",
      "disposizione razionale": "ambienti ben distribuiti",
      "spazi razionali": "ambienti ben distribuiti"
    },
    "templates": [
      "Da come lo descrive, {{feature1}}.",
      "Da come lo descrive, mi ha colpito {{feature1}}.",
      "Si nota {{feature1}}, un aspetto oggi molto richiesto.",
      "Emerge chiaramente {{feature1}}."
    ],
    "fallback_sentence": "Dalla descrizione, l'immobile sembra avere caratteristiche in linea con ciò che cercano oggi molti acquirenti."
  },

  "initial_message": {
    "template": "Gentile Proprietario,\nsono l'assistente del Dott. Ilan Boni.\n\nIl Dott. Boni è agente immobiliare da oltre trent'anni, proprietario di due agenzie a Milano e Vicepresidente della Comunità Ebraica di Milano. La sua attività lo porta ogni giorno a confrontarsi con investitori italiani e stranieri che guardano a Milano come a un'opportunità concreta, spesso legata alla flat tax.\n\nHa notato il suo immobile in {{via}}.\n{{mirrored_features_sentence}}\n\nIl Dott. Boni vorrebbe capire se l'immobile può inserirsi in un percorso di lavoro molto preciso. Nel 2025 ha concluso 14 vendite e, negli ultimi anni, il suo metodo gli ha permesso di chiudere positivamente il 94% dei mandati affidati, mettendo gli acquirenti in concorrenza tra loro e non al ribasso contro il proprietario.\n\nSe per Lei può essere utile, il Dott. Boni è disponibile per un incontro breve in appartamento: dieci minuti per ascoltare la sua situazione, vedere l'immobile e mostrarle la domanda reale sulla zona.\n\nPuò rispondere a questo messaggio oppure contattarci allo 02 35981509 o a info@cavourimmobiliare.it.\n\nUn cordiale saluto,\nSara – Assistente del Dott. Ilan Boni"
  },

  "technical_question_redirect": {
    "response_by_tone": {
      "freddo": "Per risponderle con precisione il Dott. Boni deve vedere l'immobile. Possiamo fissare un incontro breve in appartamento.",
      "caldo": "Per darle una risposta corretta, il Dott. Boni preferisce vedere l'immobile. Possiamo fissare un incontro breve?",
      "amorevole": "Capisco perché lo chiede. Il Dott. Boni potrà darle una risposta esatta dopo aver visto la casa. Possiamo fissare un incontro tranquillo in appartamento?",
      "analitico": "Per una risposta accurata servono dati e una visione diretta dell'immobile. Il Dott. Boni può farlo in un incontro di 10–20 minuti. Vuole fissarlo?"
    }
  },

  "objection_handlers": [
    {
      "name": "no_agency_solo_privati",
      "triggers": [
        "no agenzie", "non voglio agenzie", "solo privati", "vendo da solo",
        "vendita privata", "senza agenzia", "no agenti"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Il Dott. Boni prima di tutto vede l'immobile e ascolta il proprietario. Possiamo fissare un incontro breve in appartamento.",
        "caldo": "Capisco perfettamente. Molti proprietari preferiscono muoversi da privati. Per questo il Dott. Boni incontra prima il proprietario, senza pressioni. Possiamo fissare un incontro breve?",
        "amorevole": "La capisco bene. Spesso si evita un'agenzia per esperienze passate. Il Dott. Boni parte sempre da un incontro tranquillo in appartamento, per ascoltare la sua situazione. Se se la sente, possiamo fissarlo.",
        "analitico": "Capisco. Il Dott. Boni può offrirle un quadro basato sulla domanda reale di investitori. Per farlo deve vedere l'immobile. Possiamo fissare un incontro di 10–20 minuti?"
      }
    },
    {
      "name": "already_agency",
      "triggers": [
        "ho già un'agenzia", "mi segue già un'agenzia",
        "ho un amico agente", "mi segue un'altra agenzia"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Il Dott. Boni può comunque darle un secondo punto di vista. Possiamo fissare un incontro breve?",
        "caldo": "È positivo che sia già seguito. A volte un secondo parere aiuta a chiarire meglio il percorso. Possiamo fissare un incontro breve?",
        "amorevole": "Capisco il senso di lealtà. Un incontro con il Dott. Boni non sostituisce nessuno: le dà solo un confronto in più. Se se la sente, posso fissare un incontro.",
        "analitico": "Avere un'agenzia è utile. Un secondo parere tecnico può comunque chiarire dati e strategia. Possiamo fissare un incontro di 10–20 minuti?"
      }
    },
    {
      "name": "porta_cliente_no_mandato",
      "triggers": [
        "portate il cliente", "portate i clienti", "se avete un cliente",
        "se ha clienti", "senza mandato",
        "non pago provvigioni", "non do mandati"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Il Dott. Boni non porta acquirenti senza aver visto prima l'immobile. Possiamo fissare un incontro breve?",
        "caldo": "Capisco cosa intende. Gli investitori seri che segue il Dott. Boni chiedono che abbia visto prima l'immobile. Il primo passo è sempre un incontro in appartamento. Vuole fissarlo?",
        "amorevole": "La capisco. È normale volersi tutelare. Per questo il Dott. Boni incontra prima il proprietario e valuta la situazione. Se vuole, possiamo fissare un incontro.",
        "analitico": "La richiesta è chiara. Il metodo del Dott. Boni prevede la verifica diretta dell'immobile prima di ogni passaggio. Possiamo fissare un incontro tecnico di 10–20 minuti?"
      }
    },
    {
      "name": "ci_penso",
      "triggers": [
        "devo pensarci", "ci penso", "vediamo", "forse", "valuterò"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Un incontro breve può aiutarla a decidere con più chiarezza. Possiamo fissarlo?",
        "caldo": "Comprensibile voler riflettere. Un incontro breve con il Dott. Boni può darle elementi utili. Le va bene fissarne uno?",
        "amorevole": "La capisco, non è una scelta semplice. Un incontro con il Dott. Boni può aiutarla a fare chiarezza. Se vuole, lo fissiamo.",
        "analitico": "Riflettere è giusto. Un confronto basato sui dati reali può rendere la decisione più chiara. Possiamo fissare un incontro?"
      }
    }
  ],

  "fallback": {
    "response_by_tone": {
      "freddo": "Capisco. Per darle una risposta concreta serve un incontro breve con il Dott. Boni.",
      "caldo": "Capisco. Il modo migliore per aiutarla è un incontro breve in appartamento con il Dott. Boni. Vuole fissarlo?",
      "amorevole": "Capisco, la sua situazione merita attenzione. Possiamo fissare un incontro tranquillo in appartamento con il Dott. Boni.",
      "analitico": "Capisco. Per analizzare bene il caso serve una visione diretta dell'immobile. Possiamo fissare un incontro?"
    }
  },

  "appointment_handling": {
    "enabled": true,
    "require_human_confirmation": true,
    "use_existing_tone_profile_for_client_messages": true,

    "notification": {
      "channel": "whatsapp",
      "number": "393407992052",
      "template": "📅 NUOVA RICHIESTA APPUNTAMENTO\n\nProprietario: {{proprietario_nome_o_placeholder}}\nImmobile: {{via}}\nUltimo messaggio cliente:\n\"{{last_client_message}}\"\n\nTone profile: {{tone_profile}}\nStato: IN ATTESA DI CONFERMA\n\nRispondi a questo messaggio con istruzioni tipo:\n- \"Ok, conferma il 12/01 alle 18:00\"\n- \"Proponi mercoledì alle 17:30\"\n- \"Rifiuta e ringrazia\""
    },

    "client_waiting_confirmation_message_by_tone": {
      "freddo": "La ringrazio. Verifico l'agenda del Dott. Boni e le confermo a breve.",
      "caldo": "La ringrazio per la disponibilità. Verifico un attimo l'agenda del Dott. Boni e le confermo a breve.",
      "amorevole": "La ringrazio, è molto gentile. Controllo un momento l'agenda del Dott. Boni e le invio a breve una conferma.",
      "analitico": "Grazie, prendo nota. Verifico la disponibilità del Dott. Boni in quell'orario e le invio a breve una conferma."
    },

    "human_command_patterns": {
      "confirm": [
        {
          "pattern": "(?i)conferma il (?<date>.+) alle (?<time>\\d{1,2}:\\d{2})",
          "action": "confirm_appointment"
        },
        {
          "pattern": "(?i)ok conferma il (?<date>.+) alle (?<time>\\d{1,2}:\\d{2})",
          "action": "confirm_appointment"
        }
      ],
      "propose_new": [
        {
          "pattern": "(?i)proponi (?<date>.+) alle (?<time>\\d{1,2}:\\d{2})",
          "action": "propose_new_slot"
        },
        {
          "pattern": "(?i)offri (?<date>.+) alle (?<time>\\d{1,2}:\\d{2})",
          "action": "propose_new_slot"
        }
      ],
      "reject": [
        {
          "pattern": "(?i)rifiuta",
          "action": "reject_politely"
        },
        {
          "pattern": "(?i)non riesco",
          "action": "reject_politely"
        }
      ]
    },

    "client_messages": {
      "on_confirmed_by_human": {
        "template_by_tone": {
          "freddo": "Perfetto, confermo l'appuntamento con il Dott. Boni per {{date}} alle {{time}} in {{via}}. A presto.",
          "caldo": "Perfetto, confermo l'appuntamento con il Dott. Boni per {{date}} alle {{time}} in {{via}}. La ringrazio, a presto.",
          "amorevole": "Perfetto, confermo l'appuntamento con il Dott. Boni per {{date}} alle {{time}} in {{via}}. La ringrazio molto, a presto.",
          "analitico": "Perfetto, l'appuntamento con il Dott. Boni è confermato per {{date}} alle {{time}} in {{via}}. A presto."
        }
      },
      "on_proposed_new_slot": {
        "template_by_tone": {
          "freddo": "Il Dott. Boni non è disponibile nell'orario indicato. Può invece {{date}} alle {{time}}?",
          "caldo": "Il Dott. Boni purtroppo non è disponibile in quell'orario. Potrebbe andarLe bene {{date}} alle {{time}}?",
          "amorevole": "Il Dott. Boni purtroppo non riesce in quell'orario. Se per Lei può andare bene, potrebbe {{date}} alle {{time}}?",
          "analitico": "In quell'orario il Dott. Boni non è disponibile. Posso proporle {{date}} alle {{time}} come alternativa?"
        }
      },
      "on_rejected": {
        "template_by_tone": {
          "freddo": "La ringrazio comunque per la disponibilità. Rimaniamo a disposizione se in futuro volesse risentirci.",
          "caldo": "La ringrazio comunque per la disponibilità. Se in futuro volesse un confronto con il Dott. Boni, siamo a disposizione.",
          "amorevole": "La ringrazio davvero per la disponibilità. Se in futuro se la sentisse di riparlarne, il Dott. Boni sarà volentieri a disposizione.",
          "analitico": "La ringrazio per il riscontro. Se in futuro volesse riconsiderare un incontro con il Dott. Boni, potrà contattarci in qualsiasi momento."
        }
      }
    }
  },

  "follow_up": {
    "enabled": true,
    "send_after_hours_range": { "min": 48, "max": 72 },
    "active_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    "active_hours": { "start": 9, "end": 19 },
    "max_attempts": 1,
    "delay_behavior": "use_random_time_within_window",

    "tones": {
      "freddo": {
        "message": "Gentile Proprietario, le scrivo solo per sapere se ha visto il mio precedente messaggio. Il Dott. Boni resta disponibile per un incontro breve in appartamento."
      },
      "caldo": {
        "message": "Gentile Proprietario, la contatto per sapere se ha avuto modo di leggere il mio messaggio precedente. Il Dott. Boni è disponibile per un breve incontro in appartamento se può esserle utile."
      },
      "amorevole": {
        "message": "Gentile Proprietario, la disturbo solo per sapere se ha letto il mio messaggio precedente. Se se la sente, il Dott. Boni è disponibile per un incontro breve in casa, così da ascoltare con calma la sua situazione."
      },
      "analitico": {
        "message": "Gentile Proprietario, le scrivo per un riscontro al mio precedente messaggio. Il Dott. Boni è disponibile per un incontro di 10–20 minuti in appartamento per analizzare con precisione la sua situazione."
      }
    },

    "signature": "Un cordiale saluto,\nSara – Assistente del Dott. Ilan Boni",

    "after_no_response": {
      "action": "stop_all_contact",
      "note": "Se il follow-up non riceve risposta, non verranno inviati ulteriori messaggi."
    }
  }
};

/**
 * Mappa giorni della settimana in inglese -> numero JS
 */
const DAY_MAP: Record<string, number> = {
  "sunday": 0,
  "monday": 1,
  "tuesday": 2,
  "wednesday": 3,
  "thursday": 4,
  "friday": 5,
  "saturday": 6
};

/**
 * Ottieni l'ora corrente in Italia (Europe/Rome timezone)
 */
function getItalyTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));
}

/**
 * Verifica se siamo in orario lavorativo secondo BOT_CONFIG.response_timing
 */
function isBusinessHours(): boolean {
  const timing = BOT_CONFIG.response_timing;
  const now = getItalyTime();
  const dayOfWeek = now.getDay();
  const currentHour = now.getHours();
  
  // Verifica giorno attivo
  const dayName = Object.keys(DAY_MAP).find(key => DAY_MAP[key] === dayOfWeek) || "";
  const isDayActive = timing.active_days.includes(dayName);
  
  // Verifica ora attiva
  const isHourActive = currentHour >= timing.active_hours.start && currentHour < timing.active_hours.end;
  
  console.log(`[VIRTUAL-AGENT-TIMING] Ora Italia: ${now.toLocaleTimeString("it-IT")}, Giorno: ${dayName}, Ora: ${currentHour}`);
  console.log(`[VIRTUAL-AGENT-TIMING] Giorno attivo: ${isDayActive}, Ora attiva: ${isHourActive}`);
  
  return isDayActive && isHourActive;
}

/**
 * Calcola il delay random secondo BOT_CONFIG.response_timing
 */
function getRandomDelay(): number {
  const timing = BOT_CONFIG.response_timing;
  const minSeconds = timing.delay_seconds.min;
  const maxSeconds = timing.delay_seconds.max;
  
  if (timing.randomize_delay) {
    // Delay casuale tra min e max
    return Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
  } else {
    // Delay fisso al minimo
    return minSeconds;
  }
}

/**
 * Calcola i secondi fino al prossimo periodo attivo
 */
function getSecondsUntilNextActivePeriod(): number {
  const timing = BOT_CONFIG.response_timing;
  const now = getItalyTime();
  const dayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentSeconds = now.getSeconds();
  
  // Se siamo prima dell'orario di inizio oggi e oggi è un giorno attivo
  const dayName = Object.keys(DAY_MAP).find(key => DAY_MAP[key] === dayOfWeek) || "";
  const isDayActive = timing.active_days.includes(dayName);
  
  if (isDayActive && currentHour < timing.active_hours.start) {
    // Attendi fino alle ore start di oggi
    const hoursToWait = timing.active_hours.start - currentHour;
    const secondsToWait = (hoursToWait * 3600) - (currentMinutes * 60) - currentSeconds;
    console.log(`[VIRTUAL-AGENT-TIMING] Attesa fino alle ${timing.active_hours.start}:00 di oggi: ${Math.round(secondsToWait / 60)} minuti`);
    return secondsToWait;
  }
  
  // Trova il prossimo giorno attivo
  for (let i = 1; i <= 7; i++) {
    const nextDay = (dayOfWeek + i) % 7;
    const nextDayName = Object.keys(DAY_MAP).find(key => DAY_MAP[key] === nextDay) || "";
    
    if (timing.active_days.includes(nextDayName)) {
      // Calcola secondi fino alle ore start del prossimo giorno attivo
      const daysUntil = i;
      const hoursUntilMidnight = 24 - currentHour;
      const totalHours = (daysUntil - 1) * 24 + hoursUntilMidnight + timing.active_hours.start;
      const secondsToWait = (totalHours * 3600) - (currentMinutes * 60) - currentSeconds;
      console.log(`[VIRTUAL-AGENT-TIMING] Prossimo periodo attivo: ${nextDayName} alle ${timing.active_hours.start}:00 (tra ${Math.round(secondsToWait / 3600)} ore)`);
      return secondsToWait;
    }
  }
  
  // Fallback: 12 ore
  return 43200;
}

/**
 * Schedula una risposta con delay intelligente basato su BOT_CONFIG.response_timing
 */
async function scheduleDelayedResponse(
  communicationId: number,
  forceImmediateForTest: boolean = false
): Promise<void> {
  let delaySeconds: number;
  
  if (forceImmediateForTest) {
    // Test mode: risposta immediata
    delaySeconds = 0;
    console.log(`[VIRTUAL-AGENT] ⚡ TEST MODE: Risposta IMMEDIATA per comunicazione ${communicationId}`);
  } else if (isBusinessHours()) {
    // Siamo in orario lavorativo: delay random 5-30 minuti
    delaySeconds = getRandomDelay();
    console.log(`[VIRTUAL-AGENT] 🕐 In orario lavorativo: risposta tra ${Math.round(delaySeconds / 60)} minuti`);
  } else {
    // Fuori orario: attendi fino al prossimo periodo attivo + delay random
    const secondsUntilActive = getSecondsUntilNextActivePeriod();
    const randomDelay = getRandomDelay();
    delaySeconds = secondsUntilActive + randomDelay;
    console.log(`[VIRTUAL-AGENT] 🌙 Fuori orario: risposta posticipata di ${Math.round(delaySeconds / 3600)} ore`);
  }
  
  const delayMs = delaySeconds * 1000;
  
  if (delaySeconds > 0) {
    console.log(`[VIRTUAL-AGENT] Risposta schedulata tra ${Math.round(delaySeconds / 60)} minuti per comunicazione ${communicationId}`);
  }
  
  setTimeout(async () => {
    try {
      console.log(`[VIRTUAL-AGENT] Esecuzione risposta per comunicazione ${communicationId}`);
      await executeDelayedResponse(communicationId);
    } catch (error) {
      console.error(`[VIRTUAL-AGENT] Errore risposta:`, error);
    }
  }, delayMs);
}

interface AgentResponse {
  message: string;
  success: boolean;
}

/**
 * Esegue la risposta ritardata (chiamata dopo 10 minuti)
 */
async function executeDelayedResponse(communicationId: number): Promise<void> {
  const result = await generateAndSendResponse(communicationId);
  if (result.success) {
    console.log(`[VIRTUAL-AGENT] ✅ Risposta inviata: ${result.message}`);
  } else {
    console.error(`[VIRTUAL-AGENT] ❌ Errore: ${result.message}`);
  }
}

/**
 * Genera e invia una risposta automatica a un messaggio del cliente
 * Entry point principale - gestisce business hours e scheduling intelligente
 * 
 * Il timing è gestito da BOT_CONFIG.response_timing:
 * - In orario lavorativo: delay random 5-30 minuti
 * - Fuori orario: posticipa al prossimo periodo attivo + delay random
 */
export async function handleClientMessage(
  communicationId: number,
  forceImmediateForTest: boolean = false
): Promise<AgentResponse> {
  try {
    // Usa il nuovo sistema di scheduling intelligente
    await scheduleDelayedResponse(communicationId, forceImmediateForTest);
    
    if (forceImmediateForTest) {
      return {
        success: true,
        message: "⚡ TEST MODE: Risposta immediata"
      };
    }
    
    if (isBusinessHours()) {
      const delayMin = Math.round(BOT_CONFIG.response_timing.delay_seconds.min / 60);
      const delayMax = Math.round(BOT_CONFIG.response_timing.delay_seconds.max / 60);
      return {
        success: true,
        message: `🕐 Risposta schedulata tra ${delayMin}-${delayMax} minuti (orario lavorativo)`
      };
    } else {
      return {
        success: true,
        message: "🌙 Fuori orario: risposta posticipata al prossimo periodo attivo"
      };
    }
  } catch (error: any) {
    console.error("Errore durante scheduling risposta:", error);
    return {
      success: false,
      message: `Errore: ${error.message || "Errore sconosciuto"}`,
    };
  }
}

/**
 * Verifica se il messaggio contiene un'obiezione configurata nella campagna
 * Usa word boundary matching per evitare false positives da sottostringhe
 */
function checkForObjection(
  userMessage: string,
  objectionHandling: any
): { keywords: string[]; response: string } | null {
  if (!objectionHandling || !Array.isArray(objectionHandling)) {
    return null;
  }

  const messageLower = userMessage.toLowerCase();
  
  for (const objection of objectionHandling) {
    if (objection.keywords && Array.isArray(objection.keywords)) {
      // Verifica se almeno una keyword è presente nel messaggio (con word boundaries)
      const found = objection.keywords.some((keyword: string) => {
        const keywordLower = keyword.toLowerCase().trim();
        // Use word boundary regex for precise matching - evita false positives
        const regex = new RegExp(`\\b${keywordLower}\\b`, 'i');
        return regex.test(messageLower);
      });
      
      if (found && objection.response) {
        console.log(`[VIRTUAL-AGENT-OBJECTION] ✅ Rilevata obiezione con keywords: ${objection.keywords.join(', ')}`);
        return objection;
      }
    }
  }
  
  return null;
}

/**
 * Genera e invia effettivamente la risposta (chiamata dopo il ritardo)
 */
async function generateAndSendResponse(
  communicationId: number
): Promise<AgentResponse> {
  try {
    // Recupera la comunicazione
    const [communication] = await db
      .select()
      .from(communications)
      .where(eq(communications.id, communicationId));

    if (!communication) {
      return { success: false, message: "Comunicazione non trovata" };
    }

    // Verifica che sia una comunicazione in ingresso
    if (communication.direction !== "inbound") {
      return {
        success: false,
        message: "Non è possibile rispondere a una comunicazione in uscita",
      };
    }

    // Recupera il cliente
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, communication.clientId!));

    if (!client) {
      return { success: false, message: "Cliente non trovato" };
    }

    // Recupera l'immobile (normale o condiviso)
    let propertyDetails: any = null;
    let isSharedProperty = false;

    if (communication.propertyId) {
      [propertyDetails] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, communication.propertyId));
    } else if (communication.sharedPropertyId) {
      [propertyDetails] = await db
        .select()
        .from(sharedProperties)
        .where(eq(sharedProperties.id, communication.sharedPropertyId!));
      isSharedProperty = true;
    }

    if (!propertyDetails) {
      return { success: false, message: "Immobile non trovato" };
    }

    // STEP 1: Verifica se il messaggio proviene da una campagna WhatsApp con obiezioni configurate
    let campaign: any = null;
    if (communication.sharedPropertyId && client.phone) {
      // Cerca se questa shared property ha una campagna associata
      const campaignMessageResult = await db
        .select({
          campaign: whatsappCampaigns
        })
        .from(campaignMessages)
        .innerJoin(whatsappCampaigns, eq(campaignMessages.campaignId, whatsappCampaigns.id))
        .where(
          and(
            eq(campaignMessages.propertyId, communication.sharedPropertyId),
            eq(campaignMessages.phoneNumber, client.phone)
          )
        )
        .limit(1);
      
      if (campaignMessageResult.length > 0) {
        campaign = campaignMessageResult[0].campaign;
        console.log(`[VIRTUAL-AGENT] Campagna trovata: ${campaign.name} (ID: ${campaign.id})`);
      }
    }

    // STEP 2: Verifica se c'è un'obiezione configurata
    let responseText: string | null = null;
    
    if (campaign && campaign.objectionHandling && communication.content) {
      const objection = checkForObjection(
        communication.content,
        campaign.objectionHandling
      );
      
      if (objection) {
        console.log(`[VIRTUAL-AGENT-OBJECTION] ✅ Uso risposta preconfigurata per obiezione`);
        responseText = objection.response;
      }
    }

    // STEP 3: Se non c'è obiezione, usa OpenAI per generare risposta intelligente
    if (!responseText) {
      console.log(`[VIRTUAL-AGENT] Nessuna obiezione rilevata, uso OpenAI per risposta personalizzata`);
      
      // Recupera le comunicazioni precedenti con questo cliente sullo stesso immobile
      const previousCommunications = await db
        .select()
        .from(communications)
        .where(
          and(
            eq(communications.clientId, client.id),
            communication.propertyId
              ? eq(communications.propertyId, communication.propertyId)
              : eq(communications.sharedPropertyId, communication.sharedPropertyId!)
          )
        )
        .orderBy(desc(communications.createdAt))
        .limit(10);

      // Prepara la conversazione per OpenAI
      const conversationHistory = previousCommunications
        .reverse()
        .map((comm) => {
          const role = comm.direction === "inbound" ? "user" : "assistant";
          return {
            role,
            content: comm.content,
          };
        });

      // Determina lo stile di comunicazione in base al cliente
      const isFormalStyle = !client.isFriend;
      
      // Costruisci il prompt per OpenAI (usa istruzioni campagna se disponibili)
      const systemPrompt = campaign && campaign.instructions
        ? generateSystemPromptWithCampaign(client, propertyDetails, isFormalStyle, isSharedProperty, campaign.instructions)
        : generateSystemPrompt(client, propertyDetails, isFormalStyle, isSharedProperty);

      // Genera la risposta con OpenAI
      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt }
      ];
      
      // Aggiungi la storia delle conversazioni
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content as string
        });
      }
      
      // Richiesta a OpenAI
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      responseText = response.choices[0].message.content;

      if (!responseText) {
        return { success: false, message: "Impossibile generare una risposta" };
      }
    }

    // Salva la risposta come nuova comunicazione
    const insertResult = await db
      .insert(communications)
      .values({
        clientId: client.id,
        propertyId: communication.propertyId,
        sharedPropertyId: communication.sharedPropertyId,
        type: "whatsapp",
        subject: "Risposta automatica",
        content: responseText,
        summary: "Risposta generata dall'assistente virtuale",
        direction: "outbound",
        createdBy: null,
        needsFollowUp: false,
        status: "pending",
        responseToId: communication.id,
        autoFollowUpSent: false,
      })
      .returning();
    
    const newCommunication = Array.isArray(insertResult) && insertResult.length > 0 
      ? insertResult[0] 
      : null;

    // Invia la risposta via WhatsApp
    const phoneNumber = client.phone;
    if (phoneNumber && phoneNumber.length > 0) {
      await sendWhatsAppMessage(phoneNumber, responseText);
    }

    return {
      success: true,
      message: "Risposta generata e inviata con successo",
    };
  } catch (error: any) {
    console.error("Errore durante la generazione della risposta:", error);
    return {
      success: false,
      message: `Errore: ${error.message || "Errore sconosciuto"}`,
    };
  }
}

/**
 * Genera il prompt di sistema usando BOT_CONFIG (JSON Dott. Boni)
 * Questa funzione ora usa SEMPRE la configurazione del JSON
 */
function generateSystemPrompt(
  client: any,
  propertyDetails: any,
  isFormalStyle: boolean,
  isSharedProperty: boolean
): string {
  return generateBotConfigPrompt(propertyDetails);
}

/**
 * Genera il prompt con le istruzioni della campagna
 * Usa sempre BOT_CONFIG come base
 */
function generateSystemPromptWithCampaign(
  client: any,
  propertyDetails: any,
  isFormalStyle: boolean,
  isSharedProperty: boolean,
  campaignInstructions: string
): string {
  return generateBotConfigPrompt(propertyDetails);
}

/**
 * Genera il prompt completo basato su BOT_CONFIG v5.0 con rilevamento tono
 */
function generateBotConfigPrompt(propertyDetails: any): string {
  const cfg = BOT_CONFIG;
  
  const prompt = `Sei "${cfg.bot_name}". ${cfg.identity.presentation}

=== CHI SEI ===
${cfg.identity.background}
${cfg.identity.role}

=== IMMOBILE IN DISCUSSIONE ===
- Indirizzo: ${propertyDetails?.address || "Non specificato"}
- Città: ${propertyDetails?.city || "Non specificata"}
- Prezzo: ${propertyDetails?.price ? `€${propertyDetails.price.toLocaleString("it-IT")}` : "Da definire"}
- Dimensione: ${propertyDetails?.size ? `${propertyDetails.size}m²` : "Non specificata"}

=== STILE DI COMUNICAZIONE ===
- Dai SEMPRE del Lei (formality: ${cfg.language.formality})
- Frasi ${cfg.language.sentences}
- Tono: ${cfg.language.tone}
- EVITA ASSOLUTAMENTE: ${cfg.language.avoid.join(", ")}

=== OBIETTIVI ===
Primario: Fissare un appuntamento breve (10–20 minuti) presso l'immobile con il Dott. Boni
Secondario: Costruire fiducia e lasciare una porta aperta, senza mai essere insistente

=== RILEVAMENTO TONO DEL CLIENTE ===
Prima di rispondere, ANALIZZA il tono del messaggio del cliente:

**FREDDO**: ${cfg.tone_profiles.freddo.detection}
→ Rispondi in modo: ${cfg.tone_profiles.freddo.style}

**CALDO**: ${cfg.tone_profiles.caldo.detection}
→ Rispondi in modo: ${cfg.tone_profiles.caldo.style}

**AMOREVOLE**: ${cfg.tone_profiles.amorevole.detection}
→ Rispondi in modo: ${cfg.tone_profiles.amorevole.style}

**ANALITICO**: ${cfg.tone_profiles.analitico.detection}
→ Rispondi in modo: ${cfg.tone_profiles.analitico.style}

=== GESTIONE OBIEZIONI (con risposte per tono) ===
${cfg.objection_handlers.map(h => `
**${h.name.toUpperCase()}**
Trigger: ${h.triggers.join(", ")}
- Se tono FREDDO: "${h.responses_by_tone.freddo}"
- Se tono CALDO: "${h.responses_by_tone.caldo}"
- Se tono AMOREVOLE: "${h.responses_by_tone.amorevole}"
- Se tono ANALITICO: "${h.responses_by_tone.analitico}"`).join("\n")}

=== DOMANDE TECNICHE (con risposte per tono) ===
- Se tono FREDDO: "${cfg.technical_question_redirect.response_by_tone.freddo}"
- Se tono CALDO: "${cfg.technical_question_redirect.response_by_tone.caldo}"
- Se tono AMOREVOLE: "${cfg.technical_question_redirect.response_by_tone.amorevole}"
- Se tono ANALITICO: "${cfg.technical_question_redirect.response_by_tone.analitico}"

=== FALLBACK (con risposte per tono) ===
Se non riesci a categorizzare il messaggio:
- Se tono FREDDO: "${cfg.fallback.response_by_tone.freddo}"
- Se tono CALDO: "${cfg.fallback.response_by_tone.caldo}"
- Se tono AMOREVOLE: "${cfg.fallback.response_by_tone.amorevole}"
- Se tono ANALITICO: "${cfg.fallback.response_by_tone.analitico}"

=== CHIUSURA ===
Firma SEMPRE con: "${cfg.follow_up.signature}"

=== ISTRUZIONI FINALI CRITICHE ===
1. Rispondi SOLO in italiano
2. Messaggi BREVI (max 3-4 frasi, stile WhatsApp naturale)
3. PRIMA rileva il tono del cliente, POI scegli la risposta appropriata
4. NON inventare informazioni sull'immobile che non hai
5. L'obiettivo finale è SEMPRE proporre un incontro breve con il Dott. Boni
6. NON essere troppo formale o burocratico - mantieni un tono calmo ed empatico
7. Adatta SEMPRE la lunghezza e lo stile della risposta al tono rilevato`;

  return prompt;
}

/**
 * Determina il saluto appropriato in base al tipo di cliente
 */
function getSalutation(client: any): string {
  const firstName = client.firstName;
  
  if (!client.isFriend) {
    // Formale
    switch(client.salutation) {
      case 'egr_dott':
        return `Egregio Dott. ${firstName}`;
      case 'gent_sig_ra':
        return `Gentile Sig.ra ${firstName}`;
      case 'egr_avvto':
        return `Egregio Avv.to ${firstName}`;
      default:
        return `Gentile ${firstName}`;
    }
  } else {
    // Informale
    return `Ciao ${firstName}`;
  }
}

/**
 * Configurazione del sistema di risposta automatica
 */
export async function configureAutoResponseSystem(enabled: boolean = true): Promise<boolean> {
  // Qui potresti implementare un sistema di configurazione per abilitare/disabilitare le risposte automatiche
  console.log(`Sistema di risposta automatica ${enabled ? 'abilitato' : 'disabilitato'}`);
  return true;
}