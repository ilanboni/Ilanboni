// server_direct.js - Server diretto senza dipendenze complesse
import express from 'express';
import cors from 'cors';
import { Pool } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Configura path per ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crea il server Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware per il debug dei dati in ingresso
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PATCH') {
    console.log(`[${req.method}] ${req.path}`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// Endpoint di test
app.get('/api/ping', (req, res) => {
  res.json({ message: 'Server funzionante!', timestamp: new Date().toISOString() });
});

// Endpoint per ottenere tutti i clienti
app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY id DESC');
    
    // Converti da snake_case a camelCase
    const clients = result.rows.map(client => ({
      id: client.id,
      type: client.type,
      salutation: client.salutation,
      firstName: client.first_name,
      lastName: client.last_name,
      isFriend: client.is_friend,
      email: client.email,
      phone: client.phone,
      religion: client.religion,
      contractType: client.contract_type,
      notes: client.notes
    }));
    
    res.json(clients);
  } catch (error) {
    console.error('Errore nel recuperare i clienti:', error);
    res.status(500).json({ error: 'Errore nel recuperare i clienti', details: error.message });
  }
});

// Endpoint per creare un nuovo cliente
app.post('/api/clients', async (req, res) => {
  const client = await pool.connect();
  
  try {
    console.log('🟢 DATI RICEVUTI:', JSON.stringify(req.body, null, 2));
    
    // Estrai i dati dal body della richiesta (in camelCase)
    const {
      type = 'buyer',
      salutation = '',
      firstName,
      lastName,
      isFriend = false,
      email = '',
      phone,
      religion = '',
      contractType = null,
      notes = '',
      buyer
    } = req.body;
    
    // Valida i dati minimi
    if (!firstName || !lastName || !phone) {
      return res.status(400).json({
        error: 'Dati mancanti',
        message: 'Nome, cognome e telefono sono obbligatori'
      });
    }

    // Inizia una transazione
    await client.query('BEGIN');
    
    // Inserisci il cliente (converti da camelCase a snake_case)
    const clientResult = await client.query(`
      INSERT INTO clients (
        type, salutation, first_name, last_name, is_friend, 
        email, phone, religion, contract_type, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, type, first_name, last_name, phone
    `, [
      type,
      salutation,
      firstName,
      lastName,
      isFriend,
      email,
      phone,
      religion,
      contractType,
      notes
    ]);
    
    const newClient = clientResult.rows[0];
    console.log('✅ Cliente inserito:', newClient);
    
    // Se è un acquirente, inserisci anche i dati dell'acquirente
    if (type === 'buyer' && buyer) {
      const buyerData = {
        searchArea: buyer.searchArea || null,
        minSize: buyer.minSize ? parseInt(buyer.minSize) : null,
        maxPrice: buyer.maxPrice ? parseInt(buyer.maxPrice) : null,
        urgency: buyer.urgency ? parseInt(buyer.urgency) : 3,
        rating: buyer.rating ? parseInt(buyer.rating) : 3,
        searchNotes: buyer.searchNotes || ''
      };
      
      await client.query(`
        INSERT INTO buyers (
          client_id, search_area, min_size, max_price, 
          urgency, rating, search_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        newClient.id,
        buyerData.searchArea ? JSON.stringify(buyerData.searchArea) : null,
        buyerData.minSize,
        buyerData.maxPrice,
        buyerData.urgency,
        buyerData.rating,
        buyerData.searchNotes
      ]);
      
      console.log('✅ Dati acquirente inseriti');
    }
    
    // Se è un venditore, inserisci anche i dati del venditore
    if (type === 'seller' && req.body.seller) {
      const sellerData = {
        propertyId: req.body.seller.propertyId ? parseInt(req.body.seller.propertyId) : null
      };
      
      await client.query(`
        INSERT INTO sellers (client_id, property_id)
        VALUES ($1, $2)
      `, [
        newClient.id,
        sellerData.propertyId
      ]);
      
      console.log('✅ Dati venditore inseriti');
    }
    
    // Esegui il commit della transazione
    await client.query('COMMIT');
    
    // Restituisci una risposta di successo con i dati del cliente
    return res.status(201).json({
      message: 'Cliente creato con successo',
      client: {
        id: newClient.id,
        type: newClient.type,
        firstName: newClient.first_name,
        lastName: newClient.last_name,
        phone: newClient.phone
      }
    });
  } catch (error) {
    // In caso di errore, esegui il rollback della transazione
    await client.query('ROLLBACK');
    
    console.error('❌ Errore durante la creazione del cliente:', error);
    res.status(500).json({
      error: 'Errore durante la creazione del cliente',
      message: error.message
    });
  } finally {
    // Rilascia la connessione al client
    client.release();
  }
});

// Avvia il server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server alternativo avviato su http://localhost:${PORT}`);
});