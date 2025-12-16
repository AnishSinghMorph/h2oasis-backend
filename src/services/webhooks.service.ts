/**
 * ROOK Webhook Service
 * Handles webhook URL generation and management
 */

export class RookWebhookService {
  private static instance: RookWebhookService;

  private constructor() {}

  public static getInstance(): RookWebhookService {
    if (!RookWebhookService.instance) {
      RookWebhookService.instance = new RookWebhookService();
    }
    return RookWebhookService.instance;
  }

  /**
   * Get webhook URLs for ROOK configuration
   */
  getWebhookUrls(): {
    healthDataWebhook: string;
    notificationWebhook: string;
    healthCheck: string;
  } {
    const baseUrl =
      process.env.WEBHOOK_BASE_URL ||
      process.env.BASE_URL ||
      "https://api.h2oasis.ai";

    return {
      healthDataWebhook: `${baseUrl}/api/webhooks/rook/health-data`,
      notificationWebhook: `${baseUrl}/api/webhooks/rook/notifications`,
      healthCheck: `${baseUrl}/api/webhooks/rook/health`,
    };
  }

  /**
   * Validate webhook configuration
   */
  validateConfiguration(): {
    isValid: boolean;
    missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const warnings: string[] = [];

    if (!process.env.WEBHOOK_BASE_URL && !process.env.BASE_URL) {
      missing.push("WEBHOOK_BASE_URL or BASE_URL");
    }

    // Check ROOK configuration
    if (!process.env.ROOK_SANDBOX_CLIENT_UUID) {
      warnings.push("ROOK_SANDBOX_CLIENT_UUID not set");
    }

    if (!process.env.ROOK_SANDBOX_SECRET_KEY) {
      warnings.push("ROOK_SANDBOX_SECRET_KEY not set");
    }

    // Check if using localhost (not suitable for production webhooks)
    const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.BASE_URL;
    if (baseUrl?.includes("localhost") || baseUrl?.includes("127.0.0.1")) {
      warnings.push(
        "Webhook URL uses localhost - ROOK cannot reach local URLs. Use ngrok or deploy to production.",
      );
    }

    return {
      isValid: missing.length === 0,
      missing,
      warnings,
    };
  }

  /**
   * Log webhook configuration status
   */
  logConfigurationStatus(): void {
    const validation = this.validateConfiguration();
    const urls = this.getWebhookUrls();

    console.log("\n🔗 ROOK Webhook Configuration:");
    console.log("================================");

    if (validation.isValid) {
      console.log("✅ Configuration is valid");
    } else {
      console.log("❌ Configuration has issues");
      if (validation.missing.length > 0) {
        console.log(
          "Missing required variables:",
          validation.missing.join(", "),
        );
      }
    }

    if (validation.warnings.length > 0) {
      console.log("⚠️ Warnings:", validation.warnings.join(", "));
    }

    console.log("\n📍 Webhook URLs to configure in ROOK Portal:");
    console.log("Health Data Webhook:", urls.healthDataWebhook);
    console.log("Notification Webhook:", urls.notificationWebhook);
    console.log("Health Check:", urls.healthCheck);
    console.log("================================\n");
  }
}

export const rookWebhookService = RookWebhookService.getInstance();
