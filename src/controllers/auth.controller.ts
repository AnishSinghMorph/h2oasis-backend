import { Request, Response } from 'express';
import { DatabaseService } from '../utils/database';
import { AuthService } from '../services/auth.service';
import { User } from '../models/User.model';
import { admin } from '../utils/firebase';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AuthController {
  
  static async register(req: Request, res: Response) {
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
  }

  static async login(req: Request, res: Response) {
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

    // Create custom token that can be exchanged for ID token on client
    const customToken = await admin.auth().createCustomToken(user.firebaseUid);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      customToken: customToken,
      firebaseUid: user.firebaseUid,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
      }
    });
  }

  static async getProfile(req: AuthenticatedRequest, res: Response) {
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
  }
}
