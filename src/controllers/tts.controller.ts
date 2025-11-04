import { Request, Response } from "express";
import { ttsService, PERSONA_VOICES } from "../services/tts.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import path from "path";
import fs from "fs";

export class TTSController {
  /**
   * Convert text to speech
   */
  static async textToSpeech(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { text, voiceKey, speed } = req.body;

      // Validation
      if (!text || typeof text !== "string") {
        res.status(400).json({
          success: false,
          error: "Text is required and must be a string",
        });
        return;
      }

      if (text.length > 5000) {
        res.status(400).json({
          success: false,
          error: "Text too long. Maximum 5000 characters allowed.",
        });
        return;
      }

      // Get voice ID
      const voice = ttsService.getVoiceById(voiceKey || "alice");
      if (!voice) {
        res.status(400).json({
          success: false,
          error: "Invalid voice selection",
        });
        return;
      }

      console.log(`🎤 TTS request from user ${req.user.uid}:`, {
        textLength: text.length,
        voice: voice.name,
      });

      // Generate TTS
      const result = await ttsService.textToSpeech({
        text,
        voiceId: voice.id,
        speed: speed || 1.0,
      });

      if (result.success) {
        res.json({
          success: true,
          audioUrl: result.audioUrl,
          voice: voice.name,
          textLength: text.length,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "TTS generation failed",
        });
      }
    } catch (error) {
      console.error("TTS Controller Error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }

  /**
   * Get available voices
   */
  static async getVoices(req: Request, res: Response): Promise<void> {
    try {
      const voices = ttsService.getAvailableVoices();

      res.json({
        success: true,
        voices: voices.map((voice) => ({
          key: Object.keys(PERSONA_VOICES).find(
            (key) =>
              PERSONA_VOICES[key as keyof typeof PERSONA_VOICES].id ===
              voice.id,
          ),
          id: voice.id,
          name: voice.name,
          subtitle: voice.subtitle,
          description: voice.description,
          gender: voice.gender,
          accent: voice.accent,
        })),
      });
    } catch (error) {
      console.error("Get Voices Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get voices",
      });
    }
  }

  /**
   * Serve audio files
   */
  static async serveAudio(req: Request, res: Response): Promise<void> {
    try {
      const { fileName } = req.params;

      // Validate filename (security)
      if (!fileName || !/^tts_\d+_[a-z0-9]+\.mp3$/.test(fileName)) {
        res.status(400).json({
          success: false,
          error: "Invalid audio file name",
        });
        return;
      }

      const filePath = ttsService.getAudioFilePath(fileName);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        res.status(404).json({
          success: false,
          error: "Audio file not found",
        });
        return;
      }

      // Set headers for audio streaming
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

      // Stream the audio file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (error) {
      console.error("Serve Audio Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to serve audio file",
      });
    }
  }

  /**
   * Preview voice with sample text
   */
  static async previewVoice(req: Request, res: Response): Promise<void> {
    try {
      const { voiceKey } = req.params;

      const voice = ttsService.getVoiceById(voiceKey);
      if (!voice) {
        res.status(400).json({
          success: false,
          error: "Invalid voice selection",
        });
        return;
      }

      const sampleText =
        "Hi! I'm your H2Oasis recovery specialist. I'm here to help you optimize your wellness journey with personalized guidance.";

      const result = await ttsService.textToSpeech({
        text: sampleText,
        voiceId: voice.id,
      });

      if (result.success) {
        res.json({
          success: true,
          audioUrl: result.audioUrl,
          voice: voice.name,
          sampleText,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Voice preview failed",
        });
      }
    } catch (error) {
      console.error("Preview Voice Error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
      });
    }
  }
}
