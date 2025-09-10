import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { asyncHandler } from '../middleware/essential.middleware';

const router = Router();

// Health check endpoint
router.get('/', asyncHandler(HealthController.healthCheck));

// Database test endpoint
router.get('/database', asyncHandler(HealthController.testDatabase));

export default router;
