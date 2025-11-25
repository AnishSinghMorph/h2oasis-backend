import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Database connection management with auto-reconnection
 * Handles MongoDB Atlas connection with proper error handling
 */
export class DatabaseService {
  private static isConnected = false;
  private static isConnecting = false;
  private static reconnectAttempts = 0;
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;

  static async connect(): Promise<void> {
    // Already connected
    if (mongoose.connection.readyState === 1) {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      return;
    }

    // Connection already in progress, wait for it
    if (this.isConnecting) {
      console.log("⏳ Connection already in progress, waiting...");
      return this.waitForConnection();
    }

    this.isConnecting = true;

    try {
      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error("MONGODB_URI environment variable is not set");
      }

      console.log("🔄 Connecting to MongoDB...");

      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        retryReads: true,
        autoIndex: true,
      });

      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      console.log("✅ MongoDB connected successfully");

      // Setup event handlers only once
      this.setupEventHandlers();
    } catch (error) {
      this.isConnecting = false;
      console.error("❌ Failed to connect to MongoDB:", error);
      this.isConnected = false;
      throw error;
    }
  }

  private static setupEventHandlers(): void {
    // Remove existing listeners to avoid duplicates
    mongoose.connection.removeAllListeners("error");
    mongoose.connection.removeAllListeners("disconnected");
    mongoose.connection.removeAllListeners("reconnected");

    mongoose.connection.on("error", (error) => {
      console.error("❌ MongoDB error:", error);
      this.isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
      this.isConnected = false;

      // Auto-reconnect with exponential backoff
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        const delay = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts),
          30000,
        );
        console.log(
          `🔄 Attempting reconnection ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`,
        );

        setTimeout(() => {
          this.connect().catch((err) =>
            console.error("❌ Reconnection attempt failed:", err),
          );
        }, delay);
      } else {
        console.error(
          "❌ Max reconnection attempts reached. Manual intervention required.",
        );
      }
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected successfully");
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });
  }

  private static async waitForConnection(timeout = 10000): Promise<void> {
    const startTime = Date.now();

    while (this.isConnecting) {
      if (Date.now() - startTime > timeout) {
        throw new Error(
          "Connection timeout: Database connection taking too long",
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!this.isConnected) {
      throw new Error("Database connection failed");
    }
  }

  static async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      this.isConnecting = false;
      console.log("✅ Disconnected from MongoDB");
    } catch (error) {
      console.error("❌ Error disconnecting from MongoDB:", error);
      throw error;
    }
  }

  static getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  static async testConnection(): Promise<boolean> {
    try {
      if (!this.isConnected || mongoose.connection.readyState !== 1) {
        await this.connect();
      }

      // Test the connection by pinging the database
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        return true;
      }
      return false;
    } catch (error) {
      console.error("❌ Database connection test failed:", error);
      return false;
    }
  }

  static getConnectionState(): string {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    return states[mongoose.connection.readyState] || "unknown";
  }
}
