import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { User } from "../models/User.model";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// ============================================
// S3 CLIENT & HELPERS
// ============================================
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const deleteFromS3 = async (photoURL: string): Promise<void> => {
  try {
    const urlParts = photoURL.includes("cloudfront.net")
      ? photoURL.split(".net/")
      : photoURL.split(".com/");
    if (urlParts.length < 2) return;

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: urlParts[1],
      }),
    );
    console.log("✅ Deleted old file from S3:", urlParts[1]);
  } catch (error) {
    console.error("⚠️ Error deleting from S3:", error);
  }
};

const convertToCloudFrontURL = (s3URL: string): string => {
  const cloudFrontURL = process.env.CLOUDFRONT_URL;
  if (!cloudFrontURL) return s3URL;

  const urlParts = s3URL.split(".com/");
  return urlParts.length < 2 ? s3URL : `${cloudFrontURL}/${urlParts[1]}`;
};

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
   * Upload profile picture to S3 and update user
   */
  static uploadProfilePicture = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const file = req.file as Express.MulterS3.File;
      if (!file) {
        sendError(res, 400, "No file uploaded");
        return;
      }

      const userId = req.user!.uid;
      const photoURL = convertToCloudFrontURL(file.location);

      // Delete old photo if exists, then update
      const existingUser = await User.findOne({ firebaseUid: userId });
      if (existingUser?.photoURL) {
        await deleteFromS3(existingUser.photoURL);
      }

      const user = await User.findOneAndUpdate(
        { firebaseUid: userId },
        { photoURL },
        { new: true },
      );

      if (!user) {
        sendError(res, 404, "User not found");
        return;
      }

      sendSuccess(res, "Profile picture uploaded successfully", { photoURL });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      sendError(res, 500, "Failed to upload profile picture");
    }
  };

  /**
   * Delete profile picture from S3 and user profile
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
        await deleteFromS3(existingUser.photoURL);
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
