import { Router } from "express";
import { HealthController } from "../controllers/health.controller";
import { asyncHandler } from "../middleware/essential.middleware";

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Server health check
 *     description: Check if the server is running and responding
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Server is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 */
router.get("/", asyncHandler(HealthController.healthCheck));

/**
 * @swagger
 * /health/database:
 *   get:
 *     summary: Database connection check
 *     description: Test database connectivity and return connection status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Database is connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Database connected successfully
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: connected
 *                     name:
 *                       type: string
 *       500:
 *         description: Database connection failed
 */
router.get("/database", asyncHandler(HealthController.testDatabase));

export default router;
