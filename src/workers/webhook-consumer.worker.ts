/**
 * Azure Service Bus Webhook Consumer Worker
 * (Replaces the old AWS SQS consumer worker)
 *
 * This worker polls the Azure Service Bus queue and processes webhook messages one at a time
 * Runs as a separate process from the main API server
 *
 * ARCHITECTURE:
 * 1. Poll Service Bus queue (wait up to 5s for messages)
 * 2. Receive message
 * 3. Process webhook (transform data, update DB)
 * 4. Complete message (remove from queue — only after success)
 * 5. Repeat
 *
 * CONCURRENCY SAFETY:
 * - Processes ONE message at a time (no race conditions)
 * - If processing fails, message is "abandoned" (stays in queue for retry)
 * - After max delivery attempts, Service Bus moves message to Dead Letter Queue automatically
 * - Worker can crash/restart without data loss
 *
 * KEY DIFFERENCE FROM SQS:
 * - SQS: deleteFromQueue(receiptHandle) — you pass a string handle
 * - Service Bus: completeMessage(message) — you pass the full message object
 */

// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import {
  receiveFromQueue,
  completeMessage,
  abandonMessage,
  deadLetterMessage,
  closeServiceBus,
} from "../config/sqs";
import { ServiceBusReceivedMessage } from "@azure/service-bus";
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
 * Process a single webhook message from Service Bus
 */
async function processMessage(
  message: ServiceBusReceivedMessage,
): Promise<void> {
  const startTime = Date.now();
  console.log(`\n🔄 Processing Service Bus message: ${message.messageId}`);

  try {
    // Parse message body
    // Service Bus stores body as object directly (not stringified like SQS)
    const messageBody =
      typeof message.body === "string"
        ? JSON.parse(message.body)
        : message.body;
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

      // Complete the message (remove from queue — success!)
      await completeMessage(message);

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
      // should be dead-lettered to prevent infinite retries
      const permanentFailures = [
        "User not found",
        "Unknown data type",
        "No data extracted from webhook",
      ];

      if (permanentFailures.some((msg) => result.message.includes(msg))) {
        console.warn(
          `⚠️ Permanent failure detected, sending to dead-letter queue: ${result.message}`,
        );
        await deadLetterMessage(message, result.message);
      } else {
        // Temporary failures (network issues, DB timeout) - abandon for retry
        await abandonMessage(message);
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
        `⚠️ Permanent failure detected (invalid data), sending to dead-letter queue`,
      );
      console.warn(`   Error: ${errorMessage}`);

      // Mark raw webhook as failed
      const messageBody =
        typeof message.body === "string"
          ? JSON.parse(message.body)
          : message.body;
      if (messageBody.rawWebhookId) {
        await RawWebhook.findByIdAndUpdate(messageBody.rawWebhookId, {
          error: errorMessage,
          processed: true,
          processedAt: new Date(),
        });
      }

      // Dead-letter the message (permanent failure — moves to separate DLQ)
      await deadLetterMessage(message, errorMessage);
      console.log(`💀 Invalid message sent to dead-letter queue`);
      return; // Don't throw - we handled it
    }

    // Report temporary failures to Sentry
    Sentry.captureException(error, {
      tags: {
        component: "webhook-consumer",
        messageId: String(message.messageId),
      },
      extra: {
        messageBody: message.body,
      },
    });

    // Abandon message — Service Bus will make it available for retry
    try {
      await abandonMessage(message);
    } catch (abandonError) {
      console.error("❌ Failed to abandon message:", abandonError);
    }

    throw error;
  }
}

/**
 * Main worker loop
 * Continuously polls Service Bus and processes messages
 */
async function startWorker(): Promise<void> {
  console.log("🚀 Starting Service Bus Webhook Consumer Worker");
  console.log(`📊 Polling interval: ${POLLING_INTERVAL}ms`);
  console.log(`📥 Max messages per poll: ${MAX_MESSAGES}`);
  console.log(`⏱️  Wait timeout: ${WAIT_TIME_SECONDS}s\n`);

  // Connect to MongoDB
  await DatabaseService.connect();
  console.log("✅ Connected to MongoDB\n");

  // Main polling loop
  while (!isShuttingDown) {
    try {
      // Poll Service Bus for messages
      const messages = await receiveFromQueue(MAX_MESSAGES, WAIT_TIME_SECONDS);

      if (messages.length === 0) {
        // No messages — wait timeout reached
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
  const shutdown = async (signal: string) => {
    console.log(`\n📢 Received ${signal}, initiating graceful shutdown...`);
    isShuttingDown = true;

    // Close Service Bus connection
    await closeServiceBus();

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
