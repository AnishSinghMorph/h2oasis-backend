import { Router } from "express";
import { ProfileController } from "../controllers/profile.controller";
import { verifyFirebaseToken } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/essential.middleware";
import upload from "../utils/s3Upload";

const router = Router();

// Upload profile picture
router.post(
  "/upload-picture",
  verifyFirebaseToken,
  upload.single("profilePicture"),
  asyncHandler(ProfileController.uploadProfilePicture),
);

// Delete profile picture
router.delete(
  "/delete-picture",
  verifyFirebaseToken,
  asyncHandler(ProfileController.deleteProfilePicture),
);

export default router;
