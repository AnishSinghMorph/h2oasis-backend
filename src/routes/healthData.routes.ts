import { Router } from 'express';
import { 
  getUnifiedHealthData, 
  updateHealthDataPreferences,
  updateWearableConnection,
  getWearableConnections,
  syncRookConnections,
  fetchRookHealthData
} from '../controllers/healthData.controller';

const router = Router();

/**
 * @swagger
 * /api/health-data:
 *   get:
 *     summary: Get unified health data
 *     description: Retrieve comprehensive health data including user profile, selected product, and data from all connected wearables (Oura, Garmin, Fitbit, etc.)
 *     tags: [Health Data]
 *     security:
 *       - FirebaseAuth: []
 *     parameters:
 *       - in: header
 *         name: x-firebase-uid
 *         required: true
 *         schema:
 *           type: string
 *         description: Firebase UID for authentication
 *     responses:
 *       200:
 *         description: Successfully retrieved unified health data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     profile:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         uid:
 *                           type: string
 *                     selectedProduct:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         type:
 *                           type: string
 *                     wearables:
 *                       type: object
 *                       properties:
 *                         oura:
 *                           $ref: '#/components/schemas/Wearable'
 *                         garmin:
 *                           $ref: '#/components/schemas/Wearable'
 *                         fitbit:
 *                           $ref: '#/components/schemas/Wearable'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', getUnifiedHealthData);

/**
 * @swagger
 * /api/health-data/unified/{userId}:
 *   get:
 *     summary: Get unified health data by user ID (legacy)
 *     description: Legacy endpoint - same as GET /api/health-data
 *     tags: [Health Data]
 *     security:
 *       - FirebaseAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: x-firebase-uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved unified health data
 *       401:
 *         description: Authentication required
 */
router.get('/unified/:userId', getUnifiedHealthData);

/**
 * @swagger
 * /api/health-data/preferences:
 *   put:
 *     summary: Update health data preferences
 *     description: Update user preferences like voice settings, units, and timezone
 *     tags: [Health Data]
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               voiceId:
 *                 type: string
 *               voiceName:
 *                 type: string
 *               units:
 *                 type: string
 *               timezone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       401:
 *         description: Authentication required
 */
router.put('/preferences', updateHealthDataPreferences);

/**
 * @swagger
 * /api/health-data/wearable-connection:
 *   post:
 *     summary: Update wearable connection status
 *     description: Mark a wearable device as connected or disconnected
 *     tags: [Health Data]
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wearableId
 *               - wearableName
 *               - dataSource
 *               - connected
 *             properties:
 *               wearableId:
 *                 type: string
 *                 example: oura
 *               wearableName:
 *                 type: string
 *                 example: Oura Ring
 *               dataSource:
 *                 type: string
 *                 example: oura
 *               connected:
 *                 type: boolean
 *                 example: true
 *               healthData:
 *                 type: object
 *                 description: Optional health data to include
 *     responses:
 *       200:
 *         description: Connection status updated successfully
 *       401:
 *         description: Authentication required
 */
router.post('/wearable-connection', updateWearableConnection);

/**
 * @swagger
 * /api/health-data/wearable-connections:
 *   get:
 *     summary: Get all wearable connections
 *     description: Retrieve connection status for all wearable devices
 *     tags: [Health Data]
 *     security:
 *       - FirebaseAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved wearable connections
 *       401:
 *         description: Authentication required
 */
router.get('/wearable-connections', getWearableConnections);

/**
 * @swagger
 * /api/health-data/sync-rook:
 *   post:
 *     summary: Sync connections from ROOK API
 *     description: Fetch wearable connection statuses from ROOK API and sync to database
 *     tags: [Health Data]
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mongoUserId
 *             properties:
 *               mongoUserId:
 *                 type: string
 *                 description: MongoDB User ID used in ROOK
 *                 example: 68da80c9ffda7e51bd9ac167
 *     responses:
 *       200:
 *         description: ROOK connections synced successfully
 *       401:
 *         description: Authentication required
 */
router.post('/sync-rook', syncRookConnections);

/**
 * @swagger
 * /api/health-data/fetch-rook-data:
 *   post:
 *     summary: Fetch health data from ROOK
 *     description: Retrieve sleep, activity, and body health data from ROOK API for a specific data source (Oura, Garmin, etc.)
 *     tags: [Health Data]
 *     security:
 *       - FirebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mongoUserId
 *               - dataSource
 *             properties:
 *               mongoUserId:
 *                 type: string
 *                 description: MongoDB User ID used in ROOK
 *                 example: 68da80c9ffda7e51bd9ac167
 *               dataSource:
 *                 type: string
 *                 description: Wearable data source
 *                 enum: [oura, garmin, fitbit, whoop, apple_health]
 *                 example: oura
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Optional date in YYYY-MM-DD format (defaults to today)
 *                 example: 2025-10-02
 *     responses:
 *       200:
 *         description: Health data fetched and saved successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     sleep:
 *                       $ref: '#/components/schemas/HealthData/properties/sleep'
 *                     physical:
 *                       type: object
 *                     body:
 *                       type: object
 *       401:
 *         description: Authentication required
 */
router.post('/fetch-rook-data', fetchRookHealthData);

export default router;