import { eq } from "drizzle-orm";
import { db } from "../db";
import { clients, buyers, communications, properties } from "../../shared/schema";

export interface IdealistaEmailData {
  phoneNumber: string;
  dateTime: string;
  propertyCode: string;
  propertyRef: string;
  status: string;
  duration: number;
}

/**
 * Estrae i dati da una email di Idealista
 */
export function parseIdealistaEmail(subject: string, content: string): IdealistaEmailData | null {
  try {
    // Verifica se è un'email di Idealista
    if (!content.includes('Il team di idealista') || !content.includes('Una persona interessata ai tuoi annunci ti ha chiamato')) {
      return null;
    }

    // Estrae il numero di telefono
    const phoneMatch = content.match(/Numero che ti ha chiamato:\s*(\d+)/);
    if (!phoneMatch) return null;
    
    // Estrae data e ora
    const dateTimeMatch = content.match(/Data e ora:\s*([^\\n]+)/);
    if (!dateTimeMatch) return null;
    
    // Estrae lo stato della chiamata
    const statusMatch = content.match(/Stato:\s*([^\\n]+)/);
    const status = statusMatch ? statusMatch[1].trim() : 'senza risposta';
    
    // Estrae la durata
    const durationMatch = content.match(/Durata secondi:\s*(\d+)/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
    
    // Estrae il codice dell'annuncio e il riferimento
    const propertyMatch = content.match(/Codice annuncio contattato:\s*(\d+)\s*-\s*Rif\.\s*([^\\n]+)/);
    if (!propertyMatch) return null;
    
    return {
      phoneNumber: phoneMatch[1],
      dateTime: dateTimeMatch[1].trim(),
      propertyCode: propertyMatch[1],
      propertyRef: propertyMatch[2].trim(),
      status,
      duration
    };
  } catch (error) {
    console.error('[IDEALISTA] Errore parsing email:', error);
    return null;
  }
}

/**
 * Determina i parametri di ricerca basati sul riferimento della proprietà
 */
function getSearchParametersFromRef(propertyRef: string): {
  maxPrice: number;
  minSize: number;
  searchArea: { lat: number; lng: number; radius: number };
} {
  const refLower = propertyRef.toLowerCase();
  
  // Default per Viale Abruzzi (basato sui clienti reali esistenti)
  if (refLower.includes('abruzzi')) {
    return {
      maxPrice: 715000, // +10% di 650k
      minSize: 108,     // -10% di 120mq
      searchArea: {
        lat: 45.4825,   // Coordinate Viale Abruzzi
        lng: 9.2078,
        radius: 600     // 600m di raggio
      }
    };
  }
  
  // Default generico per Milano
  return {
    maxPrice: 550000,
    minSize: 81,
    searchArea: {
      lat: 45.4642,  // Centro Milano
      lng: 9.1900,
      radius: 800
    }
  };
}

/**
 * Processa un'email di Idealista e crea cliente/buyer/comunicazione
 */
export async function processIdealistaEmail(emailData: IdealistaEmailData): Promise<{
  clientId: number;
  buyerId: number;
  communicationId: number;
  propertyId?: number;
}> {
  console.log('[IDEALISTA] Elaborazione email con dati:', emailData);
  
  try {
    // Verifica se esiste già un cliente con questo numero
    const existingClient = await db.select().from(clients).where(eq(clients.phone, emailData.phoneNumber));
    
    let client;
    if (existingClient.length > 0) {
      client = existingClient[0];
      console.log('[IDEALISTA] Cliente esistente trovato:', client.id);
    } else {
      // Crea nuovo cliente
      const [newClient] = await db.insert(clients).values({
        type: 'buyer',
        salutation: 'egr_dott',
        firstName: '',
        lastName: `Cliente Idealista ${emailData.propertyRef}`,
        phone: emailData.phoneNumber,
        email: null,
        notes: `Cliente creato automaticamente da chiamata Idealista. Interessato all'annuncio ${emailData.propertyCode} - Rif. ${emailData.propertyRef}. Chiamata ricevuta il ${emailData.dateTime}, stato: ${emailData.status}.`,
        contractType: 'sale'
      }).returning();
      
      client = newClient;
      console.log('[IDEALISTA] Nuovo cliente creato:', client.id);
    }
    
    // Ottieni parametri di ricerca
    const searchParams = getSearchParametersFromRef(emailData.propertyRef);
    
    // Crea/aggiorna buyer con area di ricerca
    const existingBuyer = await db.select().from(buyers).where(eq(buyers.clientId, client.id));
    
    let buyer;
    if (existingBuyer.length > 0) {
      // Aggiorna buyer esistente
      const [updatedBuyer] = await db.update(buyers)
        .set({
          maxPrice: searchParams.maxPrice,
          minSize: searchParams.minSize,
          searchArea: JSON.stringify([searchParams.searchArea]),
          searchNotes: `Ricerca aggiornata da chiamata Idealista per ${emailData.propertyRef}. Ultima chiamata: ${emailData.dateTime}`
        })
        .where(eq(buyers.clientId, client.id))
        .returning();
      
      buyer = updatedBuyer;
      console.log('[IDEALISTA] Buyer aggiornato:', buyer.id);
    } else {
      // Crea nuovo buyer
      const [newBuyer] = await db.insert(buyers).values({
        clientId: client.id,
        maxPrice: searchParams.maxPrice,
        minSize: searchParams.minSize,
        searchArea: JSON.stringify([searchParams.searchArea]),
        searchNotes: `Ricerca creata da chiamata Idealista per ${emailData.propertyRef}. Prima chiamata: ${emailData.dateTime}`
      }).returning();
      
      buyer = newBuyer;
      console.log('[IDEALISTA] Nuovo buyer creato:', buyer.id);
    }
    
    // Cerca se esiste una proprietà corrispondente all'annuncio
    let propertyId: number | undefined;
    const properties_list = await db.select().from(properties).where(eq(properties.city, 'Milano'));
    
    // Cerca proprietà che corrisponda al riferimento
    const matchingProperty = properties_list.find(p => 
      p.address?.toLowerCase().includes(emailData.propertyRef.toLowerCase()) ||
      p.description?.toLowerCase().includes(emailData.propertyRef.toLowerCase())
    );
    
    if (matchingProperty) {
      propertyId = matchingProperty.id;
      console.log('[IDEALISTA] Proprietà corrispondente trovata:', propertyId);
    }
    
    // Crea comunicazione
    const communicationResults = await db.insert(communications).values({
      clientId: client.id,
      propertyId: propertyId || null,
      type: 'phone_call',
      subject: `Telefonata ricevuta da Idealista - ${emailData.propertyRef}`,
      content: `Chiamata ricevuta tramite Idealista per l'annuncio ${emailData.propertyCode} - Rif. ${emailData.propertyRef}.\n\nDettagli chiamata:\n- Numero: ${emailData.phoneNumber}\n- Data e ora: ${emailData.dateTime}\n- Stato: ${emailData.status}\n- Durata: ${emailData.duration} secondi\n\nParametri di ricerca automatici:\n- Budget massimo: €${searchParams.maxPrice.toLocaleString()}\n- Metratura minima: ${searchParams.minSize} mq\n- Area: ${emailData.propertyRef} (raggio ${searchParams.searchArea.radius}m)`,
      direction: 'inbound',
      status: emailData.status === 'senza risposta' ? 'pending' : 'completed',
      needsFollowUp: emailData.status === 'senza risposta'
    }).returning();
    
    const communication = Array.isArray(communicationResults) ? communicationResults[0] : communicationResults;
    
    console.log('[IDEALISTA] Comunicazione creata:', communication.id);
    
    return {
      clientId: client.id,
      buyerId: buyer.id,
      communicationId: communication.id,
      propertyId
    };
    
  } catch (error) {
    console.error('[IDEALISTA] Errore durante elaborazione:', error);
    throw error;
  }
}