import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { User } from "../models/User.model";
import { uploadToAzureBlob, deleteFromAzureBlob, getBlobSasUrl } from "../utils/blobStorage";

// ============================================
// HELPER FUNCTIONS
// ============================================
const sendError = (res: Response, status: number, message: string) => {
  res.status(status).json({ success: false, message });
};

const sendSuccess = (
  res: Response,
  message: string,
  data?: Record<string, any>,
) => {
  res.status(200).json({ success: true, message, ...data });
};

// ============================================
// CONTROLLER
// ============================================
export class ProfileController {
  /**
   * Upload profile picture to Azure Blob Storage and update user
   *
   * FLOW:
   * 1. multer receives file into memory (configured in blobStorage.ts)
   * 2. We upload that buffer to Azure Blob Storage
   * 3. Save the blob URL to the user's MongoDB document
   * 4. Delete old photo if one existed
   */
  static uploadProfilePicture = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const file = req.file;
      if (!file || !file.buffer) {
        sendError(res, 400, "No file uploaded");
        return;
      }

      const userId = req.user!.uid;

      // Build the blob path (same structure as before with S3)
      const fileExtension = file.originalname.split(".").pop();
      const blobName = `profile-pictures/${userId}-${Date.now()}.${fileExtension}`;

      // Upload to Azure Blob Storage
      const photoURL = await uploadToAzureBlob(
        file.buffer,
        blobName,
        file.mimetype,
      );

      // Delete old photo if exists
      const existingUser = await User.findOne({ firebaseUid: userId });
      if (existingUser?.photoURL) {
        await deleteFromAzureBlob(existingUser.photoURL);
      }

      // Update user with new photo URL
      const user = await User.findOneAndUpdate(
        { firebaseUid: userId },
        { photoURL },
        { new: true },
      );

      if (!user) {
        sendError(res, 404, "User not found");
        return;
      }

      // Generate a SAS URL to send back to the client so it can render the newly uploaded private image
      const sasPhotoURL = await getBlobSasUrl(photoURL);

      sendSuccess(res, "Profile picture uploaded successfully", { photoURL: sasPhotoURL });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      sendError(res, 500, "Failed to upload profile picture");
    }
  };

  /**
   * Update editable profile fields: fullName, dateOfBirth, gender
   */
  static updateProfile = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const { fullName, dateOfBirth, gender } = req.body;

      const updates: Record<string, any> = {};

      if (fullName !== undefined) {
        const trimmed = String(fullName).trim();
        if (trimmed.length === 0) {
          sendError(res, 400, "Full name cannot be empty");
          return;
        }
        if (trimmed.length > 60) {
          sendError(res, 400, "Full name cannot exceed 60 characters");
          return;
        }
        updates.fullName = trimmed;
        updates.displayName = trimmed; // keep both fields in sync
      }

      if (dateOfBirth !== undefined && dateOfBirth !== "") {
        const parsed = new Date(dateOfBirth);
        if (isNaN(parsed.getTime())) {
          sendError(res, 400, "Invalid date of birth");
          return;
        }
        updates.dateOfBirth = parsed;
      }

      if (gender !== undefined && gender !== "") {
        const allowed = ["Male", "Female", "Non-binary", "Prefer not to say", "Other"];
        if (!allowed.includes(gender)) {
          sendError(res, 400, "Invalid gender value");
          return;
        }
        updates.gender = gender;
      }

      if (Object.keys(updates).length === 0) {
        sendError(res, 400, "No valid fields provided to update");
        return;
      }

      const user = await User.findOneAndUpdate(
        { firebaseUid: userId },
        { $set: updates },
        { new: true, runValidators: true },
      );

      if (!user) {
        sendError(res, 404, "User not found");
        return;
      }

      sendSuccess(res, "Profile updated successfully", {
        user: {
          fullName: user.fullName,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
        },
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      sendError(res, 500, "Failed to update profile");
    }
  };

  /**
   * Delete profile picture from Azure Blob Storage and user profile
   */
  static deleteProfilePicture = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const existingUser = await User.findOne({ firebaseUid: userId });

      if (!existingUser) {
        sendError(res, 404, "User not found");
        return;
      }

      if (existingUser.photoURL) {
        await deleteFromAzureBlob(existingUser.photoURL);
      }

      await User.findOneAndUpdate(
        { firebaseUid: userId },
        { $unset: { photoURL: "" } },
      );

      sendSuccess(res, "Profile picture deleted successfully");
    } catch (error) {
      console.error("Error deleting profile picture:", error);
      sendError(res, 500, "Failed to delete profile picture");
    }
  };
}
