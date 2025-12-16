/**
 * H2Oasis AI Service
 * Simple wrapper to call the H2Oasis Chat API
 */

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface H2OasisChatRequest {
  stream: boolean;
  model: string;
  temperature: number;
  messages: ChatMessage[];
  tags: string[];
  goals: string[];
  mood: string;
  user_input: string;
  wearables: any;
  session_event?: string;
  createSession?: boolean;
}

// Session Types
export interface SessionStep {
  StepNumber: number;
  Activity: string;
  DurationMinutes: number;
  Instructions: string;
  Message: string;
  TimerStartMessage: string;
  TimerEndMessage: string;
}

export interface Session {
  SessionId: string;
  SessionName: string;
  TotalDurationMinutes: number;
  RecommendedFor: string;
  Steps: SessionStep[];
  StartMessage: string;
  CompletionMessage: string;
  Tips: string[];
  CreatedAt: string;
}

interface H2OasisChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  SoundData: null;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
}

export class H2OasisAIService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiUrl =
      process.env.H2OASIS_AI_URL ||
      "https://h2oasis.azurewebsites.net/api/h2oasisChat/PostAllCustomGPTAsync";
    this.apiKey = process.env.H2OASIS_AI_KEY || "";

    if (!this.apiKey) {
      console.warn("⚠️ H2OASIS_AI_KEY not configured in environment");
    }
  }

  /**
   * Send chat message to H2Oasis AI API
   */
  async sendMessage(
    userInput: string,
    chatHistory: ChatMessage[],
    wearablesData: any,
    options?: {
      tags?: string[];
      goals?: string[];
      mood?: string;
      isNewSession?: boolean;
    },
  ): Promise<string> {
    try {
      const payload: H2OasisChatRequest = {
        stream: false,
        model: "gpt-4o",
        temperature: 0,
        messages: chatHistory,
        tags: options?.tags || [],
        goals: options?.goals || [],
        mood: options?.mood || "",
        user_input: userInput,
        wearables: wearablesData,
        ...(options?.isNewSession && { session_event: "create" }),
      };

      console.log("📤 Sending request to H2Oasis AI API...");

      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ H2Oasis AI API Error:", errorText);
        throw new Error(
          `H2Oasis AI API returned ${response.status}: ${errorText}`,
        );
      }

      const data: H2OasisChatResponse = await response.json();

      console.log("✅ Received response from H2Oasis AI");

      // Extract assistant's response
      const assistantMessage = data.choices[0]?.message?.content;

      if (!assistantMessage) {
        throw new Error("No response content from H2Oasis AI");
      }

      return assistantMessage;
    } catch (error) {
      console.error("❌ H2Oasis AI Service Error:", error);
      throw error;
    }
  }

  /**
   * Create a guided wellness session
   * Uses session_event: "create" and createSession: true
   */
  async createSession(
    wearablesData: any,
    options: {
      tags: string[];
      goals?: string[];
      mood?: string;
      customPrompt?: string;
    },
  ): Promise<Session> {
    try {
      const { tags, goals = [], mood = "relaxed", customPrompt } = options;

      // Build the session creation prompt
      const devicesList = tags.join(", ").toLowerCase() || "spa";
      const goalsList =
        goals.length > 0 ? goals.join(", ") : "overall wellness";

      const prompt =
        customPrompt ||
        `Create a guided wellness session with these specifications:

• Devices to use: ${devicesList}
• Primary goal: ${goalsList}
• Desired mood: ${mood}

OUTPUT FORMAT RULES - STRICTLY FOLLOW:
1. Return ONLY valid JSON
2. Include session name, duration, steps, and tips
3. Each step should have activity, duration, instructions, and messages`;

      const payload: H2OasisChatRequest = {
        stream: false,
        model: "gpt-4o",
        temperature: 0,
        session_event: "create",
        createSession: true,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        tags,
        goals,
        mood,
        user_input: "Create a guided wellness session",
        wearables: wearablesData,
      };

      console.log("🧘 Creating session with H2Oasis AI API...");

      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ H2Oasis AI Session Error:", errorText);
        throw new Error(`Session creation failed: ${response.status}`);
      }

      const data: H2OasisChatResponse = await response.json();
      const sessionContent = data.choices[0]?.message?.content;

      if (!sessionContent) {
        throw new Error("No session content in API response");
      }

      // Parse the JSON session
      let session: Session;
      try {
        session = JSON.parse(sessionContent);
      } catch (parseError) {
        console.error("Failed to parse session JSON:", sessionContent);
        throw new Error("Invalid session format from API");
      }

      console.log("🎉 Session created:", session.SessionName);
      return session;
    } catch (error) {
      console.error("❌ Session creation error:", error);
      throw error;
    }
  }
}
