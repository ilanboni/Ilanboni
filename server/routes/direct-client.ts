/**
 * Route specifiche per la creazione diretta di clienti
 */
import { Request, Response, Router } from 'express';
import { db } from '../db';

const router = Router();

// Endpoint per la creazione diretta di clienti con SQL
router.post('/create', async (req: Request, res: Response) => {
  console.log("===============================================");
  console.log("[DIRECT] Avvio creazione cliente diretta");
  console.log("[DIRECT] Dati ricevuti:", JSON.stringify(req.body, null, 2));
  
  // Controllo dati minimi
  if (!req.body || !req.body.firstName || !req.body.lastName || !req.body.phone) {
    return res.status(400).json({
      success: false,
      error: "Dati minimi mancanti",
      message: "Nome, cognome e telefono sono obbligatori"
    });
  }
  
  // Inizia una transazione
  const client = await db.client.connect();
  
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
    console.log("[DIRECT] Cliente inserito:", newClient);
    
    // Se è un buyer, crea le preferenze
    if (clientData.type === "buyer" && req.body.buyer) {
      const buyerData = {
        searchArea: req.body.buyer.searchArea,
        minSize: req.body.buyer.minSize ? parseInt(req.body.buyer.minSize) : null,
        maxPrice: req.body.buyer.maxPrice ? parseInt(req.body.buyer.maxPrice) : null,
        urgency: req.body.buyer.urgency ? parseInt(req.body.buyer.urgency) : 3,
        rating: req.body.buyer.rating ? parseInt(req.body.buyer.rating) : 3,
        searchNotes: req.body.buyer.searchNotes || ""
      };
      
      console.log("[DIRECT] Creazione buyer per cliente id:", newClient.id);
      
      await client.query(`
        INSERT INTO buyers (
          client_id, search_area, min_size, max_price, 
          urgency, rating, search_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        newClient.id,
        buyerData.searchArea,
        buyerData.minSize,
        buyerData.maxPrice,
        buyerData.urgency,
        buyerData.rating,
        buyerData.searchNotes
      ]);
      
      console.log("[DIRECT] Buyer inserito con successo");
    }
    
    // Se è un seller, crea il record del venditore
    if (clientData.type === "seller" && req.body.seller) {
      const sellerData = {
        propertyId: req.body.seller.propertyId ? parseInt(req.body.seller.propertyId) : null
      };
      
      console.log("[DIRECT] Creazione seller per cliente id:", newClient.id);
      
      await client.query(`
        INSERT INTO sellers (client_id, property_id)
        VALUES ($1, $2)
      `, [
        newClient.id,
        sellerData.propertyId
      ]);
      
      console.log("[DIRECT] Seller inserito con successo");
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
  } catch (error) {
    // Rollback in caso di errore
    await client.query('ROLLBACK');
    console.error("[DIRECT] Errore durante la creazione diretta:", error);
    
    return res.status(500).json({
      success: false,
      error: "Errore durante la creazione cliente",
      message: error.message
    });
  } finally {
    // Rilascia il client pool
    client.release();
    console.log("[DIRECT] Fine operazione");
    console.log("===============================================");
  }
});

export default router;