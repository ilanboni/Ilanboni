/**
 * Script di test per creazione cliente
 * Da eseguire con:
 * node server/test-client.js
 */

const { pool } = require('./db');

async function createTestClient() {
  try {
    console.log('Avvio test creazione cliente...');
    
    // Crea una query SQL che rispetta i nomi delle colonne del database
    const query = `
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
    
    // Esegui la query con i valori
    const result = await pool.query(query, [
      'buyer',           // type
      'egr_dott',        // salutation
      'Mario',           // first_name
      'Rossi',           // last_name
      false,             // is_friend
      'mario@test.com',  // email
      '393341234567',    // phone
      'catholic',        // religion
      'sale',            // contract_type
      'Cliente test'     // notes
    ]);
    
    // Ottieni l'ID del cliente creato
    const clientId = result.rows[0].id;
    console.log(`Cliente creato con ID: ${clientId}`);
    
    // Crea il record buyer corrispondente
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
    
    // Area di ricerca semplice (esempio GeoJSON)
    const searchArea = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [9.163, 45.471],
            [9.167, 45.456],
            [9.184, 45.460],
            [9.182, 45.470],
            [9.174, 45.473],
            [9.163, 45.471]
          ]
        ]
      }
    };
    
    // Esegui la query buyer
    const buyerResult = await pool.query(buyerQuery, [
      clientId,         // client_id
      JSON.stringify(searchArea), // search_area (GeoJSON)
      50,               // min_size
      500000,           // max_price
      3,                // urgency
      4,                // rating
      'Test preferenze' // search_notes
    ]);
    
    const buyerId = buyerResult.rows[0].id;
    console.log(`Buyer creato con ID: ${buyerId}`);
    
    console.log('Test completato con successo!');
    return { clientId, buyerId };
  } catch (error) {
    console.error('ERRORE durante il test:', error);
    throw error;
  } finally {
    // Chiudi la connessione
    pool.end();
  }
}

// Esegui lo script
createTestClient()
  .then(result => {
    console.log('Cliente e buyer creati:', result);
    process.exit(0);
  })
  .catch(err => {
    console.error('Errore fatale:', err);
    process.exit(1);
  });