import { db } from '../db';
import { communications, properties, clients, tasks } from '@shared/schema';
import { eq, like, and, desc, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { config } from '../config';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PropertyReference {
  propertyId: number;
  confidence: number;
}

interface TaskSuggestion {
  title: string;
  description: string;
  dueDate: Date;
  priority: number;
}

/**
 * Assistente virtuale che aiuta a gestire le comunicazioni
 */
export class VirtualAssistant {
  
  /**
   * Analizza un messaggio per trovare riferimenti a immobili
   */
  async analyzeMessageForPropertyReferences(message: string): Promise<PropertyReference[]> {
    try {
      // Recupera tutti gli immobili dal database per il confronto
      const allProperties = await db.select({
        id: properties.id,
        address: properties.address,
        city: properties.city
      }).from(properties);

      // Prepara il messaggio per GPT con il contesto degli immobili disponibili
      const prompt = `
Analizza questo messaggio e identifica riferimenti a immobili presenti nel nostro database.
Messaggio: "${message}"

Immobili disponibili nel database:
${allProperties.map(p => `ID: ${p.id} - ${p.address}, ${p.city || ''}`).join('\n')}

Fornisci un elenco degli immobili menzionati nel messaggio (anche in modo indiretto), con una stima di confidenza (0-1).
Rispondi SOLO in formato JSON:
[
  { "propertyId": 123, "confidence": 0.95 },
  ...
]
Se non ci sono riferimenti ad immobili, restituisci un array vuoto.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const content = response.choices[0].message.content;
      if (!content) return [];
      
      const result = JSON.parse(content);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Errore nell\'analisi del messaggio per riferimenti a immobili:', error);
      return [];
    }
  }

  /**
   * Collega automaticamente un messaggio a un immobile se vengono rilevati riferimenti
   */
  async linkMessageToProperty(communicationId: number, message: string): Promise<void> {
    const propertyReferences = await this.analyzeMessageForPropertyReferences(message);
    
    // Collegamento solo se c'è alta confidenza (> 0.7)
    const highConfidenceReferences = propertyReferences.filter(ref => ref.confidence > 0.7);
    
    for (const ref of highConfidenceReferences) {
      try {
        // Aggiorna la comunicazione con il riferimento all'immobile
        await db.update(communications)
          .set({ propertyId: ref.propertyId })
          .where(eq(communications.id, communicationId));
        
        console.log(`Comunicazione ${communicationId} collegata automaticamente all'immobile ${ref.propertyId}`);
      } catch (err) {
        console.error(`Errore nel collegamento della comunicazione ${communicationId} all'immobile ${ref.propertyId}:`, err);
      }
    }
  }

  /**
   * Suggerisce task da creare in base alle comunicazioni recenti
   */
  async suggestTasksFromCommunication(communicationId: number, message: string, clientId: number): Promise<TaskSuggestion[]> {
    try {
      // Ottiene informazioni sul cliente
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      
      if (!client) return [];

      const prompt = `
Analizza questo messaggio da un cliente immobiliare e suggerisci eventuali attività di follow-up che l'agente dovrebbe eseguire.

Messaggio: "${message}"
Cliente: ${client.firstName} ${client.lastName}

Identifica richieste specifiche, domande o interessi che richiedono un'azione da parte dell'agente immobiliare.
Per ogni azione suggerita, specifica:
1. Un titolo breve per il task
2. Una descrizione dettagliata
3. Una data di scadenza suggerita (in giorni da oggi)
4. Una priorità (1-10, dove 10 è la più alta)

Rispondi SOLO in formato JSON:
[
  {
    "title": "Titolo del task",
    "description": "Descrizione dettagliata",
    "dueDate": 3, 
    "priority": 7
  },
  ...
]
Se non ci sono attività da suggerire, restituisci un array vuoto.
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const content = response.choices[0].message.content;
      if (!content) return [];
      
      const suggestedTasks = JSON.parse(content);
      
      // Converti i giorni in date effettive
      return Array.isArray(suggestedTasks) ? suggestedTasks.map(task => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (task.dueDate || 3));
        return {
          ...task,
          dueDate
        };
      }) : [];
    } catch (error) {
      console.error('Errore nella generazione dei suggerimenti per task:', error);
      return [];
    }
  }

  /**
   * Verifica la presenza di task in scadenza e comunicazioni senza risposta
   */
  async getDashboardSummary() {
    try {
      // Prima query: Task in scadenza
      let upcomingTasks = [];
      
      try {
        // Usa sintassi più semplice per evitare errori
        upcomingTasks = await db.execute(sql`
          SELECT * FROM tasks 
          WHERE status != 'completed' 
          ORDER BY due_date ASC
          LIMIT 10
        `);
      } catch (taskError) {
        console.error("Errore nel recupero dei task:", taskError);
        upcomingTasks = [];
      }
      
      // Seconda query: Messaggi senza risposta
      let unansweredMessages = [];
      
      try {
        // Usa sintassi più semplice per evitare errori
        unansweredMessages = await db.execute(sql`
          SELECT 
            c.id, c.subject, c.content, c.created_at as "createdAt", 
            c.client_id as "clientId", 
            cl.first_name as "clientFirstName", 
            cl.last_name as "clientLastName"
          FROM communications c
          LEFT JOIN clients cl ON c.client_id = cl.id
          WHERE c.direction = 'inbound'
          ORDER BY c.created_at DESC
          LIMIT 10
        `);
      } catch (messageError) {
        console.error("Errore nel recupero dei messaggi:", messageError);
        unansweredMessages = [];
      }
      
      return {
        upcomingTasks,
        unansweredMessages
      };
    } catch (error) {
      console.error('Errore nella generazione del dashboard summary:', error);
      return {
        upcomingTasks: [],
        unansweredMessages: []
      };
    }
  }
}

export const virtualAssistant = new VirtualAssistant();