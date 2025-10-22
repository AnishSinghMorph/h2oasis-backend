import Redis from 'ioredis';

const redis = new Redis({
  retryStrategy: () => null, // Don't retry if Redis is unavailable
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Handle connection errors gracefully
redis.on('error', (err: any) => {
  // Silently ignore Redis connection errors (Redis is optional for caching)
  if (err.code !== 'ECONNREFUSED') {
    console.warn('Redis connection warning:', err.message);
  }
});

// Try to connect, but don't fail if Redis is unavailable
redis.connect().catch(() => {
  console.log('Redis not available - caching disabled (this is optional)');
});

export default redis;