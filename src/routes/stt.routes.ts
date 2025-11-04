import express from "express";
import { speechToText } from "../controllers/stt.controller";
import multer from "multer";

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for audio files
  },
  fileFilter: (
    req: express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    // Accept audio files
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

/**
 * @swagger
 * /api/stt/transcribe:
 *   post:
 *     summary: Transcribe audio to text
 *     description: Convert audio file to text using speech-to-text (STT) with ElevenLabs API
 *     tags: [Speech-to-Text]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Audio file to transcribe (max 25MB, audio formats only)
 *     responses:
 *       200:
 *         description: Audio transcribed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 text:
 *                   type: string
 *                   description: Transcribed text
 *                   example: Hello, how was my sleep last night?
 *       400:
 *         description: Invalid file or request
 *       413:
 *         description: File too large (max 25MB)
 */
router.post("/transcribe", upload.single("file"), speechToText);

export default router;
