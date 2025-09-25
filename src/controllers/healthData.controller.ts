import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { UserSelection } from '../models/UserSelection.model';
import { Product } from '../models/Product.model';

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