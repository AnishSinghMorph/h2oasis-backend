import express, { Request, Response } from 'express';
import cors from 'cors';
import { initializeFirebaseAdmin } from './src/utils/firebase';
import { DatabaseService } from './src/utils/database';
import { verifyFirebaseToken, AuthenticatedRequest } from './src/middleware/auth.middleware';
import { AuthService } from './src/services/auth.service';
import { User } from './src/models/User.model';
import { admin } from './src/utils/firebase';

// Initialize Firebase Admin
initializeFirebaseAdmin();

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:8081', 
    'http://localhost:19006',
    'http://192.168.1.55:8081',
    'exp://192.168.1.55:8081'
  ],
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

// Auth Routes
// Registration endpoint
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { fullName, email, password } = req.body;

    // Validate input
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Create user in Firebase Auth
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
    });

    // Connect to database
    await DatabaseService.connect();

    // Create user in MongoDB
    const userData = {
      firebaseUid: firebaseUser.uid,
      email,
      fullName,
      displayName: fullName,
      provider: 'password',
    };

    const user = await AuthService.createOrUpdateUser(userData);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    if (error.code === 'auth/invalid-email') {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Connect to database
    await DatabaseService.connect();

    // Find user in our database
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // For this demo, we'll create a custom token for the user
    // In production, you'd verify the password with Firebase Auth on client side
    const customToken = await admin.auth().createCustomToken(user.firebaseUid);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: customToken,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Protected profile endpoint
app.get('/api/auth/profile', verifyFirebaseToken, async (req: any, res: Response) => {
  try {
    await DatabaseService.connect();
    
    const user = await AuthService.getUserByFirebaseUid(req.user!.uid);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        isEmailVerified: user.isEmailVerified,
        profileCompleted: user.profileCompleted,
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Database test: http://localhost:${port}/test/database`);
});
