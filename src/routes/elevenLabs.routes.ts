import { Router } from 'express';
import { verifyFirebaseToken, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/elevenlabs/agent-config:
 *   get:
 *     summary: Get ElevenLabs agent configuration
 *     description: Retrieve voice chat agent configuration including agent ID and features
 *     tags: [ElevenLabs]
 *     security:
 *       - FirebaseAuth: []
 *     responses:
 *       200:
 *         description: Agent configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     agentId:
 *                       type: string
 *                       description: ElevenLabs agent ID
 *                     features:
 *                       type: object
 *                       properties:
 *                         voiceChat:
 *                           type: boolean
 *                         maxSessionDuration:
 *                           type: number
 *                           description: Max session duration in seconds
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Agent not configured
 */
router.get('/agent-config', verifyFirebaseToken, async (req, res): Promise<void> => {
    try {
        const agentId = process.env.ELEVENLABS_AGENT_ID;

        if (!agentId) {
            console.error('❌ ElevenLabs agent ID not configured in environment');
            res.status(500).json({
                success: false,
                message: 'Voice chat service not available',
                error: 'AGENT_NOT_CONFIGURED'
            });
            return;
        }

        const authenticatedReq = req as AuthenticatedRequest;
        console.log(`🎤 User ${authenticatedReq.user?.uid} requested voice chat agent config`);

        res.set({
            'Cache-Control': 'private, max-age=3600',
            'X-Config-Generated': new Date().toISOString(),
        });

        res.json({
            success: true,
            data: {
                agentId: agentId,
                features: {
                    voiceChat: true,
                    maxSessionDuration: 30 * 60,
                }
            },
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('❌ Error getting ElevenLabs agent config:', error);
        res.status(500).json({
            success: false,
            message: "Failed to get voice chat configuration",
            error: "INTERNAL_SERVER_ERROR"
        });
    }
});

/**
 * @swagger
 * /api/elevenlabs/analytics:
 *   get:
 *     summary: Get voice chat analytics
 *     description: Retrieve analytics for voice chat sessions (Coming Soon)
 *     tags: [ElevenLabs]
 *     security:
 *       - FirebaseAuth: []
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSessions:
 *                       type: number
 *                     averageDuration:
 *                       type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/analytics', verifyFirebaseToken, async (req, res): Promise<void> => {
    res.json({
        success: true,
        data: {
            totalSessions: 0,
            averageDuration: 0,
        }
    });
});

export default router;