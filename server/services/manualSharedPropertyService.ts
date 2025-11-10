import { db } from "../db";
import { sharedProperties, tasks, clients } from "@shared/schema";
import { eq } from "drizzle-orm";

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

  // Create property and task in transaction
  return await db.transaction(async (tx) => {
    // Insert shared property
    const [property] = await tx
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
      .returning();

    // Create associated task
    const taskTitle = `Immobile in linea con ricerca cliente ${client.firstName} ${client.lastName}`;
    const taskDescription = `Immobile trovato: ${data.address}, ${data.city || "Milano"} - €${data.price.toLocaleString()}`;

    const [task] = await tx
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
      .returning();

    return { property, task };
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
