import type { Express, Request, Response, NextFunction } from "express";
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
import { summarizeText } from "./lib/openai";
import { getUltraMsgClient } from "./lib/ultramsg";

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
      
      const communicationData = validationResult.data;
      
      // Se è un tipo generico che non è un'azione preconfigurata, genera il riassunto con AI
      const preconfiguredTypes = ['property_sent', 'property_visit', 'contract_signed', 'offer_accepted', 'offer_rejected'];
      if (communicationData.content && !preconfiguredTypes.includes(communicationData.type)) {
        try {
          // Genera il riassunto utilizzando OpenAI
          const summary = await summarizeText(communicationData.content);
          communicationData.summary = summary;
        } catch (aiError) {
          console.error("Errore nella generazione del riassunto AI:", aiError);
          // Non bloccare la creazione della comunicazione se il riassunto fallisce
        }
      }
      
      const newCommunication = await storage.createCommunication(communicationData);
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
      
      const updateData = validationResult.data;
      
      // Se è stato aggiornato il contenuto e non è un'azione preconfigurata, rigenera il riassunto
      const preconfiguredTypes = ['property_sent', 'property_visit', 'contract_signed', 'offer_accepted', 'offer_rejected'];
      const currentType = updateData.type || communication.type;
      
      if (updateData.content && !preconfiguredTypes.includes(currentType)) {
        try {
          // Genera il riassunto utilizzando OpenAI
          const summary = await summarizeText(updateData.content);
          updateData.summary = summary;
        } catch (aiError) {
          console.error("Errore nella generazione del riassunto AI durante l'aggiornamento:", aiError);
          // Non bloccare l'aggiornamento della comunicazione se il riassunto fallisce
        }
      }
      
      const updatedCommunication = await storage.updateCommunication(id, updateData);
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
  
  // Endpoint per ottenere gli immobili che corrispondono alle preferenze di un cliente acquirente
  app.get("/api/clients/:id/matching-properties", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
      }
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      if (client.type !== 'buyer') {
        return res.status(400).json({ error: "Solo i clienti compratori hanno matching properties" });
      }
      
      const buyer = await storage.getBuyerByClientId(clientId);
      if (!buyer) {
        return res.status(404).json({ error: "Dati acquirente non trovati" });
      }
      
      // Recupera immobili che corrispondono alle preferenze
      const matchingProperties = await storage.matchPropertiesForBuyer(buyer.id);
      res.json(matchingProperties);
    } catch (error) {
      console.error(`[GET /api/clients/${req.params.id}/matching-properties]`, error);
      res.status(500).json({ error: "Errore durante il recupero degli immobili compatibili" });
    }
  });
  
  // Endpoint per ottenere le proprietà condivise che corrispondono alle preferenze di un cliente
  app.get("/api/clients/:id/matching-shared-properties", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
      }
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      if (client.type !== 'buyer') {
        return res.status(400).json({ error: "Solo i clienti compratori hanno matching properties" });
      }
      
      const buyer = await storage.getBuyerByClientId(clientId);
      if (!buyer) {
        return res.status(404).json({ error: "Dati acquirente non trovati" });
      }
      
      // Recupera proprietà condivise compatibili
      // Qui implementiamo un approccio semplificato - in un'app reale potremmo avere una query più ottimizzata
      const allSharedProperties = await storage.getSharedProperties({});
      
      // Filtra le proprietà in base ai criteri dell'acquirente
      const matchingProperties = allSharedProperties.filter(property => {
        // Controlla dimensioni
        if (buyer.minSize && (!property.size || property.size < buyer.minSize)) {
          return false;
        }
        
        // Controlla prezzo
        if (buyer.maxPrice && (!property.price || property.price > buyer.maxPrice)) {
          return false;
        }
        
        return true;
      });
      
      res.json(matchingProperties);
    } catch (error) {
      console.error(`[GET /api/clients/${req.params.id}/matching-shared-properties]`, error);
      res.status(500).json({ error: "Errore durante il recupero delle proprietà condivise compatibili" });
    }
  });
  
  // Endpoint per ottenere gli immobili inviati a un cliente
  app.get("/api/clients/:id/sent-properties", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
      }
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      // In questa versione semplificata, considera gli immobili inviati
      // quelli menzionati nelle comunicazioni con il cliente
      const communications = await storage.getCommunicationsByClientId(clientId);
      
      // Ottiene tutti gli immobili menzionati nelle comunicazioni
      const propertyIds = Array.from(
        new Set(
          communications
            .filter(c => c.propertyId !== null)
            .map(c => c.propertyId)
        )
      );
      
      // Recupera i dettagli degli immobili
      const sentProperties = [];
      for (const propertyId of propertyIds) {
        if (propertyId) {
          const property = await storage.getProperty(propertyId);
          if (property) {
            sentProperties.push(property);
          }
        }
      }
      
      res.json(sentProperties);
    } catch (error) {
      console.error(`[GET /api/clients/${req.params.id}/sent-properties]`, error);
      res.status(500).json({ error: "Errore durante il recupero degli immobili inviati" });
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
  
  // Recupera le preferenze di ricerca per un cliente compratore
  app.get("/api/clients/:id/preferences", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ error: "ID cliente non valido" });
      }
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      if (client.type !== 'buyer') {
        return res.status(400).json({ error: "Solo i clienti compratori hanno preferenze di ricerca" });
      }
      
      // Recupera le preferenze di ricerca dal database
      const preferences = await storage.getBuyerPreferences(clientId);
      
      if (!preferences) {
        return res.status(404).json({ error: "Nessuna preferenza di ricerca trovata per questo cliente" });
      }
      
      res.json(preferences);
    } catch (error) {
      console.error(`[GET /api/clients/${req.params.id}/preferences]`, error);
      res.status(500).json({ error: "Errore durante il recupero delle preferenze di ricerca" });
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
      
      // Log dei dati ricevuti dal client
      console.log(`[PATCH /api/clients/${clientId}] Dati ricevuti:`, req.body);
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      // Aggiorna i dati base del cliente
      const clientData = { ...req.body };
      delete clientData.buyer; // Rimuovi i dati del buyer dai dati del cliente
      
      console.log(`[PATCH /api/clients/${clientId}] Dati base cliente da aggiornare:`, clientData);
      const updatedClient = await storage.updateClient(clientId, clientData);
      
      // Se è un compratore e ci sono dati di preferenze, aggiorna anche quelli
      if (client.type === 'buyer' && req.body.buyer) {
        try {
          // Log dei dati ricevuti dal client per il buyer
          console.log(`[PATCH /api/clients/${clientId}] Dati buyer ricevuti:`, JSON.stringify(req.body.buyer, null, 2));
          
          // Verifica se esiste già un record di buyer
          const existingBuyer = await storage.getBuyerByClientId(clientId);
          console.log(`[PATCH /api/clients/${clientId}] Buyer esistente:`, 
                      existingBuyer ? JSON.stringify(existingBuyer, null, 2) : "Non trovato");
          
          // Dati del buyer da aggiornare con controlli espliciti per i valori nulli
          const buyerData = {
            searchArea: req.body.buyer.searchArea,
            minSize: req.body.buyer.minSize !== undefined && req.body.buyer.minSize !== '' ? 
                    Number(req.body.buyer.minSize) : null,
            maxPrice: req.body.buyer.maxPrice !== undefined && req.body.buyer.maxPrice !== '' ? 
                     Number(req.body.buyer.maxPrice) : null,
            urgency: req.body.buyer.urgency !== undefined ? 
                    Number(req.body.buyer.urgency) : 3,
            rating: req.body.buyer.rating !== undefined ? 
                   Number(req.body.buyer.rating) : 3,
            searchNotes: req.body.buyer.searchNotes || null
          };
          
          // Log dettagliato dei valori processati
          console.log(`[PATCH /api/clients/${clientId}] Dati buyer dopo trasformazione:`, JSON.stringify({
            originali: req.body.buyer,
            processati: buyerData
          }, null, 2));
          
          if (existingBuyer) {
            // Aggiorna buyer esistente
            const updatedBuyer = await storage.updateBuyer(existingBuyer.id, buyerData);
            console.log(`[PATCH /api/clients/${clientId}] Buyer aggiornato con successo. ID: ${existingBuyer.id}`);
            console.log(`[PATCH /api/clients/${clientId}] Dati buyer aggiornati:`, JSON.stringify(updatedBuyer, null, 2));
          } else {
            // Crea un nuovo buyer
            const buyerInsertData = {
              clientId: clientId,
              ...buyerData
            };
            const newBuyer = await storage.createBuyer(buyerInsertData);
            console.log(`[PATCH /api/clients/${clientId}] Nuovo buyer creato con successo. ID: ${newBuyer.id}`);
            console.log(`[PATCH /api/clients/${clientId}] Dati nuovo buyer:`, JSON.stringify(newBuyer, null, 2));
          }
        } catch (buyerError) {
          console.error(`[PATCH /api/clients/${clientId}] Error updating buyer preferences:`, buyerError);
          // Non blocchiamo l'aggiornamento del cliente se fallisce l'aggiornamento del buyer
        }
      }
      
      // Ottieni i dati aggiornati completi
      const updatedClientWithDetails = await storage.getClientWithDetails(clientId);
      console.log(`[PATCH /api/clients/${clientId}] Cliente aggiornato completo:`, updatedClientWithDetails);
      res.json(updatedClientWithDetails);
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

  // API per WhatsApp con UltraMsg
  
  // Endpoint per inviare messaggi WhatsApp tramite UltraMsg
  app.post("/api/whatsapp/send", async (req: Request, res: Response) => {
    try {
      const { clientId, message, priority } = req.body;
      
      if (!clientId || !message) {
        return res.status(400).json({ 
          error: "Dati mancanti", 
          details: "clientId e message sono campi obbligatori" 
        });
      }
      
      // Ottieni il cliente
      const client = await storage.getClient(parseInt(clientId));
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      if (!client.phone) {
        return res.status(400).json({ error: "Il cliente non ha un numero di telefono registrato" });
      }
      
      try {
        // Ottieni il client di UltraMsg
        const ultraMsgClient = getUltraMsgClient();
        
        // Invia il messaggio e salvalo nel database
        const communication = await ultraMsgClient.sendAndStoreCommunication(
          client.id, 
          client.phone, 
          message
        );
        
        res.status(201).json({
          success: true,
          message: "Messaggio WhatsApp inviato con successo",
          communication
        });
      } catch (apiError: any) {
        console.error("[POST /api/whatsapp/send] Errore API UltraMsg:", apiError);
        res.status(500).json({ 
          error: "Errore durante l'invio del messaggio WhatsApp", 
          details: apiError.message || "Errore API sconosciuto" 
        });
      }
    } catch (error: any) {
      console.error("[POST /api/whatsapp/send]", error);
      res.status(500).json({ 
        error: "Errore durante l'invio del messaggio WhatsApp", 
        details: error.message || "Errore sconosciuto" 
      });
    }
  });
  
  // Webhook per ricevere messaggi WhatsApp tramite UltraMsg
  app.post("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      // Registra tutti i dettagli della richiesta
      console.log("=== INIZIO ANALISI WEBHOOK ULTRAMSG ===");
      console.log("[WEBHOOK] Ricevuto webhook da:", req.ip);
      console.log("[WEBHOOK] Headers:", JSON.stringify(req.headers, null, 2));
      console.log("[WEBHOOK] Body completo:", JSON.stringify(req.body, null, 2));
      console.log("[WEBHOOK] Query params:", JSON.stringify(req.query, null, 2));
      
      // Verifica se è una notifica di messaggio valida
      const webhookData = req.body;
      
      // Crea un oggetto webhook compatibile in caso di formati diversi
      const normalizedWebhook: {
        event_type: string;
        from_me: boolean;
        from: string;
        to: string;
        body: string;
        media_url: string;
        mime_type: string;
      } = {
        event_type: 'message',
        from_me: false,
        from: '',
        to: '',
        body: '',
        media_url: '',
        mime_type: 'text/plain'
      };
      
      // UltraMsg può inviare i dati in formato diverso a seconda della configurazione
      if (webhookData) {
        normalizedWebhook.event_type = webhookData.event_type || webhookData.type || 'message';
        normalizedWebhook.from_me = webhookData.from_me === true || webhookData.fromMe === true;
        normalizedWebhook.from = webhookData.from || webhookData.author || webhookData.sender || '';
        normalizedWebhook.to = webhookData.to || webhookData.recipient || '';
        normalizedWebhook.body = webhookData.body || webhookData.text || webhookData.content || webhookData.message || '';
        normalizedWebhook.media_url = webhookData.media_url || webhookData.mediaUrl || '';
        normalizedWebhook.mime_type = webhookData.mime_type || webhookData.mimeType || 'text/plain';
      }
      
      console.log("[WEBHOOK] Dati webhook normalizzati:", JSON.stringify(normalizedWebhook, null, 2));
      
      if (!normalizedWebhook.from && !normalizedWebhook.body) {
        console.error("[WEBHOOK] Formato webhook non valido:", webhookData);
        return res.status(200).json({ success: true, message: "Formato non riconosciuto, ma ricevuto" });
      }
      
      // Elabora il messaggio in arrivo
      try {
        // Ottieni il client di UltraMsg
        const ultraMsgClient = getUltraMsgClient();
        
        // Processa il messaggio in arrivo
        const communication = await ultraMsgClient.processIncomingWebhook(normalizedWebhook);
        
        if (communication) {
          console.log("[WEBHOOK] Comunicazione salvata:", communication);
          
          // Crea un task per il follow-up se necessario
          if (communication.needsFollowUp) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1); // Scadenza: domani
            
            await storage.createTask({
              type: "follow_up",
              title: "Rispondere al messaggio WhatsApp",
              description: `Rispondere al messaggio WhatsApp del cliente: "${communication.summary}"`,
              clientId: communication.clientId,
              status: "pending",
              dueDate: dueDate.toISOString().split('T')[0],
              assignedTo: 1 // Assegnato all'agente predefinito
            });
          }
          
          console.log("=== FINE ANALISI WEBHOOK ULTRAMSG (SUCCESSO) ===");
          return res.status(200).json({
            success: true,
            message: "Webhook elaborato con successo",
            communication
          });
        } else {
          console.warn("[WEBHOOK] Nessuna comunicazione creata");
        }
      } catch (processError: any) {
        console.error("[POST /api/whatsapp/webhook] Errore nel processare il messaggio:", processError);
        console.error(processError.stack);
      }
      
      console.log("=== FINE ANALISI WEBHOOK ULTRAMSG ===");
      // Rispondi sempre con 200 per confermare la ricezione (anche se non elaborato)
      res.status(200).json({ success: true, message: "Webhook ricevuto" });
    } catch (error: any) {
      console.error("[POST /api/whatsapp/webhook] Errore generale:", error);
      console.error(error.stack);
      // Rispondi sempre con 200 per confermare la ricezione (anche in caso di errore)
      res.status(200).json({ success: true, message: "Webhook ricevuto (con errori)" });
    }
  });
  
  // Endpoint di test per simulare la ricezione di un messaggio WhatsApp
  // Endpoint semplice per verificare che il webhook sia raggiungibile
  app.get("/api/whatsapp/ping", async (req: Request, res: Response) => {
    console.log("=== WEBHOOK PING RICEVUTO ===");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
    
    // Rispondi con successo
    res.status(200).json({
      success: true,
      message: "Webhook ping ricevuto con successo",
      timestamp: new Date().toISOString(),
      request_data: {
        headers: req.headers,
        body: req.body,
        ip: req.ip
      }
    });
  });
  
  app.post("/api/whatsapp/test-webhook", async (req: Request, res: Response) => {
    try {
      const { clientId, message } = req.body;
      
      if (!clientId || !message) {
        return res.status(400).json({ 
          error: "Dati mancanti", 
          details: "clientId e message sono campi obbligatori" 
        });
      }
      
      const client = await storage.getClient(parseInt(clientId));
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      if (!client.phone) {
        return res.status(400).json({ error: "Il cliente non ha un numero di telefono registrato" });
      }
      
      // Crea un mock del payload del webhook UltraMsg
      const mockWebhookData = {
        event_type: "message",
        from_me: false,
        from: client.phone,
        to: "123456789", // Numero dell'agente
        body: message,
        media_url: "",
        mime_type: "text/plain"
      };
      
      // Elabora il webhook simulato
      const ultraMsgClient = getUltraMsgClient();
      const communication = await ultraMsgClient.processIncomingWebhook(mockWebhookData);
      
      if (communication) {
        return res.status(201).json({
          success: true,
          message: "Messaggio di test ricevuto e salvato con successo",
          communication
        });
      } else {
        return res.status(500).json({ 
          error: "Errore durante l'elaborazione del messaggio di test",
          details: "Il messaggio non è stato salvato correttamente"
        });
      }
    } catch (error: any) {
      console.error("[POST /api/whatsapp/test-webhook]", error);
      res.status(500).json({ 
        error: "Errore durante la simulazione del messaggio WhatsApp", 
        details: error.message || "Errore sconosciuto" 
      });
    }
  });

  // Altri endpoint API esistenti

  const httpServer = createServer(app);
  return httpServer;
}
