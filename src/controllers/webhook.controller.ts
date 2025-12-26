import { Request, Response } from "express";
import crypto from "crypto";
import { User } from "../models/User.model";
import { sendToQueue } from "../config/sqs"; // SQS Producer
import { RawWebhook } from "../models/RawWebhook.model"; // Store raw webhooks

/**
 * ROOK Webhook Controller
 * Handles incoming webhooks from ROOK for health data and notifications
 */

/**
 * Verify HMAC signature from ROOK webhook
 * ROOK generates HMAC from: client_uuid + user_id + datetime (concatenated without separators)
 * Uses HMAC-SHA256 with secret hash key
 */
const verifyRookSignature = (
  client_uuid: string,
  user_id: string,
  datetime: string,
  signature: string,
): boolean => {
  try {
    const secretHashKey = process.env.ROOK_SECRET_HASH_KEY;

    if (!secretHashKey) {
      console.error("❌ ROOK secret hash key not configured");
      console.warn(
        "⚠️  Set ROOK_SECRET_HASH_KEY in .env (contact ROOK support to obtain)",
      );
      return false;
    }

    // ROOK concatenates: client_uuid + user_id + datetime (no separators)
    const message = `${client_uuid}${user_id}${datetime}`;

    // Generate HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac("sha256", secretHashKey)
      .update(message)
      .digest("hex");

    console.log("🔐 HMAC Verification:");
    console.log(`   Message: ${message}`);
    console.log(`   Expected: ${expectedSignature}`);
    console.log(`   Received: ${signature}`);

    // Timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex"),
    );
  } catch (error) {
    console.error("❌ Error verifying ROOK signature:", error);
    return false;
  }
};

// REMOVED: transformRookHealthData function - storing raw ROOK data instead
// Will create custom transformation after receiving real webhook data

/**
 * Handle ROOK Health Data Webhooks
 * Receives health data from ROOK and stores it in the database
 */
export const handleRookHealthDataWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔔 Received ROOK health data webhook");
    console.log("🔍 Headers received:", JSON.stringify(req.headers, null, 2));

    const webhookData: any = req.body;
    const signature = req.headers["x-rook-hash"] as string;

    console.log(
      "🔍 Full health webhook payload:",
      JSON.stringify(req.body, null, 2),
    );

    // Extract required fields for HMAC verification
    const client_uuid = webhookData.client_uuid;
    const user_id = webhookData.user_id;
    // Extract datetime from metadata or root level
    const datetime =
      webhookData.datetime ||
      webhookData.health_score_data?.metadata?.datetime_string ||
      webhookData.body_health?.summary?.body_summary?.metadata?.datetime_string ||
      webhookData.physical_health?.summary?.physical_summary?.metadata
        ?.datetime_string ||
      webhookData.sleep_health?.summary?.sleep_summary?.metadata?.datetime_string ||
      webhookData.action_datetime;

    // Validate required fields
    if (!client_uuid || !user_id) {
      console.error("❌ Missing required fields:", { client_uuid, user_id });
      // Always return 200 to acknowledge webhook receipt
      res.status(200).json({
        success: false,
        message: "Missing required fields: client_uuid or user_id",
      });
      return;
    }

    // Verify HMAC signature (only if both signature and datetime are present)
    if (signature && datetime) {
      const isValid = verifyRookSignature(
        client_uuid,
        user_id,
        datetime,
        signature,
      );

      if (!isValid) {
        console.error("❌ Invalid ROOK webhook signature");
        // Always return 200 to acknowledge webhook receipt
        res.status(200).json({ 
          success: false,
          message: "Invalid signature" 
        });
        return;
      }

      console.log("✅ ROOK webhook signature verified");
    } else {
      if (!signature) {
        console.warn(
          "⚠️  No x-rook-hash header provided - webhook not verified",
        );
      }
      if (!datetime) {
        console.warn("⚠️  No datetime field found - HMAC verification skipped");
      }
    }

    // ROOK uses consistent field names from API - user_id, data_structure, etc.
    const data_structure = webhookData.data_structure;

    // Extract data source from metadata or root level
    let data_source = webhookData.data_source;
    if (!data_source) {
      // Look for data source in metadata.sources_of_data_array (real ROOK format)
      const metadata =
        webhookData.body_health?.summary?.body_summary?.metadata ||
        webhookData.physical_health?.summary?.physical_summary?.metadata ||
        webhookData.sleep_health?.summary?.sleep_summary?.metadata;

      if (
        metadata?.sources_of_data_array &&
        metadata.sources_of_data_array.length > 0
      ) {
        data_source = metadata.sources_of_data_array[0]; // Use first source
      } else {
        data_source = "unknown";
      }
    }

    console.log("📊 Processing health data for user:", user_id);
    console.log("🔍 Data source:", data_source);
    console.log("📋 Data structure:", data_structure);

    // 🚀 NEW QUEUE-BASED ARCHITECTURE
    // Step 1: Store raw webhook FIRST (immutable audit log)
    // Don't validate user yet - just store and queue
    const rawWebhook = await RawWebhook.create({
      provider: "rook",
      externalUserId: user_id,
      dataStructure: data_structure,
      payload: webhookData,
      receivedAt: new Date(),
    });

    console.log(`💾 Raw webhook stored: ${rawWebhook._id}`);

    // Map ROOK data source to our wearable names
    const dataSourceMap: { [key: string]: string } = {
      oura: "oura",
      garmin: "garmin",
      fitbit: "fitbit",
      whoop: "whoop",
      apple_health: "apple",
      "apple health": "apple",
      samsung_health: "samsung",
      "samsung health": "samsung",
      polar: "polar",
    };

    const wearableName = dataSourceMap[data_source.toLowerCase()] || "unknown";

    // Step 2: Send to SQS queue for async processing
    const messageBody = {
      rawWebhookId: (rawWebhook._id as any).toString(),
      userId: user_id,
      wearableName,
      dataStructure: data_structure,
      payload: webhookData,
    };

    try {
      const messageId = await sendToQueue(messageBody);
      console.log(`📤 Webhook queued to SQS: ${messageId}`);

      // Update raw webhook with SQS message ID
      await RawWebhook.findByIdAndUpdate(rawWebhook._id, {
        sqsMessageId: messageId,
      });

      // Step 3: Return 200 immediately (fast ingress!)
      res.status(200).json({
        success: true,
        message: "Webhook received and queued for processing",
        messageId,
      });
      return;
    } catch (queueError) {
      console.error("❌ Failed to queue webhook:", queueError);
      
      // If queuing fails, mark raw webhook as failed
      await RawWebhook.findByIdAndUpdate(rawWebhook._id, {
        error: queueError instanceof Error ? queueError.message : "Queue error",
      });

      res.status(500).json({
        success: false,
        message: "Failed to queue webhook for processing",
      });
      return;
    }
  } catch (error) {
    console.error("❌ Error processing ROOK health data webhook:", error);
    
    // CRITICAL: Always return 200 to ROOK, even on errors
    // Otherwise ROOK will retry and mark webhook as failed
    res.status(200).json({ 
      success: false,
      message: "Webhook received but processing failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

/**
 * Handle ROOK Notification Webhooks
 * Receives connection status and user lifecycle notifications
 * Note: Notification webhooks do NOT include x-rook-hash (no HMAC verification)
 */
export const handleRookNotificationWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔔 Received ROOK notification webhook");
    console.log(
      "🔍 Full notification payload:",
      JSON.stringify(req.body, null, 2),
    );

    const notificationData: any = req.body;

    // Extract fields
    const client_uuid = notificationData.client_uuid;
    const user_id = notificationData.user_id;
    const action = notificationData.action;
    const data_source = notificationData.data_source;
    const level = notificationData.level;
    const message = notificationData.message;

    if (!client_uuid) {
      console.error("❌ Missing required field: client_uuid");
      res.status(200).json({
        success: false,
        message: "Missing required field: client_uuid",
      });
      return;
    }

    console.log("📢 Processing notification action:", action);
    console.log("👤 User:", user_id);
    console.log("🔗 Data source:", data_source);
    console.log("📊 Client UUID:", client_uuid);
    console.log("⚠️ Level:", level);
    console.log("💬 Message:", message);

    // Validate MongoDB ObjectId format (24 hex characters)
    const hasValidUserId =
      user_id && user_id.length === 24 && /^[0-9a-fA-F]{24}$/.test(user_id);

    // Map data source to wearable name
    const dataSourceMap: { [key: string]: string } = {
      oura: "oura",
      garmin: "garmin",
      fitbit: "fitbit",
      whoop: "whoop",
      apple_health: "apple",
      polar: "polar",
    };

    const wearableName = dataSourceMap[data_source?.toLowerCase()];

    // Handle different notification types
    switch (action) {
      case "user_connected":
      case "connection_established":
        if (wearableName && hasValidUserId) {
          await User.findByIdAndUpdate(user_id, {
            $set: {
              [`wearables.${wearableName}.connected`]: true,
              [`wearables.${wearableName}.connectedAt`]: new Date(),
              [`wearables.${wearableName}.lastSync`]: new Date(),
              updatedAt: new Date(),
            },
          });
          console.log(
            `✅ ${wearableName} connection established for user ${user_id}`,
          );
        } else if (!hasValidUserId) {
          console.warn(
            `⚠️ Invalid user_id for connection_established: ${user_id}`,
          );
        }
        break;

      case "user_disconnected":
      case "connection_revoked":
        if (wearableName && hasValidUserId) {
          await User.findByIdAndUpdate(user_id, {
            $set: {
              [`wearables.${wearableName}.connected`]: false,
              [`wearables.${wearableName}.revokedAt`]: new Date(),
              updatedAt: new Date(),
            },
          });
          console.log(
            `❌ ${wearableName} connection revoked for user ${user_id}`,
          );
        } else if (!hasValidUserId) {
          console.warn(`⚠️ Invalid user_id for connection_revoked: ${user_id}`);
        }
        break;

      case "user_created":
        console.log(`👤 ROOK user created: ${user_id}`);
        break;

      case "user_deleted":
        console.log(`🗑️ ROOK user deleted: ${user_id}`);
        break;

      default:
        console.log(`ℹ️ Unknown notification action: ${action}`);
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: "Notification processed successfully",
      action: action,
      user_id: user_id,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error processing ROOK notification webhook:", error);
    
    // CRITICAL: Always return 200 to ROOK, even on errors
    // Otherwise ROOK will retry and mark webhook as failed
    res.status(200).json({ 
      success: false,
      message: "Webhook received but processing failed",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};

/**
 * Health check endpoint for webhook URL validation
 */
export const webhookHealthCheck = async (
  req: Request,
  res: Response,
): Promise<void> => {
  res.status(200).json({
    status: "ok",
    service: "ROOK Webhook Endpoint",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
};
