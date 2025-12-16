import { Request, Response } from "express";
import { z } from "zod";
import { DatabaseService } from "../utils/database";
import { AuthService } from "../services/auth.service";
import { User } from "../models/User.model";
import { admin } from "../utils/firebase";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import redis from "../utils/redis";
import { generateOTP, sendOTPEmail } from "../services/otp.service";

// -----------------------------
// ZOD SCHEMAS
// -----------------------------
const RegisterSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),
  firebaseUid: z.string().optional(),
  provider: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

const OTPVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4).max(6),
});

const RequestOTPSchema = z.object({
  email: z.string().email(),
});

export class AuthController {
  // ----------------------------------------------------
  // REGISTER
  // ----------------------------------------------------
  static async register(req: Request, res: Response) {
    try {
      const data = RegisterSchema.parse(req.body);
      const { fullName, email, password, firebaseUid, provider } = data;

      await DatabaseService.connect();

      // SOCIAL login path
      if (firebaseUid && provider && provider !== "password") {
        const user = await AuthService.createOrUpdateUser({
          firebaseUid,
          email,
          fullName,
          displayName: fullName,
          provider,
        });

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
      }

      // PASSWORD signup - validate password is provided and has min length
      if (!password || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });

      // Only block if user already has PASSWORD provider (not just social login)
      if (
        existingUser?.isEmailVerified &&
        existingUser.linkedProviders?.has("password")
      ) {
        return res.status(409).json({
          success: false,
          message: "Email already registered with password. Please login.",
          code: "EMAIL_EXISTS",
        });
      }

      // If user exists with social login only, add password to their account
      if (existingUser) {
        try {
          // Update Firebase with password
          const existingFB = await admin.auth().getUserByEmail(email);
          await admin.auth().updateUser(existingFB.uid, { password });

          // Link password provider to existing user
          if (!existingUser.linkedProviders) {
            existingUser.linkedProviders = new Map();
          }
          existingUser.linkedProviders.set("password", existingFB.uid);
          existingUser.markModified("linkedProviders");
          await existingUser.save();

          return res.status(200).json({
            success: true,
            message:
              "Password added to your account. You can now login with email/password.",
            firebaseUID: existingUser.firebaseUid,
            user: {
              id: existingUser._id,
              email: existingUser.email,
              fullName: existingUser.fullName,
            },
            linkedProviders: Array.from(existingUser.linkedProviders.keys()),
          });
        } catch (error: any) {
          console.error("Error adding password to existing account:", error);
          throw error;
        }
      }

      let firebaseUser;
      try {
        firebaseUser = await admin.auth().createUser({
          email,
          password,
          displayName: fullName,
        });
      } catch (firebaseError: any) {
        if (firebaseError.code === "auth/email-already-exists") {
          const existingFB = await admin.auth().getUserByEmail(email);
          firebaseUser = await admin
            .auth()
            .updateUser(existingFB.uid, { password });
        } else {
          throw firebaseError;
        }
      }

      const user = await AuthService.createOrUpdateUser({
        firebaseUid: firebaseUser.uid,
        email,
        fullName,
        displayName: fullName,
        provider: "password",
      });

      // Generate OTP
      const otp = generateOTP();
      user.emailOtp = otp;
      user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      sendOTPEmail(user.email, otp, user.fullName || "there");

      return res.status(201).json({
        success: true,
        message: "User registered successfully",
        firebaseUID: user.firebaseUid,
        requiresEmailVerification: true,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: error.errors[0].message });
      }

      console.error("Registration error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Registration failed" });
    }
  }

  // ----------------------------------------------------
  // LOGIN
  // ----------------------------------------------------
  static async login(req: Request, res: Response) {
    try {
      const data = LoginSchema.parse(req.body);
      const { email } = data;

      await DatabaseService.connect();

      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user)
        return res
          .status(401)
          .json({ success: false, message: "Invalid email or password" });

      const customToken = await admin
        .auth()
        .createCustomToken(user.firebaseUid);

      user.lastLoginAt = new Date();
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Login successful",
        customToken,
        firebaseUID: user.firebaseUid,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
        },
        linkedProviders: Array.from(user.linkedProviders?.keys() || []),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ success: false, message: error.errors[0].message });
      }
      console.error("Login error:", error);
      return res.status(500).json({ success: false, message: "Login failed" });
    }
  }

  // ----------------------------------------------------
  // PROFILE
  // ----------------------------------------------------
  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      await DatabaseService.connect();

      const user = await AuthService.getUserByFirebaseUid(req.user!.uid);

      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      return res.status(200).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isEmailVerified: user.isEmailVerified,
          onboardingCompleted: user.onboardingCompleted,
          linkedProviders: Array.from(user.linkedProviders?.keys() || []),
        },
      });
    } catch (error: any) {
      console.error("Profile error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to get profile" });
    }
  }

  // ----------------------------------------------------
  // VERIFY OTP
  // ----------------------------------------------------
  static async verifyOTP(req: Request, res: Response) {
    try {
      const data = OTPVerifySchema.parse(req.body);
      const { email, otp } = data;

      await DatabaseService.connect();

      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      if (user.emailOtp !== otp)
        return res.status(400).json({ success: false, message: "Invalid OTP" });

      if (!user.emailOtpExpiry || user.emailOtpExpiry < new Date())
        return res.status(400).json({ success: false, message: "OTP expired" });

      user.isEmailVerified = true;
      user.emailOtp = undefined;
      user.emailOtpExpiry = undefined;
      await user.save();

      return res.status(200).json({ success: true, message: "Email verified" });
    } catch (error: any) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ success: false, message: error.errors[0].message });

      return res
        .status(500)
        .json({ success: false, message: "Verification failed" });
    }
  }

  // ----------------------------------------------------
  // REQUEST OTP
  // ----------------------------------------------------
  static async requestOTP(req: Request, res: Response) {
    try {
      const data = RequestOTPSchema.parse(req.body);
      const { email } = data;

      await DatabaseService.connect();

      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      const otp = generateOTP();
      user.emailOtp = otp;
      user.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      sendOTPEmail(user.email, otp, user.fullName || "there");

      return res.status(200).json({ success: true, message: "OTP sent" });
    } catch (error: any) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ success: false, message: error.errors[0].message });

      return res
        .status(500)
        .json({ success: false, message: "Failed to send OTP" });
    }
  }

  // ----------------------------------------------------
  // COMPLETE ONBOARDING
  // ----------------------------------------------------
  static async completeOnboarding(req: AuthenticatedRequest, res: Response) {
    try {
      await DatabaseService.connect();

      const user = await AuthService.getUserByFirebaseUid(req.user!.uid);

      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      user.onboardingCompleted = true;
      await user.save();

      return res
        .status(200)
        .json({ success: true, message: "Onboarding completed" });
    } catch (error: any) {
      console.error("Onboarding error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to complete onboarding" });
    }
  }

  // ----------------------------------------------------
  // DELETE ACCOUNT
  // ----------------------------------------------------
  static async deleteAccount(req: AuthenticatedRequest, res: Response) {
    const firebaseUid = req.user!.uid;

    try {
      await DatabaseService.connect();

      const user = await AuthService.getUserByFirebaseUid(firebaseUid);

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const cacheKey = `user:${user.email.toLowerCase()}`;

      // Execute all deletions *in parallel*
      await Promise.all([
        User.deleteOne({ firebaseUid }),
        redis.del(cacheKey),
        admin.auth().deleteUser(firebaseUid),
      ]);

      return res.status(200).json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete account error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to delete account",
      });
    }
  }
}
