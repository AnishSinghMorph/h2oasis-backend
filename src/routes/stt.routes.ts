import express from 'express';
import { speechToText } from '../controllers/stt.controller';
import multer from 'multer';

const router = express.Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for audio files
  },
  fileFilter: (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

/**
 * POST /api/stt/transcribe
 * Convert speech to text using ElevenLabs STT API
 */
router.post('/transcribe', upload.single('file'), speechToText);

export default router;