import OpenAI from 'openai';

interface HealthData {
  calories?: number;
  hasBodyMetrics?: boolean;
  hasTraining?: boolean;
  lastSync?: string;
  dataStatus?: 'available' | 'loading' | 'error' | 'no_permissions';
  note?: string;
  error?: string;
  // Legacy fields for backward compatibility
  steps?: number;
  heartRate?: number;
  sleepHours?: number;
  activeMinutes?: number;
  restingHeartRate?: number;
  hrv?: number;
  bodyTemperature?: number;
  bloodOxygen?: number;
  stressLevel?: number;
}

interface ProductContext {
  productName: string;
  productType: 'cold_plunge' | 'hot_tub' | 'sauna' | 'recovery_suite';
  features?: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatContext {
  healthData: HealthData;
  productContext: ProductContext;
  userMessage: string;
  chatHistory?: ChatMessage[];
  userId: string;
}

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateResponse(context: ChatContext): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(context);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];

      // Add chat history if available
      if (context.chatHistory && context.chatHistory.length > 0) {
        const historyMessages = context.chatHistory.slice(-10).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
        messages.push(...historyMessages);
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: userPrompt
      });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        max_tokens: 50,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      return completion.choices[0]?.message?.content || 'I apologize, but I\'m having trouble generating a response right now. Please try again.';
    } catch (error) {
      console.error('OpenAI Service Error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  private buildSystemPrompt(context: ChatContext): string {
  const { productContext, healthData } = context;
  
  return `You are Evy, an expert AI health recovery specialist with deep knowledge in contrast therapy, specifically cold plunge, hot tubs, saunas, and recovery protocols. You work for H2Oasis, a company that creates premium recovery products.

EXPERTISE AREAS:
- Cold water therapy and cold plunge protocols
- Heat therapy including saunas and hot tubs
- Contrast therapy (alternating hot/cold)
- Recovery optimization and muscle repair
- Sleep enhancement through temperature therapy
- Stress reduction and mental wellness
- Athletic performance and recovery
- Cardiovascular health benefits
- Hormone optimization through temperature exposure

USER'S PRODUCT: ${productContext.productName} (${productContext.productType})
${productContext.features ? `Features: ${productContext.features.join(', ')}` : ''}

CURRENT HEALTH DATA:
${this.formatHealthData(healthData)}

PERSONALITY & STYLE:
- Keep responses to 1-2 sentences maximum
- Be direct and actionable
- Use the user's health data to personalize recommendations

GUIDELINES:
1. Keep responses to 1-2 sentences maximum
2. Be direct and actionable  
3. Use health data for personalized advice
4. Always prioritize safety

IMPORTANT: Always keep responses very short (1 sentence only). No paragraphs.

Remember: You're helping them optimize their recovery and wellness journey with their H2Oasis product. Keep it short!`;
}

  private buildUserPrompt(context: ChatContext): string {
    return `Based on my current health data and my ${context.productContext.productName}, here's my question: ${context.userMessage}`;
  }

  private formatHealthData(healthData: HealthData): string {
    const dataPoints = [];
    
    // Handle new data format
    if (healthData.dataStatus === 'loading') {
      return 'Health data is currently being synced from Apple Health...';
    }
    
    if (healthData.dataStatus === 'error' || healthData.error) {
      return 'Health data sync failed - providing general recommendations';
    }
    
    if (healthData.dataStatus === 'no_permissions' || healthData.note) {
      return 'No health data permissions - check Apple Health settings for personalized advice';
    }
    
    // Format available data
    if (healthData.calories !== undefined) {
      if (healthData.calories > 0) {
        dataPoints.push(`Calories burned today: ${healthData.calories}`);
      } else {
        dataPoints.push('No calorie data available today');
      }
    }
    
    if (healthData.hasBodyMetrics) dataPoints.push('Body metrics available');
    if (healthData.hasTraining) dataPoints.push('Training data available');
    
    if (healthData.lastSync) {
      const syncTime = new Date(healthData.lastSync);
      dataPoints.push(`Last sync: ${syncTime.toLocaleTimeString()}`);
    }
    
    // Legacy fields for backward compatibility
    if (healthData.steps) dataPoints.push(`Steps: ${healthData.steps.toLocaleString()}`);
    if (healthData.heartRate) dataPoints.push(`Current Heart Rate: ${healthData.heartRate} bpm`);
    if (healthData.restingHeartRate) dataPoints.push(`Resting Heart Rate: ${healthData.restingHeartRate} bpm`);
    if (healthData.sleepHours) dataPoints.push(`Sleep: ${healthData.sleepHours} hours`);
    if (healthData.activeMinutes) dataPoints.push(`Active minutes: ${healthData.activeMinutes}`);
    if (healthData.hrv) dataPoints.push(`HRV: ${healthData.hrv}ms`);
    if (healthData.stressLevel) dataPoints.push(`Stress level: ${healthData.stressLevel}/10`);
    if (healthData.bloodOxygen) dataPoints.push(`Blood oxygen: ${healthData.bloodOxygen}%`);

    return dataPoints.length > 0 ? dataPoints.join('\n') : 'No current health data available - providing general recovery advice';
  }

  async analyzeHealthTrends(healthData: HealthData[]): Promise<string> {
    // Future enhancement: analyze health trends over time
    return 'Health trend analysis coming soon';
  }
}