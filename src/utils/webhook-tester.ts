/**
 * ROOK Webhook Testing Utility
 * Use this to test webhook endpoints and simulate ROOK webhook deliveries
 */

import crypto from "crypto";

export class WebhookTester {
  private webhookSecretKey: string;
  private baseUrl: string;

  constructor(webhookSecretKey: string, baseUrl: string) {
    this.webhookSecretKey = webhookSecretKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Generate HMAC signature for testing
   */
  private generateSignature(payload: string): string {
    return crypto
      .createHmac("sha256", this.webhookSecretKey)
      .update(payload)
      .digest("hex");
  }

  /**
   * Test health data webhook with sample data
   */
  async testHealthDataWebhook(userId: string, dataSource: string = "oura") {
    const sampleHealthData = {
      user_id: userId,
      data_source: dataSource,
      webhook_type: "data",
      timestamp: new Date().toISOString(),
      document_version: 1,
      sleep_health: {
        summary: {
          sleep_summary: {
            duration: {
              sleep_date_string: new Date().toISOString().split("T")[0],
              sleep_duration_seconds_int: 28800, // 8 hours
            },
            scores: {
              sleep_efficiency_1_100_score_int: 85,
              sleep_quality_rating_1_5_score_int: 4,
            },
            heart_rate: {
              hr_maximum_bpm_int: 65,
              hr_minimum_bpm_int: 45,
              hr_avg_bpm_int: 55,
            },
          },
        },
      },
      physical_health: {
        summary: {
          physical_summary: {
            non_structured_data: [
              {
                timestamp: new Date().toISOString(),
                steps: 8500,
                total_calories: 2200,
                score: 78,
              },
            ],
          },
        },
      },
      body_health: {
        summary: {
          body_summary: {
            body_metrics: {
              weight_kg_float: 70.5,
              height_cm_int: 175,
              bmi_float: 23.0,
            },
          },
        },
      },
    };

    const payload = JSON.stringify(sampleHealthData);
    const signature = `sha256=${this.generateSignature(payload)}`;

    console.log("🧪 Testing Health Data Webhook...");
    console.log("📍 URL:", `${this.baseUrl}/api/webhooks/rook/health-data`);
    console.log("👤 User ID:", userId);
    console.log("📊 Data Source:", dataSource);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/webhooks/rook/health-data`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ROOK-HASH": signature,
          },
          body: payload,
        },
      );

      const result = await response.json();

      if (response.ok) {
        console.log("✅ Health data webhook test successful:", result);
      } else {
        console.error("❌ Health data webhook test failed:", result);
      }

      return { success: response.ok, data: result, status: response.status };
    } catch (error) {
      console.error("❌ Error testing health data webhook:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Test notification webhook with sample data
   */
  async testNotificationWebhook(
    userId: string,
    eventType: string = "connection_established",
    dataSource: string = "oura",
  ) {
    const sampleNotification = {
      user_id: userId,
      data_source: dataSource,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      details: {
        connection_status:
          eventType === "connection_established" ? "connected" : "disconnected",
      },
    };

    const payload = JSON.stringify(sampleNotification);
    const signature = `sha256=${this.generateSignature(payload)}`;

    console.log("🧪 Testing Notification Webhook...");
    console.log("📍 URL:", `${this.baseUrl}/api/webhooks/rook/notifications`);
    console.log("👤 User ID:", userId);
    console.log("📢 Event Type:", eventType);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/webhooks/rook/notifications`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ROOK-HASH": signature,
          },
          body: payload,
        },
      );

      const result = await response.json();

      if (response.ok) {
        console.log("✅ Notification webhook test successful:", result);
      } else {
        console.error("❌ Notification webhook test failed:", result);
      }

      return { success: response.ok, data: result, status: response.status };
    } catch (error) {
      console.error("❌ Error testing notification webhook:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Test webhook health check
   */
  async testHealthCheck() {
    console.log("🧪 Testing Webhook Health Check...");
    console.log("📍 URL:", `${this.baseUrl}/api/webhooks/rook/health`);

    try {
      const response = await fetch(`${this.baseUrl}/api/webhooks/rook/health`);
      const result = await response.json();

      if (response.ok) {
        console.log("✅ Health check successful:", result);
      } else {
        console.error("❌ Health check failed:", result);
      }

      return { success: response.ok, data: result, status: response.status };
    } catch (error) {
      console.error("❌ Error testing health check:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Run all webhook tests
   */
  async runAllTests(userId: string) {
    console.log("\n🧪 Running All Webhook Tests...\n");

    const results = {
      healthCheck: await this.testHealthCheck(),
      healthData: await this.testHealthDataWebhook(userId),
      connectionEstablished: await this.testNotificationWebhook(
        userId,
        "connection_established",
      ),
      connectionRevoked: await this.testNotificationWebhook(
        userId,
        "connection_revoked",
      ),
    };

    console.log("\n📊 Test Results Summary:");
    Object.entries(results).forEach(([test, result]) => {
      console.log(
        `${result.success ? "✅" : "❌"} ${test}: ${result.success ? "PASSED" : "FAILED"}`,
      );
    });

    return results;
  }
}

// Export a function to create a tester instance
export const createWebhookTester = (
  webhookSecretKey?: string,
  baseUrl?: string,
) => {
  const secretKey =
    webhookSecretKey ||
    process.env.ROOK_WEBHOOK_SECRET_KEY ||
    "test-secret-key";
  const url =
    baseUrl ||
    process.env.WEBHOOK_BASE_URL ||
    process.env.BASE_URL ||
    "http://localhost:3000";

  return new WebhookTester(secretKey, url);
};

// CLI usage example (uncomment to run directly)
/*
async function main() {
  const tester = createWebhookTester();
  const testUserId = '507f1f77bcf86cd799439011'; // Sample MongoDB ObjectId
  
  await tester.runAllTests(testUserId);
}

// Uncomment to run: node -r ts-node/register src/utils/webhook-tester.ts
// main().catch(console.error);
*/
