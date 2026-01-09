import { Session, ISession, ISessionStep } from "../models/Session.model";
import { v4 as uuidv4 } from "uuid";
import { sessionCacheService } from "./sessionCache.service";

interface CreateSessionInput {
  sessionId?: string; // Optional - generated if not provided
  firebaseUid: string;
  SessionName: string;
  TotalDurationMinutes: number;
  RecommendedFor: string;
  Steps: ISessionStep[];
  Tips: string[];
  StartMessage: string;
  CompletionMessage: string;
}

interface UpdateSessionInput {
  SessionName?: string;
  TotalDurationMinutes?: number;
  RecommendedFor?: string;
  Steps?: ISessionStep[];
  Tips?: string[];
  StartMessage?: string;
  CompletionMessage?: string;
  isCompleted?: boolean;
  completedAt?: Date;
}

interface SessionFilters {
  firebaseUid: string;
  isCompleted?: boolean;
}

export class SessionService {
  /**
   * Save or update a session (upsert operation)
   */
  async saveSession(input: CreateSessionInput): Promise<ISession> {
    console.log(`💾 saveSession called with sessionId: ${input.sessionId}`);

    // Check if session already exists for this user
    const existingSession = await Session.findOne({
      firebaseUid: input.firebaseUid,
      sessionId: input.sessionId,
    });

    if (existingSession) {
      // Update existing session in MongoDB
      existingSession.SessionName = input.SessionName;
      existingSession.TotalDurationMinutes = input.TotalDurationMinutes;
      existingSession.RecommendedFor = input.RecommendedFor;
      existingSession.Steps = input.Steps;
      existingSession.Tips = input.Tips;
      existingSession.StartMessage = input.StartMessage;
      existingSession.CompletionMessage = input.CompletionMessage;

      await existingSession.save();
      console.log(
        `🔄 Session updated: ${existingSession.SessionName} (${existingSession.sessionId})`,
      );

      // Write-through cache: Update Redis after MongoDB save
      await sessionCacheService.addSessionToCache(
        input.firebaseUid,
        existingSession.toObject() as ISession,
      );

      return existingSession;
    }

    // Create new session
    const sessionData = {
      sessionId: input.sessionId || uuidv4(),
      firebaseUid: input.firebaseUid,
      SessionName: input.SessionName,
      TotalDurationMinutes: input.TotalDurationMinutes,
      RecommendedFor: input.RecommendedFor,
      Steps: input.Steps,
      Tips: input.Tips,
      StartMessage: input.StartMessage,
      CompletionMessage: input.CompletionMessage,
      isCompleted: false,
    };

    const session = new Session(sessionData);
    await session.save();

    console.log(
      `✅ Session saved: ${session.SessionName} (${session.sessionId})`,
    );

    // Write-through cache: Add new session to Redis
    await sessionCacheService.addSessionToCache(
      input.firebaseUid,
      session.toObject() as ISession,
    );

    return session;
  }

  /**
   * Get all sessions for a user with optional filters
   * Uses Redis cache for faster reads, falls back to MongoDB
   */
  async getUserSessions(filters: SessionFilters): Promise<ISession[]> {
    // Only use cache for unfiltered requests (most common case)
    if (filters.isCompleted === undefined) {
      // Try Redis cache first
      const cachedSessions = await sessionCacheService.getUserSessions(
        filters.firebaseUid,
      );

      if (cachedSessions) {
        // Cache hit - return immediately
        return cachedSessions;
      }
    }

    // Cache miss or filtered request - query MongoDB
    const query: any = { firebaseUid: filters.firebaseUid };

    // Add optional filters
    if (filters.isCompleted !== undefined) {
      query.isCompleted = filters.isCompleted;
    }

    const sessions = await Session.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .lean<ISession[]>();

    console.log(
      `📋 Found ${sessions.length} sessions for user ${filters.firebaseUid} (from MongoDB)`,
    );

    // Populate cache for unfiltered requests
    if (filters.isCompleted === undefined) {
      await sessionCacheService.cacheUserSessions(
        filters.firebaseUid,
        sessions,
      );
    }

    return sessions;
  }

  /**
   * Get a single session by ID
   */
  async getSessionById(
    sessionId: string,
    firebaseUid: string,
  ): Promise<ISession | null> {
    const session = await Session.findOne({
      sessionId,
      firebaseUid,
    }).lean<ISession>();

    if (!session) {
      console.warn(`⚠️ Session not found: ${sessionId}`);
      return null;
    }

    return session;
  }

  /**
   * Update a session (for editing timers, favoriting, marking complete)
   */
  async updateSession(
    sessionId: string,
    firebaseUid: string,
    updates: UpdateSessionInput,
  ): Promise<ISession | null> {
    // If marking as completed, set completedAt timestamp
    if (updates.isCompleted === true && !updates.completedAt) {
      updates.completedAt = new Date();
    }

    // Try to find by MongoDB _id first, then fall back to sessionId field
    let session = await Session.findOneAndUpdate(
      { _id: sessionId, firebaseUid },
      { $set: updates },
      { new: true }, // Return updated document
    );

    // If not found by _id, try by sessionId field
    if (!session) {
      session = await Session.findOneAndUpdate(
        { sessionId, firebaseUid },
        { $set: updates },
        { new: true },
      );
    }

    if (!session) {
      console.warn(`⚠️ Session not found for update: ${sessionId}`);
      return null;
    }

    console.log(`✅ Session updated: ${session.SessionName} (${sessionId})`);

    // Update cache with the modified session
    await sessionCacheService.addSessionToCache(
      firebaseUid,
      session.toObject() as ISession,
    );

    return session;
  }

  /**
   * Delete a session
   */
  async deleteSession(
    sessionId: string,
    firebaseUid: string,
  ): Promise<boolean> {
    const result = await Session.deleteOne({ sessionId, firebaseUid });

    if (result.deletedCount === 0) {
      console.warn(`⚠️ Session not found for deletion: ${sessionId}`);
      return false;
    }

    console.log(`🗑️ Session deleted: ${sessionId}`);

    // Remove from cache
    await sessionCacheService.removeSessionFromCache(firebaseUid, sessionId);

    return true;
  }

  /**
   * Get session statistics for a user
   */
  async getSessionStats(firebaseUid: string) {
    const [total, completed] = await Promise.all([
      Session.countDocuments({ firebaseUid }),
      Session.countDocuments({ firebaseUid, isCompleted: true }),
    ]);

    return {
      total,
      completed,
      pending: total - completed,
    };
  }
}
