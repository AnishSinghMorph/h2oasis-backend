import { Router } from "express";
import { SessionController } from "../controllers/session.controller";

const router = Router();
const sessionController = new SessionController();

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Save a new session
 *     description: Save an AI-generated session to the database for the authenticated user
 *     tags: [Sessions]
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - SessionName
 *               - TotalDurationMinutes
 *               - RecommendedFor
 *               - Steps
 *               - Tips
 *               - StartMessage
 *               - CompletionMessage
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Optional UUID - will be generated if not provided
 *               SessionName:
 *                 type: string
 *                 example: Evening Relaxation
 *               TotalDurationMinutes:
 *                 type: number
 *                 example: 30
 *               RecommendedFor:
 *                 type: string
 *                 example: Relaxation
 *               Steps:
 *                 type: array
 *                 items:
 *                   type: object
 *               Tips:
 *                 type: array
 *                 items:
 *                   type: string
 *               StartMessage:
 *                 type: string
 *               CompletionMessage:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session saved successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Authentication required
 */
router.post("/", sessionController.saveSession);

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: Get all sessions for user
 *     description: Retrieve all sessions for the authenticated user with optional filters
 *     tags: [Sessions]
 *     security:
 *       - FirebaseAuth: []
 *     parameters:
 *       - in: query
 *         name: favorited
 *         schema:
 *           type: boolean
 *         description: Filter by favorited status
 *       - in: query
 *         name: completed
 *         schema:
 *           type: boolean
 *         description: Filter by completion status
 *     responses:
 *       200:
 *         description: List of sessions
 *       401:
 *         description: Authentication required
 */
router.get("/", sessionController.getSessions);

/**
 * @swagger
 * /api/sessions/stats:
 *   get:
 *     summary: Get session statistics
 *     description: Get statistics about user's sessions (total, favorited, completed, pending)
 *     tags: [Sessions]
 *     security:
 *       - FirebaseAuth: []
 *     responses:
 *       200:
 *         description: Session statistics
 *       401:
 *         description: Authentication required
 */
router.get("/stats", sessionController.getSessionStats);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     summary: Get a single session
 *     description: Retrieve a specific session by ID for the authenticated user
 *     tags: [Sessions]
 *     security:
 *       - FirebaseAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session UUID
 *     responses:
 *       200:
 *         description: Session details
 *       404:
 *         description: Session not found
 *       401:
 *         description: Authentication required
 */
router.get("/:sessionId", sessionController.getSessionById);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   patch:
 *     summary: Update a session
 *     description: Update session details (edit timers, favorite, mark complete)
 *     tags: [Sessions]
 *     security:
 *       - FirebaseAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               SessionName:
 *                 type: string
 *               TotalDurationMinutes:
 *                 type: number
 *               Steps:
 *                 type: array
 *               isFavorited:
 *                 type: boolean
 *               isCompleted:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Session updated successfully
 *       404:
 *         description: Session not found
 *       401:
 *         description: Authentication required
 */
router.patch("/:sessionId", sessionController.updateSession);

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   delete:
 *     summary: Delete a session
 *     description: Delete a session for the authenticated user
 *     tags: [Sessions]
 *     security:
 *       - FirebaseAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session UUID
 *     responses:
 *       200:
 *         description: Session deleted successfully
 *       404:
 *         description: Session not found
 *       401:
 *         description: Authentication required
 */
router.delete("/:sessionId", sessionController.deleteSession);

export default router;
