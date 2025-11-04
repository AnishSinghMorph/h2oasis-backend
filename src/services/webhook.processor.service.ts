import { User } from "../models/User.model";
import { HealthDataTransformer } from "./healthData.transformer.service";
import { HealthDataMerger } from "./healthData.merger.service";
import { IRookWebhookPayload } from "../models/HealthData.types";

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
    retryCount = 0,
  ): Promise<ProcessWebhookResult> {
    try {
      console.log(
        `🔄 Processing webhook for ${wearableName}, data_structure: ${dataStructure}`,
      );

      // Transform data
      const transformedData = HealthDataTransformer.transform(payload);

      if (!transformedData) {
        return {
          success: false,
          message: "No data extracted from webhook",
        };
      }

      console.log(`✅ Transformed data keys:`, Object.keys(transformedData));
      console.log(
        `📦 Transformed data sample:`,
        JSON.stringify(transformedData).substring(0, 200),
      );

      // Get data type
      const dataType = HealthDataMerger.getDataType(dataStructure);

      if (!dataType) {
        return {
          success: false,
          message: "Unknown data type",
        };
      }

      console.log(`📝 Data type mapped to: ${dataType}`);

      // Get user
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Build atomic update path
      const updateField = `wearables.${wearableName}.data.${dataType}`;

      // Get existing data for this specific data type only
      const existingDataForType =
        user.wearables?.[wearableName]?.data?.[dataType];

      // Merge ONLY this data type
      const mergedDataForType = existingDataForType
        ? { ...existingDataForType, ...transformedData }
        : transformedData;

      console.log(`💾 About to save to path: ${updateField}`);
      console.log(
        `💾 Data being saved (first 300 chars):`,
        JSON.stringify(mergedDataForType).substring(0, 300),
      );

      // ✅ FIX: Check if data is null and initialize it first
      const dataPath = `wearables.${wearableName}.data`;
      const currentData = user.wearables?.[wearableName]?.data;

      if (currentData === null || currentData === undefined) {
        console.log(`🔧 Initializing data for ${wearableName}...`);

        // First, initialize data as empty object
        await User.findByIdAndUpdate(userId, {
          $set: {
            [dataPath]: {},
          },
        });
      }

      // Now do the atomic update on the specific data type
      const updateResult = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            [updateField]: mergedDataForType,
            [`wearables.${wearableName}.lastSync`]: new Date(),
            [`wearables.${wearableName}.connected`]: true,
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      console.log(
        `✅ Clean health data saved for ${wearableName} (${dataType})`,
      );

      // Verify what was actually saved
      const savedData =
        updateResult?.wearables?.[wearableName]?.data?.[dataType];
      console.log(
        `🔍 Verification - saved data keys:`,
        savedData ? Object.keys(savedData) : "null",
      );

      return {
        success: true,
        message: "Webhook processed successfully",
        dataType,
      };
    } catch (error: any) {
      console.error(
        `❌ Error processing webhook (attempt ${retryCount + 1}/${this.MAX_RETRIES}):`,
        error,
      );

      // Retry logic for transient errors
      if (retryCount < this.MAX_RETRIES && this.isRetryableError(error)) {
        console.log(`🔄 Retrying in ${this.RETRY_DELAY_MS}ms...`);

        await this.sleep(this.RETRY_DELAY_MS);

        return this.processWebhook(
          userId,
          wearableName,
          dataStructure,
          payload,
          retryCount + 1,
        );
      }

      return {
        success: false,
        message: "Failed to process webhook",
        error: error.message,
      };
    }
  }

  /**
   * Check if error is retryable (transient network/database issues)
   */
  private static isRetryableError(error: any): boolean {
    const retryableErrors = [
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "MongoNetworkError",
      "MongoTimeoutError",
    ];

    return retryableErrors.some(
      (err) =>
        error.message?.includes(err) ||
        error.code === err ||
        error.name === err,
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
  static async processBatch(
    webhooks: Array<{
      userId: string;
      wearableName: string;
      dataStructure: string;
      payload: IRookWebhookPayload;
    }>,
  ): Promise<ProcessWebhookResult[]> {
    console.log(`📦 Processing batch of ${webhooks.length} webhooks`);

    // Process all in parallel (MongoDB handles concurrency)
    const results = await Promise.all(
      webhooks.map((webhook) =>
        this.processWebhook(
          webhook.userId,
          webhook.wearableName,
          webhook.dataStructure,
          webhook.payload,
        ),
      ),
    );

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `✅ Batch processed: ${successCount}/${webhooks.length} successful`,
    );

    return results;
  }
}
