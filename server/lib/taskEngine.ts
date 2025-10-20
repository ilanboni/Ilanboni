/**
 * Task Engine per Agente Virtuale
 * 
 * Gestisce la creazione automatica di task basati su matching immobili-clienti
 * con logica anti-duplicazione e invio WhatsApp controllato
 */

import { Property, Client, Buyer, Task, Interaction } from "@shared/schema";
import { db } from "../db";
import { tasks, interactions, clients } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { sendWhatsAppMessage } from "./ultramsg";

export type TaskType = 'WHATSAPP_SEND' | 'CALL_OWNER' | 'CALL_AGENCY';

export interface TaskEngineMatch {
  property: Property;
  client: Client & { buyer?: Buyer };
  score: number;
}

export interface TaskEngineDeps {
  upsertTask: (t: Partial<Task> & { type: string; title: string; dueDate: string }) => Promise<void>;
  existsRecentInteraction: (args: { 
    clientId: number; 
    propertyId: number; 
    channel: string; 
    windowDays: number 
  }) => Promise<boolean>;
  logInteraction: (i: Partial<Interaction> & { 
    channel: string; 
    clientId: number; 
    propertyId: number 
  }) => Promise<void>;
  env: {
    MATCH_SCORE_THRESHOLD: number;
    ANTI_DUP_WINDOW_DAYS: number;
    WHATSAPP_SEND_ENABLED: boolean;
    TEST_WHATSAPP_PHONE: string;
  };
}

/**
 * Crea task automatici basati sui match immobili-clienti
 * con logica anti-duplicazione e controllo invio WhatsApp
 */
export async function createTasksFromMatches(
  matches: TaskEngineMatch[],
  deps: TaskEngineDeps
): Promise<number> {
  const th = deps.env.MATCH_SCORE_THRESHOLD ?? 70;
  const win = deps.env.ANTI_DUP_WINDOW_DAYS ?? 30;
  const canSend = !!deps.env.WHATSAPP_SEND_ENABLED;
  const testPhone = (deps.env.TEST_WHATSAPP_PHONE || '').replace(/\s+/g, '').replace(/\+/g, '');

  let tasksCreated = 0;

  console.log(`[TaskEngine] Processando ${matches.length} match con soglia ${th}%`);

  for (const { property: P, client: C, score } of matches) {
    if (score < th) {
      console.log(`[TaskEngine] Skip match property=${P.id} client=${C.id} score=${score}% (sotto soglia)`);
      continue;
    }

    let type: TaskType;
    let action = '';
    let target = '';
    let notes = '';

    const phone = (C.phone || '').replace(/\+/g, '').replace(/\s+/g, '');

    // Determina tipo di task in base alle proprietà dell'immobile
    if (P.isOwned || P.isOwned === undefined) {
      // CASO 1: Immobile nostro → WHATSAPP_SEND
      type = 'WHATSAPP_SEND';
      action = 'Invia scheda immobile su WhatsApp';

      const propertyTitle = P.address || 'Immobile';
      const propertyPrice = P.price ? `€${P.price.toLocaleString('it-IT')}` : 'Prezzo da concordare';
      const propertySize = P.size ? `${P.size} mq` : '';
      const propertyFloor = P.floor ? `Piano ${P.floor}` : '';
      const propertyUrl = P.externalLink || '';

      const msg = encodeURIComponent(
        `Ciao ${C.firstName}, ho trovato un immobile in linea con la tua ricerca:\n\n` +
        `${propertyTitle}\n` +
        `${propertyPrice}${propertySize ? ' - ' + propertySize : ''}${propertyFloor ? ' - ' + propertyFloor : ''}\n\n` +
        `${propertyUrl ? 'Link: ' + propertyUrl : ''}`
      );

      target = C.phone;
      notes = `https://wa.me/${phone}?text=${msg}`;

      // Controlla anti-duplicazione per WhatsApp
      const dup = await deps.existsRecentInteraction({
        clientId: C.id,
        propertyId: P.id,
        channel: 'whatsapp',
        windowDays: win
      });

      if (dup) {
        console.log(`[TaskEngine] Skip WHATSAPP_SEND property=${P.id} client=${C.id} - duplicato entro ${win} giorni`);
        continue;
      }

      // INVIO REALE solo se abilitato E numero è quello di test
      if (canSend && phone === testPhone) {
        console.log(`[TaskEngine] 📤 Invio WhatsApp REALE a ${testPhone} per property=${P.id}`);
        
        try {
          // Invia messaggio WhatsApp reale
          const messageText = 
            `Ciao ${C.firstName}, ho trovato un immobile in linea con la tua ricerca:\n\n` +
            `${propertyTitle}\n` +
            `${propertyPrice}${propertySize ? ' - ' + propertySize : ''}${propertyFloor ? ' - ' + propertyFloor : ''}\n\n` +
            `${propertyUrl ? 'Link: ' + propertyUrl : ''}`;

          await sendWhatsAppMessage(phone, messageText);
          
          // Logga l'interazione
          await deps.logInteraction({
            channel: 'whatsapp',
            clientId: C.id,
            propertyId: P.id,
            payloadJson: { message: messageText, sent: true }
          });

          console.log(`[TaskEngine] ✅ WhatsApp inviato con successo`);
        } catch (error) {
          console.error(`[TaskEngine] ❌ Errore invio WhatsApp:`, error);
          // Continua comunque a creare il task
        }
      } else {
        console.log(`[TaskEngine] 📝 Task WhatsApp creato (invio NON attivo o numero diverso da test)`);
      }
    } else if (P.isMultiagency) {
      // CASO 2: Pluricondiviso → CALL_OWNER
      type = 'CALL_OWNER';
      action = 'Cerca numero proprietario e chiamalo';
      target = 'PROPRIETARIO';
      notes = `Di: ho un cliente interessato (${C.firstName} ${C.lastName}). Link: ${P.externalLink || ''}`;

      const dup = await deps.existsRecentInteraction({
        clientId: C.id,
        propertyId: P.id,
        channel: 'call_owner',
        windowDays: win
      });

      if (dup) {
        console.log(`[TaskEngine] Skip CALL_OWNER property=${P.id} client=${C.id} - duplicato entro ${win} giorni`);
        continue;
      }
    } else {
      // CASO 3: Immobile esterno → CALL_AGENCY
      type = 'CALL_AGENCY';
      action = "Chiama l'agenzia e chiedi se collaborano";
      target = P.portal || 'AGENZIA';
      notes = `Cliente ${C.firstName} ${C.lastName}. Chiedi collaborazione. Link: ${P.externalLink || ''}`;
      
      if (P.exclusivityHint) {
        notes += ' [Possibile esclusiva]';
      }

      const dup = await deps.existsRecentInteraction({
        clientId: C.id,
        propertyId: P.id,
        channel: 'call_agency',
        windowDays: win
      });

      if (dup) {
        console.log(`[TaskEngine] Skip CALL_AGENCY property=${P.id} client=${C.id} - duplicato entro ${win} giorni`);
        continue;
      }
    }

    // Crea il task
    const taskTitle = `${type}: ${P.address} → ${C.firstName} ${C.lastName}`;
    const dueDate = new Date().toISOString().split('T')[0]; // Oggi

    await deps.upsertTask({
      type,
      title: taskTitle,
      description: action,
      clientId: C.id,
      propertyId: P.id,
      dueDate,
      action,
      target,
      notes,
      status: 'open'
    });

    tasksCreated++;
    console.log(`[TaskEngine] ✅ Task creato: ${type} property=${P.id} client=${C.id} score=${score}%`);
  }

  console.log(`[TaskEngine] Completato: ${tasksCreated} task creati su ${matches.length} match`);
  return tasksCreated;
}

/**
 * Implementazione default delle dipendenze per uso standalone
 */
export function getDefaultDeps(): TaskEngineDeps {
  return {
    async upsertTask(t) {
      await db.insert(tasks).values({
        ...t,
        dueDate: t.dueDate || new Date().toISOString().split('T')[0]
      } as any);
    },

    async existsRecentInteraction({ clientId, propertyId, channel, windowDays }) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - windowDays);

      const result = await db
        .select({ id: interactions.id })
        .from(interactions)
        .where(
          and(
            eq(interactions.clientId, clientId),
            eq(interactions.propertyId, propertyId),
            eq(interactions.channel, channel),
            gte(interactions.createdAt, cutoffDate)
          )
        )
        .limit(1);

      return result.length > 0;
    },

    async logInteraction(i) {
      await db.insert(interactions).values({
        ...i,
        payloadJson: i.payloadJson || {}
      } as any);
    },

    env: {
      MATCH_SCORE_THRESHOLD: Number(process.env.MATCH_SCORE_THRESHOLD || 70),
      ANTI_DUP_WINDOW_DAYS: Number(process.env.ANTI_DUP_WINDOW_DAYS || 30),
      WHATSAPP_SEND_ENABLED: String(process.env.WHATSAPP_SEND_ENABLED || 'false') === 'true',
      TEST_WHATSAPP_PHONE: String(process.env.TEST_WHATSAPP_PHONE || '').replace(/\s+/g, '').replace(/\+/g, '')
    }
  };
}
