import { Router } from 'express';
import { TTSController } from '../controllers/tts.controller';
import { verifyFirebaseToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/essential.middleware';

const router = Router();

/**
 * @swagger
 * /api/tts/voices:
 *   get:
 *     summary: Get available TTS voices
 *     description: Retrieve list of all available text-to-speech voices
 *     tags: [Text-to-Speech]
 *     responses:
 *       200:
 *         description: List of available voices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 voices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 */
router.get('/voices', asyncHandler(TTSController.getVoices));

/**
 * @swagger
 * /api/tts/preview/{voiceKey}:
 *   get:
 *     summary: Preview a voice
 *     description: Generate a sample audio preview of a specific voice
 *     tags: [Text-to-Speech]
 *     parameters:
 *       - in: path
 *         name: voiceKey
 *         required: true
 *         schema:
 *           type: string
 *         description: Voice identifier key
 *         example: alloy
 *     responses:
 *       200:
 *         description: Audio preview generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 audioUrl:
 *                   type: string
 */
router.get('/preview/:voiceKey', asyncHandler(TTSController.previewVoice));

/**
 * @swagger
 * /api/tts/synthesize:
 *   post:
 *     summary: Convert text to speech
 *     description: Synthesize text into audio using the selected voice
 *     tags: [Text-to-Speech]
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to convert to speech
 *                 example: Hello! How was your sleep last night?
 *               voiceKey:
 *                 type: string
 *                 description: Voice identifier (optional, uses default if not provided)
 *                 example: alloy
 *     responses:
 *       200:
 *         description: Audio synthesized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 audioUrl:
 *                   type: string
 *                   description: URL to download the audio file
 *       401:
 *         description: Unauthorized
 */
router.post('/synthesize', verifyFirebaseToken, asyncHandler(TTSController.textToSpeech));

/**
 * @swagger
 * /api/tts/audio/{fileName}:
 *   get:
 *     summary: Serve audio file
 *     description: Download a generated audio file
 *     tags: [Text-to-Speech]
 *     parameters:
 *       - in: path
 *         name: fileName
 *         required: true
 *         schema:
 *           type: string
 *         description: Audio file name
 *     responses:
 *       200:
 *         description: Audio file
 *         content:
 *           audio/mpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: File not found
 */
router.get('/audio/:fileName', asyncHandler(TTSController.serveAudio));

export default router;