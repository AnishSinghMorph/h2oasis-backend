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
    if (this.isConnected) {
      console.log("Already connected to MongoDB");
      return;
    }

    try {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error("MONGODB_URI environment variable is not set");
      }

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10, // Maximum number of connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      });

      this.isConnected = true;
      console.log("Connected to MongoDB Atlas successfully");

      // Handle connection events
      mongoose.connection.on("error", (error) => {
        console.error("MongoDB connection error:", error);
        this.isConnected = false;
      });

      mongoose.connection.on("disconnected", () => {
        console.log("MongoDB disconnected");
        this.isConnected = false;
      });
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
