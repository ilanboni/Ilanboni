/**
 * Templates messaggi segretaria virtuale
 * Organizzati per canale e tone profile
 */

export interface MessageTemplate {
  id: string;
  channel: 'whatsapp' | 'phone' | 'email';
  targetType: 'private' | 'multi' | 'mono' | 'generic';
  tone: 'formal' | 'friendly' | 'neutral';
  subject?: string;
  body: string;
  variables: string[]; // Lista variabili supportate: {{address}}, {{price}}, etc.
}

/**
 * Templates WhatsApp
 */
export const whatsappTemplates: MessageTemplate[] = [
  {
    id: 'wa_private_formal',
    channel: 'whatsapp',
    targetType: 'private',
    tone: 'formal',
    body: `Buongiorno,

Sono {{agentName}} di {{agencyName}}.

Ho notato che la Sua proprietà in {{address}} potrebbe essere di interesse per alcuni nostri clienti selezionati.

Sarebbe disponibile per una breve chiamata per discutere una potenziale collaborazione in esclusiva?

Cordiali saluti`,
    variables: ['agentName', 'agencyName', 'address']
  },
  {
    id: 'wa_private_friendly',
    channel: 'whatsapp',
    targetType: 'private',
    tone: 'friendly',
    body: `Ciao! 👋

Sono {{agentName}} di {{agencyName}}.

Ho visto il tuo immobile in {{address}} e devo dirti che è esattamente quello che cercano alcuni miei clienti! 🏡

Ti va se ci sentiamo per capire come posso aiutarti a valorizzarlo al meglio?

A presto!`,
    variables: ['agentName', 'agencyName', 'address']
  },
  {
    id: 'wa_multi_formal',
    channel: 'whatsapp',
    targetType: 'multi',
    tone: 'formal',
    body: `Buongiorno,

Sono {{agentName}} di {{agencyName}}.

Ho visto che la Sua proprietà in {{address}} è attualmente proposta da diverse agenzie.

Lavoriamo con un approccio esclusivo che garantisce maggiore visibilità e risultati più rapidi. Potrei illustrarLe come?

Cordiali saluti`,
    variables: ['agentName', 'agencyName', 'address']
  },
  {
    id: 'wa_multi_neutral',
    channel: 'whatsapp',
    targetType: 'multi',
    tone: 'neutral',
    body: `Buongiorno,

{{agentName}} di {{agencyName}}.

Vedo che il suo immobile in {{address}} è presente su più portali. 

Potrei proporle una strategia di vendita più mirata ed efficace?

Grazie`,
    variables: ['agentName', 'agencyName', 'address']
  },
  {
    id: 'wa_mono_friendly',
    channel: 'whatsapp',
    targetType: 'mono',
    tone: 'friendly',
    body: `Ciao,

Sono {{agentName}} di {{agencyName}} 🏡

Ho notato il tuo immobile in {{address}}. Lavoriamo con un database clienti molto qualificato in quella zona.

Ti andrebbe di sentirci per capire se possiamo collaborare?

Buona giornata!`,
    variables: ['agentName', 'agencyName', 'address']
  }
];

/**
 * Script chiamate telefoniche
 */
export const phoneScripts: MessageTemplate[] = [
  {
    id: 'call_private_formal',
    channel: 'phone',
    targetType: 'private',
    tone: 'formal',
    body: `INTRODUZIONE:
"Buongiorno, sono {{agentName}} di {{agencyName}}. Disturbo?"

OBIETTIVO:
"Ho visto la Sua proprietà in {{address}}. Lavoriamo con clienti selezionati che cercano esattamente in quella zona."

PROPOSTA:
"Sarebbe interessato/a a un incontro gratuito per una valutazione professionale e per capire come possiamo aiutarLa a valorizzare al meglio il Suo immobile?"

OBIEZIONE "GIÀ CON AGENZIA":
"Capisco perfettamente. Proprio per questo le proponiamo un approccio complementare in esclusiva, che garantisce risultati più rapidi senza costi aggiuntivi."

CHIUSURA:
"Quando sarebbe più comodo per Lei? Domani o dopodomani?"`,
    variables: ['agentName', 'agencyName', 'address']
  },
  {
    id: 'call_multi_neutral',
    channel: 'phone',
    targetType: 'multi',
    tone: 'neutral',
    body: `INTRODUZIONE:
"Buongiorno, {{agentName}} di {{agencyName}}."

SITUAZIONE:
"Vedo che il suo immobile in {{address}} è presente su diversi portali. Questo spesso rallenta le vendite."

PROPOSTA:
"Le proponiamo un approccio esclusivo con target clienti pre-qualificati. Posso inviarle una presentazione via email?"

CHIUSURA:
"Preferisce che le mandi tutto oggi o domani?"`,
    variables: ['agentName', 'agencyName', 'address']
  }
];

/**
 * Templates Email
 */
export const emailTemplates: MessageTemplate[] = [
  {
    id: 'email_private_formal',
    channel: 'email',
    targetType: 'private',
    tone: 'formal',
    subject: 'Opportunità vendita {{address}}',
    body: `Gentile Proprietario,

Sono {{agentName}}, consulente immobiliare di {{agencyName}}.

Ho notato la Sua proprietà sita in {{address}} e ritengo possa essere di grande interesse per alcuni nostri clienti attualmente in cerca di immobili in quella zona.

La nostra agenzia si distingue per:
• Database clienti pre-qualificati e verificati
• Approccio esclusivo che garantisce massima riservatezza
• Vendite realizzate mediamente in 60 giorni

Sarebbe disponibile per un incontro conoscitivo gratuito, durante il quale potremmo:
1. Effettuare una valutazione professionale dell'immobile
2. Presentarle il nostro metodo di lavoro
3. Illustrarle casi studio di vendite realizzate nella zona

Resto a Sua disposizione per qualsiasi chiarimento.

Cordiali saluti,

{{agentName}}
{{agencyName}}
Tel: {{agentPhone}}
Email: {{agentEmail}}`,
    variables: ['agentName', 'agencyName', 'address', 'agentPhone', 'agentEmail']
  },
  {
    id: 'email_multi_neutral',
    channel: 'email',
    targetType: 'multi',
    tone: 'neutral',
    subject: 'Strategia vendita ottimizzata - {{address}}',
    body: `Buongiorno,

{{agentName}} di {{agencyName}}.

Ho notato che il Suo immobile in {{address}} è attualmente proposto da più agenzie.

Questa situazione spesso genera:
- Confusione nel mercato
- Ritardi nella vendita
- Perdita di valore percepito

Le proponiamo un approccio diverso:
✓ Mandato esclusivo con piano marketing mirato
✓ Target clienti pre-selezionati per quella specifica zona
✓ Report settimanali sull'andamento delle visite

Posso inviarle una presentazione dettagliata?

Grazie,

{{agentName}}
{{agencyName}}
{{agentPhone}} | {{agentEmail}}`,
    variables: ['agentName', 'agencyName', 'address', 'agentPhone', 'agentEmail']
  }
];

/**
 * Sostituisce le variabili nel template
 */
export function fillTemplate(template: MessageTemplate, variables: Record<string, string>): string {
  let filled = template.body;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    filled = filled.replace(new RegExp(placeholder, 'g'), value);
  }
  
  return filled;
}

/**
 * Ottiene template per tipo e tone
 */
export function getTemplate(
  channel: 'whatsapp' | 'phone' | 'email',
  targetType: 'private' | 'multi' | 'mono' | 'generic',
  tone: 'formal' | 'friendly' | 'neutral' = 'neutral'
): MessageTemplate | null {
  
  let templates: MessageTemplate[] = [];
  
  switch (channel) {
    case 'whatsapp':
      templates = whatsappTemplates;
      break;
    case 'phone':
      templates = phoneScripts;
      break;
    case 'email':
      templates = emailTemplates;
      break;
  }
  
  // Cerca template esatto
  let template = templates.find(t => 
    t.targetType === targetType && t.tone === tone
  );
  
  // Fallback: stesso targetType, tone diverso
  if (!template) {
    template = templates.find(t => t.targetType === targetType);
  }
  
  // Fallback: generic
  if (!template) {
    template = templates.find(t => t.targetType === 'generic');
  }
  
  return template || null;
}

/**
 * Genera messaggio completo per shared property
 */
export function generateMessageForSharedProperty(
  sharedProperty: any,
  channel: 'whatsapp' | 'phone' | 'email',
  tone: 'formal' | 'friendly' | 'neutral' = 'neutral',
  agentInfo: {
    name: string;
    agency: string;
    phone?: string;
    email?: string;
  }
): string | null {
  
  // Determina tipo in base a numero agenzie
  const agencyCount = [
    sharedProperty.agency1Name,
    sharedProperty.agency2Name,
    sharedProperty.agency3Name
  ].filter(Boolean).length;
  
  let targetType: 'private' | 'multi' | 'mono';
  
  if (agencyCount === 0) {
    targetType = 'private';
  } else if (agencyCount >= 2) {
    targetType = 'multi';
  } else {
    targetType = 'mono';
  }
  
  // Ottieni template
  const template = getTemplate(channel, targetType, tone);
  
  if (!template) {
    return null;
  }
  
  // Prepara variabili
  const variables: Record<string, string> = {
    agentName: agentInfo.name,
    agencyName: agentInfo.agency,
    address: sharedProperty.address || 'indirizzo da definire',
    price: sharedProperty.price ? `€${sharedProperty.price.toLocaleString()}` : 'da valutare',
    size: sharedProperty.size ? `${sharedProperty.size}mq` : 'da definire',
    agentPhone: agentInfo.phone || '',
    agentEmail: agentInfo.email || ''
  };
  
  // Riempi template
  return fillTemplate(template, variables);
}
