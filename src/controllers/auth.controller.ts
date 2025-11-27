import { Request, Response } from "express";
import { DatabaseService } from "../utils/database";
import { AuthService } from "../services/auth.service";
import { User } from "../models/User.model";
import { admin } from "../utils/firebase";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import redis from "../utils/redis";

export class AuthController {
  static async register(req: Request, res: Response) {
    const { fullName, email, password, firebaseUid, provider } = req.body;

    try {
      await DatabaseService.connect();

      // Handle social sign-in (Apple, Google, etc.)
      if (firebaseUid && provider && provider !== "password") {
        // User already authenticated with Firebase via social provider
        // Just create/update in MongoDB
        const userData = {
          firebaseUid,
          email: email || "",
          fullName: fullName || "User",
          displayName: fullName || "User",
          provider,
        };

        const user = await AuthService.createOrUpdateUser(userData);

        return res.status(201).json({
          success: true,
          message: "User registered successfully",
          firebaseUID: user.firebaseUid,
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            displayName: user.displayName,
            provider: user.provider,
          },
          linkedProviders: Array.from(user.linkedProviders?.keys() || [])
        });
      }

      // Handle password-based registration
      if (!fullName || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Full name, email, and password are required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      // Create user in Firebase Auth
      let firebaseUser;
      try {
        firebaseUser = await admin.auth().createUser({
          email,
          password,
          displayName: fullName,
        });
      } catch (firebaseError: any) {
        // If email already exists, try to get the existing user and link password
        if (firebaseError.code === 'auth/email-already-exists') {
          try {
            // Get existing Firebase user by email
            const existingUser = await admin.auth().getUserByEmail(email);
            
            // Update the existing user with password
            firebaseUser = await admin.auth().updateUser(existingUser.uid, {
              password: password,
            });
            
            console.log(`✅ Added password to existing account: ${email}`);
          } catch (updateError: any) {
            return res.status(400).json({
              success: false,
              message: "This email is already registered with another provider. Please sign in with that provider first.",
            });
          }
        } else {
          throw firebaseError;
        }
      }

      // Create user in MongoDB
      const userData = {
        firebaseUid: firebaseUser.uid,
        email,
        fullName,
        displayName: fullName,
        provider: "password",
      };

      const user = await AuthService.createOrUpdateUser(userData);

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        firebaseUID: user.firebaseUid,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          displayName: user.displayName,
        },
          linkedProviders: Array.from(user.linkedProviders?.keys() || []),
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Registration failed",
      });
    }
  }

  static async login(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Connect to database
    await DatabaseService.connect();

    const cacheKey = `user:${email.toLowerCase()}`;
    const cachedUser = await redis.get(cacheKey);
    let userDoc;
    let userForResponse;

    if (cachedUser) {
      // Use cached user for response
      userForResponse = JSON.parse(cachedUser);
      // Fetch Mongoose doc for updating lastLoginAt
      userDoc = await User.findOne({ email: email.toLowerCase() });
    } else {
      // Fetch from DB
      userDoc = await User.findOne({ email: email.toLowerCase() });
      if (userDoc) {
        userForResponse = {
          firebaseUid: userDoc.firebaseUid,
          email: userDoc.email,
          fullName: userDoc.fullName,
          displayName: userDoc.displayName,
          lastLoginAt: userDoc.lastLoginAt,
          _id: userDoc._id,
        };
        await redis.set(cacheKey, JSON.stringify(userForResponse), {
          EX: 3600,
        });
      }
    }

    // If user not found in cache or DB
    if (!userDoc) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Create custom token that can be exchanged for ID token on client
    const customToken = await admin
      .auth()
      .createCustomToken(userDoc.firebaseUid);

    // Update last login
    userDoc.lastLoginAt = new Date();
    await userDoc.save();

    // Always use userForResponse for the response
    return res.status(200).json({
      success: true,
      message: "Login successful",
      customToken: customToken,
      firebaseUID: userDoc.firebaseUid,
      user: {
        id: userDoc._id,
        email: userDoc.email,
        fullName: userDoc.fullName,
        displayName: userDoc.displayName,
      },
       linkedProviders: Array.from(userDoc.linkedProviders?.keys() || []),
    });
  }

  static async getProfile(req: AuthenticatedRequest, res: Response) {
    await DatabaseService.connect();

    const user = await AuthService.getUserByFirebaseUid(req.user!.uid);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        displayName: user.displayName,
        photoURL: user.photoURL,
        isEmailVerified: user.isEmailVerified,
        profileCompleted: user.profileCompleted,
        onboardingCompleted: user.onboardingCompleted,
        linkedProviders: Array.from(user.linkedProviders?.keys() || []),
      },
    });
  }

  static async completeOnboarding(req: AuthenticatedRequest, res: Response) {
    const userId = req.user!.uid;

    await DatabaseService.connect();

    const user = await User.findOneAndUpdate(
      { firebaseUid: userId },
      { onboardingCompleted: true },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Onboarding completed successfully",
      user: {
        id: user._id,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  }
}
