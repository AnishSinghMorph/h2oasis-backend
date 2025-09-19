import { Router, Request, Response } from 'express';
import { ChatController } from '../controllers/chat.controller';

const router = Router();
const chatController = new ChatController();

// POST /api/chat/message - Send a message to AI with health context
router.post('/message', async (req: Request, res: Response) => {
  await chatController.sendMessage(req as any, res);
});

// GET /api/chat/health-context/:userId - Get user's health data for context
router.get('/health-context/:userId', async (req: Request, res: Response) => {
  await chatController.getHealthContext(req, res);
});

// POST /api/chat/history/:userId - Get chat history for a user (future feature)
router.get('/history/:userId', async (req: Request, res: Response) => {
  // TODO: Implement chat history retrieval
  res.json({
    success: true,
    history: [],
    message: 'Chat history feature coming soon'
  });
});

// DELETE /api/chat/history/:userId - Clear chat history (future feature)
router.delete('/history/:userId', async (req: Request, res: Response) => {
  // TODO: Implement chat history clearing
  res.json({
    success: true,
    message: 'Chat history cleared'
  });
});

export default router;