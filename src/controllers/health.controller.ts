import { Request, Response } from "express";
import { DatabaseService } from "../utils/database";

export class HealthController {
  static async healthCheck(req: Request, res: Response) {
    try {
      const dbStatus = await DatabaseService.testConnection();

      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          api: "running",
          database: dbStatus ? "connected" : "disconnected",
          firebase: "initialized",
        },
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Internal server error",
      });
    }
  }

  static async testDatabase(req: Request, res: Response) {
    try {
      await DatabaseService.connect();

      res.status(200).json({
        status: "success",
        message: "Database connection working correctly",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Database test failed:", error);
      res.status(500).json({
        status: "error",
        message: "Database test failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
