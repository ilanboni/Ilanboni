import { GreetingTemplate, WhatsAppTemplate } from "../types";

// Greeting templates
export const GREETING_TEMPLATES: GreetingTemplate = {
  formal: [
    "Gent. Dott. {lastName}",
    "Egr. Dott. {lastName}",
    "Gent.ma Sig.ra {lastName}",
    "Spett.le {lastName}"
  ],
  informal: [
    "Caro {firstName}",
    "Cara {firstName}",
    "Ciao {firstName}",
    "Buongiorno {firstName}"
  ]
};

// WhatsApp message templates
export const WHATSAPP_TEMPLATES: { [key: string]: WhatsAppTemplate } = {
  property: {
    type: 'property',
    messages: [
      "Ho trovato questo immobile che potrebbe interessarti in base ai tuoi criteri di ricerca. Dai un'occhiata!",
      "Ecco una proprietà che corrisponde perfettamente alle tue esigenze! Cosa ne pensi?",
      "Un nuovo immobile sul mercato che combacia con i tuoi parametri di ricerca. Ti interessa una visita?",
      "Ho selezionato personalmente questo immobile per te, basandomi sulle tue preferenze. Ti piace?"
    ]
  },
  birthday: {
    type: 'birthday',
    messages: [
      "Tanti auguri di buon compleanno! Ti auguro una splendida giornata.",
      "Buon compleanno! Che questo nuovo anno ti porti tante soddisfazioni e opportunità.",
      "Auguri sinceri per un compleanno pieno di gioia e serenità!",
      "Tanti auguri! Spero che questo compleanno sia l'inizio di un anno meraviglioso.",
      "Buon compleanno! Un augurio speciale da tutto il nostro team."
    ]
  },
  followup: {
    type: 'followup',
    messages: [
      "Volevo sapere se hai avuto modo di visionare l'immobile che ti ho inviato. Hai domande a riguardo?",
      "Come ti è sembrato l'immobile? Sono a disposizione per qualsiasi chiarimento.",
      "Ti è piaciuta la proprietà che ti ho mostrato? Rimango in attesa di un tuo feedback.",
      "Pensavo di inviarti altri immobili simili a quello che hai visto. Ti interessa?"
    ]
  }
};

// Religious holiday templates
export const RELIGIOUS_HOLIDAY_TEMPLATES = {
  christian: {
    christmas: "Buon Natale e felici festività a te e famiglia!",
    easter: "Buona Pasqua! Che sia un periodo di rinnovamento e gioia."
  },
  jewish: {
    hanukkah: "Felice Hanukkah a te e ai tuoi cari!",
    passover: "Chag Pesach Sameach! Ti auguro una serena Pasqua ebraica."
  },
  muslim: {
    ramadan: "Ramadan Mubarak! Ti auguro un mese di riflessione e pace.",
    eidAlFitr: "Eid Mubarak! Che questa festa ti porti gioia e serenità."
  },
  hindu: {
    diwali: "Felice Diwali! Che la festa delle luci illumini il tuo cammino."
  },
  buddhist: {
    vesak: "Sereno Vesak! Ti auguro pace e illuminazione."
  }
};

// Property types
export const PROPERTY_TYPES = [
  "Appartamento",
  "Villa",
  "Casa a schiera",
  "Attico",
  "Loft",
  "Rustico",
  "Terreno",
  "Ufficio",
  "Negozio",
  "Magazzino"
];

// Italian city areas (for demo)
export const CITY_AREAS = [
  "Centro",
  "Nord",
  "Sud",
  "Est",
  "Ovest",
  "Periferia"
];

// Price ranges for filtering
export const PRICE_RANGES = [
  { label: "Fino a 100.000€", min: 0, max: 100000 },
  { label: "100.000€ - 200.000€", min: 100000, max: 200000 },
  { label: "200.000€ - 300.000€", min: 200000, max: 300000 },
  { label: "300.000€ - 400.000€", min: 300000, max: 400000 },
  { label: "400.000€ - 500.000€", min: 400000, max: 500000 },
  { label: "Oltre 500.000€", min: 500000, max: null }
];

// Size ranges for filtering
export const SIZE_RANGES = [
  { label: "Fino a 50m²", min: 0, max: 50 },
  { label: "50m² - 80m²", min: 50, max: 80 },
  { label: "80m² - 120m²", min: 80, max: 120 },
  { label: "120m² - 180m²", min: 120, max: 180 },
  { label: "180m² - 250m²", min: 180, max: 250 },
  { label: "Oltre 250m²", min: 250, max: null }
];

// Religions for client profile
export const RELIGIONS = [
  { value: "christian", label: "Cristiana" },
  { value: "jewish", label: "Ebraica" },
  { value: "muslim", label: "Islamica" },
  { value: "hindu", label: "Induista" },
  { value: "buddhist", label: "Buddista" },
  { value: "none", label: "Nessuna" },
  { value: "other", label: "Altra" }
];

// Salutations for clients
export const SALUTATIONS = [
  { value: "dott", label: "Dott." },
  { value: "dott.ssa", label: "Dott.ssa" },
  { value: "sig", label: "Sig." },
  { value: "sig.ra", label: "Sig.ra" },
  { value: "ing", label: "Ing." },
  { value: "avv", label: "Avv." },
  { value: "prof", label: "Prof." },
  { value: "prof.ssa", label: "Prof.ssa" }
];

// Task priorities
export const TASK_PRIORITIES = [
  { value: "high", label: "Alta", color: "bg-red-500" },
  { value: "medium", label: "Media", color: "bg-amber-500" },
  { value: "low", label: "Bassa", color: "bg-blue-500" }
];
