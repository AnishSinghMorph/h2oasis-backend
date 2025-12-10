import fetch from "node-fetch";
import fs from "fs";
import path from "path";

interface TTSOptions {
  text: string;
  voiceId: string;
  speed?: number;
  pitch?: number;
}

interface TTSResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

// ElevenLabs Configuration
const ELEVENLABS_CONFIG = {
  API_KEY: process.env.ELEVENLABS_API_KEY,
  BASE_URL: "https://api.elevenlabs.io/v1",
  MODEL_ID: "eleven_multilingual_v2",

  VOICE_SETTINGS: {
    stability: 0.75,
    similarity_boost: 0.85,
    style: 0.5,
    use_speaker_boost: true,
  },
};

// Available persona voices
export const PERSONA_VOICES = {
  emily: {
    key: "emily",
    id: process.env.ELEVENLABS_VOICE_LENA || "Xb7hH8MSUJpSbSDYk0k2",
    name: "Emily",
    subtitle: "Calm, Soothing",
    description: "Soothing, intelligent guidance to relax your mind and ease your day.",
    gender: "female",
    accent: "american",
  },
  kai: {
    key: "kai",
    id: process.env.ELEVENLABS_VOICE_ARJUN || "pqHfZKP75CvOlQylNhV4",
    name: "Kai",
    subtitle: "Motivational",
    description: "High-energy, results-focused coaching to push your limits and maximize every session.",
    gender: "male",
    accent: "american",
  },
};

export class TTSService {
  private static instance: TTSService;
  private audioDirectory: string;

  private constructor() {
    // Create audio directory if it doesn't exist
    this.audioDirectory = path.join(process.cwd(), "uploads", "audio");
    if (!fs.existsSync(this.audioDirectory)) {
      fs.mkdirSync(this.audioDirectory, { recursive: true });
    }
  }

  public static getInstance(): TTSService {
    if (!TTSService.instance) {
      TTSService.instance = new TTSService();
    }
    return TTSService.instance;
  }

  /**
   * Convert text to speech using ElevenLabs API
   */
  async textToSpeech(options: TTSOptions): Promise<TTSResponse> {
    try {
      if (!ELEVENLABS_CONFIG.API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }

      console.log("🎤 Converting text to speech:", {
        text: options.text.substring(0, 50) + "...",
        voiceId: options.voiceId,
      });

      const response = await fetch(
        `${ELEVENLABS_CONFIG.BASE_URL}/text-to-speech/${options.voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_CONFIG.API_KEY,
          },
          body: JSON.stringify({
            text: options.text,
            model_id: ELEVENLABS_CONFIG.MODEL_ID,
            voice_settings: {
              ...ELEVENLABS_CONFIG.VOICE_SETTINGS,
              speed: options.speed || 1.0,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `ElevenLabs API error: ${response.status} ${response.statusText}`,
        );
      }

      // Save audio file to server
      const audioBuffer = await response.buffer();
      const fileName = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
      const filePath = path.join(this.audioDirectory, fileName);

      fs.writeFileSync(filePath, audioBuffer);

      // Return URL where frontend can access the audio
      const audioUrl = `/api/tts/audio/${fileName}`;

      console.log("✅ TTS audio generated successfully:", fileName);
      return {
        success: true,
        audioUrl,
      };
    } catch (error) {
      console.error("❌ TTS Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown TTS error",
      };
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices() {
    return Object.values(PERSONA_VOICES);
  }

  /**
   * Get voice by key
   */
  getVoiceById(voiceKey: string) {
    return PERSONA_VOICES[voiceKey as keyof typeof PERSONA_VOICES];
  }

  /**
   * Cleanup old audio files (run periodically)
   */
  async cleanupOldFiles(maxAgeHours: number = 24) {
    try {
      const files = fs.readdirSync(this.audioDirectory);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds

      for (const file of files) {
        const filePath = path.join(this.audioDirectory, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Cleaned up old audio file: ${file}`);
        }
      }
    } catch (error) {
      console.error("Error cleaning up audio files:", error);
    }
  }

  /**
   * Get file path for serving
   */
  getAudioFilePath(fileName: string): string {
    return path.join(this.audioDirectory, fileName);
  }
}

// Export singleton instance
export const ttsService = TTSService.getInstance();
