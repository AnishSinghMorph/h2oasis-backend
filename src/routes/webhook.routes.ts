import { Router } from "express";
import {
  handleRookHealthDataWebhook,
  handleRookNotificationWebhook,
  webhookHealthCheck,
} from "../controllers/webhook.controller";

const router = Router();

/**
 * @swagger
 * /api/webhooks/rook/health-data:
 *   post:
 *     summary: ROOK Health Data Webhook
 *     description: Receives real-time health data from ROOK (sleep, physical, body metrics)
 *     tags: [Webhooks]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: x-rook-hash
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC signature for webhook security validation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: MongoDB User ID from ROOK
 *               data_source:
 *                 type: string
 *                 description: Wearable data source
 *                 enum: [oura, garmin, fitbit, whoop, apple_health, polar]
 *               webhook_type:
 *                 type: string
 *                 enum: [data]
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               sleep_health:
 *                 type: object
 *                 description: Sleep health data from ROOK
 *               physical_health:
 *                 type: object
 *                 description: Physical health data from ROOK
 *               body_health:
 *                 type: object
 *                 description: Body health data from ROOK
 *               document_version:
 *                 type: integer
 *                 description: Version number for data deduplication
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user_id:
 *                   type: string
 *                 data_source:
 *                   type: string
 *                 processed_at:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Invalid HMAC signature
 *       500:
 *         description: Internal server error
 */
router.post("/health-data", handleRookHealthDataWebhook);

/**
 * @swagger
 * /api/webhooks/rook/notifications:
 *   post:
 *     summary: ROOK Notification Webhook
 *     description: Receives connection status updates and user lifecycle events from ROOK
 *     tags: [Webhooks]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: x-rook-hash
 *         required: true
 *         schema:
 *           type: string
 *         description: HMAC signature for webhook security validation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: MongoDB User ID from ROOK
 *               data_source:
 *                 type: string
 *                 description: Wearable data source
 *               event_type:
 *                 type: string
 *                 enum: [connection_established, connection_revoked, user_created, user_deleted]
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               details:
 *                 type: object
 *                 description: Additional event details
 *     responses:
 *       200:
 *         description: Notification processed successfully
 *       401:
 *         description: Invalid HMAC signature
 *       500:
 *         description: Internal server error
 */
router.post("/notifications", handleRookNotificationWebhook);

/**
 * @swagger
 * /api/webhooks/rook/health:
 *   get:
 *     summary: Webhook Health Check
 *     description: Health check endpoint for webhook URL validation
 *     tags: [Webhooks]
 *     security: []
 *     responses:
 *       200:
 *         description: Webhook endpoint is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 service:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 */
router.get("/health", webhookHealthCheck);

export default router;
