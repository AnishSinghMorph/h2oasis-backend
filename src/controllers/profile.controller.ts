import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { DatabaseService } from "../utils/database";
import { User } from "../models/User.model";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const deleteFromS3 = async (photoURL: string): Promise<void> => {
  try {
    // Extract key from S3 URL (works with both S3 and CloudFront URLs)
    const urlParts = photoURL.includes("cloudfront.net")
      ? photoURL.split(".net/")
      : photoURL.split(".com/");
    if (urlParts.length < 2) return;

    const key = urlParts[1];

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: key,
    });

    await s3Client.send(command);
    console.log("✅ Deleted old file from S3:", key);
  } catch (error) {
    console.error("⚠️ Error deleting from S3:", error);
    // Don't throw - we still want to update the DB even if S3 delete fails
  }
};

const convertToCloudFrontURL = (s3URL: string): string => {
  const cloudFrontURL = process.env.CLOUDFRONT_URL;

  // If CloudFront is not configured, return S3 URL
  if (!cloudFrontURL) return s3URL;

  // Extract the file path from S3 URL
  const urlParts = s3URL.split(".com/");
  if (urlParts.length < 2) return s3URL;

  const filePath = urlParts[1];
  return `${cloudFrontURL}/${filePath}`;
};

export class ProfileController {
  static uploadProfilePicture = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      await DatabaseService.connect();

      const file = req.file as Express.MulterS3.File;

      if (!file) {
        res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
        return;
      }

      const userId = req.user!.uid;
      const s3URL = file.location;
      const photoURL = convertToCloudFrontURL(s3URL);

      // Get current user to check for existing photo
      const existingUser = await User.findOne({ firebaseUid: userId });

      // Delete old photo from S3 if it exists
      if (existingUser?.photoURL) {
        await deleteFromS3(existingUser.photoURL);
      }

      // Update user profile with new photo URL
      const user = await User.findOneAndUpdate(
        { firebaseUid: userId },
        { photoURL },
        { new: true },
      );

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Profile picture uploaded successfully",
        photoURL,
      });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload profile picture",
      });
    }
  };

  static deleteProfilePicture = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      await DatabaseService.connect();

      const userId = req.user!.uid;

      // Get current user to find the photo URL
      const existingUser = await User.findOne({ firebaseUid: userId });

      if (!existingUser) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      // Delete photo from S3 if it exists
      if (existingUser.photoURL) {
        await deleteFromS3(existingUser.photoURL);
      }

      // Remove photoURL from user profile
      await User.findOneAndUpdate(
        { firebaseUid: userId },
        { $unset: { photoURL: "" } },
        { new: true },
      );

      res.status(200).json({
        success: true,
        message: "Profile picture deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting profile picture:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete profile picture",
      });
    }
  };
}
