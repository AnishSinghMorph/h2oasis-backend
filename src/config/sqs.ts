import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand,
} from "@aws-sdk/client-sqs";

/**
 * AWS SQS Configuration
 * 
 * SQS (Simple Queue Service) = Message buffer between webhook ingress and processing
 * 
 * Why SQS?
 * - Decouple webhook receipt (fast) from processing (slow)
 * - Handle bursts of webhooks without overwhelming MongoDB
 * - Automatic retries if processing fails
 * - No data loss even if worker crashes
 */

// Initialize SQS Client
const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
const region = process.env.AWS_REGION?.trim() || "us-east-1";

if (!accessKeyId || !secretAccessKey) {
  console.error("❌ AWS credentials not found in environment variables");
  console.error("AWS_ACCESS_KEY_ID:", accessKeyId ? "SET" : "MISSING");
  console.error("AWS_SECRET_ACCESS_KEY:", secretAccessKey ? "SET" : "MISSING");
}

const sqsClient = new SQSClient({
  region,
  credentials: {
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
  },
});

// Queue names
const QUEUE_NAMES = {
  HEALTH_WEBHOOKS: "rook-health-webhooks",
  DEAD_LETTER: "rook-health-webhooks-dlq", // Failed messages go here after 3 retries
};

/**
 * Get Queue URL from queue name
 * 
 * AWS requires full URL like: https://sqs.us-east-1.amazonaws.com/123456789/rook-health-webhooks
 * This function converts queue name → full URL
 */
async function getQueueUrl(queueName: string): Promise<string> {
  try {
    const command = new GetQueueUrlCommand({ QueueName: queueName });
    const response = await sqsClient.send(command);
    return response.QueueUrl!;
  } catch (error) {
    console.error(`❌ Failed to get queue URL for ${queueName}:`, error);
    throw error;
  }
}

/**
 * SQS Producer - Send message to queue
 * 
 * This is called by the webhook controller to enqueue webhooks
 * 
 * @param messageBody - The webhook data to enqueue
 * @returns Message ID from SQS
 */
export async function sendToQueue(messageBody: any): Promise<string> {
  try {
    const queueUrl = await getQueueUrl(QUEUE_NAMES.HEALTH_WEBHOOKS);

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      
      // Message attributes (metadata)
      MessageAttributes: {
        provider: {
          DataType: "String",
          StringValue: "rook",
        },
        data_structure: {
          DataType: "String",
          StringValue: messageBody.data_structure || "unknown",
        },
      },
    });

    const response = await sqsClient.send(command);
    console.log(`✅ Message sent to SQS: ${response.MessageId}`);
    
    return response.MessageId!;
  } catch (error) {
    console.error("❌ Failed to send message to SQS:", error);
    throw error;
  }
}

/**
 * SQS Consumer - Receive messages from queue
 * 
 * This is called by the worker to poll for new messages
 * 
 * @param maxMessages - How many messages to fetch (1-10)
 * @param waitTimeSeconds - Long polling duration (0-20 seconds)
 * @returns Array of messages
 */
export async function receiveFromQueue(
  maxMessages: number = 1,
  waitTimeSeconds: number = 5, // Long polling - wait up to 5s for messages
) {
  try {
    const queueUrl = await getQueueUrl(QUEUE_NAMES.HEALTH_WEBHOOKS);

    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: waitTimeSeconds, // Long polling reduces API calls
      VisibilityTimeout: 60, // Worker has 60s to process before message reappears
      MessageAttributeNames: ["All"],
    });

    const response = await sqsClient.send(command);
    return response.Messages || [];
  } catch (error) {
    console.error("❌ Failed to receive messages from SQS:", error);
    throw error;
  }
}

/**
 * Delete message from queue after successful processing
 * 
 * IMPORTANT: Only delete after processing succeeds!
 * If you delete before processing and worker crashes, message is lost forever.
 * 
 * @param receiptHandle - Unique handle for this message instance
 */
export async function deleteFromQueue(receiptHandle: string): Promise<void> {
  try {
    const queueUrl = await getQueueUrl(QUEUE_NAMES.HEALTH_WEBHOOKS);

    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await sqsClient.send(command);
    console.log("✅ Message deleted from SQS");
  } catch (error) {
    console.error("❌ Failed to delete message from SQS:", error);
    throw error;
  }
}

/**
 * Health check - Verify SQS connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await getQueueUrl(QUEUE_NAMES.HEALTH_WEBHOOKS);
    return true;
  } catch (error) {
    return false;
  }
}

export { sqsClient, QUEUE_NAMES };
