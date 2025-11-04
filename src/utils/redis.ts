/**
 * Redis Mock - Temporarily disabled
 * Redis is not available on AWS right now, so we're using a mock that does nothing
 * Caching is completely disabled until Redis is set up
 */

console.log('⚠️ Redis disabled - no caching (this is temporary)');

// Mock Redis client that accepts all parameters but does nothing
const mockRedis = {
  get: async (key: string) => null,
  set: async (key: string, value: string, ...args: any[]) => 'OK',
  del: async (key: string) => 1,
  expire: async (key: string, seconds: number) => 1,
  on: (event: string, handler: any) => {},
  connect: async () => {},
  disconnect: async () => {},
};

export default mockRedis;
