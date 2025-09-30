const express = require('express');
const { agentsController } = require('../controllers');
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
 * @route GET /api/agents
 * @desc Get all agents with pagination and filtering
 * @access Private
 */
router.get('/', 
  validate('paginationQuery'),
  asyncHandler(agentsController.getAgents.bind(agentsController))
);

/**
 * @route GET /api/agents/stats
 * @desc Get agent statistics
 * @access Private
 */
router.get('/stats',
  asyncHandler(agentsController.getAgentStats.bind(agentsController))
);

/**
 * @route GET /api/agents/llm-providers
 * @desc Get available LLM providers
 * @access Private
 */
router.get('/llm-providers',
  asyncHandler(agentsController.getLLMProviders.bind(agentsController))
);

/**
 * @route GET /api/agents/clients
 * @desc Get clients
 * @access Private
 */
router.get('/clients',
  asyncHandler(agentsController.getClients.bind(agentsController))
);

/**
 * @route GET /api/agents/chatbots
 * @desc Get chatbots by client
 * @access Private
 */
router.get('/chatbots',
  asyncHandler(agentsController.getChatbotsByClient.bind(agentsController))
);

/**
 * @route GET /api/agents/by-client-chatbot
 * @desc Get agents by client and chatbot
 * @access Private
 */
router.get('/by-client-chatbot',
  asyncHandler(agentsController.getAgentsByClientChatbot.bind(agentsController))
);

/**
 * @route GET /api/agents/:id
 * @desc Get single agent by ID
 * @access Private
 */
router.get('/:id',
  asyncHandler(agentsController.getAgentById.bind(agentsController))
);

/**
 * @route POST /api/agents
 * @desc Create new agent
 * @access Private
 */
router.post('/',
  validate('createAgent'),
  asyncHandler(agentsController.createAgent.bind(agentsController))
);

/**
 * @route PUT /api/agents/:id
 * @desc Update agent
 * @access Private
 */
router.put('/:id',
  validate('updateAgent'),
  asyncHandler(agentsController.updateAgent.bind(agentsController))
);

/**
 * @route DELETE /api/agents/:id
 * @desc Delete agent (soft delete)
 * @access Private (Admin only for system-wide deletion)
 */
router.delete('/:id',
  minimalAuth.requireAdmin,
  asyncHandler(agentsController.deleteAgent.bind(agentsController))
);

/**
 * @route POST /api/agents/:id/test
 * @desc Test agent configuration
 * @access Private
 */
router.post('/:id/test',
  asyncHandler(agentsController.testAgent.bind(agentsController))
);

/**
 * @route GET /api/agents/:id/tools
 * @desc Get tools assigned to agent
 * @access Private
 */
router.get('/:id/tools',
  asyncHandler(agentsController.getAgentTools.bind(agentsController))
);

/**
 * @route POST /api/agents/:id/tools
 * @desc Assign tools to agent
 * @access Private (Admin only)
 */
router.post('/:id/tools',
  minimalAuth.requireAdmin,
  validate('assignAgentTools'),
  asyncHandler(agentsController.assignAgentTools.bind(agentsController))
);

/**
 * @route DELETE /api/agents/:id/tools/:toolId
 * @desc Remove tool from agent
 * @access Private
 */
router.delete('/:id/tools/:toolId',
  asyncHandler(agentsController.removeAgentTool.bind(agentsController))
);

/**
 * @route GET /api/agents/:id/prompts
 * @desc Get custom prompts for agent
 * @access Private
 */
router.get('/:id/prompts',
  asyncHandler(agentsController.getAgentPrompts.bind(agentsController))
);

/**
 * @route POST /api/agents/:id/test-multilang
 * @desc Test agent with multi-language prompt
 * @access Private
 */
router.post('/:id/test-multilang',
  asyncHandler(agentsController.testAgentMultiLang.bind(agentsController))
);

/**
 * @route GET /api/agents/:id/tools-editor
 * @desc Get agent tools for editor
 * @access Private
 */
router.get('/:id/tools-editor',
  asyncHandler(agentsController.getAgentToolsForEditor.bind(agentsController))
);

/**
 * @route GET /api/agents/:id/handoffs
 * @desc Get agent handoffs
 * @access Private
 */
router.get('/:id/handoffs',
  asyncHandler(agentsController.getAgentHandoffs.bind(agentsController))
);

/**
 * @route PUT /api/agents/:id/prompt
 * @desc Update agent system prompt
 * @access Private
 */
router.put('/:id/prompt',
  asyncHandler(agentsController.updateAgentPrompt.bind(agentsController))
);

/**
 * @route POST /api/agents/:id/improve-prompt
 * @desc Get AI suggestions to improve an agent's prompt
 * @access Private
 */
router.post('/:id/improve-prompt',
  asyncHandler(agentsController.improvePrompt.bind(agentsController))
);

/**
 * @route GET /api/agents/:id/rag-cartridges
 * @desc Get RAG cartridges associated with agent
 * @access Private
 */
router.get('/:id/rag-cartridges',
  asyncHandler(agentsController.getAgentRAGCartridges.bind(agentsController))
);

/**
 * @route POST /api/agents/:id/validate
 * @desc Validate agent consistency against its prompt
 * @access Private
 */
router.post('/:id/validate',
  asyncHandler(agentsController.validateAgent.bind(agentsController))
);

// TODO: Implement additional agent management endpoints
// These routes are commented out until the corresponding controller methods are implemented

/*
 * @route POST /api/agents/:id/duplicate
 * @desc Duplicate agent
 * @access Private
 */
/*
router.post('/:id/duplicate',
  asyncHandler(agentsController.duplicateAgent.bind(agentsController))
);
*/

/*
 * @route GET /api/agents/:id/chats
 * @desc Get chats using this agent
 * @access Private
 */
/*
router.get('/:id/chats',
  validate('paginationQuery'),
  asyncHandler(agentsController.getAgentChats.bind(agentsController))
);
*/

/*
 * @route POST /api/agents/:id/activate
 * @desc Activate agent
 * @access Private
 */
/*
router.post('/:id/activate',
  asyncHandler(agentsController.activateAgent.bind(agentsController))
);
*/

/*
 * @route POST /api/agents/:id/deactivate
 * @desc Deactivate agent
 * @access Private
 */
/*
router.post('/:id/deactivate',
  asyncHandler(agentsController.deactivateAgent.bind(agentsController))
);
*/

/*
 * @route GET /api/agents/:id/performance
 * @desc Get agent performance metrics
 * @access Private
 */
/*
router.get('/:id/performance',
  asyncHandler(agentsController.getAgentPerformance.bind(agentsController))
);
*/

/*
 * @route POST /api/agents/validate
 * @desc Validate agent configuration
 * @access Private
 */
/*
router.post('/validate',
  validate('createAgent'),
  asyncHandler(agentsController.validateAgentConfig.bind(agentsController))
);
*/

module.exports = router;