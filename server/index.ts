import express from 'express';
import sqlDirectRoutes from './routes/sql-direct'; // <-- Assicurati che il percorso sia corretto
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware per leggere JSON (fetch con Content-Type: application/json)
app.use(express.json());

// ✅ Middleware per leggere dati da form HTML classici (Content-Type: application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));

// ✅ Serve file statici (es. cliente-sql.html nella cartella client/public)
// In ES modules non esiste __dirname, quindi usiamo l'alternativa
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, '../client/public')));

// ✅ Registra il tuo router con l'endpoint diretto
app.use('/api', sqlDirectRoutes);

// ✅ Avvia il server
app.listen(PORT, () => {
  console.log(`✅ Server avviato su http://localhost:${PORT}`);
});
