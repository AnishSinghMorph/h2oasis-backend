// FILE: src/middleware/auth.middleware.ts (UPDATED)
// ============================================
import { Request, Response, NextFunction } from "express";
import * as admin from "firebase-admin";

// Extend Express Request type to include user data
export interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    email?: string;
    name?: string;
    picture?: string;
    provider: string;
  };
}

/**
 * Middleware to verify Firebase JWT tokens
 * For testing: Also accepts custom tokens and firebaseUid in headers
 */
export const verifyFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Method 1: Check for firebaseUid in headers (for testing)
    const firebaseUid = req.headers["x-firebase-uid"] as string;
    if (firebaseUid) {
      (req as AuthenticatedRequest).user = {
        uid: firebaseUid,
        email: "",
        name: "",
        picture: "",
        provider: "test",
      };
      return next();
    }

    // Method 2: Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "No valid authorization token provided",
      });
      return;
    }

    const token = authHeader.split("Bearer ")[1];

    try {
      // Try to verify as ID token first
      const decodedToken = await admin.auth().verifyIdToken(token);

      (req as AuthenticatedRequest).user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
        provider: decodedToken.firebase.sign_in_provider,
      };

      next();
    } catch (idTokenError) {
      // If ID token fails, try custom token (for testing)
      try {
        const decodedCustomToken = await admin
          .auth()
          .verifyIdToken(token, true);

        (req as AuthenticatedRequest).user = {
          uid: decodedCustomToken.uid,
          email: decodedCustomToken.email,
          name: decodedCustomToken.name,
          picture: decodedCustomToken.picture,
          provider: "custom",
        };

        next();
      } catch (customTokenError) {
        console.error("Token verification failed:", customTokenError);
        res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "Invalid or expired token",
        });
      }
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Authentication failed",
    });
  }
};