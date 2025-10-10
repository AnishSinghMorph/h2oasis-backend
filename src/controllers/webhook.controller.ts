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

    // Verify HMAC signature for security
    if (!verifyRookSignature(rawBody, signature)) {
      console.error('❌ Invalid ROOK webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const webhookData: RookWebhookPayload = req.body;
    console.log('📊 Processing health data for user:', webhookData.user_id);
    console.log('🔍 Data source:', webhookData.data_source);

    const user = await User.findById(webhookData.user_id);
    
    if (!user) {
      console.warn(`⚠️ User not found for ROOK user_id: ${webhookData.user_id}`);
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

    const wearableName = dataSourceMap[webhookData.data_source.toLowerCase()];
    
    if (!wearableName) {
      console.warn(`⚠️ Unknown data source: ${webhookData.data_source}`);
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
      webhookData.user_id,
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
      user_id: webhookData.user_id,
      data_source: webhookData.data_source,
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
    
    // Get raw body and signature
    const rawBody = JSON.stringify(req.body);
    const signature = req.headers['x-rook-hash'] as string;

    // Verify HMAC signature for security
    if (!verifyRookSignature(rawBody, signature)) {
      console.error('❌ Invalid ROOK webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const notificationData: NotificationPayload = req.body;
    console.log('📢 Processing notification:', notificationData.event_type);
    console.log('👤 User:', notificationData.user_id);
    console.log('🔗 Data source:', notificationData.data_source);

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

    // Handle different notification types
    switch (notificationData.event_type) {
      case 'connection_established':
        if (wearableName) {
          await User.findByIdAndUpdate(
            notificationData.user_id,
            {
              $set: {
                [`wearableConnections.${wearableName}.connected`]: true,
                [`wearableConnections.${wearableName}.connectedAt`]: new Date(),
                [`wearableConnections.${wearableName}.lastSync`]: new Date(),
                updatedAt: new Date(),
              }
            }
          );
          console.log(`✅ ${wearableName} connection established for user ${notificationData.user_id}`);
        }
        break;

      case 'connection_revoked':
        if (wearableName) {
          await User.findByIdAndUpdate(
            notificationData.user_id,
            {
              $set: {
                [`wearableConnections.${wearableName}.connected`]: false,
                [`wearableConnections.${wearableName}.revokedAt`]: new Date(),
                updatedAt: new Date(),
              }
            }
          );
          console.log(`❌ ${wearableName} connection revoked for user ${notificationData.user_id}`);
        }
        break;

      case 'user_created':
        console.log(`👤 ROOK user created: ${notificationData.user_id}`);
        break;

      case 'user_deleted':
        console.log(`🗑️ ROOK user deleted: ${notificationData.user_id}`);
        break;

      default:
        console.log(`ℹ️ Unknown notification type: ${notificationData.event_type}`);
    }

    // Return success response
    res.status(200).json({
      message: 'Notification processed successfully',
      event_type: notificationData.event_type,
      user_id: notificationData.user_id,
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