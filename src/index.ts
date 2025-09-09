import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import { initializeFirebaseAdmin } from './utils/firebase';
import { DatabaseService } from './utils/database';
import { verifyFirebaseToken, AuthenticatedRequest } from './middleware/auth.middleware';
import { AuthService } from './services/auth.service';
import { User } from './models/User.model';

// Initialize Firebase Admin and Database
initializeFirebaseAdmin();

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:19006'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint - No authentication required
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await DatabaseService.testConnection();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: dbStatus ? 'connected' : 'disconnected',
        firebase: 'initialized'
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Internal server error'
    });
  }
});

// Database test endpoint - No authentication required (for testing)
app.get('/test/database', async (req, res) => {
  try {
    await DatabaseService.connect();
    
    // Test creating a sample user
    const testUser = new User({
      firebaseUid: `test-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      displayName: 'Test User',
      provider: 'password',
      isEmailVerified: false,
      isPhoneVerified: false,
      isActive: true,
      profileCompleted: false
    });

    await testUser.save();
    
    // Clean up test user
    await User.deleteOne({ _id: testUser._id });

    res.status(200).json({
      status: 'success',
      message: 'Database connection and operations working correctly',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Authentication test endpoint - Requires Firebase token
app.get('/test/auth', verifyFirebaseToken, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    res.status(200).json({
      status: 'success',
      message: 'Authentication working correctly',
      user: authReq.user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Auth test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Authentication test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Sync user after Firebase authentication
app.post('/auth/sync', verifyFirebaseToken, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { displayName, photoURL, phone } = req.body;

    await DatabaseService.connect();

    const userData = {
      firebaseUid: authReq.user.uid,
      email: authReq.user.email || '',
      displayName: displayName || authReq.user.name,
      photoURL: photoURL || authReq.user.picture,
      phone: phone,
      provider: authReq.user.provider
    };

    const user = await AuthService.createOrUpdateUser(userData);

    res.status(200).json({
      status: 'success',
      message: 'User synced successfully',
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        provider: user.provider,
        isEmailVerified: user.isEmailVerified,
        profileCompleted: user.profileCompleted,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    console.error('User sync failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get user profile
app.get('/auth/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;

    await DatabaseService.connect();

    const user = await AuthService.getUserByFirebaseUid(authReq.user.uid);

    if (!user) {
      res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phone: user.phone,
        provider: user.provider,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        profileCompleted: user.profileCompleted,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt
      }
    });
  } catch (error) {
    console.error('Get profile failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update user profile
app.put('/auth/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { displayName, phone } = req.body;

    await DatabaseService.connect();

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (phone !== undefined) updateData.phone = phone;

    const user = await AuthService.updateUserProfile(authReq.user.uid, updateData);

    if (!user) {
      res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phone: user.phone,
        provider: user.provider,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        profileCompleted: user.profileCompleted,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Update profile failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Device data endpoint (placeholder for your IoT feature)
app.post('/devices/data', verifyFirebaseToken, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const deviceData = req.body;

    // Here you would save device data to database
    // For now, just return success with the data

    res.status(200).json({
      status: 'success',
      message: 'Device data saved successfully',
      data: {
        userId: authReq.user.uid,
        deviceData,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Save device data failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save device data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// Export the Express app as a Firebase Function
export const api = functions.https.onRequest(app);
