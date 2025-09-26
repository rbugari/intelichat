const express = require('express');
const { promptsController } = require('../controllers');
const { validate } = require('../validators/schemas');
const { asyncHandler, requestLogger } = require('../middleware/errorHandler');
const minimalAuth = require('../middleware/minimalAuth');

const router = express.Router();

// Apply minimal authentication middleware to all routes
router.use(minimalAuth.authenticate);

// Apply request logging middleware AFTER authentication
router.use(requestLogger);

/**
 * @route GET /api/prompts
 * @desc Get all prompts with pagination and filtering
 * @access Private
 */
router.get('/', 
  validate('paginationQuery'),
  asyncHandler(promptsController.getPrompts.bind(promptsController))
);

/**
 * @route GET /api/prompts/categories
 * @desc Get prompt categories
 * @access Private
 */
router.get('/categories',
  asyncHandler(promptsController.getPromptCategories.bind(promptsController))
);

/**
 * @route GET /api/prompts/stats
 * @desc Get prompt statistics
 * @access Private
 */
router.get('/stats',
  asyncHandler(promptsController.getPromptStats.bind(promptsController))
);

/**
 * @route GET /api/prompts/:id
 * @desc Get single prompt by ID
 * @access Private
 */
router.get('/:id',
  asyncHandler(promptsController.getPromptById.bind(promptsController))
);

/**
 * @route POST /api/prompts
 * @desc Create new prompt
 * @access Private
 */
router.post('/',
  validate('createPrompt'),
  asyncHandler(promptsController.createPrompt.bind(promptsController))
);

/**
 * @route PUT /api/prompts/:id
 * @desc Update prompt
 * @access Private
 */
router.put('/:id',
  validate('updatePrompt'),
  asyncHandler(promptsController.updatePrompt.bind(promptsController))
);

/**
 * @route DELETE /api/prompts/:id
 * @desc Delete prompt (soft delete)
 * @access Private
 */
router.delete('/:id',
  asyncHandler(promptsController.deletePrompt.bind(promptsController))
);

/**
 * @route POST /api/prompts/:id/preview
 * @desc Preview prompt with variable substitution
 * @access Private
 */
router.post('/:id/preview',
  asyncHandler(promptsController.previewPrompt.bind(promptsController))
);

/**
 * @route POST /api/prompts/:id/duplicate
 * @desc Duplicate prompt
 * @access Private
 */
router.post('/:id/duplicate',
  asyncHandler(promptsController.duplicatePrompt.bind(promptsController))
);

/**
 * @route GET /api/prompts/:id/agents
 * @desc Get agents using this prompt
 * @access Private
 */
// router.get('/:id/agents',
//   validate('paginationQuery'),
//   asyncHandler(promptsController.getPromptAgents.bind(promptsController))
// );

/**
 * @route POST /api/prompts/:id/activate
 * @desc Activate prompt
 * @access Private
 */
// router.post('/:id/activate',
//   asyncHandler(promptsController.activatePrompt.bind(promptsController))
// );

/**
 * @route POST /api/prompts/:id/deactivate
 * @desc Deactivate prompt
 * @access Private
 */
// router.post('/:id/deactivate',
//   asyncHandler(promptsController.deactivatePrompt.bind(promptsController))
// );

/**
 * @route POST /api/prompts/validate
 * @desc Validate prompt content and variables
 * @access Private
 */
router.post('/validate',
  validate('createPrompt'),
  asyncHandler(promptsController.validatePrompt.bind(promptsController))
);

/**
 * @route POST /api/prompts/preview-multilang
 * @desc Preview multi-language prompt with variables
 * @access Private
 */
router.post('/preview-multilang',
  asyncHandler(promptsController.previewMultiLanguagePrompt.bind(promptsController))
);

/**
 * @route POST /api/prompts/agent-prompts
 * @desc Create agent prompt (multi-language support)
 * @access Private
 */
router.post('/agent-prompts',
  asyncHandler(promptsController.createAgentPrompt.bind(promptsController))
);

/**
 * @route PUT /api/prompts/agent-prompts/:id
 * @desc Update agent prompt
 * @access Private
 */
router.put('/agent-prompts/:id',
  asyncHandler(promptsController.updateAgentPrompt.bind(promptsController))
);

/**
 * @route DELETE /api/prompts/agent-prompts/:id
 * @desc Delete agent prompt
 * @access Private
 */
router.delete('/agent-prompts/:id',
  asyncHandler(promptsController.deleteAgentPrompt.bind(promptsController))
);

/**
 * @route GET /api/prompts/:id/usage
 * @desc Get prompt usage statistics
 * @access Private
 */
// router.get('/:id/usage',
//   asyncHandler(promptsController.getPromptUsage.bind(promptsController))
// );

/**
 * @route POST /api/prompts/:id/test
 * @desc Test prompt with sample data
 * @access Private
 */
// router.post('/:id/test',
//   asyncHandler(promptsController.testPrompt.bind(promptsController))
// );

module.exports = router;