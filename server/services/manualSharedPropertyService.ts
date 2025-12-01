import { db } from "../db";
import { sharedProperties, tasks, clients, clientFavorites } from "@shared/schema";
import { eq, and, or, sql } from "drizzle-orm";

interface ManualPropertyData {
  url: string;
  address: string;
  city?: string;
  type: string;
  price: number;
  size?: number;
  floor?: string;
  notes?: string;
  scrapedForClientId: number;
}

interface CreateResult {
  property: typeof sharedProperties.$inferSelect;
  task: typeof tasks.$inferSelect;
  favorite: typeof clientFavorites.$inferSelect;
  isDuplicate: boolean;
}

export async function createManualSharedProperty(
  data: ManualPropertyData
): Promise<CreateResult> {
  console.log("[MANUAL-PROPERTY] Starting creation for client:", data.scrapedForClientId);
  
  // Get client info for task description
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, data.scrapedForClientId))
    .limit(1);

  if (!client) {
    throw new Error(`Client with ID ${data.scrapedForClientId} not found`);
  }

  console.log("[MANUAL-PROPERTY] Client found:", client.firstName, client.lastName);

  // Use transaction to handle all inserts atomically
  return await db.transaction(async (tx) => {
    let property: typeof sharedProperties.$inferSelect;
    let isDuplicate = false;

    // Format price as plain number string (no locale formatting to avoid SQL issues)
    const priceFormatted = data.price.toString();
    
    // Try to insert property using Drizzle ORM (safer than raw SQL)
    try {
      const [insertedProperty] = await tx
        .insert(sharedProperties)
        .values({
          address: data.address,
          city: data.city || "Milano",
          type: data.type,
          price: data.price,
          size: data.size || null,
          floor: data.floor || null,
          url: data.url,
          ownerNotes: data.notes || null,
          scrapedForClientId: data.scrapedForClientId,
          isFavorite: true,
          isAcquired: false,
          matchBuyers: false,
          stage: "address_found",
          rating: 3,
          portalSource: getPortalSourceFromUrl(data.url)
        })
        .onConflictDoNothing()
        .returning();

      if (insertedProperty) {
        property = insertedProperty;
        console.log("[MANUAL-PROPERTY] Property created with ID:", property.id);
      } else {
        // Conflict occurred, fetch existing property
        isDuplicate = true;
        const [existingProperty] = await tx
          .select()
          .from(sharedProperties)
          .where(
            or(
              eq(sharedProperties.url, data.url),
              and(
                eq(sharedProperties.address, data.address),
                eq(sharedProperties.price, data.price)
              )
            )
          )
          .limit(1);
        
        if (!existingProperty) {
          throw new Error("Property conflict but no existing property found");
        }
        property = existingProperty;
        console.log("[MANUAL-PROPERTY] Existing property found with ID:", property.id);
      }
    } catch (error) {
      console.error("[MANUAL-PROPERTY] Error inserting property:", error);
      throw error;
    }

    // Add property to client favorites
    let favorite: typeof clientFavorites.$inferSelect;
    try {
      const [insertedFavorite] = await tx
        .insert(clientFavorites)
        .values({
          clientId: data.scrapedForClientId,
          sharedPropertyId: property.id,
          notes: `Aggiunto manualmente: ${data.notes || ''}`
        })
        .onConflictDoNothing()
        .returning();

      if (insertedFavorite) {
        favorite = insertedFavorite;
        console.log("[MANUAL-PROPERTY] Favorite created with ID:", favorite.id);
      } else {
        // Already in favorites, fetch existing
        const [existingFavorite] = await tx
          .select()
          .from(clientFavorites)
          .where(
            and(
              eq(clientFavorites.clientId, data.scrapedForClientId),
              eq(clientFavorites.sharedPropertyId, property.id)
            )
          )
          .limit(1);
        
        if (!existingFavorite) {
          throw new Error("Favorite conflict but no existing favorite found");
        }
        favorite = existingFavorite;
        console.log("[MANUAL-PROPERTY] Existing favorite found with ID:", favorite.id);
      }
    } catch (error) {
      console.error("[MANUAL-PROPERTY] Error inserting favorite:", error);
      throw error;
    }

    // Create task for the client
    const taskTitle = `Immobile in linea con ricerca cliente ${client.firstName} ${client.lastName}`;
    const taskDescription = `Immobile trovato: ${data.address}, ${data.city || "Milano"} - €${priceFormatted}`;

    let task: typeof tasks.$inferSelect;
    try {
      const [insertedTask] = await tx
        .insert(tasks)
        .values({
          type: "search",
          title: taskTitle,
          description: taskDescription,
          clientId: data.scrapedForClientId,
          sharedPropertyId: property.id,
          priority: 2,
          dueDate: new Date().toISOString().split("T")[0],
          status: "pending",
          notes: `Link: ${data.url}`
        })
        .onConflictDoNothing()
        .returning();

      if (insertedTask) {
        task = insertedTask;
        console.log("[MANUAL-PROPERTY] Task created with ID:", task.id);
      } else {
        // Task conflict, fetch existing
        const [existingTask] = await tx
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.sharedPropertyId, property.id),
              eq(tasks.clientId, data.scrapedForClientId),
              eq(tasks.type, "search")
            )
          )
          .limit(1);
        
        if (!existingTask) {
          throw new Error("Task conflict but no existing task found");
        }
        task = existingTask;
        console.log("[MANUAL-PROPERTY] Existing task found with ID:", task.id);
      }
    } catch (error) {
      console.error("[MANUAL-PROPERTY] Error inserting task:", error);
      throw error;
    }

    console.log("[MANUAL-PROPERTY] Success! Property:", property.id, "Favorite:", favorite.id, "Task:", task.id);
    return { property, task, favorite, isDuplicate };
  });
}

function getPortalSourceFromUrl(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes("immobiliare.it")) return "Immobiliare.it";
  if (lowerUrl.includes("idealista.it")) return "Idealista.it";
  if (lowerUrl.includes("casa.it")) return "Casa.it";
  if (lowerUrl.includes("subito.it")) return "Subito.it";
  return "Manual";
}
