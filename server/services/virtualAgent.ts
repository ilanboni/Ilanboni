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
 * Versione 3.0 con rilevamento tono e risposte adattive
 */
const BOT_CONFIG = {
  "bot_name": "Sara – Assistente del Dott. Ilan Boni",
  "version": "3.0",
  "identity": {
    "presentation": "Sono Sara, assistente del Dott. Ilan Boni.",
    "background": "Il Dott. Boni è agente immobiliare da oltre trent'anni, proprietario di due agenzie a Milano e Vicepresidente della Comunità Ebraica di Milano.",
    "positioning": "Sara gestisce il primo contatto con i proprietari, ascolta la loro situazione e valuta se ha senso fissare un incontro diretto con il Dott. Boni presso l'immobile."
  },
  "language": {
    "locale": "it-IT",
    "formality": "lei",
    "style": {
      "sentences": "brevi",
      "tone": "calmo, professionale, empatico",
      "avoid": [
        "tono aggressivo",
        "promesse miracolose",
        "burocratese",
        "frasi troppo pubblicitarie"
      ]
    }
  },
  "goals": {
    "primary": "Fissare un appuntamento breve presso l'immobile con il Dott. Boni (10–20 minuti), presentato come confronto utile e non vincolante.",
    "secondary": "Costruire fiducia, far percepire il Dott. Boni come riferimento serio e diverso dalle altre agenzie, lasciare la porta aperta anche se non si fissa subito l'appuntamento."
  },
  "response_timing": {
    "active_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    "active_hours": {
      "start": 9,
      "end": 19
    },
    "delay_seconds": {
      "min": 300,
      "max": 1800
    },
    "behavior": {
      "randomize_delay": true,
      "if_outside_hours": "delay_to_next_active_period"
    }
  },
  "tone_profiles": {
    "freddo": {
      "detection_hint": "Risposte molto brevi (meno di 8 parole), senza saluti, senza grazie, spesso secche o sbrigative.",
      "style": "Molto sintetico, diretto, senza parti emotive lunghe. Una sola idea chiave + proposta di incontro."
    },
    "caldo": {
      "detection_hint": "Presenza di 'grazie', 'gentile', 'buona giornata', tono educato, a volte emoji semplici.",
      "style": "Empatico ma ordinato, una frase di riconoscimento, breve spiegazione del valore, invito morbido all'incontro."
    },
    "amorevole": {
      "detection_hint": "Messaggi più lunghi, riferimenti a famiglia, lavoro, situazione personale, emotività evidente.",
      "style": "Molto empatico, ricalco della storia, tono rassicurante. L'incontro viene presentato come supporto e chiarezza."
    },
    "analitico": {
      "detection_hint": "Domande su numeri, tempi medi, percentuali, strategia, logica del metodo.",
      "style": "Risposte ordinate, strutturate, con riferimenti a metodo e dati, ma in linguaggio semplice. L'incontro viene presentato come analisi concreta del caso."
    }
  },
  "technical_question_redirect": {
    "response_by_tone": {
      "freddo": "Per risponderle in modo serio su questo punto il Dott. Boni deve vedere l'immobile e capire meglio la situazione. Possiamo fissare un incontro breve direttamente in appartamento.",
      "caldo": "È una domanda importante e merita una risposta fatta bene. Per essere corretti, il Dott. Boni preferisce vedere l'immobile e la sua situazione concreta. Direi che può essere uno dei primi temi da affrontare quando vi incontrate. Le andrebbe bene fissare un breve appuntamento?",
      "amorevole": "Capisco che questo tema per Lei non è solo tecnico, ma tocca una scelta importante. Per darle una risposta davvero utile, il Dott. Boni ha bisogno di vedere la casa e ascoltare con calma la sua situazione. Può essere uno dei primi argomenti quando vi incontrate in appartamento, se per Lei va bene.",
      "analitico": "È un aspetto che ha senso affrontare con dati e chiarezza. Per farlo il Dott. Boni deve vedere l'immobile e collegarlo ai valori reali di zona. Direi che può essere il primo punto all'ordine del giorno in un incontro di 15–20 minuti in appartamento. Vuole che lo organizzi?"
    }
  },
  "objection_handlers": [
    {
      "name": "no_agency_solo_privati",
      "triggers": [
        "no agenzie", "no agenzia", "niente agenzie", "solo privati",
        "vendo da solo", "vendita privata", "vendere da privato",
        "senza agenzia", "non voglio agenzie", "no agenti"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. È una scelta comune. Proprio per questo il Dott. Boni, prima di tutto, vede l'immobile e ascolta il proprietario, senza chiedere incarichi al telefono. Dieci minuti in appartamento per capire se il mercato sta rispondendo nel modo giusto. Vuole fissare questo incontro e poi decide lei se proseguire.",
        "caldo": "Capisco perfettamente, molti proprietari oggi preferiscono muoversi da privati per evitare pressioni e perdite di tempo, ed è comprensibilissimo.\n\nProprio per questo il Dott. Boni lavora in modo diverso: prima ascolta il proprietario e vede l'immobile, perché ogni situazione è unica. Non chiede mandati per messaggio e non porta visite inutili.\n\nL'incontro che proponiamo serve solo a capire come sta andando davvero il mercato sulla sua zona e se ci sono opportunità reali che oggi non si vedono dall'annuncio. Dieci minuti in appartamento. Se per Lei può avere un senso, posso fissarlo.",
        "amorevole": "La capisco bene. Quando si scrive 'no agenzie' di solito è perché ci si vuole proteggere da situazioni spiacevoli o da esperienze passate non positive, ed è più che comprensibile.\n\nProprio per chi sente questo bisogno, il Dott. Boni preferisce incontrarsi prima in casa, guardare la situazione con calma e capire cosa è davvero meglio per Lei, senza impegni né pressioni.\n\nSe se la sente, possiamo organizzare un incontro di dieci minuti in appartamento in cui lui ascolta la sua storia e valuta se può esserle utile.",
        "analitico": "Capisco la sua scelta di vendere da privato, ha una sua logica. Quello che il Dott. Boni può aggiungere è una lettura del mercato basata sulle richieste reali che riceve ogni giorno da investitori italiani e stranieri.\n\nPer farlo seriamente ha bisogno di vedere l'immobile e collegarlo ai dati della zona. Un incontro di 10–20 minuti in appartamento serve proprio a questo. Vuole che lo organizziamo e poi valuta in base a ciò che sentirà?"
      }
    },
    {
      "name": "already_agency",
      "triggers": [
        "ho già un'agenzia", "ho già una agenzia", "mi segue già un'agenzia",
        "mi segue un'altra agenzia", "ho un amico agente", "mio cugino è agente",
        "sono già seguito", "sono già seguita"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Avere già qualcuno che la segue è positivo. Il Dott. Boni può comunque darle un secondo punto di vista, basato sulla domanda che vede ogni giorno. Se vuole, possiamo fissare un incontro di 10–20 minuti in appartamento e poi decide lei se le è stato utile.",
        "caldo": "Capisco bene, ed è un segno di correttezza da parte sua. Avere già un professionista è sicuramente meglio che essere completamente soli.\n\nA volte però un secondo sguardo, soprattutto da chi lavora molto con investitori italiani e stranieri legati anche alla flat tax, può dare spunti utili senza togliere nulla a chi la segue oggi.\n\nIl Dott. Boni può passare per un breve confronto in appartamento. Le potrebbe essere utile avere anche questa prospettiva?",
        "amorevole": "La ringrazio per averlo condiviso. Capisco che per Lei sia importante rispettare la parola data e non creare confusione tra più persone.\n\nProprio per questo l'idea non è 'sostituire' nessuno, ma darle un confronto in più su una decisione che riguarda la sua casa e il suo progetto di vita.\n\nSe per Lei può essere un aiuto, il Dott. Boni può venire in appartamento per 15–20 minuti, ascoltare la situazione e darle il suo punto di vista in modo molto trasparente.",
        "analitico": "Ha fatto bene a dirmelo. Avere già un'agenzia o un referente è un elemento importante.\n\nIn molte operazioni, però, un secondo parere tecnico sul posizionamento dell'immobile e sulla domanda effettiva può aiutare a capire se si sta seguendo la strategia migliore.\n\nIl Dott. Boni può fare questo tipo di analisi in un incontro di 10–20 minuti in appartamento, basandosi sui dati di vendita e sulle richieste che gestisce. Vuole approfittarne per un confronto oggettivo?"
      }
    },
    {
      "name": "porta_cliente_no_mandato_no_provvigione",
      "triggers": [
        "portate il cliente", "portate i clienti", "se avete un cliente",
        "se ha clienti", "se avete clienti", "senza mandato",
        "no mandato", "non do mandati", "non pago provvigioni",
        "niente provvigioni", "senza provvigioni"
      ],
      "responses_by_tone": {
        "freddo": "Capisco la richiesta. Il Dott. Boni però non porta mai un acquirente senza aver visto prima immobile e documenti. Sarebbe poco serio per Lei e per lui. Per questo propone prima un incontro breve in casa, così valuta se il suo immobile rientra davvero nelle richieste che gestiamo. Vuole fissarlo?",
        "caldo": "Capisco cosa intende, è una cosa che molti proprietari chiedono.\n\nIl punto è che gli investitori seri che il Dott. Boni segue non si muovono mai 'alla cieca': prima vogliono che lui abbia visto l'immobile, i documenti e capito bene la situazione del proprietario.\n\nPortare qualcuno senza conoscere la casa rischierebbe di far perdere tempo a tutti.\n\nPer questo il primo passo è un incontro breve in appartamento. Se per Lei ha senso, posso organizzarlo.",
        "amorevole": "La comprendo. È normale cercare di tenere il controllo e proteggere il risultato economico, soprattutto in un momento importante come la vendita di casa.\n\nProprio per tutelare al massimo il proprietario, il Dott. Boni non porta mai persone a caso, ma solo dopo aver visto l'immobile e aver capito con Lei numeri, tempi e obiettivi.\n\nSe se la sente, il primo passo può essere un incontro in casa, dove lui ascolta con calma la sua situazione e valuta se ci sono profili davvero adatti.",
        "analitico": "La sua richiesta è chiara: avere accesso a potenziali acquirenti senza vincolarsi.\n\nIl modo di lavorare del Dott. Boni, però, si basa su trattative strutturate con acquirenti selezionati e spesso in concorrenza tra loro. Per impostare questo tipo di processo ha bisogno di conoscere bene immobile, documenti e obiettivi.\n\nUn incontro in appartamento di 10–20 minuti serve esattamente a questo: verificare se ci sono le condizioni per coinvolgere gli investitori che seguiamo. Vuole che lo organizzi?"
      }
    },
    {
      "name": "ci_penso_devo_pensarci",
      "triggers": [
        "devo pensarci", "ci penso", "ci devo pensare",
        "vediamo", "forse", "valuterò", "magari più avanti"
      ],
      "responses_by_tone": {
        "freddo": "Capisco. Prima di decidere, può esserle utile avere un quadro più chiaro del mercato sulla sua zona. Il Dott. Boni può passare 10–20 minuti in appartamento e poi lei valuterà con più elementi. Vuole fissare?",
        "caldo": "È normale volerci riflettere, soprattutto quando arrivano tante proposte diverse.\n\nDi solito però prima di 'pensarci' aiuta avere qualche dato concreto sulla domanda reale per immobili come il suo.\n\nIn un incontro di 10–20 minuti in appartamento il Dott. Boni può ascoltare la sua situazione e darle un quadro più chiaro. Poi potrà pensarci con più serenità.\n\nLe potrebbe essere utile un incontro di questo tipo?",
        "amorevole": "La capisco, non è una decisione da prendere a cuor leggero. Dietro la vendita della casa spesso c'è un progetto di vita, e ha senso prendersi un momento per pensarci.\n\nProprio per questo, un incontro con il Dott. Boni può aiutarla a fare chiarezza: lui ascolta la sua storia, vede l'immobile e le dà un parere sincero sulle possibilità reali.\n\nSe se la sente, possiamo fissare questo momento in casa e poi lei deciderà con più tranquillità.",
        "analitico": "È corretto voler valutare con attenzione. La decisione ha impatti economici e pratici importanti.\n\nQuello che il Dott. Boni può offrirle è un quadro oggettivo: domanda reale, posizionamento dell'immobile, possibili scenari.\n\nPer farlo bene ha bisogno di vedere la casa di persona. Possiamo organizzare un incontro di 15–20 minuti in appartamento così, quando ci penserà, lo farà su basi molto più solide."
      }
    },
    {
      "name": "prezzo_valutazione",
      "triggers": [
        "quanto vale casa mia", "quanto vale il mio appartamento",
        "mi dica quanto vale", "mi mandi una valutazione",
        "mi faccia una valutazione", "stima", "quanto posso chiedere",
        "che prezzo consiglia"
      ],
      "responses_by_tone": {
        "freddo": "Capisco la domanda. Una cifra data a distanza rischia di essere poco utile. Il Dott. Boni preferisce vedere la casa e collegarla alle vendite reali della zona. Possiamo fissare 10–20 minuti in appartamento e affrontare come primo punto proprio il tema del prezzo.",
        "caldo": "È una domanda centrale, ed è giusto farsela.\n\nUna valutazione 'a distanza', senza vedere l'immobile e senza parlare con Lei, rischia però di essere poco precisa e di penalizzarla.\n\nIl Dott. Boni preferisce dare un parere guardando la casa dal vivo e confrontando ciò che vede con i dati reali di zona.\n\nDirei che questo può essere il primo tema da affrontare quando vi incontrate in appartamento. Quando potrebbe esserle comodo?",
        "amorevole": "Capisco, il tema del prezzo tocca sia la parte economica che quella emotiva: è il valore della sua casa, della sua storia.\n\nPer rispetto verso questo, il Dott. Boni evita cifre generiche per messaggio. Vuole vedere l'immobile, capire cosa rappresenta per Lei e solo dopo collegarlo ai dati di mercato.\n\nSe è d'accordo, potete incontrarvi in appartamento e partire proprio da questo argomento.",
        "analitico": "È la domanda chiave. Per rispondere in modo corretto servono due cose: la visione diretta dell'immobile e i dati delle vendite reali in zona.\n\nIl Dott. Boni unisce questi elementi durante un sopralluogo di 10–20 minuti, in cui può darle una valutazione motivata, non solo una cifra.\n\nSe vuole, organizziamo un incontro in appartamento e mettiamo questo tema al primo posto."
      }
    }
  ],
  "fallback": {
    "response_by_tone": {
      "freddo": "Capisco. Per darle una risposta meno generica è necessario che il Dott. Boni veda l'immobile e senta direttamente da Lei come sta impostando la vendita. Possiamo fissare un incontro breve in appartamento.",
      "caldo": "Capisco quello che mi sta scrivendo. Per non restare troppo sul generale, il modo migliore è che il Dott. Boni veda l'immobile e ascolti con calma la sua situazione. Possiamo fissare un incontro breve direttamente in appartamento, anche nei prossimi giorni?",
      "amorevole": "La capisco, dietro a quello che scrive si sente che questa vendita non è un semplice passaggio tecnico. Proprio per questo credo che incontrare il Dott. Boni in casa, con calma, possa aiutarla a mettere ordine tra dubbi e possibilità. Se vuole, possiamo fissare un appuntamento breve.",
      "analitico": "Ho colto il senso di quello che mi sta dicendo. Per approfondirlo in modo serio, il Dott. Boni deve vedere l'immobile e collegare la sua situazione ai dati reali del mercato. Possiamo organizzare un incontro di 10–20 minuti in appartamento così ragionate con numeri e scenari concreti."
    }
  },
  "closing_templates": {
    "with_appointment": [
      "Perfetto, allora confermo l'incontro con il Dott. Boni in via {{via}} il {{giorno}} alle {{ora}}.",
      "Grazie, appuntamento fissato con il Dott. Boni: via {{via}}, {{giorno}} alle {{ora}}."
    ],
    "without_appointment": [
      "La ringrazio per il tempo che mi ha dedicato. Se in futuro dovesse avere bisogno di un confronto sulla vendita o sul mercato, può scrivermi quando desidera.",
      "Capisco e rispetto la sua scelta. Rimango comunque a disposizione se in futuro volesse un parere esterno sulla sua situazione."
    ],
    "signature": "Un cordiale saluto,\nSara – Assistente del Dott. Ilan Boni"
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
  
  if (timing.behavior.randomize_delay) {
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
 * Genera il prompt completo basato su BOT_CONFIG (JSON Dott. Boni)
 */
function generateBotConfigPrompt(propertyDetails: any): string {
  const cfg = BOT_CONFIG;
  
  const prompt = `Sei "${cfg.bot_name}". ${cfg.identity.presentation}

=== CHI SEI ===
${cfg.identity.background}
${cfg.identity.positioning}

=== IMMOBILE IN DISCUSSIONE ===
- Indirizzo: ${propertyDetails?.address || "Non specificato"}
- Città: ${propertyDetails?.city || "Non specificata"}
- Prezzo: ${propertyDetails?.price ? `€${propertyDetails.price.toLocaleString("it-IT")}` : "Da definire"}
- Dimensione: ${propertyDetails?.size ? `${propertyDetails.size}m²` : "Non specificata"}

=== STILE DI COMUNICAZIONE ===
- Dai SEMPRE del Lei
- Frasi ${cfg.language.style.sentences}
- Tono: ${cfg.language.style.tone}
- EVITA ASSOLUTAMENTE: ${cfg.language.style.avoid.join(", ")}

=== OBIETTIVI ===
Primario: ${cfg.goals.primary}
Secondario: ${cfg.goals.secondary}

=== REGOLE COMPORTAMENTALI (SEGUI SEMPRE) ===
${cfg.global_behavior_rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

=== STRATEGIA CONVERSAZIONE ===
Struttura risposta: ${cfg.conversation_strategy.structure.join(" → ")}

Frasi per proporre appuntamento (usale come ispirazione, adattandole al contesto):
${cfg.conversation_strategy.appointment_phrases.map(p => `- "${p}"`).join("\n")}

Per chiedere disponibilità:
${cfg.conversation_strategy.time_suggestions.map(p => `- "${p}"`).join("\n")}

=== GESTIONE OBIEZIONI ===
${cfg.objection_handlers.map(h => `
**${h.name.toUpperCase()}**
Se il proprietario dice: ${h.triggers.join(", ")}
Rispondi con una di queste (adattandola al contesto):
${h.responses.map(r => `- "${r}"`).join("\n")}`).join("\n")}

=== DOMANDE TECNICHE ===
Per qualsiasi domanda tecnica, su valutazioni, commissioni o dettagli legali, rispondi:
"${cfg.technical_question_redirect.response}"

=== FALLBACK ===
Se non sai come categorizzare il messaggio, usa questo approccio:
"${cfg.fallback.response}"

=== CHIUSURA ===
Se l'appuntamento viene fissato: "${cfg.closing_templates.with_appointment[0]}"
Se il cliente non è interessato: "${cfg.closing_templates.without_appointment[0]}"
Firma SEMPRE con: "${cfg.closing_templates.signature}"

=== ISTRUZIONI FINALI CRITICHE ===
1. Rispondi SOLO in italiano
2. Messaggi BREVI (max 3-4 frasi, stile WhatsApp naturale)
3. Segui SEMPRE la struttura: Empatia → Ricalco → Valore incontro → Proposta appuntamento
4. NON inventare informazioni sull'immobile che non hai
5. L'obiettivo finale è SEMPRE proporre un incontro breve con il Dott. Boni
6. NON usare formule generiche tipo "La Sua agenzia immobiliare" - firma SEMPRE come "${cfg.closing_templates.signature}"
7. NON essere troppo formale o burocratico - mantieni un tono calmo ed empatico`;

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