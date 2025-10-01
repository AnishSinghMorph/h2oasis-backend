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
          data: wearableConnections.apple?.healthData || null
        },
        samsung: {
          id: 'samsung',
          name: 'Samsung Health',
          type: 'sdk',
          connected: wearableConnections.samsung?.connected || false,
          lastSync: wearableConnections.samsung?.lastSync?.toISOString(),
          data: wearableConnections.samsung?.healthData || null
        },
        garmin: {
          id: 'garmin',
          name: 'Garmin',
          type: 'api',
          connected: wearableConnections.garmin?.connected || false,
          lastSync: wearableConnections.garmin?.lastSync?.toISOString(),
          data: wearableConnections.garmin?.healthData || null
        },
        fitbit: {
          id: 'fitbit',
          name: 'Fitbit',
          type: 'api',
          connected: wearableConnections.fitbit?.connected || false,
          lastSync: wearableConnections.fitbit?.lastSync?.toISOString(),
          data: wearableConnections.fitbit?.healthData || null
        },
        whoop: {
          id: 'whoop',
          name: 'Whoop',
          type: 'api',
          connected: wearableConnections.whoop?.connected || false,
          lastSync: wearableConnections.whoop?.lastSync?.toISOString(),
          data: wearableConnections.whoop?.healthData || null
        },
        oura: {
          id: 'oura',
          name: 'Oura Ring',
          type: 'api',
          connected: wearableConnections.oura?.connected || false,
          lastSync: wearableConnections.oura?.lastSync?.toISOString(),
          data: wearableConnections.oura?.healthData || null
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