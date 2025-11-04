import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Database connection management
 * Handles MongoDB Atlas connection with proper error handling
 */
export class DatabaseService {
  private static isConnected = false;
  private static isConnecting = false;

  static async connect(): Promise<void> {
    const readyState = mongoose.connection.readyState as number;
    
    // If already connected and healthy, return immediately
    if (readyState === 1) {
      return;
    }

    // If currently connecting, wait for it
    if (this.isConnecting) {
      console.log("⏳ Connection already in progress, waiting...");
      // Wait up to 10 seconds for connection to complete
      for (let i = 0; i < 100; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if ((mongoose.connection.readyState as number) === 1) {
          return;
        }
      }
      throw new Error("Connection timeout - another connection is in progress");
    }

    // If in a broken state (connecting/disconnecting), force cleanup
    if (readyState === 2 || readyState === 3) {
      console.log(`Mongoose in transitional state ${readyState}, cleaning up...`);
      try {
        await mongoose.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.log("Error during cleanup:", err);
      }
    }

    this.isConnecting = true;

    try {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error("MONGODB_URI environment variable is not set");
      }

      console.log("🔄 Establishing MongoDB connection...");
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000,
        autoIndex: true,
      });

      // Wait for connection pool to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      this.isConnected = true;
      this.isConnecting = false;
      console.log("✅ MongoDB connected successfully");

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
      this.isConnecting = false;
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
