import { db } from "../db";
import { sharedProperties, tasks, clients } from "@shared/schema";
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
  isDuplicate: boolean;
}

export async function createManualSharedProperty(
  data: ManualPropertyData
): Promise<CreateResult> {
  // Get client info for task description
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, data.scrapedForClientId))
    .limit(1);

  if (!client) {
    throw new Error(`Client with ID ${data.scrapedForClientId} not found`);
  }

  // Use transaction with INSERT ON CONFLICT to handle duplicates atomically
  return await db.transaction(async (tx) => {
    let property: typeof sharedProperties.$inferSelect;
    let isDuplicate = false;

    // Try to insert property, handling both unique constraints (url and address+price)
    // Use ON CONFLICT DO NOTHING without target to handle any constraint violation
    const insertResult = await tx.execute(sql`
      INSERT INTO shared_properties (
        address, city, type, price, size, floor, url, owner_notes,
        scraped_for_client_id, is_favorite, is_acquired, match_buyers,
        stage, rating, portal_source
      ) VALUES (
        ${data.address}, ${data.city || "Milano"}, ${data.type}, ${data.price},
        ${data.size || null}, ${data.floor || null}, ${data.url}, ${data.notes || null},
        ${data.scrapedForClientId}, true, false, false,
        'address_found', 3, ${getPortalSourceFromUrl(data.url)}
      )
      ON CONFLICT DO NOTHING
      RETURNING *
    `);

    // If insert was successful, we have a new property
    if (insertResult.rows.length > 0) {
      property = insertResult.rows[0] as typeof sharedProperties.$inferSelect;
    } else {
      // Conflict occurred on either url or address+price, fetch existing property
      isDuplicate = true;
      const existing = await tx.execute(sql`
        SELECT * FROM shared_properties
        WHERE url = ${data.url}
           OR (address = ${data.address} AND price = ${data.price})
        LIMIT 1
      `);
      property = existing.rows[0] as typeof sharedProperties.$inferSelect;
    }

    // Now handle task creation with ON CONFLICT
    const taskTitle = `Immobile in linea con ricerca cliente ${client.firstName} ${client.lastName}`;
    const taskDescription = `Immobile trovato: ${data.address}, ${data.city || "Milano"} - €${data.price.toLocaleString()}`;

    const taskResult = await tx.execute(sql`
      INSERT INTO tasks (
        type, title, description, client_id, shared_property_id,
        priority, due_date, status, notes
      ) VALUES (
        'search', ${taskTitle}, ${taskDescription}, ${data.scrapedForClientId},
        ${property.id}, 2, ${new Date().toISOString().split("T")[0]},
        'pending', ${"Link: " + data.url}
      )
      ON CONFLICT (shared_property_id, client_id, type) DO NOTHING
      RETURNING *
    `);

    let task: typeof tasks.$inferSelect;

    // If task insert was successful, we have a new task
    if (taskResult.rows.length > 0) {
      task = taskResult.rows[0] as typeof tasks.$inferSelect;
    } else {
      // Task conflict occurred, fetch existing task
      isDuplicate = true;
      const existingTask = await tx.execute(sql`
        SELECT * FROM tasks
        WHERE shared_property_id = ${property.id}
          AND client_id = ${data.scrapedForClientId}
          AND type = 'search'
        LIMIT 1
      `);
      task = existingTask.rows[0] as typeof tasks.$inferSelect;
    }

    return { property, task, isDuplicate };
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
