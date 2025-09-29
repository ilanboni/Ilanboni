import type { Express, Request, Response } from "express";
import multer from "multer";
import { getUltraMsgClient } from "./lib/ultramsg";
import { storage } from "./storage";

// Configurazione multer semplice
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export function registerFileUpload(app: Express) {
  // Endpoint semplicissimo per test
  app.post("/api/file-upload-test", (req: Request, res: Response) => {
    console.log("🚀 [FILE UPLOAD TEST] ENDPOINT RAGGIUNTO!");
    res.json({ success: true, message: "File upload test endpoint funziona!" });
  });

  // Endpoint per upload file WhatsApp - NOME UNICO!
  app.post("/api/emergency-file-upload-xyz123", upload.single('file'), async (req: Request, res: Response) => {
    console.log("🚀🚀🚀 [EMERGENCY-ENDPOINT-XYZ123] ENDPOINT RAGGIUNTOOOOO! 🚀🚀🚀");
    console.log("🚀🚀🚀 [FILE] File presente:", !!req.file);
    console.log("🚀🚀🚀 [FILE] Body:", req.body);
    console.log("🚀🚀🚀 [FILE] URL chiamata:", req.url);
    console.log("🚀🚀🚀 [FILE] Method:", req.method);

    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nessun file allegato" });
      }

      const { to } = req.body;
      if (!to) {
        return res.status(400).json({ error: "Numero destinatario mancante" });
      }

      // UltraMsg API call
      const ultraMsgClient = getUltraMsgClient();
      const result = await ultraMsgClient.sendFile(
        to,
        req.file.buffer,
        req.file.originalname,
        ""
      );

      console.log("🎉 [FILE SIMPLE] File inviato con successo:", result);

      res.status(200).json({
        success: true,
        message: "File inviato con successo!",
        fileName: req.file.originalname,
        fileSize: req.file.size,
        result
      });

    } catch (error: any) {
      console.error("❌ [FILE SIMPLE] Errore:", error);
      res.status(500).json({ 
        error: "Errore invio file", 
        details: error.message 
      });
    }
  });
}