const express = require('express');
const router = express.Router();

console.log('🚀 MOCK: Chat mock routes module loaded');

// Test endpoint to verify router is working
router.get('/test', (req, res) => {
  console.log('🚀 MOCK TEST ENDPOINT HIT!');
  res.json({ 
    message: 'Chat mock router is working!', 
    timestamp: new Date().toISOString(),
    mode: 'mock' 
  });
});

/**
 * POST /chat/start (MOCK VERSION)
 * Crear nueva sesión de chat - Versión simplificada para avanzar rápido
 * Input: {cliente_id, chatbot_id}
 * Output: {chat_id, agente_inicial}
 */
router.post('/start', async (req, res) => {
  console.log('🚀 MOCK: POST /chat/start endpoint hit');
  console.log('🚀 MOCK: Request body:', req.body);
  
  try {
    const { cliente_id, chatbot_id } = req.body;
    
    // Validar parámetros requeridos
    if (!cliente_id || !chatbot_id) {
      return res.status(400).json({
        error: 'cliente_id y chatbot_id son requeridos',
        status: 'error'
      });
    }

    // MOCK: Generar chat_id único basado en timestamp
    const chat_id = Date.now();
    
    // MOCK: Respuesta simulada exitosa
    const mockResponse = {
      chat_id: chat_id,
      agente_inicial: {
        id: 1,
        nombre: 'AgenteMock'
      },
      cliente: {
        id: parseInt(cliente_id),
        nombre: `Cliente ${cliente_id}`
      },
      chatbot: {
        id: parseInt(chatbot_id),
        nombre: `Chatbot ${chatbot_id}`
      },
      status: 'success',
      created_at: new Date().toISOString(),
      mode: 'mock'
    };

    console.log('🚀 MOCK: Sending response:', mockResponse);
    res.json(mockResponse);

  } catch (error) {
    console.error('🚀 MOCK: Error en POST /chat/start:', error);
    res.status(500).json({
      error: 'Error interno del servidor (mock)',
      details: error.message,
      status: 'error',
      mode: 'mock'
    });
  }
});

/**
 * POST /chat/:id/message (MOCK VERSION)
 * Enviar mensaje a una sesión de chat existente - Versión simplificada
 * Input: {contenido}
 * Output: {respuesta, agente_actual, trigger}
 */
router.post('/:id/message', async (req, res) => {
  console.log('🚀 MOCK: POST /chat/:id/message endpoint hit');
  console.log('🚀 MOCK: Chat ID:', req.params.id);
  console.log('🚀 MOCK: Request body:', req.body);
  
  try {
    const { id: chat_id } = req.params;
    const { contenido } = req.body;
    
    // Validar parámetros requeridos
    if (!contenido || typeof contenido !== 'string') {
      return res.status(400).json({
        error: 'contenido es requerido y debe ser una cadena de texto',
        status: 'error',
        mode: 'mock'
      });
    }

    // MOCK: Generar respuesta simulada inteligente
    const mockResponses = [
      'Entiendo tu consulta. Como agente mock, estoy procesando tu solicitud.',
      'Gracias por tu mensaje. En modo mock, simulo una respuesta inteligente.',
      'He recibido tu mensaje correctamente. Esta es una respuesta de prueba.',
      'Perfecto, tu solicitud ha sido procesada en modo de desarrollo.',
      'Excelente consulta. El sistema mock está funcionando correctamente.'
    ];
    
    const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    // MOCK: Respuesta simulada exitosa
    const mockResponse = {
      respuesta: `${randomResponse} (Mensaje original: "${contenido.substring(0, 50)}${contenido.length > 50 ? '...' : ''}")`,
      agente_actual: {
        id: 1,
        nombre: 'AgenteMock'
      },
      trigger: null,
      chat_id: parseInt(chat_id),
      status: 'success',
      timestamp: new Date().toISOString(),
      mode: 'mock'
    };

    console.log('🚀 MOCK: Sending response:', mockResponse);
    res.json(mockResponse);

  } catch (error) {
    console.error('🚀 MOCK: Error en POST /chat/:id/message:', error);
    res.status(500).json({
      error: 'Error interno del servidor (mock)',
      details: error.message,
      status: 'error',
      mode: 'mock'
    });
  }
});

/**
 * POST /chat (MOCK VERSION)
 * Endpoint compatible con el frontend standalone
 * Input: {message, sessionId, agentId, language}
 * Output: {success, sessionId, response, agent, metadata}
 */
router.post('/', async (req, res) => {
  console.log('🚀 MOCK: POST /chat endpoint hit (frontend compatible)');
  console.log('🚀 MOCK: Request body:', req.body);
  
  try {
    const { message, sessionId, agentId, language } = req.body;
    
    // Validar parámetros requeridos
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'message es requerido y debe ser una cadena de texto'
      });
    }

    // Generar sessionId si no existe
    const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // MOCK: Generar respuesta simulada inteligente
    const mockResponses = [
      'Hola, soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
      'Entiendo tu consulta. Estoy aquí para asistirte con cualquier pregunta.',
      'Gracias por contactarme. ¿Podrías darme más detalles sobre lo que necesitas?',
      'Perfecto, he recibido tu mensaje. Permíteme ayudarte con eso.',
      'Excelente consulta. Estoy procesando tu solicitud ahora mismo.'
    ];
    
    const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    
    // MOCK: Respuesta compatible con el frontend
    const mockResponse = {
      success: true,
      sessionId: currentSessionId,
      response: `${randomResponse} (Tu mensaje: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}")`,
      agent: {
        id: agentId || 'info',
        name: 'Asistente Virtual',
        description: 'Agente de prueba en modo mock'
      },
      metadata: {
        messageCount: Math.floor(Math.random() * 10) + 1,
        toolCalls: [],
        dbMode: 'memory'
      }
    };

    console.log('🚀 MOCK: Sending frontend-compatible response:', mockResponse);
    res.json(mockResponse);

  } catch (error) {
    console.error('🚀 MOCK: Error en POST /chat:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor (mock)',
      details: error.message
    });
  }
});

// Debug logs para verificar que las rutas se registraron
console.log('🚀 MOCK CHAT ROUTES: Routes defined, router stack length:', router.stack ? router.stack.length : 'undefined');
if (router.stack) {
  router.stack.forEach((layer, index) => {
    console.log(`🚀 MOCK CHAT ROUTE ${index + 1}: ${layer.route ? Object.keys(layer.route.methods).join(',').toUpperCase() + ' ' + layer.route.path : 'middleware'}`);
  });
}

/**
 * GET /health (MOCK VERSION)
 * Endpoint de salud del servidor
 * Output: {status, database}
 */
router.get('/health', (req, res) => {
  console.log('🚀 MOCK: GET /health endpoint hit');
  
  const healthResponse = {
    status: 'ok',
    database: 'connected',
    timestamp: new Date().toISOString(),
    mode: 'mock'
  };
  
  console.log('🚀 MOCK: Sending health response:', healthResponse);
  res.json(healthResponse);
});

/**
 * GET /status (MOCK VERSION)
 * Endpoint de estado del servidor y agentes
 * Output: {status, agents, models, database, timestamp}
 */
router.get('/status', (req, res) => {
  console.log('🚀 MOCK: GET /status endpoint hit');
  
  const statusResponse = {
    status: 'ok',
    agents: [
      { id: 'info', name: 'INFO', description: 'Agente de información general' },
      { id: 'onboarding', name: 'ONBOARDING', description: 'Agente de registro de transportistas' },
      { id: 'clientes', name: 'CLIENTES', description: 'Agente de gestión de clientes' }
    ],
    models: [],
    database: {
      connected: true,
      mode: 'memory'
    },
    timestamp: new Date().toISOString()
  };
  
  console.log('🚀 MOCK: Sending status response:', statusResponse);
  res.json(statusResponse);
});

module.exports = router;