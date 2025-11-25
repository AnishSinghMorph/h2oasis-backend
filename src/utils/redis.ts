import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        console.error("❌ Redis connection failed after 10 retries");
        return new Error("Redis connection failed");
      }
      return retries * 100; // Reconnect after retries * 100ms
    },
  },
});

redisClient.on("error", (err: Error) => {
  console.error("❌ Redis Client Error:", err);
});

redisClient.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error);
  }
})();

export default redisClient;
