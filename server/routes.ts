import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertCommunicationSchema, 
  insertPropertySchema, 
  insertSharedPropertySchema,
  insertClientSchema,
  insertBuyerSchema,
  insertSellerSchema,
  clients,
  buyers,
  properties,
  sharedProperties,
  communications
} from "@shared/schema";
import { db } from "./db";
import { eq, sql, desc, asc, gte, lte, and, inArray, count, sum, lt, gt } from "drizzle-orm";
import { z } from "zod";
import { summarizeText } from "./lib/openai";
import axios from "axios";
import { config } from "./config";
import { getUltraMsgClient, sendPropertyMatchNotification } from "./lib/ultramsg";
import { getWebhookForwarder, getForwardKey } from './lib/webhookForwarder';
import geocodeRouter from "./routes/geocode";
import { registerAIAssistantRoutes } from "./routes/aiAssistant";
import virtualAssistantRouter from "./routes/virtualAssistant";

export async function registerRoutes(app: Express): Promise<Server> {
  // Registra le route per il webhook forwarder
  const webhookForwarder = getWebhookForwarder();
  webhookForwarder.registerRoutes(app);
  
  // Registra le route per l'assistente AI
  await registerAIAssistantRoutes(app);
  
  // Registra le route per l'assistente virtuale
  app.use('/api/virtual-assistant', virtualAssistantRouter);
  
  // Stampa la chiave da usare per il forwarder
  const forwardKey = getForwardKey();
  console.log("\n===============================================");
  console.log("WEBHOOK FORWARDER KEY:", forwardKey);
  console.log("Usa questa chiave quando configuri webhook.site per inoltrare i messaggi all'app");
  console.log("===============================================\n");
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
  
  // Endpoint per ottenere gli immobili compatibili con un cliente con info su invio
  app.get("/api/clients/:id/properties-with-notification-status", async (req: Request, res: Response) => {
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
        return res.status(400).json({ error: "Solo i clienti compratori hanno immobili compatibili" });
      }
      
      // Ottiene immobili corrispondenti
      const buyer = await storage.getBuyerByClientId(clientId);
      if (!buyer) {
        return res.status(404).json({ error: "Dati acquirente non trovati" });
      }
      
      // Recupera immobili che corrispondono alle preferenze
      const matchingProperties = await storage.matchPropertiesForBuyer(buyer.id);
      
      // Recupera comunicazioni per verificare quali immobili sono stati già inviati
      const communications = await storage.getCommunicationsByClientId(clientId);
      
      // Crea un mapping degli immobili inviati con data di invio e tipo
      const sentPropertiesMap = communications
        .filter(c => c.propertyId !== null && c.type === 'property_match')
        .reduce((map, comm) => {
          if (comm.propertyId) {
            if (!map[comm.propertyId] || new Date(comm.createdAt) > new Date(map[comm.propertyId].sentAt)) {
              map[comm.propertyId] = {
                notificationId: comm.id,
                sentAt: comm.createdAt,
                status: comm.status
              };
            }
          }
          return map;
        }, {} as Record<number, {notificationId: number, sentAt: Date, status: string}>);
      
      // Parametro per filtrare immobili già inviati oppure mostrarli tutti
      const showSent = req.query.showSent === 'true';
      
      // Combina le informazioni ed esclude gli immobili già inviati se showSent non è true
      const propertiesWithStatus = matchingProperties
        .map(property => {
          const notificationInfo = sentPropertiesMap[property.id];
          return {
            ...property,
            notificationStatus: notificationInfo ? {
              notified: true,
              sentAt: notificationInfo.sentAt,
              notificationId: notificationInfo.notificationId,
              status: notificationInfo.status
            } : {
              notified: false
            }
          };
        })
        // Filtra gli immobili già inviati se showSent non è true
        .filter(property => showSent || !property.notificationStatus.notified);
      
      res.json(propertiesWithStatus);
    } catch (error) {
      console.error(`[GET /api/clients/:id/properties-with-notification-status]`, error);
      res.status(500).json({ error: "Errore durante il recupero degli immobili con stato di notifica" });
    }
  });

  // Endpoint per inviare manualmente una notifica di immobile a un cliente
  app.post("/api/clients/:clientId/send-property/:propertyId", async (req: Request, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const propertyId = parseInt(req.params.propertyId);
      
      if (isNaN(clientId) || isNaN(propertyId)) {
        return res.status(400).json({ error: "ID cliente o immobile non valido" });
      }
      
      // Recupera cliente e immobile
      const client = await storage.getClientWithDetails(clientId);
      const property = await storage.getProperty(propertyId);
      
      if (!client) {
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      if (!property) {
        return res.status(404).json({ error: "Immobile non trovato" });
      }
      
      // Verifica che il cliente sia un acquirente
      if (client.type !== 'buyer') {
        return res.status(400).json({ error: "Solo i clienti acquirenti possono ricevere notifiche di immobili" });
      }
      
      // Invia la notifica
      const { sendPropertyMatchNotification } = await import('./lib/ultramsg');
      const notification = await sendPropertyMatchNotification(client, property);
      
      if (!notification) {
        return res.status(500).json({ error: "Non è stato possibile inviare la notifica" });
      }
      
      // Creare una comunicazione per tenere traccia dell'invio dell'immobile
      const now = new Date();
      const communicationData = {
        clientId,
        propertyId,
        type: "property_notification",
        subject: `Notifica immobile ${property.address}`,
        content: `Immobile "${property.address}" inviato al cliente ${client.firstName} ${client.lastName} tramite WhatsApp.`,
        direction: "outbound",
        status: "sent",
        externalId: notification.id?.toString()
      };
      
      // Salva la comunicazione
      await storage.createCommunication(communicationData);
      
      res.status(201).json({
        success: true,
        message: "Notifica inviata con successo",
        notification
      });
    } catch (error) {
      console.error(`[POST /api/clients/:clientId/send-property/:propertyId]`, error);
      res.status(500).json({ error: "Errore durante l'invio della notifica" });
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
      
      // Cerca acquirenti compatibili con questo immobile
      try {
        console.log(`[POST /api/properties] Verifica corrispondenze per il nuovo immobile ${newProperty.id}`);
        const matchingClients = await storage.matchBuyersForProperty(newProperty.id);
        
        if (matchingClients && matchingClients.length > 0) {
          console.log(`[POST /api/properties] Trovati ${matchingClients.length} clienti corrispondenti per l'immobile ${newProperty.id}`);
          
          // Per ogni cliente corrispondente, invia una notifica WhatsApp
          for (const client of matchingClients) {
            try {
              const clientDetails = await storage.getClientWithDetails(client.id);
              if (clientDetails) {
                await sendPropertyMatchNotification(clientDetails, newProperty);
                console.log(`[POST /api/properties] Notifica WhatsApp inviata al cliente ${client.id} per l'immobile ${newProperty.id}`);
              }
            } catch (notifyError) {
              console.error(`[POST /api/properties] Errore nell'invio della notifica al cliente ${client.id}:`, notifyError);
              // Non blocchiamo il flusso principale se fallisce una notifica
            }
          }
        } else {
          console.log(`[POST /api/properties] Nessun cliente corrispondente trovato per l'immobile ${newProperty.id}`);
        }
      } catch (matchError) {
        console.error("[POST /api/properties] Errore nel processo di match con acquirenti:", matchError);
        // Non blocchiamo la creazione dell'immobile se fallisce il matching
      }
      
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
      
      // Controlla se ci sono cambiamenti significativi che potrebbero modificare la corrispondenza
      const hasSignificantChanges = 
        (req.body.price !== undefined && req.body.price !== property.price) || 
        (req.body.size !== undefined && req.body.size !== property.size) || 
        (req.body.status !== undefined && req.body.status !== property.status) ||
        (req.body.bedrooms !== undefined && req.body.bedrooms !== property.bedrooms) ||
        (req.body.location !== undefined);
      
      const updatedProperty = await storage.updateProperty(propertyId, req.body);
      
      // Se ci sono cambiamenti significativi o l'immobile è stato reso disponibile, verifica i match
      if (hasSignificantChanges || req.body.status === 'available') {
        try {
          console.log(`[PATCH /api/properties/${propertyId}] Verifica corrispondenze per immobile aggiornato`);
          
          // Ottieni clienti corrispondenti
          const matchingClients = await storage.matchBuyersForProperty(propertyId);
          
          if (matchingClients && matchingClients.length > 0) {
            console.log(`[PATCH /api/properties/${propertyId}] Trovati ${matchingClients.length} clienti corrispondenti`);
            
            // Per ogni cliente corrispondente, invia una notifica WhatsApp
            for (const client of matchingClients) {
              try {
                const clientDetails = await storage.getClientWithDetails(client.id);
                if (clientDetails) {
                  // Verifica se il cliente ha già ricevuto una notifica per questo immobile
                  const existingCommunications = await storage.getCommunicationsByClientId(client.id);
                  const alreadyNotified = existingCommunications.some(
                    comm => comm.propertyId === propertyId && comm.type === 'property_match'
                  );
                  
                  if (!alreadyNotified) {
                    await sendPropertyMatchNotification(clientDetails, updatedProperty);
                    console.log(`[PATCH /api/properties/${propertyId}] Notifica WhatsApp inviata al cliente ${client.id}`);
                  } else {
                    console.log(`[PATCH /api/properties/${propertyId}] Cliente ${client.id} già notificato in precedenza`);
                  }
                }
              } catch (notifyError) {
                console.error(`[PATCH /api/properties/${propertyId}] Errore nell'invio della notifica al cliente ${client.id}:`, notifyError);
                // Non blocchiamo il flusso principale se fallisce una notifica
              }
            }
          } else {
            console.log(`[PATCH /api/properties/${propertyId}] Nessun cliente corrispondente trovato`);
          }
        } catch (matchError) {
          console.error(`[PATCH /api/properties/${propertyId}] Errore nel processo di match con acquirenti:`, matchError);
          // Non blocchiamo l'aggiornamento dell'immobile se fallisce il matching
        }
      }
      
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
  
  // Endpoint per trovare clienti potenziali per un immobile
  app.get("/api/properties/:id/matching-buyers", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: "ID immobile non valido" });
      }
      
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ error: "Immobile non trovato" });
      }
      
      // Cerca clienti acquirenti con preferenze compatibili
      const matchingBuyers = await storage.matchBuyersForProperty(propertyId);
      
      res.json(matchingBuyers);
    } catch (error) {
      console.error(`[GET /api/properties/${req.params.id}/matching-buyers]`, error);
      res.status(500).json({ error: "Errore durante il recupero dei clienti compatibili" });
    }
  });
  
  // Endpoint per ottenere clienti con il loro stato di notifica per un immobile
  app.get("/api/properties/:id/buyers-with-notification-status", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: "ID immobile non valido" });
      }
      
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ error: "Immobile non trovato" });
      }
      
      // Trova clienti compatibili con questo immobile
      const matchingBuyers = await storage.matchBuyersForProperty(propertyId);
      
      // Recupera comunicazioni relative all'immobile
      const communications = await storage.getCommunicationsByPropertyId(propertyId);
      
      // Crea una mappa di clienti che hanno ricevuto notifiche per questo immobile
      const notifiedClientsMap = communications
        .filter(c => c.clientId !== null && c.type === 'property_match')
        .reduce((map, comm) => {
          if (comm.clientId) {
            if (!map[comm.clientId] || new Date(comm.createdAt) > new Date(map[comm.clientId].sentAt)) {
              map[comm.clientId] = {
                notificationId: comm.id,
                sentAt: comm.createdAt,
                status: comm.status
              };
            }
          }
          return map;
        }, {} as Record<number, {notificationId: number, sentAt: Date, status: string}>);
      
      // Combina i risultati
      const buyersWithStatus = matchingBuyers.map(buyer => {
        const notificationInfo = notifiedClientsMap[buyer.id];
        return {
          ...buyer,
          notificationStatus: notificationInfo ? {
            notified: true,
            sentAt: notificationInfo.sentAt,
            notificationId: notificationInfo.notificationId,
            status: notificationInfo.status
          } : {
            notified: false
          }
        };
      });
      
      res.json(buyersWithStatus);
    } catch (error) {
      console.error(`[GET /api/properties/${req.params.id}/buyers-with-notification-status]`, error);
      res.status(500).json({ error: "Errore durante il recupero dei clienti con stato di notifica" });
    }
  });
  
  // Endpoint per ottenere i clienti a cui è stato inviato l'immobile
  app.get("/api/properties/:id/notified-buyers", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      if (isNaN(propertyId)) {
        return res.status(400).json({ error: "ID immobile non valido" });
      }
      
      // Recupera comunicazioni relative all'immobile
      const communications = await storage.getCommunicationsByPropertyId(propertyId);
      
      // Filtra per comunicazioni di tipo "property_match"
      const notificationComms = communications.filter(c => 
        c.clientId !== null && 
        c.type === 'property_match'
      );
      
      // Crea una mappa per tenere traccia dell'ultima notifica per ogni cliente
      const latestNotificationByClient = new Map<number, { commId: number, sentAt: Date }>();
      
      // Popola la mappa con le notifiche più recenti
      for (const comm of notificationComms) {
        if (!comm.clientId) continue;
        
        const existing = latestNotificationByClient.get(comm.clientId);
        if (!existing || new Date(comm.createdAt) > existing.sentAt) {
          latestNotificationByClient.set(comm.clientId, {
            commId: comm.id,
            sentAt: new Date(comm.createdAt)
          });
        }
      }
      
      // Recupera i dettagli completi dei clienti
      const notifiedBuyers = await Promise.all(
        Array.from(latestNotificationByClient.keys()).map(async (clientId) => {
          const client = await storage.getClient(clientId);
          const notificationInfo = latestNotificationByClient.get(clientId);
          
          if (client && notificationInfo) {
            return {
              ...client,
              sentAt: notificationInfo.sentAt,
              notificationId: notificationInfo.commId
            };
          }
          return null;
        })
      );
      
      // Filtra eventuali clienti null (che potrebbero essere stati eliminati)
      const validNotifiedBuyers = notifiedBuyers.filter(buyer => buyer !== null);
      
      res.json(validNotifiedBuyers);
    } catch (error) {
      console.error(`[GET /api/properties/${req.params.id}/notified-buyers]`, error);
      res.status(500).json({ error: "Errore durante il recupero dei clienti notificati" });
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
      console.log("Ricevuta richiesta di creazione proprietà condivisa:", JSON.stringify(req.body, null, 2));
      
      // Valida i dati in ingresso
      const result = insertSharedPropertySchema.safeParse(req.body);
      
      if (!result.success) {
        console.log("Errore di validazione:", JSON.stringify(result.error.format(), null, 2));
        return res.status(400).json({ 
          error: "Dati condivisione non validi", 
          details: result.error.format() 
        });
      }
      
      console.log("Validazione passata, creazione in corso...");
      
      // Prepariamo i dati per la creazione, assicurandoci che propertyId possa essere 0 o null
      const dataToInsert = {
        ...result.data
      };
      
      // Se propertyId è 0, impostalo a null
      if (dataToInsert.propertyId === 0) {
        dataToInsert.propertyId = null;
      }
      
      const newSharedProperty = await storage.createSharedProperty(dataToInsert);
      console.log("Proprietà condivisa creata con successo:", newSharedProperty.id);
      res.status(201).json(newSharedProperty);
    } catch (error) {
      console.error("[POST /api/shared-properties] Errore completo:", error);
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
  
  // Endpoint per ottenere le attività di una proprietà condivisa
  app.get("/api/shared-properties/:id/tasks", async (req: Request, res: Response) => {
    try {
      const sharedPropertyId = parseInt(req.params.id);
      if (isNaN(sharedPropertyId)) {
        return res.status(400).json({ error: "ID proprietà condivisa non valido" });
      }
      
      const tasks = await storage.getTasksBySharedPropertyId(sharedPropertyId);
      res.json(tasks);
    } catch (error) {
      console.error(`[GET /api/shared-properties/${req.params.id}/tasks]`, error);
      res.status(500).json({ error: "Errore durante il recupero delle attività della proprietà condivisa" });
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
      // Log dei dati ricevuti per debug
      console.log("[POST /api/clients] Dati ricevuti:", JSON.stringify(req.body, null, 2));
      
      // Valida i dati in ingresso
      const result = insertClientSchema.safeParse(req.body);
      
      if (!result.success) {
        console.error("[POST /api/clients] Errore di validazione:", result.error.format());
        return res.status(400).json({ 
          error: "Dati cliente non validi", 
          details: result.error.format() 
        });
      }
      
      console.log("[POST /api/clients] Dati validati:", JSON.stringify(result.data, null, 2));
      
      try {
        const newClient = await storage.createClient(result.data);
        console.log("[POST /api/clients] Cliente creato con successo:", newClient);
        
        // Se è un cliente di tipo buyer, crea anche il record buyer corrispondente
        if (newClient.type === "buyer" && req.body.buyer) {
          try {
            console.log("[POST /api/clients] Creazione buyer:", JSON.stringify(req.body.buyer, null, 2));
            const buyerData = {
              clientId: newClient.id,
              searchArea: req.body.buyer.searchArea || null,
              minSize: req.body.buyer.minSize || null,
              maxPrice: req.body.buyer.maxPrice || null,
              urgency: req.body.buyer.urgency || 3,
              rating: req.body.buyer.rating || 3,
              searchNotes: req.body.buyer.searchNotes || null
            };
            
            console.log("[POST /api/clients] Dati buyer elaborati:", JSON.stringify(buyerData, null, 2));
            const buyer = await storage.createBuyer(buyerData);
            console.log("[POST /api/clients] Buyer creato con successo:", buyer);
          } catch (buyerError) {
            console.error("[POST /api/clients] Errore creazione buyer:", buyerError);
            // Non blocchiamo la creazione del cliente se fallisce la creazione del buyer
          }
        }
        
        // Se è un cliente di tipo seller, crea anche il record seller corrispondente
        if (newClient.type === "seller" && req.body.seller) {
          try {
            console.log("[POST /api/clients] Creazione seller:", req.body.seller);
            const seller = await storage.createSeller({
              clientId: newClient.id,
              propertyId: req.body.seller.propertyId || null
            });
            console.log("[POST /api/clients] Seller creato con successo:", seller);
          } catch (sellerError) {
            console.error("[POST /api/clients] Errore creazione seller:", sellerError);
            // Non blocchiamo la creazione del cliente se fallisce la creazione del seller
          }
        }
        
        res.status(201).json(newClient);
      } catch (clientCreationError) {
        console.error("[POST /api/clients] Errore specifico durante creazione cliente:", clientCreationError);
        res.status(500).json({ 
          error: "Errore specifico durante la creazione del cliente", 
          details: clientCreationError.toString() 
        });
      }
    } catch (error) {
      console.error("[POST /api/clients] Errore generale:", error);
      res.status(500).json({ 
        error: "Errore durante la creazione del cliente", 
        details: error.toString() 
      });
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
  
  // Endpoint di test per verificare la ricezione delle richieste API
  app.post("/api/whatsapp/test", (req: Request, res: Response) => {
    console.log("[ULTRAMSG TEST] Ricevuta richiesta di test:", req.body);
    return res.status(200).json({
      success: true,
      message: "Test ricevuto con successo",
      body: req.body
    });
  });
  
  // Endpoint alternativo per invio diretto messaggi WhatsApp
  app.post("/api/whatsapp/test-direct-send", async (req: Request, res: Response) => {
    try {
      console.log("[ULTRAMSG DIRECT] Ricevuta richiesta di invio diretto:", req.body);
      const { clientId, phoneNumber, message } = req.body;
      
      if (!clientId || !phoneNumber || !message) {
        console.log("[ULTRAMSG DIRECT] Parametri mancanti:", { clientId, phoneNumber, message });
        return res.status(400).json({ 
          success: false,
          message: "Parametri mancanti. Richiesti: clientId, phoneNumber, message" 
        });
      }
      
      // Creazione diretta client UltraMsg
      if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_API_KEY) {
        console.log("[ULTRAMSG DIRECT] Variabili ambiente mancanti!");
        return res.status(500).json({ 
          success: false,
          message: "Configurazione UltraMsg non trovata" 
        });
      }
      
      // Non è necessario importare axios qui, viene già importato all'inizio del file
      
      try {
        console.log("[ULTRAMSG DIRECT] Creazione params per richiesta API");
        // Costruisce i parametri esattamente come nella richiesta curl che ha funzionato
        const formData = new URLSearchParams();
        formData.append('token', process.env.ULTRAMSG_API_KEY as string);
        formData.append('to', phoneNumber.replace(/^\+/, ''));
        formData.append('body', message);
        
        console.log("[ULTRAMSG DIRECT] Parametri richiesta:", {
          url: `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
          to: phoneNumber.replace(/^\+/, ''),
          hasToken: !!process.env.ULTRAMSG_API_KEY
        });
        
        console.log("[ULTRAMSG DIRECT] Invio richiesta API UltraMsg");
        const response = await axios.post(
          `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
          formData,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );
        
        console.log("[ULTRAMSG DIRECT] Risposta API:", response.data);
        
        if (response.data.sent !== "true" && response.data.sent !== true) {
          return res.status(500).json({
            success: false,
            message: `Errore nell'invio del messaggio: ${response.data.error || response.data.message || 'Unknown error'}`
          });
        }
        
        // Salva comunicazione nel database
        const client = await storage.getClient(parseInt(clientId));
        if (!client) {
          console.log("[ULTRAMSG DIRECT] Cliente non trovato:", clientId);
          return res.status(404).json({ 
            success: false,
            message: "Cliente non trovato"
          });
        }
        
        // Genera un riassunto
        let summary = message.length > 50 ? `${message.substring(0, 47)}...` : message;
        
        // Salva nel database
        const communicationData = {
          clientId: parseInt(clientId),
          type: 'whatsapp',
          subject: 'Messaggio WhatsApp',
          content: message,
          summary,
          direction: 'outbound',
          needsFollowUp: false,
          status: 'completed'
        };
        
        const communication = await storage.createCommunication(communicationData);
        console.log("[ULTRAMSG DIRECT] Comunicazione salvata nel DB:", communication.id);
        
        return res.status(200).json({
          success: true,
          message: "Messaggio WhatsApp inviato con successo",
          msgId: response.data.id,
          communication
        });
      } catch (apiError: any) {
        console.error("[ULTRAMSG DIRECT] Errore API UltraMsg:", apiError);
        
        if (axios.isAxiosError(apiError) && apiError.response) {
          console.error("[ULTRAMSG DIRECT] Dettagli errore API:", apiError.response.data);
        }
        
        return res.status(500).json({ 
          success: false,
          message: "Errore durante l'invio del messaggio WhatsApp", 
          details: apiError.message || "Errore API sconosciuto" 
        });
      }
    } catch (error: any) {
      console.error("[ULTRAMSG DIRECT] Errore generale:", error);
      return res.status(500).json({ 
        success: false,
        message: "Errore durante l'invio del messaggio WhatsApp", 
        details: error.message || "Errore sconosciuto" 
      });
    }
  });
  
  // Endpoint per inviare messaggi WhatsApp tramite UltraMsg
  app.post("/api/whatsapp/send", async (req: Request, res: Response) => {
    try {
      console.log("[ULTRAMSG] Ricevuta richiesta di invio messaggio:", req.body);
      const { clientId, message, priority } = req.body;
      
      if (!clientId || !message) {
        console.log("[ULTRAMSG] Dati mancanti nella richiesta");
        return res.status(400).json({ 
          error: "Dati mancanti", 
          details: "clientId e message sono campi obbligatori" 
        });
      }
      
      console.log("[ULTRAMSG] Recupero dati cliente:", clientId);
      // Ottieni il cliente
      const client = await storage.getClient(parseInt(clientId));
      if (!client) {
        console.log("[ULTRAMSG] Cliente non trovato:", clientId);
        return res.status(404).json({ error: "Cliente non trovato" });
      }
      
      console.log("[ULTRAMSG] Dati cliente recuperati:", client.id, client.firstName, client.lastName, client.phone);
      
      if (!client.phone) {
        console.log("[ULTRAMSG] Cliente senza numero di telefono");
        return res.status(400).json({ error: "Il cliente non ha un numero di telefono registrato" });
      }
      
      try {
        console.log("[ULTRAMSG] Inizializzazione client UltraMsg");
        // Ottieni il client di UltraMsg
        const ultraMsgClient = getUltraMsgClient();
        
        console.log("[ULTRAMSG] Client inizializzato, tentativo invio messaggio a:", client.phone);
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
      
      // GESTIONE DIRETTA PER IL FORMATO DI TEST
      if (req.body.data && req.body.data.from && req.body.data.from.includes('@c.us') && !req.body.data.fromMe) {
        try {
          const messageData = req.body.data;
          console.log("[WEBHOOK-DIRETTO] Rilevato formato di test webhook, elaborazione diretta");
          
          // Estrai il numero di telefono senza @c.us
          const phone = messageData.from.replace(/@c\.us$/, '');
          
          // Cerca il cliente nel database
          const client = await storage.getClientByPhone(phone);
          
          if (client) {
            console.log(`[WEBHOOK-DIRETTO] Cliente trovato: ${client.id}, ${client.firstName} ${client.lastName}`);
            
            // Trova l'ultima comunicazione in uscita per questo cliente
            const clientCommunications = await storage.getCommunicationsByClientId(client.id);
            const lastOutboundComm = clientCommunications
              .filter(comm => comm.direction === "outbound")
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            
            console.log("[WEBHOOK-DIRETTO] Ultima comunicazione in uscita:", lastOutboundComm?.id, "propertyId:", lastOutboundComm?.propertyId);
            
            // Prepara i dati per la nuova comunicazione
            const communicationData = {
              clientId: client.id,
              propertyId: lastOutboundComm?.propertyId || null,
              type: 'whatsapp',
              subject: 'Messaggio WhatsApp ricevuto',
              content: messageData.body,
              summary: messageData.body.length > 50 ? `${messageData.body.substring(0, 47)}...` : messageData.body,
              direction: 'inbound',
              needsFollowUp: true,
              status: 'pending',
              responseToId: lastOutboundComm?.id || null,
              externalId: messageData.id
            };
            
            // Crea la comunicazione nel database
            const communication = await storage.createCommunication(communicationData);
            console.log("[WEBHOOK-DIRETTO] Comunicazione creata:", communication.id);
            
            // Analisi del sentimento
            if (lastOutboundComm) {
              const { processClientResponse } = await import('./services/sentimentAnalysis');
              console.log("[SENTIMENT] Analisi sentimento della risposta al messaggio:", lastOutboundComm.id);
              
              await processClientResponse(
                messageData.body,
                lastOutboundComm.id,
                client.id,
                lastOutboundComm.propertyId ?? undefined
              );
              
              console.log("[SENTIMENT] Analisi sentimento completata");
            }
            
            console.log("=== FINE ANALISI WEBHOOK ULTRAMSG (SUCCESSO ELABORAZIONE DIRETTA) ===");
            res.status(200).json({ success: true, message: "Webhook elaborato con successo (metodo diretto)" });
            return;
          } else {
            console.log(`[WEBHOOK-DIRETTO] Cliente non trovato per il numero: ${phone}`);
          }
        } catch (directError) {
          console.error("[WEBHOOK-DIRETTO] Errore nell'elaborazione diretta:", directError);
        }
      }
      
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
        // Nuovo formato esatto ricevuto da webhook.site (1)
        if (webhookData.event_type === "message_received" && webhookData.data) {
          const messageData = webhookData.data;
          normalizedWebhook.event_type = "message";
          normalizedWebhook.from_me = messageData.fromMe === true;
          normalizedWebhook.from = messageData.from ? messageData.from.replace(/@c\.us$/, '') : '';
          normalizedWebhook.to = messageData.to ? messageData.to.replace(/@c\.us$/, '') : '';
          normalizedWebhook.body = messageData.body || '';
          normalizedWebhook.media_url = messageData.media || '';
          normalizedWebhook.mime_type = messageData.type === 'chat' ? 'text/plain' : messageData.type || 'text/plain';
          
          console.log("[WEBHOOK] Elaborazione formato webhook message_received con data object");
        } 
        // Formato test simulato (2)
        else if (webhookData.event_type === "message" || webhookData.from || webhookData.to) {
          // Formato precedente
          normalizedWebhook.event_type = webhookData.event_type || webhookData.type || 'message';
          normalizedWebhook.from_me = webhookData.from_me === true || webhookData.fromMe === true;
          normalizedWebhook.from = webhookData.from || webhookData.author || webhookData.sender || '';
          normalizedWebhook.to = webhookData.to || webhookData.recipient || '';
          normalizedWebhook.body = webhookData.body || webhookData.text || webhookData.content || webhookData.message || '';
          normalizedWebhook.media_url = webhookData.media_url || webhookData.mediaUrl || '';
          normalizedWebhook.mime_type = webhookData.mime_type || webhookData.mimeType || 'text/plain';
          
          console.log("[WEBHOOK] Elaborazione formato webhook standard o simulato");
        }
        // Altri formati potenziali (3)
        else {
          console.log("[WEBHOOK] Formato non riconosciuto, tentativo di elaborazione come formato generico");
          
          // Cerca di estrarre informazioni da qualsiasi formato
          const messageData = webhookData.data || webhookData;
          normalizedWebhook.event_type = messageData.event_type || messageData.type || webhookData.event_type || 'message';
          normalizedWebhook.from_me = messageData.fromMe === true || messageData.from_me === true || webhookData.from_me === true;
          
          // Cerca il numero di telefono mittente in tutti i possibili luoghi
          let possibleFrom = messageData.from || messageData.author || messageData.sender || webhookData.from || '';
          normalizedWebhook.from = possibleFrom ? possibleFrom.replace(/@c\.us$/, '') : '';
          
          // Cerca il numero destinatario in tutti i possibili luoghi
          normalizedWebhook.to = messageData.to || messageData.recipient || webhookData.to || '';
          
          // Cerca il contenuto del messaggio in tutti i possibili luoghi
          normalizedWebhook.body = messageData.body || messageData.text || messageData.content || messageData.message || 
                                 webhookData.body || webhookData.text || webhookData.content || '';
                                 
          normalizedWebhook.media_url = messageData.media || messageData.media_url || webhookData.media_url || '';
          
          // Determina il tipo di contenuto
          if (messageData.type === 'chat' || webhookData.type === 'chat') {
            normalizedWebhook.mime_type = 'text/plain';
          } else {
            normalizedWebhook.mime_type = messageData.mime_type || messageData.type || webhookData.mime_type || 'text/plain';
          }
        }
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
          
          // Se questo messaggio è una risposta ad un messaggio precedente, analizza il sentimento
          if (!normalizedWebhook.from_me) {
            try {
              const { processClientResponse } = await import('./services/sentimentAnalysis');
              
              // Controllo se questa è una risposta a un messaggio precedente
              // Cerca l'ultimo messaggio inviato da noi a questo cliente
              const client = await storage.getClientByPhone(normalizedWebhook.from);
              if (client) {
                // Trova le comunicazioni precedenti in uscita per questo cliente
                const clientCommunications = await storage.getCommunicationsByClientId(client.id);
                const lastOutboundComm = clientCommunications
                  .filter(comm => comm.direction === "outbound")
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                
                if (lastOutboundComm) {
                  // Elabora questa risposta come una risposta al messaggio precedente
                  console.log("[SENTIMENT] Analisi sentimento della risposta al messaggio:", lastOutboundComm.id);
                  
                  // Associa la risposta alla proprietà originale
                  if (lastOutboundComm.propertyId) {
                    console.log(`[PROPERTY-LINKING] Associazione risposta con immobile ID: ${lastOutboundComm.propertyId}`);
                    // Aggiorna la comunicazione con propertyId
                    await storage.updateCommunication(communication.id, {
                      propertyId: lastOutboundComm.propertyId,
                      responseToId: lastOutboundComm.id
                    });
                  }
                  
                  await processClientResponse(
                    communication.content,
                    lastOutboundComm.id,
                    client.id,
                    lastOutboundComm.propertyId ?? undefined
                  );
                  console.log("[SENTIMENT] Analisi sentimento completata");
                }
              }
            } catch (err) {
              console.error("[SENTIMENT] Errore durante l'analisi del sentimento:", err);
            }
          }
          
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
  
  // Endpoint per testare l'analisi del sentimento avanzata
  app.post("/api/sentiment/analyze", async (req: Request, res: Response) => {
    try {
      const { text, clientId, propertyId, commId } = req.body;
      
      if (!text || !clientId) {
        return res.status(400).json({
          success: false,
          error: "Parametri mancanti",
          message: "Fornire almeno text e clientId"
        });
      }
      
      // Ottieni i dati del cliente
      const client = await storage.getClient(parseInt(clientId));
      if (!client) {
        return res.status(404).json({ 
          success: false, 
          error: "Cliente non trovato"
        });
      }
      
      // Ottieni i dati della proprietà, se fornita
      let propertyInfo = {};
      if (propertyId) {
        const property = await storage.getProperty(parseInt(propertyId));
        if (property) {
          propertyInfo = {
            address: property.address,
            type: property.type
          };
        }
      }
      
      // Esegui l'analisi del sentimento
      const { analyzeSentiment } = await import('./services/sentimentAnalysis');
      const result = await analyzeSentiment(
        text,
        `${client.firstName} ${client.lastName}`,
        propertyInfo
      );
      
      // Se è stato fornito un ID comunicazione, simula una risposta completa
      if (commId) {
        const { processClientResponse } = await import('./services/sentimentAnalysis');
        try {
          await processClientResponse(
            text,
            parseInt(commId),
            client.id,
            propertyId ? parseInt(propertyId) : undefined
          );
        } catch (err) {
          console.error("[SENTIMENT-TEST] Errore nella simulazione della risposta completa:", err);
        }
      }
      
      // Restituisci i risultati
      res.status(200).json({
        success: true,
        message: "Analisi del sentimento completata",
        result,
        clientInfo: {
          id: client.id,
          name: `${client.firstName} ${client.lastName}`,
          isFriend: client.isFriend
        },
        propertyId: propertyId ? parseInt(propertyId) : null
      });
    } catch (error) {
      console.error("Errore durante l'analisi del sentimento:", error);
      res.status(500).json({
        success: false,
        error: "Errore interno",
        message: error.message
      });
    }
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
        to: config.agentPhoneNumber, // Numero dell'agente dalla configurazione
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
  
  // API per le statistiche di ricerca (analytics)
  app.get("/api/analytics/searches", async (req: Request, res: Response) => {
    try {
      // Fetch tutti i buyer dal database
      const buyersData = await db
        .select()
        .from(buyers)
        .innerJoin(clients, eq(buyers.clientId, clients.id));
      
      // Calcolare statistiche per zone (aree di ricerca)
      const zoneStats: Record<string, { count: number }> = {};
      buyersData.forEach(buyer => {
        if (buyer.clients.city) {
          const zone = buyer.clients.city.split(',')[0].trim();
          if (!zoneStats[zone]) {
            zoneStats[zone] = { count: 0 };
          }
          zoneStats[zone].count += 1;
        }
      });
      
      // Calcolare statistiche per fasce di prezzo
      const priceRangeStats: Record<string, { count: number }> = {
        'Fino a €150k': { count: 0 },
        '€150k - €300k': { count: 0 },
        '€300k - €500k': { count: 0 },
        '€500k - €800k': { count: 0 },
        'Oltre €800k': { count: 0 }
      };
      
      buyersData.forEach(buyer => {
        const maxPrice = buyer.buyers.maxPrice;
        if (!maxPrice) return;
        
        if (maxPrice <= 150000) {
          priceRangeStats['Fino a €150k'].count += 1;
        } else if (maxPrice <= 300000) {
          priceRangeStats['€150k - €300k'].count += 1;
        } else if (maxPrice <= 500000) {
          priceRangeStats['€300k - €500k'].count += 1;
        } else if (maxPrice <= 800000) {
          priceRangeStats['€500k - €800k'].count += 1;
        } else {
          priceRangeStats['Oltre €800k'].count += 1;
        }
      });
      
      // Calcolare statistiche per dimensioni (metri quadri)
      const sizeRangeStats: Record<string, { count: number }> = {
        'Fino a 50 m²': { count: 0 },
        '50 - 80 m²': { count: 0 },
        '80 - 120 m²': { count: 0 },
        '120 - 200 m²': { count: 0 },
        'Oltre 200 m²': { count: 0 }
      };
      
      buyersData.forEach(buyer => {
        const minSize = buyer.buyers.minSize;
        if (!minSize) return;
        
        if (minSize <= 50) {
          sizeRangeStats['Fino a 50 m²'].count += 1;
        } else if (minSize <= 80) {
          sizeRangeStats['50 - 80 m²'].count += 1;
        } else if (minSize <= 120) {
          sizeRangeStats['80 - 120 m²'].count += 1;
        } else if (minSize <= 200) {
          sizeRangeStats['120 - 200 m²'].count += 1;
        } else {
          sizeRangeStats['Oltre 200 m²'].count += 1;
        }
      });
      
      // Convertire in array e calcolare percentuali
      const totalBuyers = buyersData.length || 1; // Evita divisione per zero
      
      const zones = Object.entries(zoneStats)
        .map(([name, { count }]) => ({
          name,
          count,
          percentage: Math.round((count / totalBuyers) * 100)
        }))
        .sort((a, b) => b.count - a.count);
      
      const priceRanges = Object.entries(priceRangeStats)
        .map(([range, { count }]) => ({
          range,
          count,
          percentage: Math.round((count / totalBuyers) * 100)
        }))
        .sort((a, b) => b.count - a.count);
      
      const sizeRanges = Object.entries(sizeRangeStats)
        .map(([range, { count }]) => ({
          range,
          count,
          percentage: Math.round((count / totalBuyers) * 100)
        }))
        .sort((a, b) => b.count - a.count);
      
      // Restituire i risultati
      res.json({
        zones,
        priceRanges,
        sizeRanges
      });
    } catch (error) {
      console.error("Error calculating search analytics:", error);
      res.status(500).json({ error: "Error calculating search analytics" });
    }
  });
  
  // API per la classifica delle proprietà condivise
  app.get("/api/analytics/shared-properties-ranking", async (req: Request, res: Response) => {
    try {
      // Fetch proprietà condivise
      const sharedProps = await db
        .select()
        .from(sharedProperties);
        
      // Per ogni proprietà, calcola il numero di potenziali interessati
      const rankedProperties = await Promise.all(sharedProps.map(async (property) => {
        const buyersData = await db
          .select()
          .from(buyers)
          .innerJoin(clients, eq(buyers.clientId, clients.id));
          
        // Calcola quanti buyer potrebbero essere interessati
        const interestedBuyers = buyersData.filter(buyer => {
          if (!property.size || !property.price) return false;
          
          const matchesSize = !buyer.buyers.minSize || property.size >= buyer.buyers.minSize * 0.9;
          const matchesPrice = !buyer.buyers.maxPrice || property.price <= buyer.buyers.maxPrice * 1.1;
          
          return matchesSize && matchesPrice;
        });
        
        // Calcola match percentage medio
        let totalMatchScore = 0;
        
        interestedBuyers.forEach(buyer => {
          let matchScore = 0;
          let totalCriteria = 0;
          
          if (buyer.buyers.minSize && property.size) {
            totalCriteria++;
            const sizeRatio = property.size / buyer.buyers.minSize;
            if (sizeRatio >= 1 && sizeRatio <= 1.5) {
              matchScore += 1;
            } else if (sizeRatio >= 0.9 && sizeRatio < 1) {
              matchScore += 0.7;
            } else if (sizeRatio > 1.5) {
              matchScore += 0.5;
            }
          }
          
          if (buyer.buyers.maxPrice && property.price) {
            totalCriteria++;
            const priceRatio = property.price / buyer.buyers.maxPrice;
            if (priceRatio <= 1) {
              matchScore += 1;
            } else if (priceRatio > 1 && priceRatio <= 1.1) {
              matchScore += 0.7;
            }
          }
          
          totalMatchScore += totalCriteria > 0 ? (matchScore / totalCriteria) : 0.5;
        });
        
        const averageMatchPercentage = interestedBuyers.length > 0
          ? Math.round((totalMatchScore / interestedBuyers.length) * 100)
          : 0;
          
        return {
          id: property.id,
          address: property.address || 'Indirizzo non specificato',
          city: property.city || 'Città non specificata',
          size: property.size,
          price: property.price,
          interestedBuyersCount: interestedBuyers.length,
          matchPercentage: averageMatchPercentage,
          stage: property.stage || 'address_found',
          isAcquired: property.isAcquired || false
        };
      }));
      
      // Ordina per numero di potenziali interessati (decrescente)
      const sortedProperties = rankedProperties.sort((a, b) => 
        b.interestedBuyersCount - a.interestedBuyersCount
      );
      
      res.json(sortedProperties);
    } catch (error) {
      console.error("Error fetching shared properties ranking:", error);
      res.status(500).json({ error: "Error fetching shared properties ranking" });
    }
  });
  
  // Registra i router per API specifiche
  app.use("/api/geocode", geocodeRouter);

  // Endpoint per controllare e configurare l'agente virtuale
  app.get("/api/agent/status", async (req: Request, res: Response) => {
    const isEnabled = process.env.ENABLE_VIRTUAL_AGENT === 'true';
    res.status(200).json({
      enabled: isEnabled
    });
  });
  
  app.post("/api/agent/configure", async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: "Il parametro 'enabled' deve essere un valore booleano"
        });
      }
      
      // Importazione dinamica per evitare dipendenze circolari
      const { configureAutoResponseSystem } = await import('./services/virtualAgent');
      const result = await configureAutoResponseSystem(enabled);
      
      // Imposta la variabile d'ambiente per il polling
      process.env.ENABLE_VIRTUAL_AGENT = enabled ? 'true' : 'false';
      
      res.status(200).json({
        success: true,
        enabled: enabled,
        message: `Agente virtuale ${enabled ? 'abilitato' : 'disabilitato'} con successo`
      });
    } catch (error: any) {
      console.error("Errore nella configurazione dell'agente virtuale:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Errore nella configurazione dell'agente virtuale"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
