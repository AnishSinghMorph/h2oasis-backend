import { Request, Response } from 'express';
import { OpenAIService } from '../services/openai.service';

export class ChatController {
  private openAIService: OpenAIService;

  constructor() {
    this.openAIService = new OpenAIService();
  }

  sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { message, userId, healthData, productContext, chatHistory } = req.body;

      // Validate required fields
      if (!message || !userId) {
        res.status(400).json({
          error: 'Message and userId are required'
        });
        return;
      }

      // Default product context if not provided
      const defaultProductContext = {
        productName: 'H2Oasis Recovery System',
        productType: 'recovery_suite' as const,
        features: ['Cold Plunge', 'Hot Tub', 'Sauna']
      };

      // Convert chat history timestamps
      const formattedChatHistory = chatHistory?.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      }));

      // Build context for OpenAI
      const context = {
        healthData: healthData || {},
        productContext: productContext || defaultProductContext,
        userMessage: message,
        chatHistory: formattedChatHistory,
        userId
      };

      // Generate AI response
      const aiResponse = await this.openAIService.generateResponse(context);

      // Save chat message to database (implement this later)
      // await this.saveChatMessage(userId, message, aiResponse);

      res.json({
        success: true,
        response: aiResponse,
        timestamp: new Date().toISOString(),
        context: {
          healthDataReceived: !!healthData,
          productContext: context.productContext
        }
      });

    } catch (error) {
      console.error('Chat controller error:', error);
      res.status(500).json({
        error: 'Failed to process chat message',
        message: 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.'
      });
    }
  };

  getHealthContext = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          error: 'userId is required'
        });
        return;
      }

      // TODO: Integrate with ROOK API to fetch real health data
      // For now, return mock data structure
      const mockHealthData = {
        steps: 8500,
        heartRate: 72,
        restingHeartRate: 58,
        sleepHours: 7.5,
        calories: 2200,
        activeMinutes: 45,
        hrv: 42,
        stressLevel: 3,
        bloodOxygen: 98,
        lastUpdated: new Date().toISOString()
      };

      res.json({
        success: true,
        healthData: mockHealthData,
        userId
      });

    } catch (error) {
      console.error('Health context error:', error);
      res.status(500).json({
        error: 'Failed to fetch health context'
      });
    }
  };

  // Future method to save chat history
  private async saveChatMessage(userId: string, userMessage: string, aiResponse: string): Promise<void> {
    // TODO: Implement database storage for chat history
    console.log(`Saving chat for user ${userId}: ${userMessage} -> ${aiResponse}`);
  }
}