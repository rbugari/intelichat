const Database = require('../database');
const EncryptionService = require('../services/encryption');
const ChatsController = require('./chatsController');
const AgentsController = require('./agentsController');
const ToolsController = require('./toolsController');
const LLMsController = require('./llmsController');
const PromptsController = require('./promptsController');
const FormsController = require('./formsController');

// Initialize services
const encryptionService = EncryptionService.instance;

// Initialize controllers with dependencies
const chatsController = new ChatsController(Database);
const agentsController = new AgentsController(Database);
const toolsController = new ToolsController(Database);
const llmsController = new LLMsController(Database, encryptionService);
const promptsController = new PromptsController(Database);
const formsController = new FormsController(Database);

module.exports = {
  chatsController,
  agentsController,
  toolsController,
  llmsController,
  promptsController,
  formsController,
  encryptionService
};