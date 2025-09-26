const express = require('express');
const { chatsController } = require('../controllers');
const { validate } = require('../validators/schemas');
const { asyncHandler, requestLogger } = require('../middleware/errorHandler');
const minimalAuth = require('../middleware/minimalAuth');

const router = express.Router();

// Apply minimal authentication middleware to all routes
router.use(minimalAuth.authenticate);

// Apply request logging middleware AFTER authentication
router.use(requestLogger);

/**
 * @route GET /api/chats
 * @desc Get all chats with pagination and filtering
 * @access Private
 */
router.get('/', 
  validate('paginationQuery', 'query'),
  asyncHandler(chatsController.getChats.bind(chatsController))
);

/**
 * @route GET /api/chats/stats
 * @desc Get chat statistics
 * @access Private
 */
router.get('/stats',
  asyncHandler(chatsController.getChatStats.bind(chatsController))
);

/**
 * @route GET /api/chats/:id
 * @desc Get single chat by ID with messages
 * @access Private
 */
router.get('/:id',
  asyncHandler(chatsController.getChatById.bind(chatsController))
);

/**
 * @route POST /api/chats
 * @desc Create new chat
 * @access Private
 */
router.post('/',
  validate('createChat'),
  asyncHandler(chatsController.createChat.bind(chatsController))
);

/**
 * @route PUT /api/chats/:id
 * @desc Update chat
 * @access Private
 */
router.put('/:id',
  validate('updateChat'),
  asyncHandler(chatsController.updateChat.bind(chatsController))
);

/**
 * @route DELETE /api/chats/:id
 * @desc Delete chat (soft delete)
 * @access Private
 */
router.delete('/:id',
  asyncHandler(chatsController.deleteChat.bind(chatsController))
);

/**
 * @route POST /api/chats/:id/messages
 * @desc Add message to chat
 * @access Private
 */
router.post('/:id/messages',
  validate('createMessage'),
  asyncHandler(chatsController.addMessage.bind(chatsController))
);

/**
 * @route GET /api/chats/:id/messages
 * @desc Get chat messages with pagination
 * @access Private
 */
router.get('/:id/messages',
  validate('paginationQuery', 'query'),
  asyncHandler(chatsController.getChatMessages.bind(chatsController))
);

/*
 * @route PUT /api/chats/:chatId/messages/:messageId
 * @desc Update message
 * @access Private
 */
/*
router.put('/:chatId/messages/:messageId',
  validate('updateMessage'),
  asyncHandler(chatsController.updateMessage.bind(chatsController))
);
*/

/*
 * @route DELETE /api/chats/:chatId/messages/:messageId
 * @desc Delete message
 * @access Private
 */
/*
router.delete('/:chatId/messages/:messageId',
  asyncHandler(chatsController.deleteMessage.bind(chatsController))
);
*/

/*
 * @route POST /api/chats/:id/archive
 * @desc Archive chat
 * @access Private
 */
/*
router.post('/:id/archive',
  asyncHandler(chatsController.archiveChat.bind(chatsController))
);
*/

/*
 * @route POST /api/chats/:id/unarchive
 * @desc Unarchive chat
 * @access Private
 */
/*
router.post('/:id/unarchive',
  asyncHandler(chatsController.unarchiveChat.bind(chatsController))
);
*/

/*
 * @route GET /api/chats/:id/export
 * @desc Export chat data
 * @access Private
 */
/*
router.get('/:id/export',
  asyncHandler(chatsController.exportChat.bind(chatsController))
);
*/

module.exports = router;