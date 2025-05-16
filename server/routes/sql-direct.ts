/**
 * Endpoint ultra diretto per salvare clienti direttamente via SQL
 * Questo endpoint bypassa completamente l'ORM e usa query SQL dirette
 */

import { Request, Response, Router } from 'express';
import { Pool } from '@neondatabase/serverless';

// Utilizza direttamente il pool di connessioni
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  console.log("===============================================");
  console.log("[SQL-DIRECT] Avvio salvataggio cliente ultra-diretto");
  console.log("[SQL-DIRECT] Dati ricevuti:", JSON.stringify(req.body, null, 2));
  
  // Controllo dati minimi
  if (!req.body || !req.body.firstName || !req.body.lastName || !req.body.phone) {
    return res.status(400).json({
      success: false,
      error: "Dati minimi mancanti",
      message: "Nome, cognome e telefono sono obbligatori"
    });
  }
  
  // Connessione al database
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Costruisci l'oggetto cliente con i campi in formato snake_case
    const clientData = {
      type: req.body.type || "buyer",
      salutation: req.body.salutation || "",
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      is_friend: req.body.isFriend === true,
      email: req.body.email || "",
      phone: req.body.phone,
      religion: req.body.religion || "",
      contract_type: req.body.contractType || null,
      notes: req.body.notes || ""
    };
    
    // Inserisci il cliente
    const clientResult = await client.query(`
      INSERT INTO clients (
        type, salutation, first_name, last_name, is_friend, 
        email, phone, religion, contract_type, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, type, first_name, last_name, phone
    `, [
      clientData.type,
      clientData.salutation,
      clientData.first_name,
      clientData.last_name,
      clientData.is_friend,
      clientData.email,
      clientData.phone,
      clientData.religion,
      clientData.contract_type,
      clientData.notes
    ]);
    
    const newClient = clientResult.rows[0];
    console.log("[SQL-DIRECT] Cliente inserito:", newClient);
    
    // Se è un buyer, crea le preferenze
    if (clientData.type === "buyer" && req.body.buyer) {
      const buyerData = {
        searchArea: req.body.buyer.searchArea || null,
        minSize: req.body.buyer.minSize ? parseInt(String(req.body.buyer.minSize)) : null,
        maxPrice: req.body.buyer.maxPrice ? parseInt(String(req.body.buyer.maxPrice)) : null,
        urgency: req.body.buyer.urgency ? parseInt(String(req.body.buyer.urgency)) : 3,
        rating: req.body.buyer.rating ? parseInt(String(req.body.buyer.rating)) : 3,
        searchNotes: req.body.buyer.searchNotes || ""
      };
      
      console.log("[SQL-DIRECT] Creazione buyer per cliente id:", newClient.id);
      
      await client.query(`
        INSERT INTO buyers (
          client_id, search_area, min_size, max_price, 
          urgency, rating, search_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        newClient.id,
        JSON.stringify(buyerData.searchArea),
        buyerData.minSize,
        buyerData.maxPrice,
        buyerData.urgency,
        buyerData.rating,
        buyerData.searchNotes
      ]);
      
      console.log("[SQL-DIRECT] Buyer inserito con successo");
    }
    
    // Se è un seller, crea il record del venditore
    if (clientData.type === "seller" && req.body.seller) {
      const sellerData = {
        propertyId: req.body.seller.propertyId ? parseInt(String(req.body.seller.propertyId)) : null
      };
      
      console.log("[SQL-DIRECT] Creazione seller per cliente id:", newClient.id);
      
      await client.query(`
        INSERT INTO sellers (client_id, property_id)
        VALUES ($1, $2)
      `, [
        newClient.id,
        sellerData.propertyId
      ]);
      
      console.log("[SQL-DIRECT] Seller inserito con successo");
    }
    
    // Commit della transazione
    await client.query('COMMIT');
    
    // Ritorna risposta di successo
    return res.status(201).json({
      success: true,
      message: "Cliente creato con successo",
      client: {
        id: newClient.id,
        type: clientData.type,
        firstName: clientData.first_name,
        lastName: clientData.last_name,
        phone: clientData.phone
      }
    });
  } catch (error: any) {
    // Rollback in caso di errore
    await client.query('ROLLBACK');
    console.error("[SQL-DIRECT] Errore durante salvataggio:", error);
    
    return res.status(500).json({
      success: false,
      error: "Errore durante la creazione cliente",
      message: error.message || String(error)
    });
  } finally {
    // Rilascia il client pool
    client.release();
    console.log("[SQL-DIRECT] Fine operazione");
    console.log("===============================================");
  }
});

export default router;