/**
 * Azure Service Bus Configuration
 * (Replaces the old AWS SQS configuration)
 *
 * Service Bus = Azure's message queue service (same concept as SQS)
 *
 * WHY A MESSAGE QUEUE?
 * - Decouple webhook receipt (fast) from processing (slow)
 * - Handle bursts of webhooks without overwhelming MongoDB
 * - Automatic retries if processing fails
 * - No data loss even if worker crashes
 *
 * KEY DIFFERENCES FROM SQS:
 * - SQS: You "poll" for messages (ask repeatedly "any new messages?")
 * - Service Bus: You can also "receive" which is similar polling, or use "subscribe"
 * - Service Bus has built-in dead-letter queue (no separate setup needed)
 * - Messages are "completed" (deleted) or "abandoned" (retry)
 */

import {
  ServiceBusClient,
  ServiceBusMessage,
  ServiceBusReceivedMessage,
  ServiceBusSender,
  ServiceBusReceiver,
} from "@azure/service-bus";

// ============================================
// CLIENT SETUP
// ============================================

const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const queueName = process.env.AZURE_SERVICE_BUS_QUEUE_NAME || "task-queue";

if (!connectionString) {
  console.error(
    "❌ AZURE_SERVICE_BUS_CONNECTION_STRING not found in environment variables",
  );
}

// Create the Service Bus client (main entry point)
let serviceBusClient: ServiceBusClient | null = null;
let sender: ServiceBusSender | null = null;

function getClient(): ServiceBusClient {
  if (!connectionString) {
    throw new Error(
      "Azure Service Bus not configured. Check AZURE_SERVICE_BUS_CONNECTION_STRING.",
    );
  }
  if (!serviceBusClient) {
    serviceBusClient = new ServiceBusClient(connectionString);
  }
  return serviceBusClient;
}

function getSender(): ServiceBusSender {
  if (!sender) {
    sender = getClient().createSender(queueName);
  }
  return sender;
}

// ============================================
// PRODUCER — Send messages to the queue
// ============================================

/**
 * Send a message to the Service Bus queue
 * (Called by the webhook controller when a webhook arrives)
 *
 * @param messageBody - The webhook data to enqueue
 * @returns The message ID
 */
export async function sendToQueue(messageBody: any): Promise<string> {
  try {
    const message: ServiceBusMessage = {
      body: messageBody,
      // Application properties = metadata (like SQS MessageAttributes)
      applicationProperties: {
        provider: "rook",
        data_structure: messageBody.data_structure || "unknown",
      },
    };

    await getSender().sendMessages(message);

    const messageId = message.messageId || `sb-${Date.now()}`;
    console.log(`✅ Message sent to Service Bus: ${messageId}`);
    return String(messageId);
  } catch (error) {
    console.error("❌ Failed to send message to Service Bus:", error);
    throw error;
  }
}

// ============================================
// CONSUMER — Receive messages from the queue
// ============================================

/**
 * Receive messages from the Service Bus queue
 * (Called by the worker to get new messages to process)
 *
 * @param maxMessages - How many messages to fetch
 * @param waitTimeSeconds - How long to wait for messages
 * @returns Array of received messages
 */
export async function receiveFromQueue(
  maxMessages: number = 1,
  waitTimeSeconds: number = 5,
): Promise<ServiceBusReceivedMessage[]> {
  // Create a new receiver each time (peekLock mode = message stays until we complete/abandon it)
  const receiver = getClient().createReceiver(queueName);

  try {
    const messages = await receiver.receiveMessages(maxMessages, {
      maxWaitTimeInMs: waitTimeSeconds * 1000,
    });
    return messages;
  } catch (error) {
    console.error("❌ Failed to receive messages from Service Bus:", error);
    throw error;
  } finally {
    await receiver.close();
  }
}

/**
 * Complete (delete) a message after successful processing
 *
 * In Service Bus terminology:
 * - "complete" = message processed successfully, remove it (like SQS deleteMessage)
 * - "abandon" = processing failed, put it back in the queue for retry
 * - "deadLetter" = move to dead-letter queue (permanent failure)
 *
 * @param message - The received message to complete
 */
export async function completeMessage(
  message: ServiceBusReceivedMessage,
): Promise<void> {
  const receiver = getClient().createReceiver(queueName);
  try {
    await receiver.completeMessage(message);
    console.log("✅ Message completed (deleted) from Service Bus");
  } catch (error) {
    console.error("❌ Failed to complete message:", error);
    throw error;
  } finally {
    await receiver.close();
  }
}

/**
 * Abandon a message (put it back in the queue for retry)
 *
 * @param message - The received message to abandon
 */
export async function abandonMessage(
  message: ServiceBusReceivedMessage,
): Promise<void> {
  const receiver = getClient().createReceiver(queueName);
  try {
    await receiver.abandonMessage(message);
    console.log("🔄 Message abandoned (will retry) in Service Bus");
  } catch (error) {
    console.error("❌ Failed to abandon message:", error);
    throw error;
  } finally {
    await receiver.close();
  }
}

/**
 * Send a message to dead-letter queue (permanent failure)
 *
 * @param message - The received message to dead-letter
 * @param reason - Why the message is being dead-lettered
 */
export async function deadLetterMessage(
  message: ServiceBusReceivedMessage,
  reason: string,
): Promise<void> {
  const receiver = getClient().createReceiver(queueName);
  try {
    await receiver.deadLetterMessage(message, {
      deadLetterReason: reason,
      deadLetterErrorDescription: `Permanent failure: ${reason}`,
    });
    console.log("💀 Message sent to dead-letter queue:", reason);
  } catch (error) {
    console.error("❌ Failed to dead-letter message:", error);
    throw error;
  } finally {
    await receiver.close();
  }
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Verify Service Bus connection is working
 */
export async function healthCheck(): Promise<boolean> {
  try {
    // Try to create a receiver — if connection string is wrong, this will fail
    const receiver = getClient().createReceiver(queueName);
    await receiver.close();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Close the Service Bus connection (for graceful shutdown)
 */
export async function closeServiceBus(): Promise<void> {
  try {
    if (sender) {
      await sender.close();
      sender = null;
    }
    if (serviceBusClient) {
      await serviceBusClient.close();
      serviceBusClient = null;
    }
    console.log("✅ Service Bus connection closed");
  } catch (error) {
    console.error("❌ Error closing Service Bus:", error);
  }
}

export { queueName };
