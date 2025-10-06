import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { UserSelection } from '../models/UserSelection.model';
import { Product } from '../models/Product.model';
import { getUserConnections, getAllHealthDataForSource } from '../services/rook.service';

interface WearableData {
  id: string;
  name: string;
  type: 'api' | 'sdk';
  connected: boolean;
  lastSync?: string;
  data?: {
    sleep?: any;
    activity?: any;
    heartRate?: any;
    body?: any;
    nutrition?: any;
  };
}

// Helper function to transform raw ROOK data into clean summary
const transformHealthData = (healthData: any) => {
  if (!healthData) return null;

  const result: any = {};

  // Transform sleep data
  if (healthData.sleep?.sleep_health?.summary?.sleep_summary) {
    const sleepSummary = healthData.sleep.sleep_health.summary.sleep_summary;
    result.sleep = {
      date: sleepSummary.duration?.sleep_date_string,
      durationHours: sleepSummary.duration?.sleep_duration_seconds_int 
        ? Math.round(sleepSummary.duration.sleep_duration_seconds_int / 3600) 
        : null,
      efficiency: sleepSummary.scores?.sleep_efficiency_1_100_score_int,
      qualityScore: sleepSummary.scores?.sleep_quality_rating_1_5_score_int,
      heartRate: {
        max: sleepSummary.heart_rate?.hr_maximum_bpm_int,
        min: sleepSummary.heart_rate?.hr_minimum_bpm_int,
        avg: sleepSummary.heart_rate?.hr_avg_bpm_int
      }
    };
  }

  // Transform physical/activity data
  if (healthData.physical?.physical_health?.summary?.physical_summary) {
    const physicalSummary = healthData.physical.physical_health.summary.physical_summary;
    // Get the most recent activity data (last item in non_structured_data array)
    const activityData = physicalSummary.non_structured_data?.[physicalSummary.non_structured_data.length - 1];
    
    if (activityData) {
      result.activity = {
        date: activityData.timestamp,
        steps: activityData.steps,
        calories: activityData.total_calories,
        activityScore: activityData.score
      };
    }
  }

  // Transform body data
  if (healthData.body?.body_health?.summary?.body_summary) {
    const bodySummary = healthData.body.body_health.summary.body_summary;
    result.body = {
      weight_kg: bodySummary.body_metrics?.weight_kg_float,
      height_cm: bodySummary.body_metrics?.height_cm_int,
      bmi: bodySummary.body_metrics?.bmi_float
    };
  }

  result.lastFetched = healthData.lastFetched;
  
  return result;
};

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

export const getUnifiedHealthData = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-firebase-uid'] as string;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    console.log('📊 Fetching unified health data for user:', userId);

    // Get user profile
    const user = await User.findOne({ firebaseUid: userId });
    
    // Get user's product selection
    const userSelection = await UserSelection.findOne({ userId })
      .populate('productId') as any;

    // Get user's wearable connection statuses from database
    const wearableConnections = user?.wearableConnections || {};
    
    console.log('🔍 Wearable connections data:', JSON.stringify(wearableConnections, null, 2));
    
    // Build unified data with actual health data from connected wearables
    const unifiedData: UnifiedHealthData = {
      userId,
      profile: {
        name: user?.fullName || user?.displayName,
        email: user?.email,
        uid: userId,
      },
      selectedProduct: userSelection ? {
        id: userSelection.productId._id.toString(),
        name: userSelection.productId.name,
        type: userSelection.productId.type,
        selectedAt: userSelection.selectedAt.toISOString(),
      } : null,
      wearables: {
        apple: {
          id: 'apple',
          name: 'Apple Health',
          type: 'sdk',
          connected: wearableConnections.apple?.connected || false,
          lastSync: wearableConnections.apple?.lastSync?.toISOString(),
          data: transformHealthData(wearableConnections.apple?.healthData)
        },
        samsung: {
          id: 'samsung',
          name: 'Samsung Health',
          type: 'sdk',
          connected: wearableConnections.samsung?.connected || false,
          lastSync: wearableConnections.samsung?.lastSync?.toISOString(),
          data: transformHealthData(wearableConnections.samsung?.healthData)
        },
        garmin: {
          id: 'garmin',
          name: 'Garmin',
          type: 'api',
          connected: wearableConnections.garmin?.connected || false,
          lastSync: wearableConnections.garmin?.lastSync?.toISOString(),
          data: transformHealthData(wearableConnections.garmin?.healthData)
        },
        fitbit: {
          id: 'fitbit',
          name: 'Fitbit',
          type: 'api',
          connected: wearableConnections.fitbit?.connected || false,
          lastSync: wearableConnections.fitbit?.lastSync?.toISOString(),
          data: transformHealthData(wearableConnections.fitbit?.healthData)
        },
        whoop: {
          id: 'whoop',
          name: 'Whoop',
          type: 'api',
          connected: wearableConnections.whoop?.connected || false,
          lastSync: wearableConnections.whoop?.lastSync?.toISOString(),
          data: transformHealthData(wearableConnections.whoop?.healthData)
        },
        oura: {
          id: 'oura',
          name: 'Oura Ring',
          type: 'api',
          connected: wearableConnections.oura?.connected || false,
          lastSync: wearableConnections.oura?.lastSync?.toISOString(),
          data: transformHealthData(wearableConnections.oura?.healthData)
        }
      },
      lastSync: new Date().toISOString(),
    };

    console.log('✅ Unified health data prepared');

    res.json({
      success: true,
      data: unifiedData,
    });

  } catch (error) {
    console.error('❌ Error fetching unified health data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch health data' 
    });
  }
};

export const updateHealthDataPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-firebase-uid'] as string;
    const { voiceId, voiceName, units, timezone } = req.body;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    console.log('⚙️ Updating health data preferences for user:', userId);

    // Update user preferences in database
    await User.findOneAndUpdate(
      { uid: userId },
      {
        $set: {
          'preferences.voiceId': voiceId,
          'preferences.voiceName': voiceName,
          'preferences.units': units,
          'preferences.timezone': timezone,
          updatedAt: new Date(),
        }
      },
      { upsert: true, new: true }
    );

    console.log('✅ Health data preferences updated');

    res.json({
      success: true,
      message: 'Preferences updated successfully',
    });

  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update preferences' 
    });
  }
};

export const updateWearableConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-firebase-uid'] as string;
    const { wearableId, wearableName, dataSource, connected, healthData } = req.body;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    console.log(`📱 Updating ${wearableName} connection status:`, { wearableId, connected });
    if (healthData) {
      console.log(`📊 Including health data for ${wearableName}:`, healthData);
    }

    // Update user's wearable connection status and health data
    const updateField = `wearableConnections.${wearableId}`;
    const connectionData: any = {
      id: wearableId,
      name: wearableName,
      dataSource: dataSource || wearableId,
      connected: connected,
      lastSync: new Date(),
      connectedAt: connected ? new Date() : null,
    };

    // Include health data if provided
    if (healthData) {
      connectionData.healthData = healthData;
    }

    await User.findOneAndUpdate(
      { firebaseUid: userId },
      {
        $set: {
          [updateField]: connectionData,
          updatedAt: new Date(),
        }
      },
      { upsert: true, new: true }
    );

    console.log(`✅ ${wearableName} connection status updated: ${connected ? 'Connected' : 'Disconnected'}`);
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
      }
    });

  } catch (error) {
    console.error('❌ Error updating wearable connection:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update wearable connection status' 
    });
  }
};

export const getWearableConnections = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-firebase-uid'] as string;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    console.log('🔍 Fetching wearable connections for user:', userId);

    // Get user's wearable connections
    const user = await User.findOne({ firebaseUid: userId });
    const wearableConnections = user?.wearableConnections || {};

    console.log('📊 Wearable connections found:', wearableConnections);

    res.json({
      success: true,
      data: wearableConnections,
    });

  } catch (error) {
    console.error('❌ Error fetching wearable connections:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch wearable connections' 
    });
  }
};

export const syncRookConnections = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-firebase-uid'] as string;
    const { mongoUserId } = req.body; // The MongoDB user ID used in ROOK
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    console.log(`🔄 Syncing ROOK connections for user: ${userId}, ROOK User ID: ${mongoUserId}`);

    // Fetch connections from ROOK API
    const rookConnections = await getUserConnections(mongoUserId);
    
    console.log('📡 ROOK API response:', JSON.stringify(rookConnections, null, 2));

    // Map ROOK data sources to our wearable names
    const dataSourceMap: { [key: string]: string } = {
      'oura': 'oura',
      'garmin': 'garmin',
      'fitbit': 'fitbit',
      'whoop': 'whoop',
      'apple_health': 'apple',
    };

    // Update our database with ROOK connection statuses
    const user = await User.findOne({ firebaseUid: userId });
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Update each wearable connection status
    for (const [rookSource, ourWearable] of Object.entries(dataSourceMap)) {
      const rookConnection = rookConnections.connections?.[rookSource];
      
      if (rookConnection) {
        const updateField = `wearableConnections.${ourWearable}`;
        
        await User.findOneAndUpdate(
          { firebaseUid: userId },
          {
            $set: {
              [updateField]: {
                id: ourWearable,
                name: ourWearable.charAt(0).toUpperCase() + ourWearable.slice(1),
                dataSource: rookSource,
                connected: rookConnection.connected,
                lastSync: rookConnection.lastSync || new Date(),
                connectedAt: rookConnection.connected ? new Date() : null,
              },
              updatedAt: new Date(),
            }
          },
          { new: true }
        );

        console.log(`✅ Updated ${ourWearable} connection status: ${rookConnection.connected}`);

        // If connected, try to fetch recent health data
        if (rookConnection.connected) {
          try {
            const healthData = await getAllHealthDataForSource(mongoUserId, rookSource);
            
            // Update health data if available
            await User.findOneAndUpdate(
              { firebaseUid: userId },
              {
                $set: {
                  [`wearableConnections.${ourWearable}.healthData`]: {
                    ...healthData,
                    lastFetched: new Date(),
                  }
                }
              }
            );
            
            console.log(`✅ Fetched and stored health data for ${ourWearable}`);
          } catch (error) {
            console.log(`⚠️ Could not fetch health data for ${ourWearable}:`, error);
          }
        }
      }
    }

    console.log('✅ ROOK connections synced successfully');

    res.json({
      success: true,
      message: 'ROOK connections synced successfully',
      data: rookConnections,
    });

  } catch (error: any) {
    console.error('❌ Error syncing ROOK connections:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to sync ROOK connections' 
    });
  }
};

export const fetchRookHealthData = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-firebase-uid'] as string;
    const { mongoUserId, dataSource, date } = req.body;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    if (!mongoUserId || !dataSource) {
      res.status(400).json({
        success: false,
        error: 'mongoUserId and dataSource are required'
      });
      return;
    }

    console.log(`📊 Fetching ROOK health data for ${dataSource}...`);

    // Fetch all health data from ROOK
    const healthData = await getAllHealthDataForSource(mongoUserId, dataSource, date);

    // Update user's wearable health data in database
    const wearableMap: { [key: string]: string } = {
      'oura': 'oura',
      'garmin': 'garmin',
      'fitbit': 'fitbit',
      'whoop': 'whoop',
      'apple_health': 'apple',
    };

    const ourWearable = wearableMap[dataSource];
    
    if (ourWearable) {
      await User.findOneAndUpdate(
        { firebaseUid: userId },
        {
          $set: {
            [`wearableConnections.${ourWearable}.healthData`]: {
              ...healthData,
              lastFetched: new Date(),
            },
            updatedAt: new Date(),
          }
        },
        { new: true }
      );
      
      console.log(`✅ Health data stored for ${ourWearable}`);
    }

    res.json({
      success: true,
      message: `Health data fetched successfully from ${dataSource}`,
      data: healthData,
    });

  } catch (error: any) {
    console.error('❌ Error fetching ROOK health data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch health data' 
    });
  }
};

/**
 * Get ROOK Authorization URL
 * Generates OAuth URL for wearable connection (keeps secret key secure on backend)
 */
export const getRookAuthURL = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-firebase-uid'] as string;
    const { mongoUserId, dataSource } = req.body;

    if (!mongoUserId || !dataSource) {
      res.status(400).json({ 
        success: false, 
        error: 'mongoUserId and dataSource are required' 
      });
      return;
    }

    console.log(`🔐 Generating ROOK auth URL for ${dataSource}...`);

    // Get credentials from environment (secure - not exposed to frontend)
    const clientUUID = process.env.ROOK_SANDBOX_CLIENT_UUID;
    const secretKey = process.env.ROOK_SANDBOX_SECRET_KEY;
    const baseUrl = process.env.ROOK_SANDBOX_BASE_URL || 'https://api.rook-connect.review';
    
    // Get redirect URL from environment
    const redirectUri = process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL;
    
    if (!clientUUID || !secretKey) {
      res.status(500).json({ 
        success: false, 
        error: 'ROOK credentials not configured on server' 
      });
      return;
    }

    if (!redirectUri) {
      res.status(500).json({ 
        success: false, 
        error: 'OAuth redirect URL not configured on server' 
      });
      return;
    }

    // Call ROOK API to get authorization URL
    const url = `${baseUrl}/api/v1/user_id/${mongoUserId}/data_source/${dataSource}/authorizer?redirect_url=${encodeURIComponent(redirectUri)}`;
    
    const credentials = `${clientUUID}:${secretKey}`;
    const basicAuth = Buffer.from(credentials).toString('base64');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'H2Oasis/1.0.0',
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json',
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
          authorizationURL: '',
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
    console.error('❌ Error getting ROOK auth URL:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get authorization URL' 
    });
  }
};