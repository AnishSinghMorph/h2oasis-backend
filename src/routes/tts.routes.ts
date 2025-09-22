import { Router } from 'express';
import { TTSController } from '../controllers/tts.controller';
import { verifyFirebaseToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/essential.middleware';

const router = Router();

// Get available voices (public)
router.get('/voices', asyncHandler(TTSController.getVoices));

// Preview voice with sample text (public)
router.get('/preview/:voiceKey', asyncHandler(TTSController.previewVoice));

// Convert text to speech (authenticated)
router.post('/synthesize', verifyFirebaseToken, asyncHandler(TTSController.textToSpeech));

// Serve audio files (public but with filename validation)
router.get('/audio/:fileName', asyncHandler(TTSController.serveAudio));

export default router;