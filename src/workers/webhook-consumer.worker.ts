/**
 * SQS Webhook Consumer Worker
 *
 * This worker polls SQS queue and processes webhook messages one at a time
 * Runs as a separate process from the main API server
 *
 * ARCHITECTURE:
 * 1. Poll SQS queue (long polling = wait up to 5s for messages)
 * 2. Receive message
 * 3. Process webhook (transform data, update DB)
 * 4. Delete message from queue (only after success)
 * 5. Repeat
 *
 * CONCURRENCY SAFETY:
 * - Processes ONE message at a time (no race conditions)
 * - If processing fails, message stays in queue
 * - After 3 failed attempts, message goes to Dead Letter Queue (DLQ)
 * - Worker can crash/restart without data loss
 */

// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import { receiveFromQueue, deleteFromQueue } from "../config/sqs";
import { WebhookProcessor } from "../services/webhook.processor.service";
import { RawWebhook } from "../models/RawWebhook.model";
import { DatabaseService } from "../utils/database";
import * as Sentry from "@sentry/node";

// Worker configuration
const POLLING_INTERVAL = 1000; // 1 second between polls
const MAX_MESSAGES = 1; // Process 1 message at a time
const WAIT_TIME_SECONDS = 5; // Long polling timeout

// Graceful shutdown flag
let isShuttingDown = false;

/**
 * Process a single webhook message from SQS
 */
async function processMessage(message: any): Promise<void> {
  const startTime = Date.now();
  console.log(`\n🔄 Processing SQS message: ${message.MessageId}`);

  try {
    // Parse message body
    const messageBody = JSON.parse(message.Body);
    const { rawWebhookId, userId, wearableName, dataStructure, payload } =
      messageBody;

    console.log(`👤 User: ${userId}`);
    console.log(`⌚ Wearable: ${wearableName}`);
    console.log(`📊 Data structure: ${dataStructure}`);

    // Process webhook using existing processor
    const result = await WebhookProcessor.processWebhook(
      userId,
      wearableName,
      dataStructure,
      payload,
    );

    if (result.success) {
      // Mark raw webhook as processed
      if (rawWebhookId) {
        await RawWebhook.findByIdAndUpdate(rawWebhookId, {
          processed: true,
          processedAt: new Date(),
        });
      }

      // Delete message from SQS (success!)
      await deleteFromQueue(message.ReceiptHandle);

      const duration = Date.now() - startTime;
      console.log(`✅ Message processed successfully in ${duration}ms`);
    } else {
      // Processing failed
      console.error(`❌ Processing failed: ${result.message}`);

      // Update raw webhook with error
      if (rawWebhookId) {
        await RawWebhook.findByIdAndUpdate(rawWebhookId, {
          error: result.message,
          processed: true, // Mark as processed to avoid infinite retries
          processedAt: new Date(),
        });
      }

      // Permanent failures (user not found, unknown structure, invalid data)
      // should be deleted from queue to prevent infinite retries
      const permanentFailures = [
        "User not found",
        "Unknown data type",
        "No data extracted from webhook",
      ];

      if (permanentFailures.some((msg) => result.message.includes(msg))) {
        console.warn(
          `⚠️ Permanent failure detected, removing from queue: ${result.message}`,
        );
        await deleteFromQueue(message.ReceiptHandle);
      } else {
        // Temporary failures (network issues, DB timeout) - let it retry
        throw new Error(result.message);
      }
    }
  } catch (error) {
    console.error("❌ Error processing message:", error);

    // Check if it's a permanent failure (invalid ObjectId, cast errors, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);
    const permanentErrorPatterns = [
      "Cast to ObjectId failed",
      "input must be a 24 character hex string",
      "User not found",
      "Unknown data structure",
      "BSONError",
    ];

    const isPermanentFailure = permanentErrorPatterns.some((pattern) =>
      errorMessage.includes(pattern),
    );

    if (isPermanentFailure) {
      console.warn(
        `⚠️ Permanent failure detected (invalid data), removing from queue`,
      );
      console.warn(`   Error: ${errorMessage}`);

      // Mark raw webhook as failed
      const messageBody = JSON.parse(message.Body);
      if (messageBody.rawWebhookId) {
        await RawWebhook.findByIdAndUpdate(messageBody.rawWebhookId, {
          error: errorMessage,
          processed: true,
          processedAt: new Date(),
        });
      }

      // Delete from queue to prevent infinite retries
      await deleteFromQueue(message.ReceiptHandle);
      console.log(`🗑️ Invalid message deleted from queue`);
      return; // Don't throw - we handled it
    }

    // Report temporary failures to Sentry
    Sentry.captureException(error, {
      tags: {
        component: "webhook-consumer",
        messageId: message.MessageId,
      },
      extra: {
        messageBody: message.Body,
      },
    });

    // Don't delete message - let SQS retry (temporary failure)
    throw error;
  }
}

/**
 * Main worker loop
 * Continuously polls SQS and processes messages
 */
async function startWorker(): Promise<void> {
  console.log("🚀 Starting SQS Webhook Consumer Worker");
  console.log(`📊 Polling interval: ${POLLING_INTERVAL}ms`);
  console.log(`📥 Max messages per poll: ${MAX_MESSAGES}`);
  console.log(`⏱️  Long polling timeout: ${WAIT_TIME_SECONDS}s\n`);

  // Connect to MongoDB
  await DatabaseService.connect();
  console.log("✅ Connected to MongoDB\n");

  // Main polling loop
  while (!isShuttingDown) {
    try {
      // Poll SQS for messages
      const messages = await receiveFromQueue(MAX_MESSAGES, WAIT_TIME_SECONDS);

      if (messages.length === 0) {
        // No messages - long polling timeout
        console.log("💤 No messages in queue, continuing to poll...");
        continue;
      }

      console.log(`📬 Received ${messages.length} message(s)`);

      // Process each message sequentially (one at a time)
      for (const message of messages) {
        if (isShuttingDown) break;

        await processMessage(message);
      }

      // Small delay before next poll
      await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL));
    } catch (error) {
      console.error("❌ Worker error:", error);

      // Report to Sentry
      Sentry.captureException(error, {
        tags: { component: "webhook-consumer-loop" },
      });

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log("👋 Worker shutting down gracefully");
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    console.log(`\n📢 Received ${signal}, initiating graceful shutdown...`);
    isShuttingDown = true;

    // Give worker 30s to finish current message
    setTimeout(() => {
      console.log("⏰ Shutdown timeout reached, forcing exit");
      process.exit(0);
    }, 30000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Start the worker
if (require.main === module) {
  setupGracefulShutdown();

  startWorker().catch((error) => {
    console.error("💥 Fatal worker error:", error);
    Sentry.captureException(error);
    process.exit(1);
  });
}

export { startWorker, processMessage };
