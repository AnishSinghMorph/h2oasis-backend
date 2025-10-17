import { User } from '../models/User.model';
import { HealthDataTransformer } from './healthData.transformer.service';
import { HealthDataMerger } from './healthData.merger.service';
import { IRookWebhookPayload } from '../models/HealthData.types';

/**
 * Webhook Processor Service
 * Handles webhook processing with retry logic and error handling
 */

interface ProcessWebhookResult {
  success: boolean;
  message: string;
  dataType?: string;
  error?: string;
}

export class WebhookProcessor {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000; // 1 second

  /**
   * Process webhook with automatic retry on failure
   */
  static async processWebhook(
    userId: string,
    wearableName: string,
    dataStructure: string,
    payload: IRookWebhookPayload,
    retryCount = 0
  ): Promise<ProcessWebhookResult> {
    try {
      // Transform data
      const transformedData = HealthDataTransformer.transform(payload);

      if (!transformedData) {
        return {
          success: false,
          message: 'No data extracted from webhook',
        };
      }

      // Get data type
      const dataType = HealthDataMerger.getDataType(dataStructure);

      if (!dataType) {
        return {
          success: false,
          message: 'Unknown data type',
        };
      }

      // Get user
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Build atomic update path
      const updateField = `wearableConnections.${wearableName}.healthData.${dataType}`;

      // Get existing data for this specific data type only
      const existingDataForType = user.wearableConnections?.[wearableName]?.healthData?.[dataType];

      // Merge ONLY this data type
      const mergedDataForType = existingDataForType
        ? { ...existingDataForType, ...transformedData }
        : transformedData;

      // ✅ FIX: Check if healthData is null and initialize it first
      const healthDataPath = `wearableConnections.${wearableName}.healthData`;
      const currentHealthData = user.wearableConnections?.[wearableName]?.healthData;

      if (currentHealthData === null || currentHealthData === undefined) {
        console.log(`🔧 Initializing healthData for ${wearableName}...`);
        
        // First, initialize healthData as empty object
        await User.findByIdAndUpdate(
          userId,
          {
            $set: {
              [healthDataPath]: {},
            },
          }
        );
      }

      // Now do the atomic update on the specific data type
      await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            [updateField]: mergedDataForType,
            [`wearableConnections.${wearableName}.lastSync`]: new Date(),
            [`wearableConnections.${wearableName}.connected`]: true,
            updatedAt: new Date(),
          },
        },
        { new: true }
      );

      console.log(`✅ Clean health data saved for ${wearableName} (${dataType})`);

      return {
        success: true,
        message: 'Webhook processed successfully',
        dataType,
      };
    } catch (error: any) {
      console.error(`❌ Error processing webhook (attempt ${retryCount + 1}/${this.MAX_RETRIES}):`, error);

      // Retry logic for transient errors
      if (retryCount < this.MAX_RETRIES && this.isRetryableError(error)) {
        console.log(`🔄 Retrying in ${this.RETRY_DELAY_MS}ms...`);
        
        await this.sleep(this.RETRY_DELAY_MS);
        
        return this.processWebhook(userId, wearableName, dataStructure, payload, retryCount + 1);
      }

      return {
        success: false,
        message: 'Failed to process webhook',
        error: error.message,
      };
    }
  }

  /**
   * Check if error is retryable (transient network/database issues)
   */
  private static isRetryableError(error: any): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'MongoNetworkError',
      'MongoTimeoutError',
    ];

    return retryableErrors.some((err) => 
      error.message?.includes(err) || error.code === err || error.name === err
    );
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Batch process multiple webhooks (if needed in future)
   */
  static async processBatch(webhooks: Array<{
    userId: string;
    wearableName: string;
    dataStructure: string;
    payload: IRookWebhookPayload;
  }>): Promise<ProcessWebhookResult[]> {
    console.log(`📦 Processing batch of ${webhooks.length} webhooks`);

    // Process all in parallel (MongoDB handles concurrency)
    const results = await Promise.all(
      webhooks.map((webhook) =>
        this.processWebhook(
          webhook.userId,
          webhook.wearableName,
          webhook.dataStructure,
          webhook.payload
        )
      )
    );

    const successCount = results.filter((r) => r.success).length;
    console.log(`✅ Batch processed: ${successCount}/${webhooks.length} successful`);

    return results;
  }
}
