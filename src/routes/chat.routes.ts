import { Router, Request, Response } from "express";
import { ChatController } from "../controllers/chat.controller";

const router = Router();
const chatController = new ChatController();

/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     summary: Send message to AI assistant
 *     description: Send a message to the AI assistant with health context. The AI uses health data to provide personalized recommendations.
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *               - userId
 *             properties:
 *               message:
 *                 type: string
 *                 example: How was my sleep last night?
 *               userId:
 *                 type: string
 *                 description: Firebase UID
 *                 example: u6QJ1xtouUN9F6uGjUZEa5v2oS12
 *               voiceId:
 *                 type: string
 *                 description: Optional ElevenLabs voice ID for TTS
 *               useVoice:
 *                 type: boolean
 *                 description: Whether to return audio response
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 response:
 *                   type: string
 *                   description: AI text response
 *                 audioUrl:
 *                   type: string
 *                   description: URL to audio file (if useVoice is true)
 *       400:
 *         description: Invalid request
 */
router.post("/message", async (req: Request, res: Response) => {
  await chatController.sendMessage(req as any, res);
});

// Removed /health-context/:userId endpoint - now using real data from /api/health-data

/**
 * @swagger
 * /api/chat/generate-plan:
 *   post:
 *     summary: Generate personalized recovery plan
 *     description: Creates a personalized recovery plan based on user's health data and selected product
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Firebase UID
 *               healthData:
 *                 type: object
 *               productContext:
 *                 type: object
 *     responses:
 *       200:
 *         description: Recovery plan generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 plan:
 *                   type: object
 */
router.post("/generate-plan", async (req: Request, res: Response) => {
  await chatController.generatePlan(req, res);
});

/**
 * @swagger
 * /api/chat/create-session:
 *   post:
 *     summary: Create a guided wellness session
 *     description: Creates a personalized wellness session with timed steps based on user's health data and selected products
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tags
 *             properties:
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Product tags (e.g., ["Spa", "Hot Tub", "Sauna"])
 *                 example: ["Spa", "Hot Tub"]
 *               goals:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Wellness goals
 *                 example: ["relaxation", "stress relief"]
 *               mood:
 *                 type: string
 *                 description: Current mood state
 *                 example: "stressed"
 *               customPrompt:
 *                 type: string
 *                 description: Additional context or preferences
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 session:
 *                   type: object
 *                   properties:
 *                     SessionId:
 *                       type: string
 *                     SessionName:
 *                       type: string
 *                     TotalDurationMinutes:
 *                       type: number
 *                     Steps:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           StepNumber:
 *                             type: number
 *                           Activity:
 *                             type: string
 *                           DurationMinutes:
 *                             type: number
 *                           Instructions:
 *                             type: string
 *                           Message:
 *                             type: string
 *                           TimerStartMessage:
 *                             type: string
 *                           TimerEndMessage:
 *                             type: string
 *                     Tips:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Invalid request - missing tags
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Failed to create session
 */
router.post("/create-session", async (req: Request, res: Response) => {
  await chatController.createSession(req, res);
});

/**
 * @swagger
 * /api/chat/history/{userId}:
 *   get:
 *     summary: Get chat history (Coming Soon)
 *     description: Retrieve chat conversation history for a user
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat history (feature coming soon)
 */
router.get("/history/:userId", async (req: Request, res: Response) => {
  // TODO: Implement chat history retrieval
  res.json({
    success: true,
    history: [],
    message: "Chat history feature coming soon",
  });
});

/**
 * @swagger
 * /api/chat/history/{userId}:
 *   delete:
 *     summary: Clear chat history (Coming Soon)
 *     description: Delete all chat conversation history for a user
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat history cleared
 */
router.delete("/history/:userId", async (req: Request, res: Response) => {
  // TODO: Implement chat history clearing
  res.json({
    success: true,
    message: "Chat history cleared",
  });
});

export default router;
