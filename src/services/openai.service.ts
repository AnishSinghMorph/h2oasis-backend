import OpenAI from 'openai';

interface HealthData {
  // New unified format
  physical?: {
    steps?: number;
    calories_kcal?: number;
    distance_meters?: number;
    active_minutes?: number;
    heart_rate?: {
      min_bpm?: number;
      max_bpm?: number;
      avg_bpm?: number;
      resting_bpm?: number;
    };
  };
  sleep?: {
    duration_minutes?: number;
    efficiency_percentage?: number;
    deep_sleep_minutes?: number;
    rem_sleep_minutes?: number;
  };
  body?: {
    weight_kg?: number;
    bmi?: number;
  };
  lastSync?: string;
  source?: string;
  dataStatus?: 'available' | 'loading' | 'error' | 'no_data';
  note?: string;
  
  // Legacy fields
  calories?: number;
  hasBodyMetrics?: boolean;
  hasTraining?: boolean;
  error?: string;
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
      // Detect if user is asking for a plan
      const userMessage = context.userMessage.toLowerCase();
      const isPlanRequest = 
        userMessage.includes('plan') ||
        userMessage.includes('create') ||
        userMessage.includes('make') ||
        userMessage.includes('generate') ||
        userMessage.includes('personalized') ||
        userMessage.includes('routine') ||
        userMessage.includes('schedule');

      const systemPrompt = this.buildSystemPrompt(context, isPlanRequest);
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
        max_tokens: 150, // Increased for plan suggestions
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      let response = completion.choices[0]?.message?.content || 'I apologize, but I\'m having trouble generating a response right now. Please try again.';

      // If user asked for a plan, append special marker
      if (isPlanRequest) {
        response += '\n\n[ACTION:CREATE_PLAN]';
      }

      return response;
    } catch (error) {
      console.error('OpenAI Service Error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  private buildSystemPrompt(context: ChatContext, isPlanRequest: boolean = false): string {
  const { productContext, healthData } = context;
  
  const planInstructions = isPlanRequest ? `

PLAN GENERATION REQUEST DETECTED:
The user is asking for a personalized recovery plan. Respond with:
1. A brief acknowledgment (1 sentence)
2. Tell them you'll create a personalized plan based on their health data and ${productContext.productName}
3. Keep it under 2 sentences total

Example: "I'll create a personalized recovery plan based on your activity data and Cold Plunge. This will optimize your recovery and performance!"` : '';

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

IMPORTANT: Always keep responses very short (1-2 sentences only). No paragraphs.${planInstructions}

Remember: You're helping them optimize their recovery and wellness journey with their H2Oasis product. Keep it short!`;
}

  private buildUserPrompt(context: ChatContext): string {
    return `Based on my current health data and my ${context.productContext.productName}, here's my question: ${context.userMessage}`;
  }

  private formatHealthData(healthData: HealthData): string {
    const dataPoints = [];
    
    // Handle data status
    if (healthData.dataStatus === 'loading') {
      return 'Health data is currently being synced...';
    }
    
    if (healthData.dataStatus === 'error' || healthData.error) {
      return 'Health data sync failed - providing general recommendations';
    }
    
    if (healthData.dataStatus === 'no_data' || healthData.note) {
      return healthData.note || 'No health data available - connect a wearable device';
    }
    
    // Format physical data
    if (healthData.physical) {
      const p = healthData.physical;
      if (p.steps) dataPoints.push(`Steps: ${p.steps.toLocaleString()}`);
      if (p.calories_kcal) dataPoints.push(`Calories: ${p.calories_kcal} kcal`);
      if (p.distance_meters) dataPoints.push(`Distance: ${(p.distance_meters / 1000).toFixed(1)} km`);
      if (p.active_minutes) dataPoints.push(`Active: ${p.active_minutes} min`);
      if (p.heart_rate) {
        if (p.heart_rate.avg_bpm) dataPoints.push(`Avg HR: ${p.heart_rate.avg_bpm} bpm`);
        if (p.heart_rate.resting_bpm) dataPoints.push(`Resting HR: ${p.heart_rate.resting_bpm} bpm`);
      }
    }
    
    // Format sleep data
    if (healthData.sleep) {
      const s = healthData.sleep;
      if (s.duration_minutes) {
        const hours = (s.duration_minutes / 60).toFixed(1);
        dataPoints.push(`Sleep: ${hours} hours`);
      }
      if (s.efficiency_percentage) dataPoints.push(`Sleep Efficiency: ${s.efficiency_percentage}%`);
      if (s.deep_sleep_minutes) dataPoints.push(`Deep Sleep: ${s.deep_sleep_minutes} min`);
    }
    
    // Format body data
    if (healthData.body) {
      const b = healthData.body;
      if (b.weight_kg) dataPoints.push(`Weight: ${b.weight_kg} kg`);
      if (b.bmi) dataPoints.push(`BMI: ${b.bmi}`);
    }
    
    // Legacy support
    if (healthData.calories && !healthData.physical) {
      dataPoints.push(`Calories: ${healthData.calories}`);
    }
    
    if (healthData.lastSync) {
      const syncTime = new Date(healthData.lastSync);
      dataPoints.push(`Last sync: ${syncTime.toLocaleTimeString()}`);
    }
    
    if (healthData.source) {
      dataPoints.push(`Source: ${healthData.source}`);
    }

    return dataPoints.length > 0 ? dataPoints.join('\n') : 'No current health data available - providing general recovery advice';
  }

  async analyzeHealthTrends(healthData: HealthData[]): Promise<string> {
    // Future enhancement: analyze health trends over time
    return 'Health trend analysis coming soon';
  }

  async generateRecoveryPlan(context: ChatContext): Promise<any> {
    try {
      const { productContext, healthData } = context;

      const planPrompt = `Based on the following information, create a concise daily recovery plan:

PRODUCT: ${productContext.productName} (${productContext.productType})

HEALTH DATA:
${this.formatHealthData(healthData)}

Create a recovery plan with exactly 3 sessions for today. For each session:
- Keep title to 3-4 words max
- Duration: 2-5 minutes only
- Keep description to 1 short sentence

Return ONLY a JSON object in this exact format:
{
  "sessions": [
    {"title": "Morning Cold Plunge", "duration": "3 mins", "description": "Boost energy and reduce inflammation", "icon": "❄️"},
    {"title": "Afternoon Recovery", "duration": "5 mins", "description": "Enhance muscle repair", "icon": "🔥"},
    {"title": "Evening Relaxation", "duration": "4 mins", "description": "Improve sleep quality", "icon": "🌙"}
  ],
  "insights": {
    "heartRate": "90 Bpm",
    "sleepData": "9 Hour",
    "recommendation": "Your activity level suggests contrast therapy would be beneficial"
  }
}

NO explanations, JUST the JSON.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a recovery specialist. Respond ONLY with valid JSON. No markdown, no explanations.'
          },
          {
            role: 'user',
            content: planPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      
      // Clean up the response (remove markdown code blocks if present)
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      try {
        const plan = JSON.parse(cleanedResponse);
        
        // Extract health insights from health data
        const insights = {
          heartRate: healthData.physical?.heart_rate?.avg_bpm 
            ? `${healthData.physical.heart_rate.avg_bpm} Bpm`
            : plan.insights?.heartRate || 'N/A',
          sleepData: healthData.sleep?.duration_minutes
            ? `${(healthData.sleep.duration_minutes / 60).toFixed(0)} Hour`
            : plan.insights?.sleepData || 'N/A',
          recommendation: plan.insights?.recommendation || 'Personalized recovery plan based on your metrics'
        };

        return {
          sessions: plan.sessions || [],
          insights: insights,
          createdAt: new Date().toISOString(),
          productName: productContext.productName
        };
      } catch (parseError) {
        console.error('Failed to parse AI plan response:', parseError);
        console.error('Response was:', cleanedResponse);
        
        // Return fallback plan
        return this.getFallbackPlan(productContext, healthData);
      }
    } catch (error) {
      console.error('Generate Recovery Plan Error:', error);
      // Return fallback plan on error
      return this.getFallbackPlan(context.productContext, context.healthData);
    }
  }

  private getFallbackPlan(productContext: ProductContext, healthData: HealthData): any {
    const productType = productContext.productType;
    
    let sessions: any[] = [];
    
    if (productType === 'cold_plunge' || productType === 'recovery_suite') {
      sessions = [
        {
          title: "Morning Cold Plunge",
          duration: "3 mins",
          description: "Boost energy and mental clarity",
          icon: "❄️"
        },
        {
          title: "Post-Workout Recovery",
          duration: "4 mins",
          description: "Reduce inflammation and muscle soreness",
          icon: "💪"
        },
        {
          title: "Evening Wind Down",
          duration: "2 mins",
          description: "Improve sleep quality",
          icon: "🌙"
        }
      ];
    } else if (productType === 'hot_tub') {
      sessions = [
        {
          title: "Morning Warm-Up",
          duration: "5 mins",
          description: "Loosen muscles and increase flexibility",
          icon: "🔥"
        },
        {
          title: "Midday Stress Relief",
          duration: "4 mins",
          description: "Reduce tension and improve mood",
          icon: "🧘"
        }
      ];
    } else if (productType === 'sauna') {
      sessions = [
        {
          title: "Morning Detox",
          duration: "3 mins",
          description: "Boost metabolism and energy",
          icon: "🔥"
        },
        {
          title: "Evening Recovery",
          duration: "4 mins",
          description: "Deep muscle relaxation",
          icon: "🌙"
        }
      ];
    }

    return {
      sessions,
      insights: {
        heartRate: healthData.physical?.heart_rate?.avg_bpm 
          ? `${healthData.physical.heart_rate.avg_bpm} Bpm`
          : '90 Bpm',
        sleepData: healthData.sleep?.duration_minutes
          ? `${(healthData.sleep.duration_minutes / 60).toFixed(0)} Hour`
          : '8 Hour',
        recommendation: `Personalized ${productContext.productName} recovery plan`
      },
      createdAt: new Date().toISOString(),
      productName: productContext.productName
    };
  }
}