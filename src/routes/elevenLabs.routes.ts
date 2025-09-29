import { Router } from 'express';
import { verifyFirebaseToken, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

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