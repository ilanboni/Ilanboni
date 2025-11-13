import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { db } from "../db";
import { 
  propertyActivities, 
  propertyAttachments,
  insertPropertyActivitySchema,
  insertPropertyAttachmentSchema,
  type PropertyActivity,
  type PropertyAttachment
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import fs from "fs/promises";

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "property-attachments");
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    // Allow common document and image formats
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo file non supportato: ${file.mimetype}`));
    }
  }
});

// ===== PROPERTY ACTIVITIES ROUTES =====

// GET /api/shared-properties/:id/activities - Lista attività
router.get("/shared-properties/:id/activities", async (req: Request, res: Response) => {
  try {
    const sharedPropertyId = parseInt(req.params.id);
    if (isNaN(sharedPropertyId)) {
      return res.status(400).json({ error: "ID proprietà non valido" });
    }

    const activities = await db
      .select()
      .from(propertyActivities)
      .where(eq(propertyActivities.sharedPropertyId, sharedPropertyId))
      .orderBy(desc(propertyActivities.activityDate));

    res.json(activities);
  } catch (error) {
    console.error(`[GET /api/shared-properties/${req.params.id}/activities]`, error);
    res.status(500).json({ error: "Errore durante il recupero delle attività" });
  }
});

// POST /api/shared-properties/:id/activities - Crea attività
router.post("/shared-properties/:id/activities", async (req: Request, res: Response) => {
  try {
    const sharedPropertyId = parseInt(req.params.id);
    if (isNaN(sharedPropertyId)) {
      return res.status(400).json({ error: "ID proprietà non valido" });
    }

    // Convert date strings to Date objects before validation
    const activityDate = req.body.activityDate ? new Date(req.body.activityDate) : new Date();
    const completedAt = req.body.completedAt ? new Date(req.body.completedAt) : undefined;
    
    // Validate dates are not NaN
    if (isNaN(activityDate.getTime())) {
      return res.status(400).json({ error: "Data attività non valida" });
    }
    if (completedAt && isNaN(completedAt.getTime())) {
      return res.status(400).json({ error: "Data completamento non valida" });
    }
    
    const dataToValidate = {
      ...req.body,
      sharedPropertyId,
      activityDate,
      completedAt
    };

    // Validate request body
    const validatedData = insertPropertyActivitySchema.parse(dataToValidate);

    const [activity] = await db
      .insert(propertyActivities)
      .values(validatedData)
      .returning();

    console.log(`[POST /api/shared-properties/${sharedPropertyId}/activities] Attività creata:`, activity.id);
    res.status(201).json(activity);
  } catch (error) {
    console.error(`[POST /api/shared-properties/${req.params.id}/activities]`, error);
    
    if (error instanceof Error && error.message.includes('validation')) {
      return res.status(400).json({ error: "Dati attività non validi", details: error.message });
    }
    
    res.status(500).json({ error: "Errore durante la creazione dell'attività" });
  }
});

// PATCH /api/shared-properties/:id/activities/:activityId - Aggiorna attività
router.patch("/shared-properties/:id/activities/:activityId", async (req: Request, res: Response) => {
  try {
    const sharedPropertyId = parseInt(req.params.id);
    const activityId = parseInt(req.params.activityId);
    
    if (isNaN(sharedPropertyId) || isNaN(activityId)) {
      return res.status(400).json({ error: "ID non validi" });
    }

    // Check if activity exists and belongs to this property
    const existing = await db
      .select()
      .from(propertyActivities)
      .where(
        and(
          eq(propertyActivities.id, activityId),
          eq(propertyActivities.sharedPropertyId, sharedPropertyId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Attività non trovata" });
    }

    // Whitelist of allowed update fields (exclude id, sharedPropertyId, createdAt)
    const allowedFields = ['type', 'title', 'description', 'activityDate', 'status', 'completedAt', 'createdBy'];
    const updateData: any = {
      updatedAt: new Date()
    };

    // Copy only allowed fields from request body
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // Convert date strings to Date objects
        if ((field === 'activityDate' || field === 'completedAt') && req.body[field]) {
          const dateValue = new Date(req.body[field]);
          if (isNaN(dateValue.getTime())) {
            return res.status(400).json({ error: `Valore data non valido per ${field}` });
          }
          updateData[field] = dateValue;
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    // Update activity
    const [updated] = await db
      .update(propertyActivities)
      .set(updateData)
      .where(eq(propertyActivities.id, activityId))
      .returning();

    console.log(`[PATCH /api/shared-properties/${sharedPropertyId}/activities/${activityId}] Attività aggiornata`);
    res.json(updated);
  } catch (error) {
    console.error(`[PATCH /api/shared-properties/${req.params.id}/activities/${req.params.activityId}]`, error);
    res.status(500).json({ error: "Errore durante l'aggiornamento dell'attività" });
  }
});

// DELETE /api/shared-properties/:id/activities/:activityId - Elimina attività
router.delete("/shared-properties/:id/activities/:activityId", async (req: Request, res: Response) => {
  try {
    const sharedPropertyId = parseInt(req.params.id);
    const activityId = parseInt(req.params.activityId);
    
    if (isNaN(sharedPropertyId) || isNaN(activityId)) {
      return res.status(400).json({ error: "ID non validi" });
    }

    // Check if activity exists and belongs to this property
    const existing = await db
      .select()
      .from(propertyActivities)
      .where(
        and(
          eq(propertyActivities.id, activityId),
          eq(propertyActivities.sharedPropertyId, sharedPropertyId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Attività non trovata" });
    }

    await db
      .delete(propertyActivities)
      .where(eq(propertyActivities.id, activityId));

    console.log(`[DELETE /api/shared-properties/${sharedPropertyId}/activities/${activityId}] Attività eliminata`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[DELETE /api/shared-properties/${req.params.id}/activities/${req.params.activityId}]`, error);
    res.status(500).json({ error: "Errore durante l'eliminazione dell'attività" });
  }
});

// ===== PROPERTY ATTACHMENTS ROUTES =====

// GET /api/shared-properties/:id/attachments - Lista allegati
router.get("/shared-properties/:id/attachments", async (req: Request, res: Response) => {
  try {
    const sharedPropertyId = parseInt(req.params.id);
    if (isNaN(sharedPropertyId)) {
      return res.status(400).json({ error: "ID proprietà non valido" });
    }

    const attachments = await db
      .select()
      .from(propertyAttachments)
      .where(eq(propertyAttachments.sharedPropertyId, sharedPropertyId))
      .orderBy(desc(propertyAttachments.createdAt));

    res.json(attachments);
  } catch (error) {
    console.error(`[GET /api/shared-properties/${req.params.id}/attachments]`, error);
    res.status(500).json({ error: "Errore durante il recupero degli allegati" });
  }
});

// POST /api/shared-properties/:id/attachments - Upload allegato
router.post("/shared-properties/:id/attachments", upload.single('file'), async (req: Request, res: Response) => {
  try {
    const sharedPropertyId = parseInt(req.params.id);
    if (isNaN(sharedPropertyId)) {
      return res.status(400).json({ error: "ID proprietà non valido" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Nessun file caricato" });
    }

    // Validate category against schema constraints
    const validCategories = ['visura', 'planimetria', 'foto', 'contratto', 'altro'];
    const { category, notes } = req.body;
    
    if (!category || !validCategories.includes(category)) {
      // Delete uploaded file if validation fails
      await fs.unlink(req.file.path).catch(console.error);
      return res.status(400).json({ 
        error: `Categoria non valida. Usa: ${validCategories.join(', ')}` 
      });
    }

    // SECURITY: Store only the safe filename generated by multer, not the full path
    // This prevents path traversal attacks
    const safeFilename = path.basename(req.file.filename);
    const uploadDir = path.join(process.cwd(), "uploads", "property-attachments");
    const safePath = path.join(uploadDir, safeFilename);

    // Validate schema with Zod
    const attachmentData = {
      sharedPropertyId,
      category,
      filename: req.file.originalname,
      filepath: safePath, // Use safe absolute path
      filesize: req.file.size,
      mimetype: req.file.mimetype,
      notes: notes || null,
      uploadedBy: (req as any).user?.id || null
    };

    // Validate against Zod schema (excluding auto-generated fields)
    const validationResult = insertPropertyAttachmentSchema
      .omit({ id: true, createdAt: true, updatedAt: true })
      .safeParse(attachmentData);

    if (!validationResult.success) {
      // Delete uploaded file if validation fails
      await fs.unlink(req.file.path).catch(console.error);
      return res.status(400).json({ 
        error: "Dati allegato non validi", 
        details: validationResult.error.errors 
      });
    }

    const [attachment] = await db
      .insert(propertyAttachments)
      .values(attachmentData)
      .returning();

    console.log(`[POST /api/shared-properties/${sharedPropertyId}/attachments] Allegato caricato:`, attachment.id);
    res.status(201).json(attachment);
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }
    
    console.error(`[POST /api/shared-properties/${req.params.id}/attachments]`, error);
    res.status(500).json({ error: "Errore durante il caricamento dell'allegato" });
  }
});

// GET /api/shared-properties/:id/attachments/:attachmentId/download - Download allegato
router.get("/shared-properties/:id/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  try {
    const sharedPropertyId = parseInt(req.params.id);
    const attachmentId = parseInt(req.params.attachmentId);
    
    if (isNaN(sharedPropertyId) || isNaN(attachmentId)) {
      return res.status(400).json({ error: "ID non validi" });
    }

    // Get attachment
    const [attachment] = await db
      .select()
      .from(propertyAttachments)
      .where(
        and(
          eq(propertyAttachments.id, attachmentId),
          eq(propertyAttachments.sharedPropertyId, sharedPropertyId)
        )
      )
      .limit(1);

    if (!attachment) {
      return res.status(404).json({ error: "Allegato non trovato" });
    }

    // SECURITY: Sanitize filepath to prevent directory traversal
    // Only use the basename to prevent path traversal attacks
    const safeFilename = path.basename(attachment.filepath);
    const uploadDir = path.join(process.cwd(), "uploads", "property-attachments");
    const safePath = path.join(uploadDir, safeFilename);

    // Normalize and validate the path stays within upload directory
    const normalizedPath = path.normalize(safePath);
    if (!normalizedPath.startsWith(uploadDir)) {
      console.error(`[SECURITY] Path traversal attempt detected: ${attachment.filepath}`);
      return res.status(403).json({ error: "Accesso negato" });
    }

    // Check if file exists
    try {
      await fs.access(normalizedPath);
    } catch {
      return res.status(404).json({ error: "File non trovato sul server" });
    }

    // Send file with sanitized path
    res.download(normalizedPath, attachment.filename);
  } catch (error) {
    console.error(`[GET /api/shared-properties/${req.params.id}/attachments/${req.params.attachmentId}/download]`, error);
    res.status(500).json({ error: "Errore durante il download dell'allegato" });
  }
});

// DELETE /api/shared-properties/:id/attachments/:attachmentId - Elimina allegato
router.delete("/shared-properties/:id/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const sharedPropertyId = parseInt(req.params.id);
    const attachmentId = parseInt(req.params.attachmentId);
    
    if (isNaN(sharedPropertyId) || isNaN(attachmentId)) {
      return res.status(400).json({ error: "ID non validi" });
    }

    // Get attachment to delete file
    const [attachment] = await db
      .select()
      .from(propertyAttachments)
      .where(
        and(
          eq(propertyAttachments.id, attachmentId),
          eq(propertyAttachments.sharedPropertyId, sharedPropertyId)
        )
      )
      .limit(1);

    if (!attachment) {
      return res.status(404).json({ error: "Allegato non trovato" });
    }

    // Delete from database
    await db
      .delete(propertyAttachments)
      .where(eq(propertyAttachments.id, attachmentId));

    // Delete physical file
    try {
      await fs.unlink(attachment.filepath);
    } catch (error) {
      console.warn(`File fisico non trovato o già eliminato: ${attachment.filepath}`);
    }

    console.log(`[DELETE /api/shared-properties/${sharedPropertyId}/attachments/${attachmentId}] Allegato eliminato`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[DELETE /api/shared-properties/${req.params.id}/attachments/${req.params.attachmentId}]`, error);
    res.status(500).json({ error: "Errore durante l'eliminazione dell'allegato" });
  }
});

export default router;
