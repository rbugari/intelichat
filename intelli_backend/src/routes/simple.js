const express = require('express');
const router = express.Router();

// Importar controladores
const chatsController = require('../controllers/simple-chats');
const messagesController = require('../controllers/simple-messages');
const agentsController = require('../controllers/simple-agents');
const providersController = require('../controllers/simple-providers');
const modelsController = require('../controllers/simple-models');

// Rutas para Chats
router.get('/chats', chatsController.getAll);
router.get('/chats/:id', chatsController.getById);
router.post('/chats', chatsController.create);
router.put('/chats/:id', chatsController.update);
router.delete('/chats/:id', chatsController.delete);

// Rutas para Mensajes
router.get('/messages', messagesController.getAll);
router.get('/messages/:id', messagesController.getById);
router.get('/messages/chat/:chatId', messagesController.getByChatId);
router.post('/messages', messagesController.create);
router.put('/messages/:id', messagesController.update);
router.delete('/messages/:id', messagesController.delete);

// Rutas para Agentes
router.get('/agents', agentsController.getAll);
router.get('/agents/:id', agentsController.getById);
router.post('/agents', agentsController.create);
router.put('/agents/:id', agentsController.update);
router.delete('/agents/:id', agentsController.delete);

// Rutas para Proveedores LLM
router.get('/providers', providersController.getAll);
router.get('/providers/:id', providersController.getById);
router.post('/providers', providersController.create);
router.put('/providers/:id', providersController.update);
router.delete('/providers/:id', providersController.delete);

// Rutas para Modelos LLM
router.get('/models', modelsController.getAll);
router.get('/models/:id', modelsController.getById);
router.get('/models/provider/:providerId', modelsController.getByProviderId);
router.post('/models', modelsController.create);
router.put('/models/:id', modelsController.update);
router.delete('/models/:id', modelsController.delete);

module.exports = router;