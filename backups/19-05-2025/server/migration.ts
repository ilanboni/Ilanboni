import { db, pool } from './db';
import { sql } from 'drizzle-orm';

// Funzione per eseguire la migrazione
async function runMigration() {
  try {
    // Check if the column exists
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'communications' 
        AND column_name = 'summary'
      );
    `);
    
    const columnExists = result[0]?.exists;
    
    if (!columnExists) {
      console.log('Aggiunta della colonna summary alla tabella communications...');
      await db.execute(sql`
        ALTER TABLE communications
        ADD COLUMN summary TEXT;
      `);
      console.log('Colonna summary aggiunta con successo.');
    } else {
      console.log('La colonna summary esiste già nella tabella communications.');
    }
  } catch (error) {
    console.error('Errore durante la migrazione:', error);
  } finally {
    await pool.end();
  }
}

runMigration();