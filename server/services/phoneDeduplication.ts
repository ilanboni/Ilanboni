/**
 * Servizio anti-duplicazione contatti WhatsApp
 * 
 * Gestisce il tracking dei numeri di telefono già contattati per evitare:
 * - Doppi contatti allo stesso numero
 * - Contatti ripetuti se l'annuncio viene ripubblicato
 * - Spam involontario
 */

import { storage } from '../storage';
import type { Property } from '@shared/schema';

/**
 * Normalizza un numero di telefono rimuovendo spazi, trattini e prefissi
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Rimuovi tutti i caratteri non numerici
  let normalized = phone.replace(/[^0-9+]/g, '');
  
  // Rimuovi + iniziale
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }
  
  // Se numero italiano senza prefisso, aggiungi 39
  if (normalized.length === 10 && normalized.startsWith('3')) {
    normalized = '39' + normalized;
  }
  
  // Se numero ha 00 all'inizio, rimuovi e prendi il resto
  if (normalized.startsWith('00')) {
    normalized = normalized.substring(2);
  }
  
  return normalized;
}

/**
 * Verifica se un numero è già stato contattato
 */
export async function isPhoneAlreadyContacted(phone: string): Promise<{
  contacted: boolean;
  tracking?: any;
  daysSinceLastContact?: number;
}> {
  const normalizedPhone = normalizePhoneNumber(phone);
  
  if (!normalizedPhone) {
    return { contacted: false };
  }
  
  try {
    const tracking = await storage.getPrivateContactTracking(normalizedPhone);
    
    if (!tracking) {
      return { contacted: false };
    }
    
    // Calcola giorni dall'ultimo contatto
    const lastContactedAt = new Date(tracking.lastContactedAt);
    const now = new Date();
    const daysSinceLastContact = Math.floor(
      (now.getTime() - lastContactedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return {
      contacted: true,
      tracking,
      daysSinceLastContact
    };
  } catch (error) {
    console.error('[PHONE-DEDUP] Errore verifica contatto:', error);
    return { contacted: false };
  }
}

/**
 * Verifica se un numero può essere ricontattato
 * (es: dopo X giorni, o se lo status è cambiato)
 */
export async function canRecontactPhone(
  phone: string,
  minDaysBetweenContacts: number = 30
): Promise<{
  canContact: boolean;
  reason?: string;
  tracking?: any;
}> {
  const result = await isPhoneAlreadyContacted(phone);
  
  if (!result.contacted) {
    return { canContact: true };
  }
  
  const { tracking, daysSinceLastContact } = result;
  
  // Se utente ha risposto "non interessato", non ricontattare
  if (tracking.status === 'do_not_contact') {
    return {
      canContact: false,
      reason: 'Utente ha richiesto di non essere ricontattato',
      tracking
    };
  }
  
  // Se sono passati abbastanza giorni, può essere ricontattato
  if (daysSinceLastContact! >= minDaysBetweenContacts) {
    return {
      canContact: true,
      reason: `Ultimo contatto ${daysSinceLastContact} giorni fa`,
      tracking
    };
  }
  
  // Altrimenti, non ricontattare
  return {
    canContact: false,
    reason: `Contattato ${daysSinceLastContact} giorni fa (minimo: ${minDaysBetweenContacts})`,
    tracking
  };
}

/**
 * Registra un nuovo contatto
 */
export async function trackContact(
  phone: string,
  propertyId: number,
  campaignId?: number
): Promise<void> {
  const normalizedPhone = normalizePhoneNumber(phone);
  
  if (!normalizedPhone) {
    console.warn('[PHONE-DEDUP] Numero telefono invalido:', phone);
    return;
  }
  
  try {
    const existingTracking = await storage.getPrivateContactTracking(normalizedPhone);
    
    if (existingTracking) {
      // Aggiorna tracking esistente
      const metadata = (existingTracking.metadata as any) || {};
      const propertyIds = metadata.propertyIds || [];
      const campaignIds = metadata.campaignIds || [];
      
      // Aggiungi nuovi ID se non già presenti
      if (!propertyIds.includes(propertyId)) {
        propertyIds.push(propertyId);
      }
      if (campaignId && !campaignIds.includes(campaignId)) {
        campaignIds.push(campaignId);
      }
      
      await storage.updatePrivateContactTracking(normalizedPhone, {
        propertyId,
        contactCount: existingTracking.contactCount + 1,
        lastCampaignId: campaignId,
        metadata: {
          ...metadata,
          propertyIds,
          campaignIds,
          lastContactedAt: new Date().toISOString() // Salva in metadata invece che come campo
        }
      });
      
      console.log(`[PHONE-DEDUP] ✅ Tracking aggiornato per ${normalizedPhone} (contatto #${existingTracking.contactCount + 1})`);
    } else {
      // Crea nuovo tracking
      await storage.createPrivateContactTracking({
        phoneNumber: normalizedPhone,
        propertyId,
        contactCount: 1,
        lastCampaignId: campaignId,
        status: 'active',
        metadata: {
          propertyIds: [propertyId],
          campaignIds: campaignId ? [campaignId] : []
        }
      });
      
      console.log(`[PHONE-DEDUP] ✅ Nuovo tracking creato per ${normalizedPhone}`);
    }
  } catch (error) {
    console.error('[PHONE-DEDUP] Errore tracking contatto:', error);
    throw error;
  }
}

/**
 * Marca un numero come "non contattare"
 */
export async function markAsDoNotContact(
  phone: string,
  reason?: string
): Promise<void> {
  const normalizedPhone = normalizePhoneNumber(phone);
  
  if (!normalizedPhone) {
    return;
  }
  
  try {
    await storage.updatePrivateContactTracking(normalizedPhone, {
      status: 'do_not_contact',
      notes: reason || 'Richiesta utente'
    });
    
    console.log(`[PHONE-DEDUP] ❌ Numero ${normalizedPhone} marcato come "do not contact"`);
  } catch (error) {
    console.error('[PHONE-DEDUP] Errore mark as do not contact:', error);
  }
}

/**
 * Marca un numero come "risposto"
 */
export async function markAsResponded(
  phone: string,
  response?: string
): Promise<void> {
  const normalizedPhone = normalizePhoneNumber(phone);
  
  if (!normalizedPhone) {
    return;
  }
  
  try {
    const existingTracking = await storage.getPrivateContactTracking(normalizedPhone);
    const metadata = (existingTracking?.metadata as any) || {};
    
    await storage.updatePrivateContactTracking(normalizedPhone, {
      status: 'responded',
      metadata: {
        ...metadata,
        lastResponse: response,
        respondedAt: new Date().toISOString()
      }
    });
    
    console.log(`[PHONE-DEDUP] ✅ Numero ${normalizedPhone} marcato come "responded"`);
  } catch (error) {
    console.error('[PHONE-DEDUP] Errore mark as responded:', error);
  }
}

/**
 * Filtra una lista di proprietà rimuovendo quelle con numeri già contattati
 */
export async function filterUncontactedProperties(
  properties: Property[],
  minDaysBetweenContacts?: number
): Promise<{
  toContact: Property[];
  alreadyContacted: Property[];
  stats: {
    total: number;
    uncontacted: number;
    recentlyContacted: number;
    doNotContact: number;
  };
}> {
  const toContact: Property[] = [];
  const alreadyContacted: Property[] = [];
  const stats = {
    total: properties.length,
    uncontacted: 0,
    recentlyContacted: 0,
    doNotContact: 0
  };
  
  for (const property of properties) {
    if (!property.ownerPhone) {
      // Senza telefono, non possiamo contattare
      continue;
    }
    
    const canContact = await canRecontactPhone(
      property.ownerPhone,
      minDaysBetweenContacts
    );
    
    if (canContact.canContact) {
      toContact.push(property);
      stats.uncontacted++;
    } else {
      alreadyContacted.push(property);
      
      if (canContact.tracking?.status === 'do_not_contact') {
        stats.doNotContact++;
      } else {
        stats.recentlyContacted++;
      }
    }
  }
  
  console.log(`[PHONE-DEDUP] 📊 Filtro completato:`, stats);
  
  return { toContact, alreadyContacted, stats };
}
