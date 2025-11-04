import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Database connection management
 * Handles MongoDB Atlas connection with proper error handling
 */
export class DatabaseService {
  private static isConnected = false;

  static async connect(): Promise<void> {
    // Always disconnect first to ensure clean state
    if (mongoose.connection.readyState !== 0) {
      console.log(`Mongoose state: ${mongoose.connection.readyState}, forcing disconnect...`);
      try {
        await mongoose.disconnect();
        // Wait a bit for the connection to fully close
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.log("Error disconnecting:", err);
      }
    }

    try {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error("MONGODB_URI environment variable is not set");
      }

      console.log("Establishing new MongoDB connection...");
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000,
        autoIndex: true,
      });

      this.isConnected = true;
      console.log("✅ Connected to MongoDB Atlas successfully");

      // Handle connection events (only set up once)
      if (!mongoose.connection.listeners("error").length) {
        mongoose.connection.on("error", (error) => {
          console.error("❌ MongoDB connection error:", error);
          this.isConnected = false;
        });

        mongoose.connection.on("disconnected", () => {
          console.log("⚠️ MongoDB disconnected");
          this.isConnected = false;
        });

        mongoose.connection.on("reconnected", () => {
          console.log("✅ MongoDB reconnected");
          this.isConnected = true;
        });

        mongoose.connection.on("close", () => {
          console.log("🔒 MongoDB connection closed");
          this.isConnected = false;
        });
      }
    } catch (error) {
      console.error("❌ Failed to connect to MongoDB:", error);
      this.isConnected = false;
      throw error;
    }
  }

  static async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log("Disconnected from MongoDB");
    } catch (error) {
      console.error("Error disconnecting from MongoDB:", error);
      throw error;
    }
  }

  static getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  static async testConnection(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Test the connection by pinging the database
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      }
      return true;
    } catch (error) {
      console.error("Database connection test failed:", error);
      return false;
    }
  }
}
