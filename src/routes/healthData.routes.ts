import { Router } from 'express';
import { 
  getUnifiedHealthData, 
  updateHealthDataPreferences,
  updateWearableConnection,
  getWearableConnections
} from '../controllers/healthData.controller';

const router = Router();

/**
 * GET /api/health-data/unified/:userId
 * Get unified health data for a user including:
 * - User profile
 * - Selected product
 * - Wearable connections (each wearable separate)
 * - Health data from each connected wearable
 */
router.get('/unified/:userId', getUnifiedHealthData);

/**
 * GET /api/health-data
 * Get unified health data for a user (legacy endpoint)
 */
router.get('/', getUnifiedHealthData);

/**
 * PUT /api/health-data/preferences
 * Update user preferences for health data
 */
router.put('/preferences', updateHealthDataPreferences);

/**
 * POST /api/health-data/wearable-connection
 * Update wearable connection status
 */
router.post('/wearable-connection', updateWearableConnection);

/**
 * GET /api/health-data/wearable-connections
 * Get all wearable connection statuses for user
 */
router.get('/wearable-connections', getWearableConnections);

export default router;