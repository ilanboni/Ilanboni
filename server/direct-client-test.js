/**
 * Test di inserimento diretto di un cliente nel database
 * Questo script può essere eseguito manualmente per verificare la corretta creazione di un cliente
 */

// Database
const { db } = require('./db');

async function testCreateClient() {
  console.log("Test di creazione cliente...");
  
  try {
    // Dati cliente in formato snake_case
    const clientData = {
      type: "buyer",
      salutation: "egr_dott",
      first_name: "Mario",
      last_name: "Rossi",
      is_friend: false,
      email: "test@example.com",
      phone: "393334455667",
      religion: "none",
      birthday: null, 
      contract_type: "sale",
      notes: "Cliente inserito direttamente tramite SQL"
    };
    
    // Inserisci cliente
    const clientResult = await db.query(`
      INSERT INTO clients (type, salutation, first_name, last_name, is_friend, email, phone, religion, contract_type, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
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
    
    const clientId = clientResult.rows[0].id;
    console.log(`Cliente creato con successo! ID: ${clientId}`);
    
    // Dati buyer
    const buyerData = {
      client_id: clientId,
      min_size: 60,
      max_price: 300000,
      urgency: 3,
      rating: 4,
      search_notes: "Note di test"
    };
    
    // Inserisci buyer
    await db.query(`
      INSERT INTO buyers (client_id, min_size, max_price, urgency, rating, search_notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      buyerData.client_id,
      buyerData.min_size,
      buyerData.max_price,
      buyerData.urgency,
      buyerData.rating,
      buyerData.search_notes
    ]);
    
    console.log(`Preferenze buyer create con successo!`);
    console.log("Test completato con successo!");
    
    return { clientId, message: "Cliente creato con successo" };
  } catch (error) {
    console.error("ERRORE durante il test:", error);
    throw error;
  }
}

// Esporta la funzione
module.exports = { testCreateClient };