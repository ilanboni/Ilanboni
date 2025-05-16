/**
 * API di Emergenza per la creazione dei clienti
 * 
 * Questo modulo contiene metodi di creazione diretta di clienti/buyer/seller
 * che bypassano completamente la validazione standard e utilizzano query SQL dirette
 * per inserire i dati nel database.
 */

import { Request, Response, Express } from "express";
import { pool } from "./db";

/**
 * Registra le rotte di emergenza
 */
export function registerEmergencyRoutes(app: Express): void {
  // Rotta di test per verificare se il server è attivo
  app.get("/api/emergency/ping", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      message: "Emergency API is active",
      timestamp: new Date().toISOString()
    });
  });

  // Crea un cliente con query SQL diretta
  app.post("/api/emergency/create-client", async (req: Request, res: Response) => {
    console.log("[EMERGENCY API] Richiesta creazione cliente diretto");
    console.log("[EMERGENCY API] Body ricevuto:", JSON.stringify(req.body, null, 2));
    
    try {
      // Validazione dati minimi
      const { type, firstName, lastName, phone } = req.body;
      
      if (!type || !firstName || !lastName || !phone) {
        return res.status(400).json({
          error: "Dati mancanti",
          message: "I campi 'type', 'firstName', 'lastName' e 'phone' sono obbligatori"
        });
      }
      
      // Crea una query SQL che rispetta i nomi delle colonne del database (snake_case)
      const clientQuery = `
        INSERT INTO clients (
          type, 
          salutation, 
          first_name, 
          last_name, 
          is_friend, 
          email, 
          phone, 
          religion,
          contract_type, 
          notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING id;
      `;
      
      // Parametri per la query
      const clientParams = [
        type,                           // type
        req.body.salutation || "",      // salutation
        firstName,                      // first_name
        lastName,                       // last_name
        req.body.isFriend === true,     // is_friend
        req.body.email || "",           // email
        phone,                          // phone
        req.body.religion || "",        // religion
        req.body.contractType || null,  // contract_type
        req.body.notes || ""            // notes
      ];
      
      // Esegui la query client
      const clientResult = await pool.query(clientQuery, clientParams);
      const clientId = clientResult.rows[0].id;
      
      console.log(`[EMERGENCY API] Cliente creato con ID: ${clientId}`);
      
      // Se è un buyer, crea anche il record associato
      if (type === "buyer" && req.body.buyer) {
        try {
          // Parse dei dati numerici con fallback a valori di default
          const minSize = parseInt(req.body.buyer.minSize) || null;
          const maxPrice = parseInt(req.body.buyer.maxPrice) || null;
          const urgency = parseInt(req.body.buyer.urgency) || 3;
          const rating = parseInt(req.body.buyer.rating) || 3;
          
          // Query per il buyer
          const buyerQuery = `
            INSERT INTO buyers (
              client_id,
              search_area,
              min_size,
              max_price,
              urgency,
              rating,
              search_notes
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7
            ) RETURNING id;
          `;
          
          // Parametri per la query buyer
          const buyerParams = [
            clientId,                       // client_id
            JSON.stringify(req.body.buyer.searchArea || null), // search_area
            minSize,                        // min_size
            maxPrice,                       // max_price
            urgency,                        // urgency
            rating,                         // rating
            req.body.buyer.searchNotes || "" // search_notes
          ];
          
          // Esegui la query buyer
          const buyerResult = await pool.query(buyerQuery, buyerParams);
          const buyerId = buyerResult.rows[0].id;
          
          console.log(`[EMERGENCY API] Buyer creato con ID: ${buyerId}`);
          
          // Restuituisci i dati del cliente e del buyer
          return res.status(201).json({
            success: true,
            client: {
              id: clientId,
              type,
              firstName,
              lastName,
              phone
            },
            buyer: {
              id: buyerId,
              clientId,
              minSize,
              maxPrice
            },
            message: "Cliente e buyer creati con successo"
          });
        } catch (buyerError) {
          console.error("[EMERGENCY API] Errore creazione buyer:", buyerError);
          
          // Restituisci comunque il cliente anche se fallisce la creazione del buyer
          return res.status(201).json({
            success: true,
            client: {
              id: clientId,
              type,
              firstName,
              lastName,
              phone
            },
            warning: "Cliente creato ma errore nella creazione del buyer",
            error: String(buyerError)
          });
        }
      }
      
      // Se è un seller, crea anche il record associato
      if (type === "seller" && req.body.seller) {
        try {
          const propertyId = parseInt(req.body.seller.propertyId) || null;
          
          // Query per il seller
          const sellerQuery = `
            INSERT INTO sellers (
              client_id,
              property_id
            ) VALUES (
              $1, $2
            ) RETURNING id;
          `;
          
          // Parametri per la query seller
          const sellerParams = [
            clientId,    // client_id
            propertyId   // property_id
          ];
          
          // Esegui la query seller
          const sellerResult = await pool.query(sellerQuery, sellerParams);
          const sellerId = sellerResult.rows[0].id;
          
          console.log(`[EMERGENCY API] Seller creato con ID: ${sellerId}`);
          
          // Restuituisci i dati del cliente e del seller
          return res.status(201).json({
            success: true,
            client: {
              id: clientId,
              type,
              firstName,
              lastName,
              phone
            },
            seller: {
              id: sellerId,
              clientId,
              propertyId
            },
            message: "Cliente e seller creati con successo"
          });
        } catch (sellerError) {
          console.error("[EMERGENCY API] Errore creazione seller:", sellerError);
          
          // Restituisci comunque il cliente anche se fallisce la creazione del seller
          return res.status(201).json({
            success: true,
            client: {
              id: clientId,
              type,
              firstName,
              lastName,
              phone
            },
            warning: "Cliente creato ma errore nella creazione del seller",
            error: String(sellerError)
          });
        }
      }
      
      // Se non è né buyer né seller, restituisci solo i dati del cliente
      return res.status(201).json({
        success: true,
        client: {
          id: clientId,
          type,
          firstName,
          lastName,
          phone
        },
        message: "Cliente creato con successo"
      });
      
    } catch (error) {
      console.error("[EMERGENCY API] Errore generale:", error);
      return res.status(500).json({
        success: false,
        error: "Errore durante la creazione del cliente",
        details: String(error)
      });
    }
  });
}