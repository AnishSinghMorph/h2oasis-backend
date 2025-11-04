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
    // Check actual mongoose connection state, not just our flag
    if (mongoose.connection.readyState === 1) {
      console.log("Already connected to MongoDB");
      return;
    }

    // If connection exists but is not ready, disconnect and reconnect
    if (mongoose.connection.readyState !== 0) {
      console.log("Mongoose connection in invalid state, reconnecting...");
      try {
        await mongoose.disconnect();
      } catch (err) {
        console.log("Error disconnecting stale connection:", err);
      }
    }

    try {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error("MONGODB_URI environment variable is not set");
      }

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        autoIndex: true,
      });

      this.isConnected = true;
      console.log("Connected to MongoDB Atlas successfully");

      // Handle connection events (only set up once)
      if (!mongoose.connection.listeners("error").length) {
        mongoose.connection.on("error", (error) => {
          console.error("MongoDB connection error:", error);
          this.isConnected = false;
        });

        mongoose.connection.on("disconnected", () => {
          console.log("MongoDB disconnected");
          this.isConnected = false;
        });

        mongoose.connection.on("reconnected", () => {
          console.log("MongoDB reconnected");
          this.isConnected = true;
        });
      }
    } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
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
