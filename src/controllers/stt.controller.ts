import { Request, Response } from 'express';
import { ElevenLabsAPI } from '../services/elevenlabs.service';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

/**
 * Convert speech to text using ElevenLabs STT API
 */
export const speechToText = async (req: MulterRequest, res: Response): Promise<void> => {
  try {
    console.log('🎤 Processing STT request...');
    console.log('📝 Request details:', {
      hasFile: !!req.file,
      body: req.body,
      headers: req.headers['content-type']
    });

    if (!req.file) {
      console.error('❌ No file received in request');
      res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
      return;
    }

    console.log('📄 File info:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferSize: req.file.buffer?.length || 0
    });

    if (!req.file.buffer || req.file.buffer.length === 0) {
      console.error('❌ Audio file is empty');
      res.status(400).json({
        success: false,
        error: 'Audio file is empty'
      });
      return;
    }

    // Convert speech to text using ElevenLabs
    const transcription = await ElevenLabsAPI.speechToText(req.file.buffer, req.file.mimetype);

    console.log('✅ STT successful:', transcription);

    res.json({
      success: true,
      transcription,
      confidence: 1.0 // ElevenLabs doesn't provide confidence scores
    });

  } catch (error: any) {
    console.error('❌ STT Error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Speech to text conversion failed'
    });
  }
};