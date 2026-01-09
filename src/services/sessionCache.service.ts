import redisClient from "../utils/redis";
import { ISession } from "../models/Session.model";

/**
 * Session Cache Service
 *
 * Implements a hot cache layer using Redis to speed up session reads.
 * MongoDB remains the source of truth.
 *
 * Key Pattern: user:{userId}:sessions
 * TTL Strategy:
 *   - Active/completed sessions: 24 hours (86400 seconds)
 *   - In-progress sessions: 30 minutes (1800 seconds)
 */
export class SessionCacheService {
  // TTL constants in seconds
  private readonly DEFAULT_TTL = 86400; // 24 hours for general sessions
  private readonly IN_PROGRESS_TTL = 1800; // 30 minutes for in-progress sessions

  /**
   * Generate Redis key for user's sessions
   */
  private getUserSessionsKey(userId: string): string {
    return `user:${userId}:sessions`;
  }

  /**
   * Generate Redis key for a single session
   */
  private getSessionKey(userId: string, sessionId: string): string {
    return `user:${userId}:session:${sessionId}`;
  }

  /**
   * Check if Redis is connected and available
   */
  private async isRedisAvailable(): Promise<boolean> {
    try {
      await redisClient.ping();
      return true;
    } catch (error) {
      console.warn("⚠️ Redis not available, falling back to MongoDB");
      return false;
    }
  }

  /**
   * Cache all sessions for a user
   * Called after fetching from MongoDB to populate cache
   */
  async cacheUserSessions(userId: string, sessions: ISession[]): Promise<void> {
    if (!(await this.isRedisAvailable())) return;

    try {
      const key = this.getUserSessionsKey(userId);

      // Store sessions as JSON array
      await redisClient.set(key, JSON.stringify(sessions), {
        EX: this.DEFAULT_TTL,
      });

      console.log(
        `💾 Cached ${sessions.length} sessions for user ${userId} (TTL: 24h)`,
      );
    } catch (error) {
      console.error("❌ Failed to cache user sessions:", error);
      // Don't throw - caching failures shouldn't break the app
    }
  }

  /**
   * Cache a single session (used after creation/update)
   * Also invalidates the user's session list cache to ensure consistency
   */
  async cacheSession(userId: string, session: ISession): Promise<void> {
    if (!(await this.isRedisAvailable())) return;

    try {
      // Determine TTL based on session state
      const ttl = session.isCompleted ? this.DEFAULT_TTL : this.IN_PROGRESS_TTL;
      const ttlLabel = session.isCompleted ? "24h" : "30min";

      // Cache individual session
      const sessionKey = this.getSessionKey(userId, session.sessionId);
      await redisClient.set(sessionKey, JSON.stringify(session), {
        EX: ttl,
      });

      console.log(
        `💾 Cached session "${session.SessionName}" (TTL: ${ttlLabel})`,
      );

      // Invalidate the sessions list cache to force refresh
      // This ensures getUserSessions returns fresh data
      await this.invalidateUserSessionsCache(userId);
    } catch (error) {
      console.error("❌ Failed to cache session:", error);
    }
  }

  /**
   * Get all sessions for a user from cache
   * Returns null if cache miss (caller should fetch from MongoDB)
   */
  async getUserSessions(userId: string): Promise<ISession[] | null> {
    if (!(await this.isRedisAvailable())) return null;

    try {
      const key = this.getUserSessionsKey(userId);
      const cached = await redisClient.get(key);

      if (cached) {
        const sessions = JSON.parse(cached) as ISession[];
        console.log(
          `📦 Cache HIT: ${sessions.length} sessions for user ${userId}`,
        );
        return sessions;
      }

      console.log(`📭 Cache MISS: No sessions cached for user ${userId}`);
      return null;
    } catch (error) {
      console.error("❌ Failed to read sessions from cache:", error);
      return null;
    }
  }

  /**
   * Get a single session from cache
   * Returns null if cache miss
   */
  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<ISession | null> {
    if (!(await this.isRedisAvailable())) return null;

    try {
      const key = this.getSessionKey(userId, sessionId);
      const cached = await redisClient.get(key);

      if (cached) {
        console.log(`📦 Cache HIT: Session ${sessionId}`);
        return JSON.parse(cached) as ISession;
      }

      console.log(`📭 Cache MISS: Session ${sessionId} not in cache`);
      return null;
    } catch (error) {
      console.error("❌ Failed to read session from cache:", error);
      return null;
    }
  }

  /**
   * Invalidate (delete) the user's sessions list cache
   * Called when sessions are created, updated, or deleted
   */
  async invalidateUserSessionsCache(userId: string): Promise<void> {
    if (!(await this.isRedisAvailable())) return;

    try {
      const key = this.getUserSessionsKey(userId);
      await redisClient.del(key);
      console.log(`🗑️ Invalidated sessions cache for user ${userId}`);
    } catch (error) {
      console.error("❌ Failed to invalidate sessions cache:", error);
    }
  }

  /**
   * Invalidate (delete) a single session from cache
   */
  async invalidateSession(userId: string, sessionId: string): Promise<void> {
    if (!(await this.isRedisAvailable())) return;

    try {
      const sessionKey = this.getSessionKey(userId, sessionId);
      await redisClient.del(sessionKey);

      // Also invalidate the list cache
      await this.invalidateUserSessionsCache(userId);

      console.log(`🗑️ Invalidated session ${sessionId} from cache`);
    } catch (error) {
      console.error("❌ Failed to invalidate session from cache:", error);
    }
  }

  /**
   * Add a session to the user's cached sessions list
   * Used for immediate cache update after session creation
   */
  async addSessionToCache(userId: string, session: ISession): Promise<void> {
    if (!(await this.isRedisAvailable())) return;

    try {
      // Get existing cached sessions
      const existingSessions = await this.getUserSessions(userId);

      if (existingSessions) {
        // Check if session already exists (update) or is new (add)
        const existingIndex = existingSessions.findIndex(
          (s) => s.sessionId === session.sessionId,
        );

        let updatedSessions: ISession[];
        if (existingIndex >= 0) {
          // Update existing session
          updatedSessions = [...existingSessions];
          updatedSessions[existingIndex] = session;
        } else {
          // Add new session at the beginning (most recent first)
          updatedSessions = [session, ...existingSessions];
        }

        // Re-cache the updated list
        await this.cacheUserSessions(userId, updatedSessions);
        console.log(`📝 Updated sessions cache with "${session.SessionName}"`);
      } else {
        // No cached list exists, just cache this single session
        await this.cacheUserSessions(userId, [session]);
      }
    } catch (error) {
      console.error("❌ Failed to add session to cache:", error);
    }
  }

  /**
   * Remove a session from the cached sessions list
   * Used for immediate cache update after session deletion
   */
  async removeSessionFromCache(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    if (!(await this.isRedisAvailable())) return;

    try {
      // Get existing cached sessions
      const existingSessions = await this.getUserSessions(userId);

      if (existingSessions) {
        // Filter out the deleted session
        const updatedSessions = existingSessions.filter(
          (s) => s.sessionId !== sessionId,
        );

        // Re-cache the updated list
        await this.cacheUserSessions(userId, updatedSessions);
        console.log(`🗑️ Removed session ${sessionId} from cache list`);
      }

      // Also delete the individual session cache
      const sessionKey = this.getSessionKey(userId, sessionId);
      await redisClient.del(sessionKey);
    } catch (error) {
      console.error("❌ Failed to remove session from cache:", error);
    }
  }
}

// Export singleton instance
export const sessionCacheService = new SessionCacheService();
