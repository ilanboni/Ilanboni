import { storage } from "../storage";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// CORREZIONE CRITICA: Sistema idempotente per prevenire duplicazioni
const processedByCommunicationId = new Map<number, number>(); // commId → taskId
const creationMutex = new Map<number, boolean>(); // commId → isCreating

/**
 * Hydrata l'indice delle comunicazioni processate dal database esistente
 */
async function hydrateProcessedCommunications(): Promise<void> {
  try {
    const allTasks = await storage.getTasks();
    
    for (const task of allTasks) {
      if (task.notes) {
        // Estrai ID comunicazione dalle note usando regex robusto
        const match = task.notes.match(/\bID:\s*(\d+)\b/);
        if (match) {
          const commId = parseInt(match[1]);
          processedByCommunicationId.set(commId, task.id);
        }
      }
    }
    
    console.log(`[INBOUND-TASK] 🔄 Hydratato indice: ${processedByCommunicationId.size} comunicazioni processate`);
  } catch (error) {
    console.error('[INBOUND-TASK] ❌ Errore hydratazione indice:', error);
  }
}

// Hydrata l'indice all'avvio del modulo
hydrateProcessedCommunications();

/**
 * Crea automaticamente un task per una comunicazione in ingresso
 * @param communicationId ID della comunicazione
 * @param clientId ID del cliente (se disponibile)
 * @param propertyId ID dell'immobile (se disponibile)
 * @param sharedPropertyId ID dell'immobile condiviso (se disponibile)
 * @param communicationType Tipo di comunicazione (whatsapp, email, phone)
 * @param content Contenuto del messaggio/chiamata
 */
export async function createInboundTask(
  communicationId: number,
  clientId?: number,
  propertyId?: number,
  sharedPropertyId?: number,
  communicationType: string = 'whatsapp',
  content: string = ''
): Promise<void> {
  try {
    // CORREZIONE CRITICA: Controllo idempotente per evitare duplicazioni
    if (processedByCommunicationId.has(communicationId)) {
      const existingTaskId = processedByCommunicationId.get(communicationId);
      console.log(`[INBOUND-TASK] ⏭️  Task già esistente per comunicazione ${communicationId} (task ID: ${existingTaskId}), saltato`);
      return;
    }

    // CORREZIONE CRITICA: Mutex per prevenire creazioni concorrenti
    if (creationMutex.get(communicationId)) {
      console.log(`[INBOUND-TASK] ⏸️  Creazione in corso per comunicazione ${communicationId}, aspetto...`);
      return;
    }

    // Imposta mutex
    creationMutex.set(communicationId, true);
    
    console.log(`[INBOUND-TASK] Creazione task automatico per comunicazione ${communicationId}`);

    // CORREZIONE CRITICA: Carica la comunicazione completa per dati accurati
    const communication = await storage.getCommunication(communicationId);
    if (!communication) {
      console.warn(`[INBOUND-TASK] ⚠️ Comunicazione ${communicationId} non trovata, usando dati passati`);
    }

    // Usa i dati della comunicazione quando disponibili
    const actualClientId = clientId || communication?.clientId;
    const actualPropertyId = propertyId || communication?.propertyId;
    const actualSharedPropertyId = sharedPropertyId || communication?.sharedPropertyId;
    const actualContent = content || communication?.content || '';
    const actualType = communicationType || communication?.type || 'whatsapp';

    // Determina informazioni cliente
    let clientInfo = '';
    let contactPhone = '';
    if (actualClientId) {
      const client = await storage.getClient(actualClientId);
      if (client) {
        clientInfo = `${client.firstName} ${client.lastName}`.trim() || 'Cliente';
        contactPhone = client.phone || '';
      }
    }
    
    // Se non c'è un cliente, prova ad estrarre il telefono dalla comunicazione
    if (!contactPhone && communication) {
      contactPhone = communication.senderPhone || communication.contactPhone || '';
    }

    // Determina informazioni immobile
    let propertyInfo = '';
    let taskPropertyId = actualPropertyId || undefined;
    let taskSharedPropertyId = actualSharedPropertyId || undefined;

    if (actualPropertyId) {
      const property = await storage.getProperty(actualPropertyId);
      if (property) {
        propertyInfo = ` per l'immobile in ${property.address}`;
      }
    } else if (actualSharedPropertyId) {
      const sharedProperty = await storage.getSharedProperty(actualSharedPropertyId);
      if (sharedProperty) {
        propertyInfo = ` per l'immobile in ${sharedProperty.address}`;
      }
    }

    // Determina il tipo di task e titolo
    let taskType = 'call_response';
    let title = '';
    let description = '';

    switch (communicationType) {
      case 'whatsapp':
        title = clientInfo 
          ? `Rispondere a ${clientInfo} su WhatsApp${propertyInfo}`
          : `Gestire messaggio WhatsApp da ${contactPhone}${propertyInfo}`;
        description = `Messaggio WhatsApp ricevuto: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`;
        break;
      case 'email':
        title = clientInfo 
          ? `Rispondere email a ${clientInfo}${propertyInfo}`
          : `Gestire email${propertyInfo}`;
        description = `Email ricevuta: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`;
        break;
      case 'phone':
        title = clientInfo 
          ? `Richiamare ${clientInfo}${propertyInfo}`
          : `Gestire chiamata da ${contactPhone}${propertyInfo}`;
        description = `Chiamata ricevuta`;
        break;
      default:
        title = clientInfo 
          ? `Rispondere a ${clientInfo}${propertyInfo}`
          : `Gestire comunicazione${propertyInfo}`;
        description = `Comunicazione ricevuta: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`;
    }

    // Se non c'è un cliente specifico, è un task generico
    if (!clientId && !propertyId && !sharedPropertyId) {
      taskType = 'generic_call';
      title = contactPhone 
        ? `Gestire chiamata da ${contactPhone}`
        : 'Gestire comunicazione ricevuta';
      description += '\n\nTask generico: assegna a un immobile, crea nuovo cliente o elimina se non necessario.';
    }

    // Data di scadenza: domani per task urgenti
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = format(tomorrow, 'yyyy-MM-dd');

    // Crea il task
    const task = await storage.createTask({
      type: taskType,
      title,
      description,
      clientId: actualClientId || null,
      propertyId: taskPropertyId || null,
      sharedPropertyId: taskSharedPropertyId || null,
      dueDate,
      status: 'pending',
      contactPhone: contactPhone || null,
      notes: `Task creato automaticamente da comunicazione ${actualType} ID: ${communicationId}`
    });

    // CORREZIONE CRITICA: Registra nell'indice per evitare duplicazioni future
    processedByCommunicationId.set(communicationId, task.id);

    console.log(`[INBOUND-TASK] ✅ Task creato con ID ${task.id}: ${title}`);

  } catch (error) {
    console.error(`[INBOUND-TASK] ❌ Errore creazione task per comunicazione ${communicationId}:`, error);
  } finally {
    // CORREZIONE CRITICA: Rimuovi mutex sempre, anche in caso di errore
    creationMutex.delete(communicationId);
  }
}

/**
 * Verifica e crea task per comunicazioni in ingresso senza task associati
 * Utile per recuperare comunicazioni passate che non hanno generato task
 */
export async function backfillInboundTasks(): Promise<void> {
  try {
    console.log('[INBOUND-TASK] 🔄 Avvio backfill task per comunicazioni inbound...');

    // Filtra per ultimi 7 giorni per evitare processare tutta la storia
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // CORREZIONE: getCommunications non supporta filtri, implementa filtraggio manuale
    const allCommunications = await storage.getCommunications();
    const communications = allCommunications.filter(comm => {
      const commDate = new Date(comm.createdAt || comm.timestamp || 0);
      return commDate >= sevenDaysAgo;
    });

    console.log(`[INBOUND-TASK] Trovate ${communications.length} comunicazioni recenti da elaborare`);

    // CORREZIONE CRITICA: Carica tutti i task UNA VOLTA per evitare O(N^2)
    const allTasks = await storage.getTasks();

    let tasksCreated = 0;
    for (const comm of communications) {
      // CORREZIONE CRITICA: Verifica esistenza ROBUSTA per ID comunicazione unico
      const commIdString = comm.id.toString();
      const hasExistingTask = allTasks.some(task => {
        if (!task.notes) return false;
        
        // Verifica multipli pattern per essere certi
        return task.notes.includes(`ID: ${commIdString}`) ||
               task.notes.includes(`comunicazione whatsapp ID: ${commIdString}`) ||
               task.notes.includes(`comunicazione email ID: ${commIdString}`) ||
               task.notes.includes(`comunicazione phone ID: ${commIdString}`) ||
               task.notes.includes(` ID: ${commIdString}`)  // Con spazio prima
      });

      if (!hasExistingTask) {
        console.log(`[INBOUND-TASK] Creando task per comunicazione ${comm.id} (tipo: ${comm.type})`);
        await createInboundTask(
          comm.id,
          comm.clientId || undefined,
          comm.propertyId || undefined,
          comm.sharedPropertyId || undefined,
          comm.type,
          comm.content || ''
        );
        tasksCreated++;
      } else {
        console.log(`[INBOUND-TASK] ⏭️  Task già esistente per comunicazione ${comm.id}, saltato`);
      }
    }

    console.log(`[INBOUND-TASK] ✅ Backfill completato: ${tasksCreated} task creati`);

  } catch (error) {
    console.error('[INBOUND-TASK] ❌ Errore durante backfill task:', error);
  }
}

/**
 * Marca un task di comunicazione come completato quando viene inviata una risposta
 * @param clientId ID del cliente
 * @param communicationType Tipo di comunicazione
 */
export async function markInboundTaskCompleted(
  clientId: number,
  communicationType: string = 'whatsapp'
): Promise<void> {
  try {
    console.log(`[INBOUND-TASK] Marcatura task completati per cliente ${clientId} (${communicationType})`);

    // Trova task pendenti relativo al tipo di comunicazione
    const tasks = await storage.getTasks({
      status: 'pending',
      type: 'call_response'
    });

    let tasksCompleted = 0;
    for (const task of tasks) {
      // Filtra per clientId e tipo di comunicazione
      if (task.clientId === clientId && task.notes?.includes(`comunicazione ${communicationType}`)) {
        await storage.updateTask(task.id, {
          status: 'completed'
        });
        tasksCompleted++;
        console.log(`[INBOUND-TASK] ✅ Task ${task.id} marcato come completato`);
      }
    }

    console.log(`[INBOUND-TASK] ✅ ${tasksCompleted} task marcati come completati`);

  } catch (error) {
    console.error(`[INBOUND-TASK] ❌ Errore marcatura task completati:`, error);
  }
}