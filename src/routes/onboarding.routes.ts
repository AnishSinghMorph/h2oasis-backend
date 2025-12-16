import { Router } from "express";
import { OnboardingController } from "../controllers/onboarding.controller";
import { verifyFirebaseToken } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/essential.middleware";

const router = Router();

// Select product
router.post(
  "/select-product",
  verifyFirebaseToken,
  asyncHandler(OnboardingController.selectProduct),
);

// Select focus goal
router.post(
  "/select-focus-goal",
  verifyFirebaseToken,
  asyncHandler(OnboardingController.selectFocusGoal),
);

export default router;
