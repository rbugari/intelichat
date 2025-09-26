const express = require('express');
const { llmsController } = require('../controllers');
const { validate } = require('../validators/schemas');
const { asyncHandler, requestLogger } = require('../middleware/errorHandler');
const minimalAuth = require('../middleware/minimalAuth');
const { SECURITY_SETTINGS } = require('../config/security');

const router = express.Router();

// Apply minimal authentication middleware to all routes
router.use(minimalAuth.authenticate);

// Apply request logging middleware AFTER authentication
router.use(requestLogger);

/**
 * @route GET /api/llms
 * @desc Get all LLMs with pagination and filtering
 * @access Private
 */
router.get('/', 
  validate('paginationQuery'),
  asyncHandler(llmsController.getLLMs.bind(llmsController))
);

/**
 * @route GET /api/llms/providers
 * @desc Get available LLM providers
 * @access Private
 */
router.get('/providers',
  asyncHandler(llmsController.getLLMProviders.bind(llmsController))
);

/**
 * @route GET /api/llms/stats
 * @desc Get LLM statistics
 * @access Private
 */
router.get('/stats',
  asyncHandler(llmsController.getLLMStats.bind(llmsController))
);

/**
 * @route GET /api/llms/:id
 * @desc Get single LLM by ID
 * @access Private
 */
router.get('/:id',
  asyncHandler(llmsController.getLLMById.bind(llmsController))
);

/**
 * @route POST /api/llms
 * @desc Create new LLM
 * @access Private (Admin only)
 */
router.post('/',
  minimalAuth.requireAdmin,
  validate('createLLM'),
  asyncHandler(llmsController.createLLM.bind(llmsController))
);

/**
 * @route PUT /api/llms/:id
 * @desc Update LLM
 * @access Private (Admin only)
 */
router.put('/:id',
  minimalAuth.requireAdmin,
  validate('updateLLM'),
  asyncHandler(llmsController.updateLLM.bind(llmsController))
);

/**
 * @route DELETE /api/llms/:id
 * @desc Delete LLM (soft delete)
 * @access Private (Admin only)
 */
router.delete('/:id',
  minimalAuth.requireAdmin,
  asyncHandler(llmsController.deleteLLM.bind(llmsController))
);

/**
 * @route POST /api/llms/:id/test
 * @desc Test LLM connection
 * @access Private (Admin only)
 */
router.post('/:id/test',
  minimalAuth.requireAdmin,
  asyncHandler(llmsController.testLLM.bind(llmsController))
);

/**
 * @route PUT /api/llms/:id/credentials
 * @desc Update LLM credentials only
 * @access Private (Admin only)
 */
router.put('/:id/credentials',
  minimalAuth.requireAdmin,
  validate('updateLLMCredentials'),
  asyncHandler(llmsController.updateCredentials.bind(llmsController))
);

/**
 * @route GET /api/llms/:id/agents
 * @desc Get agents using this LLM
 * @access Private
 */
// router.get('/:id/agents',
//   validate('paginationQuery'),
//   asyncHandler(llmsController.getLLMAgents.bind(llmsController))
// );

/**
 * @route POST /api/llms/:id/activate
 * @desc Activate LLM
 * @access Private (Admin only)
 */
// router.post('/:id/activate',
//   authMiddleware.authorize(['admin']).bind(authMiddleware),
//   asyncHandler(llmsController.activateLLM.bind(llmsController))
// );

/**
 * @route POST /api/llms/:id/deactivate
 * @desc Deactivate LLM
 * @access Private (Admin only)
 */
// router.post('/:id/deactivate',
//   authMiddleware.authorize(['admin']).bind(authMiddleware),
//   asyncHandler(llmsController.deactivateLLM.bind(llmsController))
// );

/**
 * @route GET /api/llms/:id/usage
 * @desc Get LLM usage statistics
 * @access Private (Admin only)
 */
// router.get('/:id/usage',
//   authMiddleware.authorize(['admin']).bind(authMiddleware),
//   asyncHandler(llmsController.getLLMUsage.bind(llmsController))
// );

/**
 * @route POST /api/llms/validate-config
 * @desc Validate LLM configuration
 * @access Private (Admin only)
 */
// router.post('/validate-config',
//   authMiddleware.authorize(['admin']).bind(authMiddleware),
//   validate('createLLM'),
//   asyncHandler(llmsController.validateLLMConfig.bind(llmsController))
// );

/**
 * @route GET /api/llms/configs
 * @desc Get all LLM configurations with pagination
 * @access Private
 */
router.get('/configs',
  validate('paginationQuery'),
  asyncHandler(llmsController.getLLMConfigs.bind(llmsController))
);

/**
 * @route POST /api/llms/configs
 * @desc Create new LLM configuration
 * @access Private (Admin only)
 */
router.post('/configs',
  minimalAuth.requireAdmin,
  validate('createLLMConfig'),
  asyncHandler(llmsController.createLLMConfig.bind(llmsController))
);

/**
 * @route GET /api/llms/configs/:id
 * @desc Get single LLM configuration by ID
 * @access Private
 */
router.get('/configs/:id',
  asyncHandler(llmsController.getLLMConfigById.bind(llmsController))
);

/**
 * @route PUT /api/llms/configs/:id
 * @desc Update LLM configuration
 * @access Private (Admin only)
 */
router.put('/configs/:id',
  minimalAuth.requireAdmin,
  validate('updateLLMConfig'),
  asyncHandler(llmsController.updateLLMConfig.bind(llmsController))
);

/**
 * @route DELETE /api/llms/configs/:id
 * @desc Delete LLM configuration
 * @access Private (Admin only)
 */
router.delete('/configs/:id',
  minimalAuth.requireAdmin,
  asyncHandler(llmsController.deleteLLMConfig.bind(llmsController))
);

module.exports = router;