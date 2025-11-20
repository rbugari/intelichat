const path = require('path');
const fs = require('fs');

// Configuración de dotenv opcional para producción
const envPath = path.resolve(__dirname, '../../.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  const dotenvResult = require('dotenv').config({ path: envPath });
  if (dotenvResult.error) {
    console.error('❌ ERROR: Could not load .env file from root.', dotenvResult.error);
  } else {
    console.log('✅ SUCCESS: Loaded .env file from:', envPath);
  }
} else {
  console.log('ℹ️  INFO: No .env file found. Using environment variables from system (Railway mode).');
}

// Validación de variables de entorno críticas
const requiredEnvVars = {
  'OPENAI_API_KEY': 'OpenAI API key for LLM functionality',
  'DB_HOST': 'Database host',
  'DB_USER': 'Database user',
  'DB_PASSWORD': 'Database password',
  'DB_NAME': 'Database name'
};

const missingVars = [];
for (const [varName, description] of Object.entries(requiredEnvVars)) {
  if (!process.env[varName] || process.env[varName].trim() === '') {
    missingVars.push(`${varName} (${description})`);
  }
}

if (missingVars.length > 0) {
  console.error('❌ CRITICAL ERROR: Missing required environment variables:');
  missingVars.forEach(varInfo => console.error(`   - ${varInfo}`));
  console.error('');
  console.error('🔧 To fix this in Railway:');
  console.error('   1. Go to your Railway project dashboard');
  console.error('   2. Navigate to Variables tab');
  console.error('   3. Add the missing environment variables');
  console.error('   4. Redeploy the application');
  console.error('');
  process.exit(1);
}

console.log('✅ All required environment variables are present.');

const getEditorModelName = () => {
  const provider = process.env.LLM_PROVIDER || 'openai';
  switch (provider) {
    case 'openrouter':
      return process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
    case 'groq':
      return process.env.GROQ_MODEL || 'llama3-70b-8192';
    case 'openai':
    default:
      return process.env.OPENAI_MODEL || 'gpt-4-turbo';
  }
};

const internalModel = getEditorModelName();
const internalProvider = process.env.LLM_PROVIDER || 'openai';

console.log('--------------------------------------------------------------------------');
console.log(`✅ INTERNAL LLM CONFIG: Provider for app tasks is '${internalProvider}'.`);
console.log(`✅ INTERNAL LLM CONFIG: Model for app tasks is '${internalModel}'.`);
console.log('--------------------------------------------------------------------------');

const express = require('express');
const { handleUserInput } = require('./bot_logic');
const { agentReportData } = require('./startup_report');
const Database = require('./database');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Importar rutas
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/chats');
const chatRoutes = require('./routes/chat');
// const botRoutes = require('./routes/bot'); // TEMP: Comentado para debug
// const configRoutes = require('./routes/config'); // TEMP: Comentado para debug
// const agentRoutes = require('./routes/agents'); // TEMP: Comentado para debug
// const toolsRoutes = require('./routes/tools'); // TEMP: Comentado para debug

// Importar middlewares
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

const app = express();

// Declarar isDev antes de usarlo
const isDev = process.env.NODE_ENV === 'development';

// Log de inicio de la aplicación
if (isDev) {
  console.log('\n🚀 INICIANDO BACKEND EN MODO DEBUG');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('📝 Todos los requests serán logueados');
  console.log('🎯 Buscando peticiones web en puertos 3000 → 5000\n');
}

// Middleware de logging detallado
const requestId = () => Math.random().toString(36).substring(2, 15);

// Logger detallado para debug
const detailedLogger = (req, res, next) => {
  if (!isDev) return next();
  
  const id = requestId();
  const timestamp = new Date().toISOString();
  req.requestId = id;
  
  console.log(`\n📝 [${timestamp}] [${id}] 📥 INCOMING REQUEST`);
  console.log(`   Method: ${req.method}`);
  console.log(`   URL: ${req.originalUrl}`);
  console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`   Body:`, JSON.stringify(req.body, null, 2));
  }
  
  // Capturar respuesta
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`\n📤 [${timestamp}] [${id}] 📤 OUTGOING RESPONSE`);
    console.log(`   Status: ${res.statusCode}`);
    console.log(`   Headers:`, JSON.stringify(res.getHeaders(), null, 2));
    
    if (data) {
      const responseData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      console.log(`   Body:`, responseData.substring(0, 500) + (responseData.length > 500 ? '...' : ''));
    }
    console.log(`   ⏱️  Response time: ${Date.now() - req.startTime}ms\n`);
    
    originalSend.call(this, data);
  };
  
  req.startTime = Date.now();
  next();
};

// ===== Configuración de CORS Estándar =====
const allowedOrigins = [
  'https://intelichat-five.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];
const corsOptions = {
  origin: function (origin, callback) {
    console.log(`[CORS] Request from origin: ${origin || 'no-origin'}`);
    // Permitir todos los origins en desarrollo para evitar BadRequestError
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

const sessions = new Map();


// Initialize database connection (with fallback)
Database.initialize().catch(error => {
    console.warn('⚠️ Database connection failed, running in degraded mode:', error.message);
    console.log('🚀 Railway Debug: Database connection error details:', error);
});

// JSON parsing middleware - MUST BE BEFORE ANY BODY PROCESSING
app.use(express.json({ 
    limit: '50mb',
    verify: (req, res, buf, encoding) => {
        // Log para debugging
        if (buf && buf.length > 0) {
            console.log(`[JSON PARSER] Received ${buf.length} bytes`);
        }
    }
}));

// URL encoded parsing middleware
app.use(express.urlencoded({ 
    extended: true,
    limit: '50mb'
}));

// Logger detallado ANTES de CORS y otras rutas
if (isDev) {
  console.log('🔍 LOGGER DETALLADO ACTIVADO');
  console.log('📢 IMPORTANTE: Todos los requests serán logueados con detalles completos');
  app.use(detailedLogger);
}

// Logger adicional para rutas específicas de API
if (isDev) {
  app.use('/api', (req, res, next) => {
    console.log('\n🎯 API REQUEST DETECTADO');
    console.log('📡 Method:', req.method);
    console.log('🌐 URL:', req.originalUrl);
    console.log('📦 Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('📄 Body:', JSON.stringify(req.body, null, 2));
    }
    console.log('🕐 Time:', new Date().toISOString());
    console.log('🎯 API REQUEST - END\n');
    next();
  });
}

// Middleware para manejar errores de parsing
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        console.error('[PARSE ERROR] Bad JSON:', error.message);
        return res.status(400).json({ error: 'Invalid JSON format' });
    }
    if (error.type === 'entity.too.large') {
        console.error('[PARSE ERROR] Request too large:', error.message);
        return res.status(413).json({ error: 'Request entity too large' });
    }
    next(error);
});

// Middleware para loggear todas las peticiones entrantes
app.use((req, res, next) => {
  console.log(`[INCOMING REQUEST] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('[REQUEST BODY]', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Import and register chat routes AFTER middleware setup (PRD 1.5)
// Chat routes (real database)
// Endpoint de prueba simple
app.get('/test-simple', (req, res) => {

    res.json({ message: 'Test endpoint works!', timestamp: new Date().toISOString() });
});

// ENDPOINT ESPECIAL PARA PROBAR CORS - BYPASS COMPLETO
app.get('/api/test-cors', (req, res) => {

    
    res.json({
        message: 'CORS TEST ENDPOINT - Headers establecidos manualmente',
        timestamp: new Date().toISOString(),
        origin: req.get('Origin'),
        userAgent: req.get('User-Agent'),
        method: req.method,
        headers: req.headers,
        corsHeaders: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
            'Access-Control-Allow-Credentials': 'true'
        }
    });
});

// Endpoint temporal para debug/config (solución para frontend) - ANTES de las rutas API
app.get('/debug/config', async (req, res) => {
    try {
        const clientes = await Database.query('SELECT * FROM cfg_cliente WHERE is_active = 1');
        const chatbots = await Database.query('SELECT * FROM cfg_chatbot WHERE is_active = 1');
        const agentes = await Database.query('SELECT * FROM cfg_agente WHERE is_active = 1');
        

        
        res.json({
            clientes,
            chatbots,
            agentes,
            status: 'success'
        });
    } catch (error) {
        console.error('🔍 DEBUG: Error in /debug/config:', error);
        res.status(500).json({
            error: error.message,
            status: 'error'
        });
    }
});

app.get('/api/ping', (req, res) => {
  console.log('\n🏓 PING ENDPOINT - Request received');
  console.log('📡 Method:', req.method);
  console.log('🌐 URL:', req.originalUrl);
  console.log('📡 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('🕐 Time:', new Date().toISOString());
  res.send('pong');
});

// Endpoint de test para debug
app.get('/api/test', (req, res) => {
  console.log('\n🧪 TEST ENDPOINT - Request received');
  console.log('📡 Method:', req.method);
  console.log('🌐 URL:', req.originalUrl);
  console.log('📦 Query:', JSON.stringify(req.query, null, 2));
  console.log('📡 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('🕐 Time:', new Date().toISOString());
  
  res.json({ 
    message: 'Backend is responding - logs working!',
    timestamp: new Date().toISOString(),
    url: req.originalUrl,
    query: req.query,
    headers: req.headers
  });
});

// Register form routes
const formRoutes = require('./routes/forms');
app.use('/api/forms', formRoutes);


// Register API routes
console.log('📋 REGISTRANDO RUTAS API...');
const apiRoutes = require('./routes/index');
app.use('/api', apiRoutes);
console.log('✅ RUTAS API REGISTRADAS - /api/*');



// Frontend-compatible chat endpoint


// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbConnected = await Database.healthCheck();
        const includeConfig = req.query.config === 'true';
        let configData = {};
        
        if (includeConfig) {
            try {
                const clientes = await Database.query('SELECT * FROM cfg_cliente WHERE is_active = 1');
                const chatbots = await Database.query('SELECT * FROM cfg_chatbot WHERE is_active = 1');
                const agentes = await Database.query('SELECT * FROM cfg_agente WHERE is_active = 1');
                
                configData = {
                    clientes,
                    chatbots,
                    agentes
                };
            } catch (error) {
                console.error('Error getting config data:', error);
                configData = { error: error.message };
            }
        }
        
        const healthResponse = {
            status: 'ok',
            database: dbConnected ? 'connected' : 'disconnected',
            message: 'Server is healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime() + 's',
            port: process.env.PORT || 5000,
            ...(includeConfig && { config: configData })
        };
        
        res.status(200).json(healthResponse);
    } catch (error) {
        console.error("Health check error:", error);
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});



app.get('/status', (req, res) => {
    const isMock = process.env.MOCK_API === 'true';
    const mode = isMock ? 'MOCK (MOCK)' : 'ON-LINE';

    res.json({
        language: 'es',
        llmProvider: process.env.LLM_PROVIDER || 'groq',
        llmModel: process.env.LLM_MODEL || 'llama3-70b-8192',
        apiMode: mode,
        agents: agentReportData.map(agent => ({
            name: agent.name,
            emoji: agent.emoji,
            description: agent.description,
            tools: agent.tools
        }))
    });
});

// Endpoint para obtener información del sistema desde la BD real
app.get('/api/system/info', async (req, res) => {
  try {
    // Obtener información de agentes con sus modelos LLM y proveedores
    const agentsQuery = `
      SELECT 
        a.id,
        a.nombre,
        a.descripcion,
        a.system_prompt_es,
        a.system_prompt_en,
        a.temperatura,
        a.max_tokens,
        a.is_active,
        m.nombre_modelo as llm_model,
        p.nombre as llm_provider
      FROM cfg_agente a
      LEFT JOIN cfg_llm_modelo m ON a.llm_modelo_id = m.id
      LEFT JOIN cfg_llm_proveedor p ON m.proveedor_id = p.id
      WHERE a.is_active = 1
    `;
    
    const agents = await Database.query(agentsQuery);

    // Obtener herramientas con sus rutas y autenticación
    const toolsV2Rows = await Database.query(`
      SELECT 
        h.id,
        h.nombre,
        h.descripcion,
        h.base_url,
        h.agente_id,
        h.tipo,
        h.herramienta_auth_id,
        auth.nombre as auth_name,
        auth.tipo as auth_type,
        h.rutas_json
      FROM cfg_herramienta_v2 h
      LEFT JOIN cfg_herramienta_auth auth ON h.herramienta_auth_id = auth.id
      WHERE h.is_active = 1
    `);
    const tools = [];
    for (const row of toolsV2Rows) {
      let endpoints = [];
      try {
        const rutas = JSON.parse(row.rutas_json || '[]');
        endpoints = rutas.map(r => ({
          name: r.nombre,
          path: r.path,
          method: r.metodo,
          description: r.notas || row.descripcion
        }));
      } catch (_) {}
      tools.push({
        id: row.id,
        nombre: row.nombre,
        descripcion: row.descripcion,
        base_url: row.base_url,
        agente_id: row.agente_id,
        auth_name: row.auth_name,
        auth_type: row.auth_type,
        endpoints
      });
    }

    // Organizar herramientas por agente
    const agentsWithTools = agents.map(agent => {
      const agentTools = tools.filter(tool => tool.agente_id === agent.id);
      return {
        ...agent,
        tools: agentTools
      };
    });

    // Obtener herramientas únicas
    const uniqueTools = tools.reduce((acc, tool) => {
      const existing = acc.find(t => t.id === tool.id);
      if (!existing) {
        acc.push({
          id: tool.id,
          nombre: tool.nombre,
          descripcion: tool.descripcion,
          base_url: tool.base_url,
          auth_name: tool.auth_name,
          auth_type: tool.auth_type,
          endpoints: tools.filter(t => t.id === tool.id).map(t => ({
            name: t.route_name,
            path: t.endpoint_path,
            method: t.endpoint_method,
            description: t.endpoint_description
          }))
        });
      }
      return acc;
    }, []);

    // Información del sistema
    const systemInfo = {
      database: 'chatmini',
      connection_status: 'connected',
      total_agents: agents.length,
      total_tools: uniqueTools.length,
      timestamp: new Date().toISOString()
    };

    res.json({
      system: systemInfo,
      agents: agentsWithTools,
      tools: uniqueTools,
      status: 'success'
    });

  } catch (error) {
    console.error('Error al obtener información del sistema:', error);
    res.status(500).json({
      error: 'Error al obtener información del sistema',
      details: error.message,
      status: 'error'
    });
  }
});

// Endpoints dinámicos para el frontend
app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await Database.query('SELECT id, nombre, descripcion FROM cfg_cliente WHERE is_active = 1 ORDER BY nombre');
    res.json(clientes);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes', details: error.message });
  }
});

app.get('/api/chatbots', async (req, res) => {
  try {
    const chatbots = await Database.query('SELECT id, nombre, descripcion FROM cfg_chatbot WHERE is_active = 1 ORDER BY nombre');
    res.json(chatbots);
  } catch (error) {
    console.error('Error al obtener chatbots:', error);
    res.status(500).json({ error: 'Error al obtener chatbots', details: error.message });
  }
});

app.get('/api/agentes/:chatbotId', async (req, res) => {
  try {
    const { chatbotId } = req.params;
    
    const agentes = await Database.query(`
      SELECT 
        a.id,
        a.nombre as name,
        a.descripcion as description,
        a.orden,
        a.color,
        a.is_active
      FROM cfg_agente a
      WHERE a.chatbot_id = ? AND a.is_active = 1
      ORDER BY a.orden ASC
    `, [chatbotId]);
    
    // Devolver en el formato esperado por el frontend
    res.json({
      success: true,
      data: {
        agents: agentes
      }
    });
  } catch (error) {
    console.error('Error al obtener agentes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener agentes', 
      details: error.message 
    });
  }
});

// Endpoint de debug para mostrar configuración completa
app.get('/api/debug/config', async (req, res) => {
  try {
    const chatbotId = req.query.chatbot_id;
    if (!chatbotId) {
      return res.status(400).json({ error: 'El parámetro chatbot_id es requerido.' });
    }

    // Obtener información del chatbot y cliente
    const chatbotQuery = 'SELECT * FROM cfg_chatbot WHERE id = ?';
    const chatbotRows = await Database.query(chatbotQuery, [chatbotId]);
    const chatbot = chatbotRows[0];
    if (!chatbot) {
      return res.status(404).json({ error: `Chatbot con id ${chatbotId} no encontrado.` });
    }

    const clienteQuery = 'SELECT * FROM cfg_cliente WHERE id = ?';
    const clienteRows = await Database.query(clienteQuery, [chatbot.cliente_id]);
    const cliente = clienteRows[0];

    // Obtener agentes con sus modelos LLM ordenados por orden ASC
    const agentesQuery = `
      SELECT 
        a.id, a.nombre, a.descripcion, a.system_prompt_es, a.system_prompt_en,
        a.orden, a.temperatura, a.max_tokens, a.is_active, a.color,
        m.nombre_modelo as llm_model, p.nombre as llm_provider, p.base_url as provider_base_url
      FROM cfg_agente a
      LEFT JOIN cfg_llm_modelo m ON a.llm_modelo_id = m.id
      LEFT JOIN cfg_llm_proveedor p ON m.proveedor_id = p.id
      WHERE a.chatbot_id = ? AND a.is_active = 1
      ORDER BY a.orden ASC
    `;
    const agentes = await Database.query(agentesQuery, [chatbotId]);

    // Obtener herramientas con sus rutas para cada agente
    const herramientasV2 = await Database.query(`
      SELECT 
        h.id, h.nombre, h.descripcion, h.base_url, h.agente_id, h.tipo,
        auth.nombre as auth_name, auth.tipo as auth_type,
        h.rutas_json
      FROM cfg_herramienta_v2 h
      LEFT JOIN cfg_herramienta_auth auth ON h.herramienta_auth_id = auth.id
      WHERE h.is_active = 1 AND h.agente_id IN (
        SELECT id FROM cfg_agente WHERE chatbot_id = ? AND is_active = 1
      )
      ORDER BY h.agente_id, h.nombre
    `, [chatbotId]);

    // Organizar herramientas por agente en las nuevas listas
    const agentesConHerramientas = agentes.map(agente => {
      const herramientasAgente = herramientasV2.filter(h => h.agente_id === agente.id);

      let invocables_api = [];
      herramientasAgente.forEach(h => {
        try {
          const rutas = JSON.parse(h.rutas_json || '[]');
          const endpoints = rutas.filter(r => (h.tipo === 'api' || h.tipo === 'mcp')).map(r => ({
            nombre: r.nombre,
            descripcion: r.notas || h.descripcion,
            endpoint: `${(r.metodo || 'get').toUpperCase()} ${h.base_url || ''}${r.path}`,
            auth: h.auth_name || 'none'
          }));
          invocables_api = invocables_api.concat(endpoints);
        } catch (_) {}
      });

      const forms = {};
      herramientasAgente.forEach(h => {
        if (h.tipo === 'form') {
          forms[h.id] = {
            nombre: h.nombre,
            descripcion: h.descripcion
          };
        }
      });
      const invocables_form = Object.values(forms);

      return {
        ...agente,
        invocables_api,
        invocables_form
      };
    });

    // Respuesta completa de debug
    const debugConfig = {
      cliente: cliente || { id: chatbot.cliente_id, nombre: 'Cliente no encontrado' },
      chatbot: chatbot,
      agentes_disponibles: agentesConHerramientas,
      agente_activo: agentesConHerramientas[0] || null,
      estadisticas: {
        total_agentes: agentesConHerramientas.length,
        total_herramientas: new Set(herramientasV2.map(h => h.id)).size,
        agentes_activos: agentesConHerramientas.filter(a => a.is_active).length
      },
      configuracion: {
        cliente_id: chatbot.cliente_id,
        chatbot_id: parseInt(chatbotId, 10),
        modo_debug: true,
        timestamp: new Date().toISOString()
      }
    };

    res.json(debugConfig);

  } catch (error) {
    console.error('Error en /api/debug/config:', error);
    res.status(500).json({
      error: 'Error al obtener configuración de debug',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/debug/traces', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50')
    const { getRecent } = require('./services/traceStore')
    const data = getRecent(limit)
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get traces' })
  }
});

// Auditoría de agentes (solo lectura)
app.get('/api/audit/agents', async (req, res) => {
  try {
    const agentes = await Database.query(`
      SELECT a.id, a.nombre, a.chatbot_id, a.llm_modelo_id, a.is_active, a.is_default,
             CHAR_LENGTH(a.system_prompt_es) AS sp_es_len,
             CHAR_LENGTH(a.system_prompt_en) AS sp_en_len
      FROM cfg_agente a
      ORDER BY a.chatbot_id, a.orden, a.id
    `)

    const results = []
    for (const a of agentes) {
      const modeloRows = await Database.query(`
        SELECT m.nombre_modelo, p.nombre AS proveedor
        FROM cfg_llm_modelo m
        JOIN cfg_llm_proveedor p ON p.id = m.proveedor_id
        WHERE m.id = ?
      `, [a.llm_modelo_id])

      const handoffs = await Database.query(
        'SELECT trigger_codigo, to_agente_id, is_active FROM cfg_agente_handoff WHERE from_agente_id = ?',
        [a.id]
      )

      const tools = await Database.query(
        'SELECT id, nombre, tipo, is_active FROM cfg_herramienta WHERE agente_id = ?',
        [a.id]
      )

      let rutasCount = 0
      if (tools.length) {
        const ids = tools.map(t => t.id).join(',')
        const rc = await Database.query(`SELECT COUNT(*) AS cnt FROM cfg_herramienta_ruta WHERE herramienta_id IN (${ids})`)
        rutasCount = rc[0]?.cnt || 0
      }

      const ragCartuchos = await Database.query(
        'SELECT COUNT(*) AS cnt FROM cfg_agente_rag_cartucho WHERE agente_id = ?',
        [a.id]
      )
      const ragPolitica = await Database.query(
        'SELECT confianza_min, latencia_max_ms, fallback_limite FROM cfg_rag_politica WHERE agente_id = ?',
        [a.id]
      )

      const promptsSum = await Database.query(
        'SELECT COUNT(*) AS cnt, SUM(is_active=1) AS actives FROM cfg_agente_prompt WHERE agente_id = ?',
        [a.id]
      )

      results.push({
        id: a.id,
        nombre: a.nombre,
        chatbot_id: a.chatbot_id,
        is_active: !!a.is_active,
        is_default: !!a.is_default,
        sp_es_len: a.sp_es_len || 0,
        sp_en_len: a.sp_en_len || 0,
        modelo: modeloRows[0] || null,
        handoffs,
        tools: tools.map(t => ({ nombre: t.nombre, tipo: t.tipo, is_active: !!t.is_active })),
        rutas_count: rutasCount,
        rag: { cartuchos: ragCartuchos[0]?.cnt || 0, politica: ragPolitica[0] || null },
        prompts_summary: promptsSum[0] || { cnt: 0, actives: 0 }
      })
    }

    res.json({ success: true, count: results.length, agentes: results })
  } catch (error) {
    console.error('Error en /api/audit/agents:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Legacy system info endpoint (keep for compatibility)
app.get('/system-info', async (req, res) => {
    try {
        // Get cliente info
        const clienteRows = await Database.query('SELECT * FROM cliente WHERE id = 1');
        const cliente = clienteRows[0] || { nombre: 'Kargho' };
        
        // Get chatbot info
        const chatbotRows = await Database.query('SELECT * FROM chatbot WHERE id = 1');
        const chatbot = chatbotRows[0] || { nombre: 'Kargho Assistant' };
        
        // Get agentes with their LLM info
        const agentesRows = await Database.query(`
            SELECT a.*, m.nombre as nombre_modelo, p.nombre as proveedor_nombre 
            FROM agente a 
            LEFT JOIN llm_modelo m ON a.llm_modelo_id = m.id 
            LEFT JOIN llm_proveedor p ON m.proveedor_id = p.id 
            WHERE a.cliente_id = 1
        `);
        
        // Get herramientas
        const herramientasRows = await Database.query(`
            SELECT DISTINCT h.* FROM herramienta h
            INNER JOIN agente_herramienta ah ON h.id = ah.herramienta_id
            INNER JOIN agente a ON ah.agente_id = a.id
            WHERE a.cliente_id = 1
        `);
        
        res.json({
            cliente,
            chatbot,
            agentes: agentesRows,
            herramientas: herramientasRows
        });
        
    } catch (error) {
        console.error('DEBUG: app.js - Error in /system-info:', error);
        res.status(500).json({ error: 'Error retrieving system information' });
    }
});

app.get('/', (req, res) => {
    res.send('Kargho Chatbot Backend is running!');
});



// Export the app and sessions for testing
module.exports = { app, sessions };

const PORT = process.env.PORT || 5000;
// Configurar timeouts del servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log(`🚀 Railway: Server listening on 0.0.0.0:${PORT}`);
  console.log(`🏥 Health endpoint: http://localhost:${PORT}/health`);
  console.log(`🔍 DEBUG MODE: ${process.env.NODE_ENV === 'development' ? 'ACTIVADO' : 'DESACTIVADO'}`);
});

// Configurar timeouts para evitar request aborted
server.timeout = 300000; // 5 minutos (aumentado para evitar timeouts)
server.keepAliveTimeout = 65000; // 65 segundos
server.headersTimeout = 66000; // 66 segundos (debe ser mayor que keepAliveTimeout)

// Manejar errores del servidor
server.on('error', (error) => {
  console.error('[SERVER ERROR]:', error);
});

server.on('clientError', (err, socket) => {
  console.error('[CLIENT ERROR]:', err.message);
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});
