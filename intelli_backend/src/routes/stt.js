const express = require('express');
const multer = require('multer');
const STTController = require('../controllers/sttController');
const minimalAuth = require('../middleware/minimalAuth');
const { AppError, asyncHandler } = require('../middleware/errorHandler'); // <-- Importación corregida

const router = express.Router();
const sttController = new STTController();

// Configure Multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB file size limit (OpenAI's limit)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file type. Only audio files are allowed.', 400), false);
    }
  },
});

/**
 * @route   POST /api/stt/transcribe
 * @desc    Transcribe audio to text using the configured provider.
 * @access  Private (Requires authentication)
 */
router.post(
  '/transcribe',
  minimalAuth.authenticate,
  upload.single('audio'),
  asyncHandler(sttController.transcribe.bind(sttController)) // <-- Uso corregido
);

module.exports = router;