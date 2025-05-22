import { Router, Request, Response } from 'express';
import { virtualAssistant } from '../services/virtualAssistant';
import { db } from '../db';
import { communications, tasks } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Ottiene un riepilogo per la dashboard dell'assistente
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const summary = await virtualAssistant.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    console.error('Errore nel recupero del dashboard summary:', error);
    res.status(500).json({ error: 'Errore nel recupero dei dati della dashboard' });
  }
});

/**
 * Analizza una comunicazione per identificare riferimenti a immobili
 */
router.post('/analyze-message/:communicationId', async (req: Request, res: Response) => {
  const communicationId = parseInt(req.params.communicationId);
  
  try {
    // Ottieni la comunicazione dal database
    const [communication] = await db.select().from(communications).where(eq(communications.id, communicationId));
    
    if (!communication) {
      return res.status(404).json({ error: 'Comunicazione non trovata' });
    }
    
    // Analizza la comunicazione per riferimenti a immobili
    const propertyReferences = await virtualAssistant.analyzeMessageForPropertyReferences(communication.body);
    
    // Se ci sono riferimenti ad alta confidenza, collega la comunicazione
    if (propertyReferences.some(ref => ref.confidence > 0.7)) {
      await virtualAssistant.linkMessageToProperty(communicationId, communication.body);
    }
    
    res.json({ propertyReferences });
  } catch (error) {
    console.error('Errore nell\'analisi della comunicazione:', error);
    res.status(500).json({ error: 'Errore nell\'analisi della comunicazione' });
  }
});

/**
 * Suggerisce task basati su una comunicazione
 */
router.post('/suggest-tasks/:communicationId', async (req: Request, res: Response) => {
  const communicationId = parseInt(req.params.communicationId);
  
  try {
    // Ottieni la comunicazione dal database
    const [communication] = await db.select().from(communications).where(eq(communications.id, communicationId));
    
    if (!communication) {
      return res.status(404).json({ error: 'Comunicazione non trovata' });
    }
    
    if (!communication.clientId) {
      return res.status(400).json({ error: 'La comunicazione non è associata a un cliente' });
    }
    
    // Suggerisci task basati sulla comunicazione
    const suggestedTasks = await virtualAssistant.suggestTasksFromCommunication(
      communicationId,
      communication.body,
      communication.clientId
    );
    
    res.json({ suggestedTasks });
  } catch (error) {
    console.error('Errore nella generazione dei suggerimenti per task:', error);
    res.status(500).json({ error: 'Errore nella generazione dei suggerimenti per task' });
  }
});

/**
 * Crea un task dal suggerimento
 */
router.post('/create-task', async (req: Request, res: Response) => {
  const { title, description, dueDate, priority, clientId, propertyId } = req.body;
  
  try {
    // Inserisci il task nel database
    const [newTask] = await db.insert(tasks)
      .values({
        type: 'followUp', // Tipo predefinito per i task creati dall'assistente
        title,
        description,
        dueDate: dueDate.toString(), // Converti la data in stringa per soddisfare il tipo richiesto
        status: 'pending',
        clientId,
        propertyId,
        createdAt: new Date().toISOString()
      })
      .returning();
    
    res.json(newTask);
  } catch (error) {
    console.error('Errore nella creazione del task:', error);
    res.status(500).json({ error: 'Errore nella creazione del task' });
  }
});

export default router;