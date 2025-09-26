const express = require('express');
const editorController = require('../controllers/editorController');
const { asyncHandler } = require('../middleware/errorHandler');
const minimalAuth = require('../middleware/minimalAuth');

const router = express.Router();

// Apply minimal authentication middleware to all routes
router.use(minimalAuth.authenticate);

/**
 * @route GET /api/editor/config
 * @desc Get configuration for the prompt editor
 * @access Private
 */
router.get('/config', asyncHandler(editorController.getConfig));

module.exports = router;
