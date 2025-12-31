import { Request, Response } from "express";
import { H2OasisAIService } from "../services/h2oasis-ai.service";
import { User } from "../models/User.model";
import redisClient from "../utils/redis";
import { SessionService } from "../services/session.service";

export class ChatController {
  private h2oasisAI: H2OasisAIService;
  private sessionService: SessionService;
  private readonly CACHE_TTL = 300; // 5 minutes cache

  constructor() {
    this.h2oasisAI = new H2OasisAIService();
    this.sessionService = new SessionService();
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

      // Get user to retrieve focusGoal
      const user = await User.findOne({ firebaseUid: userId });

      // Build goals array: prioritize passed goals, fallback to user's focusGoal
      let goalsArray = goals || [];
      if (goalsArray.length === 0 && user?.focusGoal?.label) {
        goalsArray = [user.focusGoal.label];
        console.log("📌 Using user's focus goal:", user.focusGoal.label);
      }

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
          goals: goalsArray,
          mood,
          isNewSession,
        },
      );

      console.log("✅ AI response received");

      // Try to extract JSON session from response (may be wrapped in markdown or text)
      let parsed: any = null;
      let jsonString = aiResponse.trim();

      // Remove markdown code blocks if present
      if (jsonString.includes("```json")) {
        jsonString = jsonString
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "");
      } else if (jsonString.includes("```")) {
        jsonString = jsonString.replace(/```\s*/g, "");
      }

      // Try to find JSON object in the response
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          parsed = null;
        }
      }

      // If the parsed object looks like a Session, return structured response
      if (
        parsed &&
        (parsed.SessionId || parsed.SessionName) &&
        Array.isArray(parsed.Steps)
      ) {
        console.log("🛰️ Detected session JSON - returning structured session");
        res.json({
          success: true,
          response:
            "Session created successfully. Tap 'View Session' to open it.",
          action: "CREATE_SESSION",
          session: parsed,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Default: return raw assistant text
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
          selectedProduct: user?.selectedProduct
            ? {
                id: user.selectedProduct.type,
                name: user.selectedProduct.name,
                type: user.selectedProduct.type,
                selectedAt: user.selectedProduct.selectedAt.toISOString(),
              }
            : {
                id: "unspecified",
                name: "Unspecified",
                type: "unspecified",
                selectedAt: new Date().toISOString(),
              },
          focusGoal: user?.focusGoal
            ? {
                key: user.focusGoal.key,
                label: user.focusGoal.label,
                customText: user.focusGoal.customText || null,
                selectedAt: user.focusGoal.selectedAt.toISOString(),
              }
            : null,
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

  /**
   * Create a guided wellness session
   * POST /api/chat/create-session
   */
  createSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tags, goals, mood, customPrompt } = req.body;
      const userId = req.headers["x-firebase-uid"] as string;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      // Validate tags
      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        res.status(400).json({
          success: false,
          error: "Tags array is required (e.g., ['Spa', 'Hot Tub'])",
        });
        return;
      }

      console.log("🧘 Creating session for user:", userId);

      // Get user's wearables data
      const wearablesData = await this.getWearablesDataCached(userId);

      // Get user to retrieve focusGoal
      const user = await User.findOne({ firebaseUid: userId });

      // Build goals array: prioritize passed goals, fallback to user's focusGoal
      let goalsArray = goals || [];
      if (goalsArray.length === 0 && user?.focusGoal?.label) {
        goalsArray = [user.focusGoal.label];
        console.log(
          "📌 Using user's focus goal for session:",
          user.focusGoal.label,
        );
      }

      // Create session via H2Oasis AI
      const session = await this.h2oasisAI.createSession(wearablesData, {
        tags,
        goals: goalsArray,
        mood: mood || "",
        customPrompt,
      });

      console.log("✅ Session created:", session.SessionName);

      // Use a consistent sessionId per user so it updates instead of creating new
      const consistentSessionId = `user-${userId}-default-session`;
      console.log(`🔑 Using consistent sessionId: ${consistentSessionId}`);

      // Delete all old sessions for this user first
      try {
        const existingSessions = await this.sessionService.getUserSessions({
          firebaseUid: userId,
        });
        for (const oldSession of existingSessions) {
          if (oldSession.sessionId !== consistentSessionId) {
            await this.sessionService.deleteSession(
              oldSession.sessionId,
              userId,
            );
          }
        }
        if (existingSessions.length > 0) {
          console.log(`🗑️ Cleaned up old sessions`);
        }
      } catch (cleanupError) {
        console.warn("⚠️ Failed to cleanup old sessions:", cleanupError);
      }

      // Save/update session to database (upsert)
      try {
        await this.sessionService.saveSession({
          sessionId: consistentSessionId,
          firebaseUid: userId,
          SessionName: session.SessionName,
          TotalDurationMinutes: session.TotalDurationMinutes,
          RecommendedFor: session.RecommendedFor,
          Steps: session.Steps,
          Tips: session.Tips,
          StartMessage: session.StartMessage,
          CompletionMessage: session.CompletionMessage,
        });
        console.log("💾 Session saved to database");
      } catch (saveError) {
        console.error("⚠️ Failed to save session to database:", saveError);
        // Don't fail the request - session was created successfully
      }

      res.status(201).json({
        success: true,
        message: "Session created successfully",
        session,
      });
    } catch (error: any) {
      console.error("❌ Session creation error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create session",
        message: error.message || "Unable to create session. Please try again.",
      });
    }
  };
}
