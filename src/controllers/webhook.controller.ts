import { Request, Response } from "express";
import crypto from "crypto";
import { User } from "../models/User.model";
import { HealthDataTransformer } from "../services/healthData.transformer.service";
import { HealthDataMerger } from "../services/healthData.merger.service";
import { IRookWebhookPayload } from "../models/HealthData.types";
import { WebhookProcessor } from "../services/webhook.processor.service";

/**
 * ROOK Webhook Controller
 * Handles incoming webhooks from ROOK for health data and notifications
 */

interface RookWebhookPayload {
  user_id: string;
  data_source: string;
  webhook_type: "data" | "notification";
  event_type?: string;
  timestamp: string;
  data?: any;
  sleep_health?: any;
  physical_health?: any;
  body_health?: any;
  document_version?: number;
}

interface NotificationPayload {
  user_id: string;
  data_source: string;
  event_type:
    | "connection_established"
    | "connection_revoked"
    | "user_created"
    | "user_deleted";
  timestamp: string;
  details?: any;
}

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
      webhookData.body_health?.summary?.body_summary?.metadata?.datetime ||
      webhookData.physical_health?.summary?.physical_summary?.metadata
        ?.datetime ||
      webhookData.sleep_health?.summary?.sleep_summary?.metadata?.datetime ||
      webhookData.action_datetime;

    // Only verify HMAC if signature header is present
    if (!client_uuid || !user_id) {
      console.error("❌ Missing required fields:", { client_uuid, user_id });
      res.status(400).json({
        error: "Missing required fields: client_uuid or user_id",
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
        res.status(401).json({ error: "Invalid signature" });
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

    // Validate ObjectId format before querying
    if (
      !user_id ||
      user_id.length !== 24 ||
      !/^[0-9a-fA-F]{24}$/.test(user_id)
    ) {
      console.warn(`⚠️ Invalid user_id format: ${user_id}`);
      res
        .status(200)
        .json({ message: "Invalid user_id format, webhook acknowledged" });
      return;
    }

    const user = await User.findById(user_id);

    if (!user) {
      console.warn(`⚠️ User not found for ROOK user_id: ${user_id}`);
      res.status(200).json({ message: "User not found, webhook acknowledged" });
      return;
    }

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

    const wearableName = dataSourceMap[data_source.toLowerCase()];

    if (!wearableName) {
      console.warn(`⚠️ Unknown data source: ${data_source}`);
      res
        .status(200)
        .json({ message: "Unknown data source, webhook acknowledged" });
      return;
    }

    const payload: IRookWebhookPayload = webhookData;

    // ✅ Use WebhookProcessor with retry logic
    const result = await WebhookProcessor.processWebhook(
      user_id,
      wearableName,
      data_structure,
      payload,
    );

    if (!result.success) {
      console.warn(`⚠️ ${result.message}`);
      res
        .status(200)
        .json({ message: result.message, webhook_acknowledged: true });
      return;
    }

    console.log(`📊 Data type updated: ${result.dataType}`);

    res.status(200).json({
      success: true,
      message: "Health data processed and merged successfully",
      user_id: user_id,
      wearable: wearableName,
      data_type: result.dataType,
      data_structure: data_structure,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error processing ROOK health data webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Handle ROOK Notification Webhooks
 * Receives connection status and user lifecycle notifications
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
    const signature = req.headers["x-rook-hash"] as string;

    // Extract required fields for HMAC verification
    const client_uuid = notificationData.client_uuid;
    const user_id = notificationData.user_id;
    const datetime =
      notificationData.action_datetime || notificationData.datetime;

    // Notifications may not have user_id (e.g., error notifications)
    if (!client_uuid) {
      console.error("❌ Missing required field: client_uuid");
      res.status(400).json({
        error: "Missing required field: client_uuid",
      });
      return;
    }

    // Verify HMAC signature (only if all required fields are present)
    if (signature && user_id && datetime) {
      const isValid = verifyRookSignature(
        client_uuid,
        user_id,
        datetime,
        signature,
      );

      if (!isValid) {
        console.error("❌ Invalid ROOK webhook signature");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      console.log("✅ ROOK webhook signature verified");
    } else {
      if (!signature) {
        console.warn(
          "⚠️  No x-rook-hash header provided - webhook not verified",
        );
      }
      if (!user_id) {
        console.warn(
          "⚠️  No user_id in notification - HMAC verification skipped",
        );
      }
      if (!datetime) {
        console.warn("⚠️  No datetime found - HMAC verification skipped");
      }
    }

    // ROOK notification format: action, client_uuid, user_id, data_source, level, message, action_datetime, environment
    const action = notificationData.action; // e.g., "user_connected", "user_disconnected"
    const data_source = notificationData.data_source;
    const level = notificationData.level; // e.g., "info", "warning", "error"
    const message = notificationData.message;
    const action_datetime = notificationData.action_datetime;
    const environment = notificationData.environment;

    console.log("📢 Processing notification action:", action);
    console.log("👤 User:", user_id);
    console.log("🔗 Data source:", data_source);
    console.log("📊 Client UUID:", client_uuid);
    console.log("⚠️ Level:", level);
    console.log("💬 Message:", message);

    // Validate ObjectId format for user operations
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

    const wearableName =
      dataSourceMap[notificationData.data_source?.toLowerCase()];

    // Handle different notification types (ROOK uses "action" field)
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
      message: "Notification processed successfully",
      action: action,
      user_id: user_id,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error processing ROOK notification webhook:", error);
    res.status(500).json({ error: "Internal server error" });
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
