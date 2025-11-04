import fetch from "node-fetch";
import FormData from "form-data";

// ElevenLabs Configuration
const ELEVENLABS_CONFIG = {
  API_KEY: process.env.ELEVENLABS_API_KEY,
  BASE_URL: "https://api.elevenlabs.io/v1",
};

export class ElevenLabsAPI {
  /**
   * Convert speech to text using ElevenLabs STT API
   */
  static async speechToText(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    try {
      if (!ELEVENLABS_CONFIG.API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }

      console.log("🎤 Sending audio to ElevenLabs STT API...");
      console.log("📄 Audio info:", { size: audioBuffer.length, mimeType });

      // Create form data for the audio file
      const formData = new FormData();

      // Determine file extension from mime type
      const extension =
        mimeType.includes("mp4") || mimeType.includes("m4a")
          ? "m4a"
          : mimeType.includes("webm")
            ? "webm"
            : mimeType.includes("wav")
              ? "wav"
              : "mp3";

      formData.append("file", audioBuffer, {
        filename: `audio.${extension}`,
        contentType: mimeType,
      });

      // Add required model_id parameter (required by ElevenLabs STT API)
      formData.append("model_id", "scribe_v1");

      // Force English language detection
      formData.append("language", "en");

      // ElevenLabs STT API endpoint
      const response = await fetch(
        `${ELEVENLABS_CONFIG.BASE_URL}/speech-to-text`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_CONFIG.API_KEY,
            ...formData.getHeaders(),
          },
          body: formData,
        },
      );

      console.log("📡 STT Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ElevenLabs STT Error Response:", errorText);
        throw new Error(
          `ElevenLabs STT API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = (await response.json()) as any;
      console.log("✅ STT Response:", result);

      // ElevenLabs returns the transcription in different possible fields
      const transcription =
        result.text || result.transcription || result.transcript || "";

      if (!transcription) {
        throw new Error("No transcription received from ElevenLabs STT API");
      }

      return transcription.trim();
    } catch (error: any) {
      console.error("❌ ElevenLabs STT Error:", error);

      // Provide more helpful error messages
      if (error?.message?.includes("ECONNRESET")) {
        throw new Error(
          "Network connection error. Please check your internet connection and try again.",
        );
      } else if (error?.message?.includes("timeout")) {
        throw new Error(
          "Request timeout. Please try with a shorter audio recording.",
        );
      } else if (error?.message?.includes("401")) {
        throw new Error(
          "Invalid ElevenLabs API key. Please check your configuration.",
        );
      } else if (error?.message?.includes("413")) {
        throw new Error(
          "Audio file too large. Please try with a shorter recording.",
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Get available voices from ElevenLabs
   */
  static async getVoices(): Promise<any[]> {
    try {
      if (!ELEVENLABS_CONFIG.API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }

      const response = await fetch(`${ELEVENLABS_CONFIG.BASE_URL}/voices`, {
        headers: {
          "xi-api-key": ELEVENLABS_CONFIG.API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(
          `ElevenLabs API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = (await response.json()) as any;
      return result.voices || [];
    } catch (error) {
      console.error("❌ ElevenLabs Voices Error:", error);
      throw error;
    }
  }
}
