import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

// 1. LOGGING - Track what happens (REQUIRED for debugging)
export const logger = (req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
};

// 2. ERROR HANDLER - Catch all errors (REQUIRED) - NOW WITH DB ERROR HANDLING
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error("Error:", error.message);
  console.error("Stack:", error.stack);

  // Handle MongoDB/Mongoose specific errors
  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: Object.values(error.errors).map((e: any) => e.message),
    });
  }

  if (
    error.name === "MongooseError" ||
    error.name === "MongoError" ||
    error.name === "MongoServerError"
  ) {
    console.error("❌ Database error:", error);
    return res.status(503).json({
      success: false,
      message: "Database operation failed. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }

  // Handle connection closed errors specifically
  if (
    error.message?.includes("Connection is closed") ||
    error.message?.includes("topology was destroyed") ||
    error.message?.includes("pool was destroyed")
  ) {
    return res.status(503).json({
      success: false,
      message: "Database connection lost. Please try again.",
    });
  }

  // Handle Firebase auth errors
  if (error.code?.startsWith("auth/")) {
    return res.status(401).json({
      success: false,
      message: error.message || "Authentication failed",
    });
  }

  // Default error response
  return res.status(error.status || 500).json({
    success: false,
    message: error.message || "Something went wrong",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};

// 3. NOT FOUND - Handle invalid routes (REQUIRED)
export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};

// 4. ASYNC ERROR WRAPPER - Catch async errors (VERY USEFUL)
export const asyncHandler =
  <T extends Request = Request>(
    fn: (req: T, res: Response, next: NextFunction) => Promise<any>,
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
