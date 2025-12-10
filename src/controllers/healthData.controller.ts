import { Request, Response } from "express";
import { User } from "../models/User.model";
import {
  getUserConnections,
  getAllHealthDataForSource,
} from "../services/rook.service";
import { IHealthData } from "../models/HealthData.types";

interface WearableData {
  id: string;
  name: string;
  type: "api" | "sdk";
  connected: boolean;
  lastSync?: string;
  data?: IHealthData | null;
}

// REMOVED: transformHealthData function to avoid confusion with webhook data
// Webhook data is stored directly from webhook.controller.ts with proper formatting

interface UnifiedHealthData {
  userId: string;
  profile: {
    name?: string;
    email?: string;
    uid: string;
  };
  selectedProduct: {
    id: string;
    name: string;
    type: string;
    selectedAt: string;
  } | null;
  focusGoal: {
    key: string;
    label: string;
    customText: string | null;
    selectedAt: string;
  } | null;
  wearables: {
    apple: WearableData;
    samsung: WearableData;
    garmin: WearableData;
    fitbit: WearableData;
    whoop: WearableData;
    oura: WearableData;
  };
  lastSync: string;
}

export const getUnifiedHealthData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.headers["x-firebase-uid"] as string;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    console.log("📊 Fetching unified health data for user:", userId);

    // Get user profile
    const user = await User.findOne({ firebaseUid: userId });

    // Get user's wearable connection statuses from database
    const wearables = user?.wearables || {};

    console.log("🔍 Wearables data:", JSON.stringify(wearables, null, 2));

    // Build unified data with actual health data from connected wearables
    const unifiedData: UnifiedHealthData = {
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
        : null,
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
          lastSync: wearables.apple?.lastSync?.toISOString(),
          data: wearables.apple?.data || null,
        },
        samsung: {
          id: "samsung",
          name: "Samsung Health",
          type: "sdk",
          connected: wearables.samsung?.connected || false,
          lastSync: wearables.samsung?.lastSync?.toISOString(),
          data: wearables.samsung?.data || null,
        },
        garmin: {
          id: "garmin",
          name: "Garmin",
          type: "api",
          connected: wearables.garmin?.connected || false,
          lastSync: wearables.garmin?.lastSync?.toISOString(),
          data: wearables.garmin?.data || null,
        },
        fitbit: {
          id: "fitbit",
          name: "Fitbit",
          type: "api",
          connected: wearables.fitbit?.connected || false,
          lastSync: wearables.fitbit?.lastSync?.toISOString(),
          data: wearables.fitbit?.data || null,
        },
        whoop: {
          id: "whoop",
          name: "Whoop",
          type: "api",
          connected: wearables.whoop?.connected || false,
          lastSync: wearables.whoop?.lastSync?.toISOString(),
          data: wearables.whoop?.data || null,
        },
        oura: {
          id: "oura",
          name: "Oura Ring",
          type: "api",
          connected: wearables.oura?.connected || false,
          lastSync: wearables.oura?.lastSync?.toISOString(),
          data: wearables.oura?.data || null,
        },
      },
      lastSync: new Date().toISOString(),
    };

    console.log("✅ Unified health data prepared");

    res.json({
      success: true,
      data: unifiedData,
    });
  } catch (error) {
    console.error("❌ Error fetching unified health data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch health data",
    });
  }
};

export const updateHealthDataPreferences = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.headers["x-firebase-uid"] as string;
    const { voiceId, voiceName, units, timezone } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    console.log("⚙️ Updating health data preferences for user:", userId);

    // Update user preferences in database
    await User.findOneAndUpdate(
      { uid: userId },
      {
        $set: {
          "preferences.voiceId": voiceId,
          "preferences.voiceName": voiceName,
          "preferences.units": units,
          "preferences.timezone": timezone,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    console.log("✅ Health data preferences updated");

    res.json({
      success: true,
      message: "Preferences updated successfully",
    });
  } catch (error) {
    console.error("❌ Error updating preferences:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update preferences",
    });
  }
};

export const updateWearableConnection = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.headers["x-firebase-uid"] as string;
    const { wearableId, wearableName, dataSource, connected, healthData } =
      req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    console.log(`📱 Updating ${wearableName} connection status:`, {
      wearableId,
      connected,
    });
    if (healthData) {
      console.log(`📊 Including health data for ${wearableName}:`, healthData);
    }

    // Update user's wearable connection status and health data
    const updateField = `wearables.${wearableId}`;
    const connectionData: any = {
      id: wearableId,
      name: wearableName,
      type: dataSource === "sdk" ? "sdk" : "api",
      connected: connected,
      lastSync: new Date(),
      connectedAt: connected ? new Date() : null,
    };

    // Include health data if provided
    if (healthData) {
      connectionData.data = healthData;
    }

    await User.findOneAndUpdate(
      { firebaseUid: userId },
      {
        $set: {
          [updateField]: connectionData,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    console.log(
      `✅ ${wearableName} connection status updated: ${connected ? "Connected" : "Disconnected"}`,
    );
    if (healthData) {
      console.log(`✅ ${wearableName} health data saved successfully`);
    }

    res.json({
      success: true,
      message: `${wearableName} connection status updated successfully`,
      data: {
        wearableId,
        connected,
        lastSync: new Date().toISOString(),
        hasHealthData: !!healthData,
      },
    });
  } catch (error) {
    console.error("❌ Error updating wearable connection:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update wearable connection status",
    });
  }
};

export const getWearableConnections = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.headers["x-firebase-uid"] as string;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    console.log("🔍 Fetching wearable connections for user:", userId);

    // Get user's wearable connections
    const user = await User.findOne({ firebaseUid: userId });
    const wearables = user?.wearables || {};

    console.log("📊 Wearables found:", wearables);

    res.json({
      success: true,
      data: wearables,
    });
  } catch (error) {
    console.error("❌ Error fetching wearable connections:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch wearable connections",
    });
  }
};

export const syncRookConnections = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.headers["x-firebase-uid"] as string;
    const { mongoUserId } = req.body; // The MongoDB user ID used in ROOK

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    console.log(
      `🔄 Syncing ROOK connections for user: ${userId}, ROOK User ID: ${mongoUserId}`,
    );

    // Fetch connections from ROOK API
    const rookConnections = await getUserConnections(mongoUserId);

    console.log(
      "📡 ROOK API response:",
      JSON.stringify(rookConnections, null, 2),
    );

    // Map ROOK data sources to our wearable names
    const dataSourceMap: { [key: string]: string } = {
      oura: "oura",
      garmin: "garmin",
      fitbit: "fitbit",
      whoop: "whoop",
      apple_health: "apple",
    };

    // Update our database with ROOK connection statuses
    const user = await User.findOne({ firebaseUid: userId });

    if (!user) {
      res.status(404).json({
        success: false,
        error: "User not found",
      });
      return;
    }

    // Update each wearable connection status
    for (const [rookSource, ourWearable] of Object.entries(dataSourceMap)) {
      const rookConnection = rookConnections.connections?.[rookSource];

      if (rookConnection) {
        const updateField = `wearables.${ourWearable}`;

        await User.findOneAndUpdate(
          { firebaseUid: userId },
          {
            $set: {
              [updateField]: {
                id: ourWearable,
                name:
                  ourWearable.charAt(0).toUpperCase() + ourWearable.slice(1),
                type: "api",
                connected: rookConnection.connected,
                lastSync: rookConnection.lastSync || new Date(),
                connectedAt: rookConnection.connected ? new Date() : null,
              },
              updatedAt: new Date(),
            },
          },
          { new: true },
        );

        console.log(
          `✅ Updated ${ourWearable} connection status: ${rookConnection.connected}`,
        );

        // If connected, try to fetch recent health data
        if (rookConnection.connected) {
          try {
            const healthData = await getAllHealthDataForSource(
              mongoUserId,
              rookSource,
            );

            // Update health data if available
            await User.findOneAndUpdate(
              { firebaseUid: userId },
              {
                $set: {
                  [`wearables.${ourWearable}.data`]: {
                    ...healthData,
                    lastFetched: new Date(),
                  },
                },
              },
            );

            console.log(`✅ Fetched and stored health data for ${ourWearable}`);
          } catch (error) {
            console.log(
              `⚠️ Could not fetch health data for ${ourWearable}:`,
              error,
            );
          }
        }
      }
    }

    console.log("✅ ROOK connections synced successfully");

    res.json({
      success: true,
      message: "ROOK connections synced successfully",
      data: rookConnections,
    });
  } catch (error: any) {
    console.error("❌ Error syncing ROOK connections:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to sync ROOK connections",
    });
  }
};

// COMMENTED OUT: Manual API fetching to avoid confusion with webhook data
// Use webhooks for real-time data delivery instead
export const fetchRookHealthData_DISABLED = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.headers["x-firebase-uid"] as string;
    const { mongoUserId, dataSource, date } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    if (!mongoUserId || !dataSource) {
      res.status(400).json({
        success: false,
        error: "mongoUserId and dataSource are required",
      });
      return;
    }

    console.log(`📊 Fetching ROOK health data for ${dataSource}...`);

    // Fetch all health data from ROOK
    const healthData = await getAllHealthDataForSource(
      mongoUserId,
      dataSource,
      date,
    );

    // Update user's wearable health data in database
    const wearableMap: { [key: string]: string } = {
      oura: "oura",
      garmin: "garmin",
      fitbit: "fitbit",
      whoop: "whoop",
      apple_health: "apple",
    };

    const ourWearable = wearableMap[dataSource];

    if (ourWearable) {
      await User.findOneAndUpdate(
        { firebaseUid: userId },
        {
          $set: {
            [`wearables.${ourWearable}.data`]: {
              ...healthData,
              lastFetched: new Date(),
            },
            updatedAt: new Date(),
          },
        },
        { new: true },
      );

      console.log(`✅ Health data stored for ${ourWearable}`);
    }

    res.json({
      success: true,
      message: `Health data fetched successfully from ${dataSource}`,
      data: healthData,
    });
  } catch (error: any) {
    console.error("❌ Error fetching ROOK health data:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch health data",
    });
  }
};

/**
 * Get ROOK Authorization URL
 * Generates OAuth URL for wearable connection (keeps secret key secure on backend)
 */
export const getRookAuthURL = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.headers["x-firebase-uid"] as string;
    const { mongoUserId, dataSource } = req.body;

    if (!mongoUserId || !dataSource) {
      res.status(400).json({
        success: false,
        error: "mongoUserId and dataSource are required",
      });
      return;
    }

    console.log(`🔐 Generating ROOK auth URL for ${dataSource}...`);

    // Get credentials from environment (secure - not exposed to frontend)
    const clientUUID = process.env.ROOK_SANDBOX_CLIENT_UUID;
    const secretKey = process.env.ROOK_SANDBOX_SECRET_KEY;
    const baseUrl =
      process.env.ROOK_SANDBOX_BASE_URL || "https://api.rook-connect.review";

    // Get redirect URL from environment (for production callback)
    const redirectUri = process.env.OAUTH_REDIRECT_URL;

    if (!clientUUID || !secretKey) {
      res.status(500).json({
        success: false,
        error: "ROOK credentials not configured on server",
      });
      return;
    }

    // Call ROOK API to get authorization URL
    // If redirectUri is provided, use it. Otherwise ROOK uses their default callback
    const url = redirectUri
      ? `${baseUrl}/api/v1/user_id/${mongoUserId}/data_source/${dataSource}/authorizer?redirect_url=${encodeURIComponent(redirectUri)}`
      : `${baseUrl}/api/v1/user_id/${mongoUserId}/data_source/${dataSource}/authorizer`;

    const credentials = `${clientUUID}:${secretKey}`;
    const basicAuth = Buffer.from(credentials).toString("base64");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "H2Oasis/1.0.0",
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🚫 ROOK API Error: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Check if already authorized
    if (data.authorized === true) {
      res.json({
        success: true,
        data: {
          isAlreadyConnected: true,
          authorizationURL: "",
        },
      });
      return;
    }

    // Return authorization URL
    if (!data.authorization_url) {
      throw new Error(`No authorization URL provided for ${dataSource}`);
    }

    res.json({
      success: true,
      data: {
        authorizationURL: data.authorization_url,
        isAlreadyConnected: false,
      },
    });
  } catch (error: any) {
    console.error("❌ Error getting ROOK auth URL:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get authorization URL",
    });
  }
};
