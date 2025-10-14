import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User.model';

/**
 * ROOK Webhook Controller
 * Handles incoming webhooks from ROOK for health data and notifications
 */

interface RookWebhookPayload {
  user_id: string;
  data_source: string;
  webhook_type: 'data' | 'notification';
  event_type?: string;
  timestamp: string;
  data?: any;
  sleep_health?: any;
  physical_health?: any;
  body_health?: any;
  document_version?: number;
}

interface NotificationPayload {
  user_id: string;
  data_source: string;
  event_type: 'connection_established' | 'connection_revoked' | 'user_created' | 'user_deleted';
  timestamp: string;
  details?: any;
}

/**
 * Verify HMAC signature from ROOK webhook
 */
const verifyRookSignature = (payload: string, signature: string): boolean => {
  try {
    const secretKey = process.env.ROOK_WEBHOOK_SECRET_KEY;
    
    if (!secretKey) {
      console.error('❌ ROOK webhook secret key not configured');
      return false;
    }

    // ROOK sends HMAC-SHA256 signature in X-ROOK-HASH header
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(payload)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch (error) {
    console.error('❌ Error verifying ROOK signature:', error);
    return false;
  }
};


// REMOVED: transformRookHealthData function - storing raw ROOK data instead
// Will create custom transformation after receiving real webhook data

/**
 * Handle ROOK Health Data Webhooks
 * Receives health data from ROOK and stores it in the database
 */
export const handleRookHealthDataWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔔 Received ROOK health data webhook');
    
    // Get raw body and signature
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-rook-hash'] as string;

    // TEMPORARILY DISABLED HMAC VERIFICATION FOR DEVELOPMENT
    if (process.env.NODE_ENV === 'production') {
      if (!verifyRookSignature(rawBody, signature)) {
        console.error('❌ Invalid ROOK webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } else {
      console.log('⚠️ HMAC signature verification DISABLED for development');
    }

    const webhookData: any = req.body;
    console.log('🔍 Full health webhook payload:', JSON.stringify(req.body, null, 2));
    
    // ROOK uses consistent field names from API - user_id, data_structure, etc.
    const user_id = webhookData.user_id;
    const data_structure = webhookData.data_structure;
    
    // Extract data source from metadata or root level
    let data_source = webhookData.data_source;
    if (!data_source) {
      // Look for data source in metadata.sources_of_data_array (real ROOK format)
      const metadata = webhookData.body_health?.summary?.body_summary?.metadata || 
                      webhookData.physical_health?.summary?.metadata ||
                      webhookData.sleep_health?.summary?.metadata;
      
      if (metadata?.sources_of_data_array && metadata.sources_of_data_array.length > 0) {
        data_source = metadata.sources_of_data_array[0]; // Use first source
      } else {
        data_source = 'unknown';
      }
    }
    
    console.log('📊 Processing health data for user:', user_id);
    console.log('🔍 Data source:', data_source);
    console.log('📋 Data structure:', data_structure);

    // Validate ObjectId format before querying
    if (!user_id || user_id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(user_id)) {
      console.warn(`⚠️ Invalid user_id format: ${user_id}`);
      res.status(200).json({ message: 'Invalid user_id format, webhook acknowledged' });
      return;
    }

    const user = await User.findById(user_id);
    
    if (!user) {
      console.warn(`⚠️ User not found for ROOK user_id: ${user_id}`);
      res.status(200).json({ message: 'User not found, webhook acknowledged' });
      return;
    }

    // Map ROOK data source to our wearable names
    const dataSourceMap: { [key: string]: string } = {
      'oura': 'oura',
      'garmin': 'garmin',
      'fitbit': 'fitbit',
      'whoop': 'whoop',
      'apple_health': 'apple',
      'polar': 'polar'
    };

    const wearableName = dataSourceMap[data_source.toLowerCase()];
    
    if (!wearableName) {
      console.warn(`⚠️ Unknown data source: ${data_source}`);
      res.status(200).json({ message: 'Unknown data source, webhook acknowledged' });
      return;
    }

    // Store raw ROOK data with minimal processing
    const rawHealthData = {
      ...webhookData,
      deliveredVia: 'webhook',
      lastFetched: new Date(),
      processedAt: new Date()
    };

    // Update user's wearable health data
    const updateField = `wearableConnections.${wearableName}.healthData`;
    
    await User.findByIdAndUpdate(
      user_id,
      {
        $set: {
          [updateField]: rawHealthData,
          [`wearableConnections.${wearableName}.lastSync`]: new Date(),
          updatedAt: new Date(),
        }
      },
      { new: true }
    );

    console.log(`✅ Raw health data stored for ${wearableName} via webhook`);
    console.log(`� Raw ROOK data keys: ${Object.keys(webhookData).filter(k => k !== 'user_id' && k !== 'timestamp').join(', ')}`);

    // Return success response (required by ROOK)
    res.status(200).json({
      message: 'Health data processed successfully',
      user_id: user_id,
      data_source: data_source,
      data_structure: data_structure,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error processing ROOK health data webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Handle ROOK Notification Webhooks
 * Receives connection status and user lifecycle notifications
 */
export const handleRookNotificationWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔔 Received ROOK notification webhook');
    console.log('🔍 Full notification payload:', JSON.stringify(req.body, null, 2));
    
    // Get raw body and signature
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-rook-hash'] as string;

    // TEMPORARILY DISABLED HMAC VERIFICATION FOR DEVELOPMENT
    if (process.env.NODE_ENV === 'production') {
      if (!verifyRookSignature(rawBody, signature)) {
        console.error('❌ Invalid ROOK webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } else {
      console.log('⚠️ HMAC signature verification DISABLED for development');
    }

    const notificationData: any = req.body;
    
    // ROOK notification format: action, client_uuid, user_id, data_source, level, message, action_datetime, environment
    const action = notificationData.action; // e.g., "user_connected", "user_disconnected"
    const user_id = notificationData.user_id;
    const data_source = notificationData.data_source;
    const client_uuid = notificationData.client_uuid;
    const level = notificationData.level; // e.g., "info", "warning", "error"
    const message = notificationData.message;
    const action_datetime = notificationData.action_datetime;
    const environment = notificationData.environment;
    
    console.log('📢 Processing notification action:', action);
    console.log('👤 User:', user_id);
    console.log('🔗 Data source:', data_source);
    console.log('📊 Client UUID:', client_uuid);
    console.log('⚠️ Level:', level);
    console.log('💬 Message:', message);

    // Validate ObjectId format for user operations
    const hasValidUserId = user_id && 
                          user_id.length === 24 && 
                          /^[0-9a-fA-F]{24}$/.test(user_id);

    // Map data source to wearable name
    const dataSourceMap: { [key: string]: string } = {
      'oura': 'oura',
      'garmin': 'garmin',
      'fitbit': 'fitbit',
      'whoop': 'whoop',
      'apple_health': 'apple',
      'polar': 'polar'
    };

    const wearableName = dataSourceMap[notificationData.data_source?.toLowerCase()];

    // Handle different notification types (ROOK uses "action" field)
    switch (action) {
      case 'user_connected':
      case 'connection_established':
        if (wearableName && hasValidUserId) {
          await User.findByIdAndUpdate(
            user_id,
            {
              $set: {
                [`wearableConnections.${wearableName}.connected`]: true,
                [`wearableConnections.${wearableName}.connectedAt`]: new Date(),
                [`wearableConnections.${wearableName}.lastSync`]: new Date(),
                updatedAt: new Date(),
              }
            }
          );
          console.log(`✅ ${wearableName} connection established for user ${user_id}`);
        } else if (!hasValidUserId) {
          console.warn(`⚠️ Invalid user_id for connection_established: ${user_id}`);
        }
        break;

      case 'user_disconnected':
      case 'connection_revoked':
        if (wearableName && hasValidUserId) {
          await User.findByIdAndUpdate(
            user_id,
            {
              $set: {
                [`wearableConnections.${wearableName}.connected`]: false,
                [`wearableConnections.${wearableName}.revokedAt`]: new Date(),
                updatedAt: new Date(),
              }
            }
          );
          console.log(`❌ ${wearableName} connection revoked for user ${user_id}`);
        } else if (!hasValidUserId) {
          console.warn(`⚠️ Invalid user_id for connection_revoked: ${user_id}`);
        }
        break;

      case 'user_created':
        console.log(`👤 ROOK user created: ${user_id}`);
        break;

      case 'user_deleted':
        console.log(`🗑️ ROOK user deleted: ${user_id}`);
        break;

      default:
        console.log(`ℹ️ Unknown notification action: ${action}`);
    }

    // Return success response
    res.status(200).json({
      message: 'Notification processed successfully',
      action: action,
      user_id: user_id,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error processing ROOK notification webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Health check endpoint for webhook URL validation
 */
export const webhookHealthCheck = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    status: 'ok',
    service: 'ROOK Webhook Endpoint',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};