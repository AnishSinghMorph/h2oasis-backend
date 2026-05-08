import { createClient } from "redis";

const isRedisDisabled = !process.env.REDIS_URL || process.env.DISABLE_REDIS === "true";

// If redis is disabled, return a mock client that resolves seamlessly without crashing
const mockRedisClient = {
  on: () => { },
  connect: async () => { },
  ping: async () => true,
  get: async () => null,
  set: async () => "OK",
  del: async () => 1,
} as any;

let redisClient: ReturnType<typeof createClient>;

if (isRedisDisabled) {
  console.log("⚠️ Redis is disabled (no REDIS_URL found). Using mock client. Caching is bypassed.");
  redisClient = mockRedisClient;
} else {
  redisClient = createClient({
    url: process.env.REDIS_URL,
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
}

export default redisClient;
