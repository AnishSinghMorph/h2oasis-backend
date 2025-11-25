// ============================================
// FILE: src/middleware/database.middleware.ts
// ============================================
import { Request, Response, NextFunction } from "express";
import { DatabaseService } from "../utils/database";

/**
 * Middleware to ensure database connection before processing requests
 * Automatically reconnects if connection is lost
 */
export const ensureDbConnection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Skip database check for health endpoints and static files
    if (req.path.startsWith("/health") || req.path.startsWith("/api-docs")) {
      return next();
    }

    // Check if connection is healthy
    const isConnected = DatabaseService.getConnectionStatus();

    if (!isConnected) {
      console.log("⚠️ Database connection lost, attempting to reconnect...");
      await DatabaseService.connect();
    }

    next();
  } catch (error) {
    console.error("❌ Failed to establish database connection:", error);
    res.status(503).json({
      success: false,
      error: "Database connection unavailable. Please try again.",
    });
  }
};
