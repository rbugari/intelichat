const express = require('express');
const chatsRoutes = require('./chats');
const agentsRoutes = require('./agents');
const chatStandaloneRoutes = require('./chatStandalone');
const editorRoutes = require('./editor');
const formsRoutes = require('./forms');
const authSimpleRoutes = require('./auth_simple');
const toolsProxyRoutes = require('./tools_proxy'); // <-- AÑADIDO
const sttRoutes = require('./stt'); // <-- AÑADIDO PARA STT
const llmProvidersRoutes = require('./llmProviders'); // <-- AÑADIDO PARA LLM PROVIDERS
const { requestLogger } = require('../middleware/errorHandler');

const router = express.Router();

// Endpoint para la configuración de la UI
router.get('/config/ui', (req, res) => {
  res.json({
    sttDefaultProvider: process.env.STT_DEFAULT_PROVIDER || 'backend',
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ... (otros endpoints como /version)

// Registrar las rutas de la API principal
router.use('/chat', chatStandaloneRoutes);
router.use('/chats', chatsRoutes);
router.use('/agents', agentsRoutes);
router.use('/editor', editorRoutes);
router.use('/forms', formsRoutes);
router.use('/auth-simple', authSimpleRoutes);
router.use('/stt', sttRoutes); // <-- AÑADIDO PARA STT
router.use('/llm-providers', llmProvidersRoutes); // <-- AÑADIDO PARA LLM PROVIDERS

// Registrar las rutas de las herramientas genéricas bajo el prefijo /api
// La petición desde el servicio será a /api/weather, por lo tanto aquí solo registramos la base
router.use('/', toolsProxyRoutes);

module.exports = router;
