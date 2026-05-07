/**
 * Azure Blob Storage Upload Utility
 * (Replaces the old AWS S3 + multer-s3 upload)
 *
 * HOW IT WORKS:
 * 1. multer receives the file into memory (RAM buffer)
 * 2. After multer is done, we manually upload that buffer to Azure Blob Storage
 * 3. The blob URL is returned so we can save it to the user's profile
 *
 * WHY MEMORY STORAGE?
 * - Azure SDK doesn't have a multer plugin like multer-s3
 * - Memory storage is fine for profile pictures (max 5MB)
 * - We upload to Azure Blob right after, so memory is freed quickly
 */

import multer from "multer";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

// ============================================
// AZURE BLOB CLIENT SETUP
// ============================================

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName =
  process.env.AZURE_STORAGE_CONTAINER_NAME || "media";

if (!connectionString) {
  console.error(
    "❌ AZURE_STORAGE_CONNECTION_STRING not found in environment variables",
  );
}

// Create the BlobServiceClient — this is the main entry point to Azure Storage
const blobServiceClient = connectionString
  ? BlobServiceClient.fromConnectionString(connectionString)
  : null;

// Get a reference to the container (like an S3 bucket)
const containerClient = blobServiceClient
  ? blobServiceClient.getContainerClient(containerName)
  : null;

/**
 * Upload a file buffer to Azure Blob Storage
 *
 * @param buffer - The file data in memory
 * @param blobName - The path/name for the file in Azure (e.g., "profile-pictures/user123-12345.jpg")
 * @param contentType - MIME type (e.g., "image/jpeg")
 * @returns The full URL of the uploaded blob
 */
export async function uploadToAzureBlob(
  buffer: Buffer,
  blobName: string,
  contentType: string,
): Promise<string> {
  if (!containerClient) {
    throw new Error(
      "Azure Blob Storage not configured. Check AZURE_STORAGE_CONNECTION_STRING.",
    );
  }

  // Get a reference to the specific blob (file) we want to create
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Upload the buffer to Azure
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType, // So browsers know it's an image, not a download
    },
  });

  console.log(`✅ Uploaded to Azure Blob: ${blobName}`);

  // Return the public URL
  return blockBlobClient.url;
}

/**
 * Delete a blob from Azure Storage
 *
 * @param blobUrl - The full URL of the blob to delete
 */
export async function deleteFromAzureBlob(blobUrl: string): Promise<void> {
  if (!containerClient) {
    throw new Error("Azure Blob Storage not configured.");
  }

  try {
    // Extract blob name from URL
    // URL format: https://stwath2oeusdev001.blob.core.windows.net/media/profile-pictures/user123.jpg
    const url = new URL(blobUrl);
    // pathname = /media/profile-pictures/user123.jpg
    // Remove the leading /containerName/ to get just the blob name
    const pathParts = url.pathname.split("/");
    // Remove empty first element and container name
    const blobName = pathParts.slice(2).join("/");

    if (!blobName) {
      console.warn("⚠️ Could not extract blob name from URL:", blobUrl);
      return;
    }

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
    console.log("✅ Deleted from Azure Blob:", blobName);
  } catch (error) {
    console.error("⚠️ Error deleting from Azure Blob:", error);
  }
}

// ============================================
// MULTER CONFIG (memory storage)
// ============================================

const upload = multer({
  storage: multer.memoryStorage(), // Store in RAM temporarily
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (same as before)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."));
    }
  },
});

export default upload;
