import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertCommunicationSchema, 
  insertPropertySchema, 
  insertSharedPropertySchema,
  insertClientSchema,
  insertBuyerSchema,
  insertSellerSchema
} from "@shared/schema";
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
  
  // API per gli immobili
  
  // Ottieni tutti gli immobili
  app.get("/api/properties", async (req: Request, res: Response) => {
    try {
      // Filtraggio opzionale
      const filters: { status?: string; search?: string } = {};
      
      if (req.query.status) {
        filters.status = req.query.status as string;
      }
      
      if (req.query.search) {
        filters.search = req.query.search as string;
      }
      
      const properties = await storage.getProperties(filters);
      res.json(properties);
    } catch (error) {
      console.error("[GET /api/properties]", error);
      res.status(500).json({ error: "Errore durante il recupero degli immobili" });
    }
  });
  
  // Ottieni un immobile specifico
  app.get("/api/properties/:id", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: "ID immobile non valido" });
      }
      
      const property = await storage.getPropertyWithDetails(propertyId);
      
      if (!property) {
        return res.status(404).json({ error: "Immobile non trovato" });
      }
      
      res.json(property);
    } catch (error) {
      console.error(`[GET /api/properties/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante il recupero dell'immobile" });
    }
  });
  
  // Crea un nuovo immobile
  app.post("/api/properties", async (req: Request, res: Response) => {
    try {
      // Valida i dati in ingresso
      const result = insertPropertySchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dati immobile non validi", 
          details: result.error.format() 
        });
      }
      
      const newProperty = await storage.createProperty(result.data);
      res.status(201).json(newProperty);
    } catch (error) {
      console.error("[POST /api/properties]", error);
      res.status(500).json({ error: "Errore durante la creazione dell'immobile" });
    }
  });
  
  // Aggiorna un immobile esistente
  app.patch("/api/properties/:id", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: "ID immobile non valido" });
      }
      
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ error: "Immobile non trovato" });
      }
      
      const updatedProperty = await storage.updateProperty(propertyId, req.body);
      res.json(updatedProperty);
    } catch (error) {
      console.error(`[PATCH /api/properties/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'aggiornamento dell'immobile" });
    }
  });
  
  // Elimina un immobile
  app.delete("/api/properties/:id", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: "ID immobile non valido" });
      }
      
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ error: "Immobile non trovato" });
      }
      
      await storage.deleteProperty(propertyId);
      res.status(204).send();
    } catch (error) {
      console.error(`[DELETE /api/properties/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'eliminazione dell'immobile" });
    }
  });
  
  // API per proprietà condivise
  
  // Get shared properties with optional filters
  app.get("/api/shared-properties", async (req: Request, res: Response) => {
    try {
      const { stage, search } = req.query;
      
      const filters: { stage?: string; search?: string } = {};
      if (stage) filters.stage = stage as string;
      if (search) filters.search = search as string;
      
      const sharedProperties = await storage.getSharedProperties(filters);
      res.json(sharedProperties);
    } catch (error) {
      console.error("[GET /api/shared-properties]", error);
      res.status(500).json({ error: "Errore durante il recupero delle proprietà condivise" });
    }
  });
  
  // Get shared property details
  app.get("/api/shared-properties/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID proprietà condivisa non valido" });
      }
      
      const sharedProperty = await storage.getSharedPropertyWithDetails(id);
      if (!sharedProperty) {
        return res.status(404).json({ error: "Proprietà condivisa non trovata" });
      }
      
      res.json(sharedProperty);
    } catch (error) {
      console.error(`[GET /api/shared-properties/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante il recupero della proprietà condivisa" });
    }
  });
  
  // Crea una proprietà condivisa
  app.post("/api/shared-properties", async (req: Request, res: Response) => {
    try {
      // Valida i dati in ingresso
      const result = insertSharedPropertySchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dati condivisione non validi", 
          details: result.error.format() 
        });
      }
      
      const newSharedProperty = await storage.createSharedProperty(result.data);
      res.status(201).json(newSharedProperty);
    } catch (error) {
      console.error("[POST /api/shared-properties]", error);
      res.status(500).json({ error: "Errore durante la creazione della proprietà condivisa" });
    }
  });
  
  // Update shared property
  app.patch("/api/shared-properties/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID proprietà condivisa non valido" });
      }
      
      const sharedProperty = await storage.getSharedProperty(id);
      if (!sharedProperty) {
        return res.status(404).json({ error: "Proprietà condivisa non trovata" });
      }
      
      // Validate the update data
      const result = insertSharedPropertySchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dati aggiornamento non validi", 
          details: result.error.format() 
        });
      }
      
      const updatedSharedProperty = await storage.updateSharedProperty(id, result.data);
      res.json(updatedSharedProperty);
    } catch (error) {
      console.error(`[PATCH /api/shared-properties/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'aggiornamento della proprietà condivisa" });
    }
  });
  
  // Acquire a shared property
  app.post("/api/shared-properties/:id/acquire", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID proprietà condivisa non valido" });
      }
      
      const sharedProperty = await storage.getSharedProperty(id);
      if (!sharedProperty) {
        return res.status(404).json({ error: "Proprietà condivisa non trovata" });
      }
      
      const success = await storage.acquireSharedProperty(id);
      if (!success) {
        return res.status(500).json({ error: "Errore durante l'acquisizione della proprietà condivisa" });
      }
      
      res.json({ success: true, message: "Proprietà acquisita con successo" });
    } catch (error) {
      console.error(`[POST /api/shared-properties/${req.params.id}/acquire]`, error);
      res.status(500).json({ error: "Errore durante l'acquisizione della proprietà condivisa" });
    }
  });
  
  // Delete shared property
  app.delete("/api/shared-properties/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID proprietà condivisa non valido" });
      }
      
      const sharedProperty = await storage.getSharedProperty(id);
      if (!sharedProperty) {
        return res.status(404).json({ error: "Proprietà condivisa non trovata" });
      }
      
      const success = await storage.deleteSharedProperty(id);
      if (!success) {
        return res.status(500).json({ error: "Errore durante l'eliminazione della proprietà condivisa" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(`[DELETE /api/shared-properties/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'eliminazione della proprietà condivisa" });
    }
  });
  
  // Get matching buyers for a shared property
  app.get("/api/shared-properties/:id/matching-buyers", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID proprietà condivisa non valido" });
      }
      
      const sharedProperty = await storage.getSharedProperty(id);
      if (!sharedProperty) {
        return res.status(404).json({ error: "Proprietà condivisa non trovata" });
      }
      
      const matchingBuyers = await storage.getMatchingBuyersForSharedProperty(id);
      res.json(matchingBuyers);
    } catch (error) {
      console.error(`[GET /api/shared-properties/${req.params.id}/matching-buyers]`, error);
      res.status(500).json({ error: "Errore durante il recupero dei compratori corrispondenti" });
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

  // API per la gestione dei clienti
  
  // Ottieni tutti i clienti (con filtri opzionali)
  app.get("/api/clients", async (req: Request, res: Response) => {
    try {
      // Filtraggio opzionale
      const filters: { type?: string; search?: string } = {};
      
      if (req.query.type) {
        filters.type = req.query.type as string;
      }
      
      if (req.query.search) {
        filters.search = req.query.search as string;
      }
      
      const clients = await storage.getClients(filters);
      res.json(clients);
    } catch (error) {
      console.error("[GET /api/clients]", error);
      res.status(500).json({ error: "Errore durante il recupero dei clienti" });
    }
  });
  
  // Ottieni un cliente specifico con dettagli completi
  app.get("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
      }
      
      const client = await storage.getClientWithDetails(clientId);
      
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      res.json(client);
    } catch (error) {
      console.error(`[GET /api/clients/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante il recupero del cliente" });
    }
  });
  
  // Crea un nuovo cliente
  app.post("/api/clients", async (req: Request, res: Response) => {
    try {
      // Valida i dati in ingresso
      const result = insertClientSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dati cliente non validi", 
          details: result.error.format() 
        });
      }
      
      const newClient = await storage.createClient(result.data);
      
      // Se è un cliente di tipo buyer, crea anche il record buyer corrispondente
      if (newClient.type === "buyer" && req.body.buyer) {
        try {
          await storage.createBuyer({
            clientId: newClient.id,
            searchArea: req.body.buyer.searchArea || null,
            minSize: req.body.buyer.minSize || null,
            maxPrice: req.body.buyer.maxPrice || null,
            urgency: req.body.buyer.urgency || 3,
            rating: req.body.buyer.rating || 3,
            searchNotes: req.body.buyer.searchNotes || null
          });
        } catch (buyerError) {
          console.error("[POST /api/clients] Error creating buyer:", buyerError);
          // Non blocchiamo la creazione del cliente se fallisce la creazione del buyer
        }
      }
      
      // Se è un cliente di tipo seller, crea anche il record seller corrispondente
      if (newClient.type === "seller" && req.body.seller) {
        try {
          await storage.createSeller({
            clientId: newClient.id,
            propertyId: req.body.seller.propertyId || null
          });
        } catch (sellerError) {
          console.error("[POST /api/clients] Error creating seller:", sellerError);
          // Non blocchiamo la creazione del cliente se fallisce la creazione del seller
        }
      }
      
      res.status(201).json(newClient);
    } catch (error) {
      console.error("[POST /api/clients]", error);
      res.status(500).json({ error: "Errore durante la creazione del cliente" });
    }
  });
  
  // Aggiorna un cliente esistente
  app.patch("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
      }
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      const updatedClient = await storage.updateClient(clientId, req.body);
      res.json(updatedClient);
    } catch (error) {
      console.error(`[PATCH /api/clients/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'aggiornamento del cliente" });
    }
  });
  
  // Elimina un cliente
  app.delete("/api/clients/:id", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
      }
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      await storage.deleteClient(clientId);
      res.status(204).send();
    } catch (error) {
      console.error(`[DELETE /api/clients/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'eliminazione del cliente" });
    }
  });
  
  // API per acquirenti
  
  // Crea un nuovo acquirente per un cliente
  app.post("/api/buyers", async (req: Request, res: Response) => {
    try {
      // Valida i dati in ingresso
      const result = insertBuyerSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dati acquirente non validi", 
          details: result.error.format() 
        });
      }
      
      const newBuyer = await storage.createBuyer(result.data);
      res.status(201).json(newBuyer);
    } catch (error) {
      console.error("[POST /api/buyers]", error);
      res.status(500).json({ error: "Errore durante la creazione dell'acquirente" });
    }
  });
  
  // Aggiorna un acquirente
  app.patch("/api/buyers/:id", async (req: Request, res: Response) => {
    try {
      const buyerId = parseInt(req.params.id);
      if (isNaN(buyerId)) {
        return res.status(400).json({ error: "ID acquirente non valido" });
      }
      
      const buyer = await storage.getBuyer(buyerId);
      if (!buyer) {
        return res.status(404).json({ error: "Acquirente non trovato" });
      }
      
      const updatedBuyer = await storage.updateBuyer(buyerId, req.body);
      res.json(updatedBuyer);
    } catch (error) {
      console.error(`[PATCH /api/buyers/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'aggiornamento dell'acquirente" });
    }
  });
  
  // API per venditori
  
  // Crea un nuovo venditore per un cliente
  app.post("/api/sellers", async (req: Request, res: Response) => {
    try {
      // Valida i dati in ingresso
      const result = insertSellerSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: "Dati venditore non validi", 
          details: result.error.format() 
        });
      }
      
      const newSeller = await storage.createSeller(result.data);
      res.status(201).json(newSeller);
    } catch (error) {
      console.error("[POST /api/sellers]", error);
      res.status(500).json({ error: "Errore durante la creazione del venditore" });
    }
  });
  
  // Aggiorna un venditore
  app.patch("/api/sellers/:id", async (req: Request, res: Response) => {
    try {
      const sellerId = parseInt(req.params.id);
      if (isNaN(sellerId)) {
        return res.status(400).json({ error: "ID venditore non valido" });
      }
      
      const seller = await storage.getSeller(sellerId);
      if (!seller) {
        return res.status(404).json({ error: "Venditore non trovato" });
      }
      
      const updatedSeller = await storage.updateSeller(sellerId, req.body);
      res.json(updatedSeller);
    } catch (error) {
      console.error(`[PATCH /api/sellers/${req.params.id}]`, error);
      res.status(500).json({ error: "Errore durante l'aggiornamento del venditore" });
    }
  });

  // Altri endpoint API esistenti

  const httpServer = createServer(app);
  return httpServer;
}
