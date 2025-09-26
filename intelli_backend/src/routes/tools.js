const express = require('express');
const { toolsController } = require('../controllers');
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
 * @route GET /api/tools
 * @desc Get all tools with pagination and filtering
 * @access Private
 */
router.get('/', 
  validate('paginationQuery'),
  asyncHandler(toolsController.getTools.bind(toolsController))
);

/**
 * @route GET /api/tools/categories
 * @desc Get tool categories
 * @access Private
 */
router.get('/categories',
  asyncHandler(toolsController.getToolCategories.bind(toolsController))
);

/**
 * @route GET /api/tools/stats
 * @desc Get tool statistics
 * @access Private
 */
router.get('/stats',
  asyncHandler(toolsController.getToolStats.bind(toolsController))
);

/**
 * @route GET /api/tools/:id
 * @desc Get single tool by ID
 * @access Private
 */
router.get('/:id',
  asyncHandler(toolsController.getToolById.bind(toolsController))
);

/**
 * @route POST /api/tools
 * @desc Create new tool
 * @access Private
 */
router.post('/',
  validate('createTool'),
  asyncHandler(toolsController.createTool.bind(toolsController))
);

/**
 * @route PUT /api/tools/:id
 * @desc Update tool
 * @access Private
 */
router.put('/:id',
  validate('updateTool'),
  asyncHandler(toolsController.updateTool.bind(toolsController))
);

/**
 * @route DELETE /api/tools/:id
 * @desc Delete tool (soft delete)
 * @access Private (Admin only for system-wide deletion)
 */
router.delete('/:id',
  minimalAuth.requireAdmin,
  asyncHandler(toolsController.deleteTool.bind(toolsController))
);

/**
 * @route POST /api/tools/:id/test
 * @desc Test tool function
 * @access Private (Admin only)
 */
router.post('/:id/test',
  minimalAuth.requireAdmin,
  asyncHandler(toolsController.testTool.bind(toolsController))
);

/**
 * @route POST /api/tools/:id/duplicate
 * @desc Duplicate tool
 * @access Private
 */
// router.post('/:id/duplicate',
//   asyncHandler(toolsController.duplicateTool.bind(toolsController))
// );

/**
 * @route GET /api/tools/:id/usage
 * @desc Get tool usage statistics
 * @access Private
 */
// router.get('/:id/usage',
//   asyncHandler(toolsController.getToolUsage.bind(toolsController))
// );

/**
 * @route POST /api/tools/:id/activate
 * @desc Activate tool
 * @access Private
 */
// router.post('/:id/activate',
//   asyncHandler(toolsController.activateTool.bind(toolsController))
// );

/**
 * @route POST /api/tools/:id/deactivate
 * @desc Deactivate tool
 * @access Private
 */
// router.post('/:id/deactivate',
//   asyncHandler(toolsController.deactivateTool.bind(toolsController))
// );

/**
 * @route POST /api/tools/validate-schema
 * @desc Validate tool parameters schema
 * @access Private
 */
router.post('/validate-schema',
  asyncHandler(toolsController.validateToolSchema.bind(toolsController))
);

/**
 * @route GET /api/tools/versions
 * @desc Get all tool versions with pagination and filtering
 * @access Private
 */
router.get('/versions',
  validate('paginationQuery'),
  asyncHandler(toolsController.getToolVersions.bind(toolsController))
);

/**
 * @route POST /api/tools/versions
 * @desc Create new tool version
 * @access Private (Admin only)
 */
router.post('/versions',
  minimalAuth.requireAdmin,
  validate('createToolVersion'),
  asyncHandler(toolsController.createToolVersion.bind(toolsController))
);

/**
 * @route GET /api/tools/:id/versions
 * @desc Get versions for a specific tool
 * @access Private
 */
router.get('/:id/versions',
  validate('paginationQuery'),
  asyncHandler(toolsController.getToolVersionsByToolId.bind(toolsController))
);

/**
 * @route GET /api/tools/:id/agents
 * @desc Get agents using this tool
 * @access Private
 */
// router.get('/:id/agents',
//   validate('paginationQuery'),
//   asyncHandler(toolsController.getToolAgents.bind(toolsController))
// );

module.exports = router;