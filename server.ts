import express from 'express';
import cors from 'cors';
import { initializeFirebaseAdmin } from './utils/firebase';
import { DatabaseService } from './utils/database';
import { verifyFirebaseToken, AuthenticatedRequest } from './middleware/auth.middleware';
import { AuthService } from './services/auth.service';
import { User } from './models/User.model';

// Initialize Firebase Admin
initializeFirebaseAdmin();

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:19006'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
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

// Database test endpoint
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
    console.log('Test user created:', testUser._id);
    
    // Clean up test user
    await User.deleteOne({ _id: testUser._id });
    console.log('Test user deleted');

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

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Database test: http://localhost:${port}/test/database`);
});
