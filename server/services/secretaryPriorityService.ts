import { db } from "../db";
import { sharedProperties, tasks, contacts } from "@shared/schema";
import { eq, and, ne, isNull, isNotNull, desc } from "drizzle-orm";

/**
 * Servizio per calcolare priorità contatti segretaria
 * Ordine priorità:
 * 1. PRIVATI (no agenzie) - priorità 90-100
 * 2. MULTI-AGENCY (2+ agenzie) - priorità 70-80
 * 3. MONO-AGENCY (1 agenzia) - priorità 40-60
 */

export interface PriorityResult {
  type: 'private' | 'multi' | 'mono';
  priority: number;
  agencyCount: number;
  agencies: string[];
}

/**
 * Analizza una shared property e calcola la priorità
 */
export function calculateSharedPropertyPriority(sp: any): PriorityResult {
  const agencies: string[] = [];
  
  if (sp.agency1Name) agencies.push(sp.agency1Name);
  if (sp.agency2Name) agencies.push(sp.agency2Name);
  if (sp.agency3Name) agencies.push(sp.agency3Name);

  const agencyCount = agencies.length;

  if (agencyCount === 0) {
    // PRIVATO - priorità massima
    return {
      type: 'private',
      priority: 95,
      agencyCount: 0,
      agencies: []
    };
  } else if (agencyCount >= 2) {
    // MULTI-AGENCY - priorità alta
    return {
      type: 'multi',
      priority: 75,
      agencyCount,
      agencies
    };
  } else {
    // MONO-AGENCY - priorità media
    return {
      type: 'mono',
      priority: 50,
      agencyCount,
      agencies
    };
  }
}

/**
 * Genera task di outreach per shared properties non ancora contattate
 */
export async function generateOutreachTasks() {
  try {
    console.log('[SECRETARY] 🤖 Generazione task outreach per shared properties...');

    // Query shared properties in stage address_found o owner_found non ancora acquisite
    const sharedPropsToContact = await db.select()
      .from(sharedProperties)
      .where(
        and(
          ne(sharedProperties.isAcquired, true),
          isNull(sharedProperties.stageResult)
        )
      )
      .orderBy(desc(sharedProperties.createdAt));

    console.log(`[SECRETARY] Trovate ${sharedPropsToContact.length} shared properties da processare`);

    const tasksCreated = [];

    for (const sp of sharedPropsToContact) {
      // Verifica se esiste già task per questa shared property
      const existingTask = await db.select()
        .from(tasks)
        .where(
          and(
            eq(tasks.sharedPropertyId, sp.id),
            ne(tasks.status, 'done'),
            ne(tasks.status, 'skip')
          )
        )
        .limit(1);

      if (existingTask.length > 0) {
        console.log(`[SECRETARY] ⏭️ Shared property ${sp.id} ha già task attivo`);
        continue;
      }

      // Calcola priorità
      const priorityInfo = calculateSharedPropertyPriority(sp);

      // Determina azione in base a stage
      let action = '';
      let target = '';
      let taskType = '';
      let title = '';

      if (!sp.ownerPhone && !sp.ownerEmail) {
        // Nessun contatto proprietario - cerca su database contatti
        action = 'Ricerca contatto proprietario';
        target = 'DATABASE';
        taskType = 'FIND_OWNER';
        title = `Trova proprietario per ${sp.address}`;
      } else if (sp.ownerPhone) {
        // Abbiamo telefono - chiamata
        action = 'Chiama proprietario per acquisizione';
        target = sp.ownerPhone;
        taskType = 'CALL_OWNER';
        title = `Chiama proprietario ${sp.ownerName || 'N/D'} - ${sp.address}`;
      } else if (sp.ownerEmail) {
        // Solo email - contatto via email
        action = 'Contatta proprietario via email';
        target = sp.ownerEmail;
        taskType = 'EMAIL_OWNER';
        title = `Email proprietario ${sp.ownerName || 'N/D'} - ${sp.address}`;
      } else {
        // Fallback - cerca agenzie
        action = 'Contatta agenzia per informazioni';
        target = 'AGENZIA';
        taskType = 'CALL_AGENCY';
        title = `Contatta agenzia per ${sp.address}`;
      }

      // Crea task
      const today = new Date().toISOString().split('T')[0];
      
      const [newTask] = await db.insert(tasks).values({
        type: taskType,
        title: title,
        description: `${priorityInfo.type.toUpperCase()} (${priorityInfo.agencyCount} agenzie)\nIndirizzo: ${sp.address}\nPrezzo: €${sp.price?.toLocaleString() || 'N/D'}\nmq: ${sp.size || 'N/D'}`,
        sharedPropertyId: sp.id,
        priority: priorityInfo.priority,
        dueDate: today,
        status: 'pending',
        contactName: sp.ownerName || null,
        contactPhone: sp.ownerPhone || null,
        contactEmail: sp.ownerEmail || null,
        action: action,
        target: target,
        notes: `Tipo: ${priorityInfo.type}\nAgenzie: ${priorityInfo.agencies.join(', ') || 'Nessuna'}\nStage: ${sp.stage}`
      }).returning();

      tasksCreated.push(newTask);
      console.log(`[SECRETARY] ✅ Task creato per shared property ${sp.id}: ${title} (priorità ${priorityInfo.priority})`);
    }

    console.log(`[SECRETARY] 🎯 Generati ${tasksCreated.length} task di outreach`);
    return tasksCreated;

  } catch (error) {
    console.error('[SECRETARY] ❌ Errore generazione task outreach:', error);
    throw error;
  }
}

/**
 * Crea contatto da shared property se ha dati proprietario
 */
export async function createContactFromSharedProperty(sharedPropertyId: number) {
  try {
    const sp = await db.select()
      .from(sharedProperties)
      .where(eq(sharedProperties.id, sharedPropertyId))
      .limit(1);

    if (sp.length === 0) {
      throw new Error(`Shared property ${sharedPropertyId} non trovata`);
    }

    const sharedProp = sp[0];

    if (!sharedProp.ownerName && !sharedProp.ownerPhone && !sharedProp.ownerEmail) {
      console.log(`[SECRETARY] ℹ️ Shared property ${sharedPropertyId} non ha dati proprietario`);
      return null;
    }

    // Verifica se contatto esiste già
    const existingContact = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.type, 'owner'),
          eq(contacts.phone, sharedProp.ownerPhone || ''),
          eq(contacts.email, sharedProp.ownerEmail || '')
        )
      )
      .limit(1);

    if (existingContact.length > 0) {
      console.log(`[SECRETARY] ℹ️ Contatto già esistente per shared property ${sharedPropertyId}`);
      return existingContact[0];
    }

    // Crea nuovo contatto
    const [newContact] = await db.insert(contacts).values({
      type: 'owner',
      name: sharedProp.ownerName || 'Proprietario N/D',
      phone: sharedProp.ownerPhone || null,
      email: sharedProp.ownerEmail || null,
      notes: `Proprietario immobile ${sharedProp.address}\nPrezzo: €${sharedProp.price?.toLocaleString() || 'N/D'}\nmq: ${sharedProp.size || 'N/D'}`
    }).returning();

    console.log(`[SECRETARY] ✅ Contatto creato per shared property ${sharedPropertyId}`);
    return newContact;

  } catch (error) {
    console.error(`[SECRETARY] ❌ Errore creazione contatto:`, error);
    throw error;
  }
}
