import { Request, Response } from "express";
import { SessionService } from "../services/session.service";
import { ISessionStep } from "../models/Session.model";

export class SessionController {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }

  /**
   * POST /api/sessions
   * Save a new session (typically from AI generation)
   */
  saveSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const firebaseUid = req.headers["x-firebase-uid"] as string;

      if (!firebaseUid) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const {
        sessionId,
        SessionName,
        TotalDurationMinutes,
        RecommendedFor,
        Steps,
        Tips,
        StartMessage,
        CompletionMessage,
      } = req.body;

      // Validate required fields
      if (
        !SessionName ||
        !TotalDurationMinutes ||
        !RecommendedFor ||
        !Steps ||
        !Array.isArray(Steps) ||
        !Tips ||
        !Array.isArray(Tips) ||
        !StartMessage ||
        !CompletionMessage
      ) {
        res.status(400).json({
          success: false,
          error: "Missing required session fields",
        });
        return;
      }

      const session = await this.sessionService.saveSession({
        sessionId,
        firebaseUid,
        SessionName,
        TotalDurationMinutes,
        RecommendedFor,
        Steps: Steps as ISessionStep[],
        Tips,
        StartMessage,
        CompletionMessage,
      });

      res.status(201).json({
        success: true,
        session,
      });
    } catch (error: any) {
      console.error("❌ Error saving session:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to save session",
      });
    }
  };

  /**
   * GET /api/sessions
   * Get all sessions for the authenticated user
   * Query params: ?favorited=true, ?completed=false
   */
  getSessions = async (req: Request, res: Response): Promise<void> => {
    try {
      const firebaseUid = req.headers["x-firebase-uid"] as string;

      if (!firebaseUid) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      // Parse query filters
      const filters: any = { firebaseUid };

      if (req.query.completed !== undefined) {
        filters.isCompleted = req.query.completed === "true";
      }

      const sessions = await this.sessionService.getUserSessions(filters);

      res.status(200).json({
        success: true,
        sessions,
        count: sessions.length,
      });
    } catch (error: any) {
      console.error("❌ Error fetching sessions:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch sessions",
      });
    }
  };

  /**
   * GET /api/sessions/:sessionId
   * Get a single session by ID
   */
  getSessionById = async (req: Request, res: Response): Promise<void> => {
    try {
      const firebaseUid = req.headers["x-firebase-uid"] as string;
      const { sessionId } = req.params;

      if (!firebaseUid) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const session = await this.sessionService.getSessionById(
        sessionId,
        firebaseUid,
      );

      if (!session) {
        res.status(404).json({
          success: false,
          error: "Session not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        session,
      });
    } catch (error: any) {
      console.error("❌ Error fetching session:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch session",
      });
    }
  };

  /**
   * PATCH /api/sessions/:sessionId
   * Update a session (edit timers, favorite, mark complete)
   */
  updateSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const firebaseUid = req.headers["x-firebase-uid"] as string;
      const { sessionId } = req.params;

      if (!firebaseUid) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      // Extract allowed update fields
      const allowedUpdates = [
        "SessionName",
        "TotalDurationMinutes",
        "RecommendedFor",
        "Steps",
        "Tips",
        "StartMessage",
        "CompletionMessage",
        "isCompleted",
      ];

      const updates: any = {};
      for (const key of allowedUpdates) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          error: "No valid update fields provided",
        });
        return;
      }

      const session = await this.sessionService.updateSession(
        sessionId,
        firebaseUid,
        updates,
      );

      if (!session) {
        res.status(404).json({
          success: false,
          error: "Session not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        session,
      });
    } catch (error: any) {
      console.error("❌ Error updating session:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update session",
      });
    }
  };

  /**
   * DELETE /api/sessions/:sessionId
   * Delete a session
   */
  deleteSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const firebaseUid = req.headers["x-firebase-uid"] as string;
      const { sessionId } = req.params;

      if (!firebaseUid) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const deleted = await this.sessionService.deleteSession(
        sessionId,
        firebaseUid,
      );

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: "Session not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Session deleted successfully",
      });
    } catch (error: any) {
      console.error("❌ Error deleting session:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete session",
      });
    }
  };

  /**
   * GET /api/sessions/stats
   * Get session statistics for the user
   */
  getSessionStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const firebaseUid = req.headers["x-firebase-uid"] as string;

      if (!firebaseUid) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const stats = await this.sessionService.getSessionStats(firebaseUid);

      res.status(200).json({
        success: true,
        stats,
      });
    } catch (error: any) {
      console.error("❌ Error fetching session stats:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch session stats",
      });
    }
  };
}
