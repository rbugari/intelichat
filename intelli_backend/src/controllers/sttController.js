const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { AppError } = require('../middleware/errorHandler');

// Initialize OpenAI client with error handling
let openai = null;
try {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') {
    console.warn('⚠️  WARNING: OPENAI_API_KEY not configured. STT functionality will be disabled.');
  } else {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('✅ OpenAI client initialized successfully for STT.');
  }
} catch (error) {
  console.error('❌ Failed to initialize OpenAI client for STT:', error.message);
}

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

class STTController {
  /**
   * @desc    Transcribe audio to text
   * @route   POST /api/stt/transcribe
   * @access  Private
   */
  async transcribe(req, res, next) {
    // Check if OpenAI client is available
    if (!openai) {
      return next(new AppError('Speech-to-text service is not available. OPENAI_API_KEY is not configured.', 503));
    }

    const sttProvider = process.env.STT_PROVIDER;

    if (sttProvider !== 'openai') {
      return next(new AppError('Speech-to-text service is not configured or not supported.', 501));
    }

    if (!req.file) {
      return next(new AppError('No audio file was uploaded.', 400));
    }

    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const fileExtension = path.extname(req.file.originalname) || '.webm';
    const tempPath = path.join(UPLOADS_DIR, `temp_audio_${Date.now()}${fileExtension}`);

    try {
      fs.writeFileSync(tempPath, req.file.buffer);
      const readStream = fs.createReadStream(tempPath);

      const transcription = await openai.audio.transcriptions.create({
        file: readStream,
        model: 'whisper-1',
      });

      res.status(200).json({
        success: true,
        data: {
          text: transcription.text,
        },
      });

    } catch (error) {
      console.error('OpenAI API Error:', error);
      return next(new AppError('Failed to transcribe audio.', 500));
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }
}

module.exports = STTController;