/**
 * Utility per testare la creazione di un cliente direttamente da JavaScript
 */
const { db } = require('../db');

/**
 * Funzione per creare un cliente di test
 */
async function createTestClient() {
  console.log("Avvio creazione cliente di test...");
  
  try {
    // Dati cliente (snake_case)
    const clientData = {
      type: "buyer",
      salutation: "caro",
      first_name: "Test", 
      last_name: "SQL",
      is_friend: false,
      email: "test@example.com",
      phone: "393334455667",
      religion: "none",
      contract_type: "sale",
      notes: "Cliente inserito direttamente tramite SQL"
    };
    
    // Inserisci cliente
    const result = await db.query(`
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
    
    const cliente = result.rows[0];
    console.log("✅ Cliente creato con successo:", cliente);
    return cliente;
  } catch (error) {
    console.error("❌ Errore durante la creazione del cliente:", error);
    throw error;
  }
}

module.exports = { createTestClient };