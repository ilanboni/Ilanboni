import { storage } from "../storage";
import { subDays } from "date-fns";
import { createFollowUpTaskIfNeeded } from "./sentimentAnalysis";

/**
 * Verifica tutte le comunicazioni in uscita degli ultimi X giorni
 * che non hanno ricevuto risposta e crea task di follow-up automatici
 * @param days Giorni indietro per cercare le comunicazioni (default: 10)
 */
export async function checkUnrespondedCommunications(days: number = 10): Promise<void> {
  try {
    console.log(`[SCHEDULER] Controllo comunicazioni senza risposta degli ultimi ${days} giorni...`);
    
    // Calcola la data limite
    const checkDate = subDays(new Date(), days);
    
    // Ottieni tutte le comunicazioni in uscita successive alla data limite
    const communications = await storage.getCommunications({ 
      type: "whatsapp",
      status: "completed"
    });
    
    // Filtra solo comunicazioni in uscita senza follow-up già inviato e create dopo la data limite
    const outboundCommunications = communications
      .filter(comm => 
        comm.direction === "outbound" && 
        !comm.autoFollowUpSent && 
        new Date(comm.createdAt) >= checkDate
      );
    
    console.log(`[SCHEDULER] Trovate ${outboundCommunications.length} comunicazioni da verificare`);
    
    // Per ogni comunicazione, controlla se c'è stata risposta
    let tasksCreated = 0;
    for (const comm of outboundCommunications) {
      if (!comm.clientId) continue;
      
      // Crea un task di follow-up se necessario
      await createFollowUpTaskIfNeeded(comm.id, comm.clientId, comm.propertyId || undefined);
      tasksCreated++;
    }
    
    console.log(`[SCHEDULER] Creati ${tasksCreated} task di follow-up automatici`);
  } catch (error) {
    console.error("[SCHEDULER] Errore durante il controllo delle comunicazioni senza risposta:", error);
  }
}

/**
 * Avvia lo scheduler per il controllo periodico delle comunicazioni senza risposta
 * @param intervalMinutes Intervallo in minuti per il controllo (default: 60 minuti = 1 ora)
 */
export function startFollowUpScheduler(intervalMinutes: number = 60): NodeJS.Timeout {
  console.log(`[SCHEDULER] Avvio scheduler per follow-up automatici ogni ${intervalMinutes} minuti`);
  
  // Esegui subito un primo controllo
  checkUnrespondedCommunications();
  
  // Esegui periodicamente il controllo
  const intervalMs = intervalMinutes * 60 * 1000;
  return setInterval(checkUnrespondedCommunications, intervalMs);
}