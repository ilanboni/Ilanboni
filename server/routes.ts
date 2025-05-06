import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCommunicationSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // API per la gestione delle comunicazioni

  // Ottieni tutte le comunicazioni (con filtri opzionali)
  app.get("/api/communications", async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;
      
      const communications = await storage.getCommunications(
        type || status ? { type, status } : undefined
      );
      
      res.json(communications);
    } catch (error) {
      console.error("[GET /api/communications]", error);
      res.status(500).json({ error: "Errore durante il recupero delle comunicazioni" });
    }
  });

  // Ottieni una comunicazione specifica per ID
  app.get("/api/communications/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID non valido" });
      }
      
      const communication = await storage.getCommunication(id);
      if (!communication) {
        return res.status(404).json({ error: "Comunicazione non trovata" });
      }
      
      res.json(communication);
    } catch (error) {
      console.error(`[GET /api/communications/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante il recupero della comunicazione" });
    }
  });

  // Ottieni comunicazioni per un cliente specifico
  app.get("/api/clients/:id/communications", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
      }
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      const communications = await storage.getCommunicationsByClientId(clientId);
      res.json(communications);
    } catch (error) {
      console.error(`[GET /api/clients/${req.params.id}/communications]`, error);
      res.status(500).json({ error: "Errore durante il recupero delle comunicazioni del cliente" });
    }
  });

  // Ottieni comunicazioni per una proprietà specifica
  app.get("/api/properties/:id/communications", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: "ID proprietà non valido" });
      }
      
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ error: "Proprietà non trovata" });
      }
      
      const communications = await storage.getCommunicationsByPropertyId(propertyId);
      res.json(communications);
    } catch (error) {
      console.error(`[GET /api/properties/${req.params.id}/communications]`, error);
      res.status(500).json({ error: "Errore durante il recupero delle comunicazioni della proprietà" });
    }
  });

  // Crea una nuova comunicazione
  app.post("/api/communications", async (req: Request, res: Response) => {
    try {
      const validationResult = insertCommunicationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Dati non validi per la comunicazione",
          details: validationResult.error.format()
        });
      }
      
      const newCommunication = await storage.createCommunication(validationResult.data);
      res.status(201).json(newCommunication);
    } catch (error) {
      console.error("[POST /api/communications]", error);
      res.status(500).json({ error: "Errore durante la creazione della comunicazione" });
    }
  });

  // Aggiorna una comunicazione esistente
  app.patch("/api/communications/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID non valido" });
      }
      
      const communication = await storage.getCommunication(id);
      if (!communication) {
        return res.status(404).json({ error: "Comunicazione non trovata" });
      }
      
      // Validazione parziale (solo i campi forniti)
      const validationSchema = insertCommunicationSchema.partial();
      const validationResult = validationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Dati non validi per l'aggiornamento della comunicazione",
          details: validationResult.error.format()
        });
      }
      
      const updatedCommunication = await storage.updateCommunication(id, validationResult.data);
      res.json(updatedCommunication);
    } catch (error) {
      console.error(`[PATCH /api/communications/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'aggiornamento della comunicazione" });
    }
  });

  // Elimina una comunicazione
  app.delete("/api/communications/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID non valido" });
      }
      
      const communication = await storage.getCommunication(id);
      if (!communication) {
        return res.status(404).json({ error: "Comunicazione non trovata" });
      }
      
      await storage.deleteCommunication(id);
      res.status(204).send();
    } catch (error) {
      console.error(`[DELETE /api/communications/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'eliminazione della comunicazione" });
    }
  });

  // Ottieni clienti ad alta priorità senza comunicazioni recenti
  app.get("/api/clients/without-recent-communication", async (req: Request, res: Response) => {
    try {
      // Parametri predefiniti: 10 giorni, rating minimo 4
      const days = req.query.days ? parseInt(req.query.days as string) : 10;
      const minRating = req.query.minRating ? parseInt(req.query.minRating as string) : 4;
      
      if (isNaN(days) || isNaN(minRating)) {
        return res.status(400).json({ error: "Parametri non validi" });
      }
      
      const clients = await storage.getClientsWithoutRecentCommunication(days, minRating);
      res.json(clients);
    } catch (error) {
      console.error("[GET /api/clients/without-recent-communication]", error);
      res.status(500).json({ error: "Errore durante il recupero dei clienti senza comunicazioni recenti" });
    }
  });
  
  // Endpoint per ottenere le attività di un cliente
  app.get("/api/clients/:id/tasks", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
      }
      
      const tasks = await storage.getTasksByClientId(clientId);
      res.json(tasks);
    } catch (error) {
      console.error(`[GET /api/clients/${req.params.id}/tasks]`, error);
      res.status(500).json({ error: "Errore durante il recupero delle attività del cliente" });
    }
  });

  // Endpoint per ottenere le attività di un immobile
  app.get("/api/properties/:id/tasks", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: "ID immobile non valido" });
      }
      
      const tasks = await storage.getTasksByPropertyId(propertyId);
      res.json(tasks);
    } catch (error) {
      console.error(`[GET /api/properties/${req.params.id}/tasks]`, error);
      res.status(500).json({ error: "Errore durante il recupero delle attività dell'immobile" });
    }
  });

  // Altri endpoint API esistenti

  const httpServer = createServer(app);
  return httpServer;
}
