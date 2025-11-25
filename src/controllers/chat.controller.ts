import { Request, Response } from "express";
import { H2OasisAIService } from "../services/h2oasis-ai.service";
import { User } from "../models/User.model";
import { UserSelection } from "../models/UserSelection.model";
import redisClient from "../utils/redis";

export class ChatController {
  private h2oasisAI: H2OasisAIService;
  private readonly CACHE_TTL = 300; // 5 minutes cache

  constructor() {
    this.h2oasisAI = new H2OasisAIService();
  }

  sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { message, chatHistory, tags, goals, mood, isNewSession } =
        req.body;

      // Get userId from auth middleware
      const userId = req.headers["x-firebase-uid"] as string;

      // Validate required fields
      if (!message || !userId) {
        res.status(400).json({
          error: "Message and userId are required",
        });
        return;
      }

      console.log("💬 Processing chat message for user:", userId);

      // Fetch user's wearables data (with caching)
      const wearablesData = await this.getWearablesDataCached(userId);

      // Build messages array for H2Oasis AI
      const messages = [
        ...(chatHistory || []),
        {
          role: "user" as const,
          content: message,
        },
      ];

      // Call H2Oasis AI API
      const aiResponse = await this.h2oasisAI.sendMessage(
        message,
        messages,
        wearablesData,
        {
          tags,
          goals,
          mood,
          isNewSession,
        },
      );

      console.log("✅ AI response received");

      res.json({
        success: true,
        response: aiResponse,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Chat controller error:", error);
      res.status(500).json({
        error: "Failed to process chat message",
        message:
          "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.",
      });
    }
  };

  /**
   * Get wearables data with Redis caching
   * Caches for 5 minutes to avoid repeated DB queries
   */
  private async getWearablesDataCached(userId: string) {
    const cacheKey = `wearables:${userId}`;

    try {
      // Try to get from Redis cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("📦 Using cached wearables data");
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn("⚠️ Redis cache read failed, fetching from DB:", error);
    }

    // Fetch fresh data from database
    console.log("🔄 Fetching fresh wearables data from MongoDB");
    const wearablesData = await this.getWearablesData(userId);

    try {
      // Store in Redis cache
      await redisClient.set(cacheKey, JSON.stringify(wearablesData), {
        EX: this.CACHE_TTL,
      });
      console.log("💾 Cached wearables data for 5 minutes");
    } catch (error) {
      console.warn("⚠️ Redis cache write failed:", error);
    }

    return wearablesData;
  }

  /**
   * Get wearables data in H2Oasis AI format
   */
  private async getWearablesData(userId: string) {
    try {
      // Get user profile
      const user = await User.findOne({ firebaseUid: userId });

      // Get user's product selection
      const userSelection = (await UserSelection.findOne({ userId }).populate(
        "productId",
      )) as any;

      // Get user's wearable connection statuses from database
      const wearables = user?.wearables || {};

      // Check if any wearable is connected
      const hasConnectedWearables = Object.values(wearables).some(
        (w: any) => w?.connected,
      );

      // Return in H2Oasis AI format
      return {
        success: hasConnectedWearables,
        data: {
          userId,
          profile: {
            name: user?.fullName || user?.displayName,
            email: user?.email,
            uid: userId,
          },
          selectedProduct: userSelection
            ? {
                id: userSelection.productId._id.toString(),
                name: userSelection.productId.name,
                type: userSelection.productId.type,
                selectedAt: userSelection.selectedAt.toISOString(),
              }
            : {
                id: "unspecified",
                name: "Unspecified",
                type: "unspecified",
                selectedAt: new Date().toISOString(),
              },
          wearables: {
            apple: {
              id: "apple",
              name: "Apple Health",
              type: "sdk",
              connected: wearables.apple?.connected || false,
              data: wearables.apple?.data || null,
            },
            samsung: {
              id: "samsung",
              name: "Samsung Health",
              type: "sdk",
              connected: wearables.samsung?.connected || false,
              data: wearables.samsung?.data || null,
            },
            garmin: {
              id: "garmin",
              name: "Garmin",
              type: "api",
              connected: wearables.garmin?.connected || false,
              data: wearables.garmin?.data || null,
            },
            fitbit: {
              id: "fitbit",
              name: "Fitbit",
              type: "api",
              connected: wearables.fitbit?.connected || false,
              data: wearables.fitbit?.data || null,
            },
            whoop: {
              id: "whoop",
              name: "Whoop",
              type: "api",
              connected: wearables.whoop?.connected || false,
              data: wearables.whoop?.data || null,
            },
            oura: {
              id: "oura",
              name: "Oura Ring",
              type: "api",
              connected: wearables.oura?.connected || false,
              data: wearables.oura?.data || null,
            },
          },
          lastSync: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("❌ Error fetching wearables data:", error);
      // Return empty structure if error
      return {
        success: false,
        data: {
          userId,
          profile: {
            uid: userId,
          },
          selectedProduct: {
            id: "unspecified",
            name: "Unspecified",
            type: "unspecified",
            selectedAt: new Date().toISOString(),
          },
          wearables: {
            apple: {
              id: "apple",
              name: "Apple Health",
              type: "sdk",
              connected: false,
              data: null,
            },
            samsung: {
              id: "samsung",
              name: "Samsung Health",
              type: "sdk",
              connected: false,
              data: null,
            },
            garmin: {
              id: "garmin",
              name: "Garmin",
              type: "api",
              connected: false,
              data: null,
            },
            fitbit: {
              id: "fitbit",
              name: "Fitbit",
              type: "api",
              connected: false,
              data: null,
            },
            whoop: {
              id: "whoop",
              name: "Whoop",
              type: "api",
              connected: false,
              data: null,
            },
            oura: {
              id: "oura",
              name: "Oura Ring",
              type: "api",
              connected: false,
              data: null,
            },
          },
          lastSync: new Date().toISOString(),
        },
      };
    }
  }

  // Removed getHealthContext - we now use getWearablesData() which fetches real data from database

  // Future method to save chat history
  private async saveChatMessage(
    userId: string,
    userMessage: string,
    aiResponse: string,
  ): Promise<void> {
    // TODO: Implement database storage for chat history
    console.log(
      `Saving chat for user ${userId}: ${userMessage} -> ${aiResponse}`,
    );
  }

  generatePlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { chatHistory } = req.body;

      // Get userId from auth middleware
      const userId = req.headers["x-firebase-uid"] as string;

      if (!userId) {
        res.status(400).json({
          error: "userId is required",
        });
        return;
      }

      console.log("📋 Generating recovery plan for user:", userId);

      // Fetch user's wearables data from database
      const wearablesData = await this.getWearablesData(userId);

      // Build messages for plan generation
      const planRequestMessage =
        "Generate a personalized recovery plan for me based on my health data and goals.";

      const messages = [
        ...(chatHistory || []),
        {
          role: "user" as const,
          content: planRequestMessage,
        },
      ];

      // Call H2Oasis AI API to generate plan
      const recoveryPlan = await this.h2oasisAI.sendMessage(
        planRequestMessage,
        messages,
        wearablesData,
      );

      console.log("✅ Recovery plan generated");

      res.json({
        success: true,
        plan: recoveryPlan,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Plan generation error:", error);
      res.status(500).json({
        error: "Failed to generate recovery plan",
        message: "Unable to create plan. Please try again.",
      });
    }
  };
}
