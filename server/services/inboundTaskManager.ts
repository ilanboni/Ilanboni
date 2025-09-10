import { storage } from "../storage";
import { format } from "date-fns";
import { it } from "date-fns/locale";

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
    console.log(`[INBOUND-TASK] Creazione task automatico per comunicazione ${communicationId}`);

    // Determina informazioni cliente
    let clientInfo = '';
    let contactPhone = '';
    if (clientId) {
      const client = await storage.getClient(clientId);
      if (client) {
        clientInfo = `${client.firstName} ${client.lastName}`.trim() || 'Cliente';
        contactPhone = client.phone || '';
      }
    }

    // Determina informazioni immobile
    let propertyInfo = '';
    let taskPropertyId = propertyId || undefined;
    let taskSharedPropertyId = sharedPropertyId || undefined;

    if (propertyId) {
      const property = await storage.getProperty(propertyId);
      if (property) {
        propertyInfo = ` per l'immobile in ${property.address}`;
      }
    } else if (sharedPropertyId) {
      const sharedProperty = await storage.getSharedProperty(sharedPropertyId);
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
      clientId: clientId || null,
      propertyId: taskPropertyId || null,
      sharedPropertyId: taskSharedPropertyId || null,
      dueDate,
      status: 'pending',
      contactPhone: contactPhone || null,
      notes: `Task creato automaticamente da comunicazione ${communicationType} ID: ${communicationId}`
    });

    console.log(`[INBOUND-TASK] ✅ Task creato con ID ${task.id}: ${title}`);

  } catch (error) {
    console.error(`[INBOUND-TASK] ❌ Errore creazione task per comunicazione ${communicationId}:`, error);
  }
}

/**
 * Verifica e crea task per comunicazioni in ingresso senza task associati
 * Utile per recuperare comunicazioni passate che non hanno generato task
 */
export async function backfillInboundTasks(): Promise<void> {
  try {
    console.log('[INBOUND-TASK] Avvio backfill task per comunicazioni in ingresso...');

    // Recupera tutte le comunicazioni inbound recenti (ultimi 7 giorni) che necessitano risposta
    const communications = await storage.getCommunications({
      direction: 'inbound',
      needsResponse: true
    });

    console.log(`[INBOUND-TASK] Trovate ${communications.length} comunicazioni inbound da elaborare`);

    let tasksCreated = 0;
    for (const comm of communications) {
      // Verifica se esiste già un task per questa comunicazione
      const existingTasks = await storage.getTasks({
        type: 'call_response'
      });

      // Cerca task che potrebbero essere collegati a questa comunicazione
      const hasExistingTask = existingTasks.some(task => 
        task.clientId === comm.clientId && 
        task.notes?.includes(`comunicazione ${comm.type}`)
      );

      if (!hasExistingTask) {
        await createInboundTask(
          comm.id,
          comm.clientId || undefined,
          comm.propertyId || undefined,
          comm.sharedPropertyId || undefined,
          comm.type,
          comm.content || ''
        );
        tasksCreated++;
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

    // Trova task pendenti per questo cliente relativo al tipo di comunicazione
    const tasks = await storage.getTasks({
      clientId,
      status: 'pending',
      type: 'call_response'
    });

    let tasksCompleted = 0;
    for (const task of tasks) {
      if (task.notes?.includes(`comunicazione ${communicationType}`)) {
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