import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { verifyFirebaseToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/essential.middleware';

const router = Router();

// Registration endpoint
router.post('/register', asyncHandler(AuthController.register));

// Login endpoint
router.post('/login', asyncHandler(AuthController.login));

// Protected profile endpoint
router.get('/profile', verifyFirebaseToken, asyncHandler(AuthController.getProfile));

// Complete onboarding endpoint
router.post('/complete-onboarding', verifyFirebaseToken, asyncHandler(AuthController.completeOnboarding));

export default router;
