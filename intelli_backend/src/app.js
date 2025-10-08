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
// const cors = require('cors'); // ELIMINADO - USANDO CORS MANUAL
const { handleUserInput } = require('./bot_logic');
const { agentReportData } = require('./startup_report');
const Database = require('./database');

console.log("DEBUG: app.js - Script started."); // DEBUG LOG
console.log(`🚀 Railway Debug: NODE_ENV=${process.env.NODE_ENV}`);
console.log(`🚀 Railway Debug: PORT=${process.env.PORT}`);
console.log(`🚀 Railway Debug: DB_HOST=${process.env.DB_HOST ? 'SET' : 'NOT SET'}`);

// DEBUG: Verificar variables CORS específicas
console.log('🔍 CORS ENV VARS DEBUG:');
console.log(`  - CORS_ORIGIN=${process.env.CORS_ORIGIN}`);
console.log(`  - CORS_CREDENTIALS=${process.env.CORS_CREDENTIALS}`);
console.log(`  - CORS_METHODS=${process.env.CORS_METHODS}`);
console.log(`  - CORS_HEADERS=${process.env.CORS_HEADERS}`);
console.log(`  - RAILWAY_CORS_ORIGIN=${process.env.RAILWAY_CORS_ORIGIN}`);
console.log(`  - RAILWAY_CORS_CREDENTIALS=${process.env.RAILWAY_CORS_CREDENTIALS}`);
console.log(`  - RAILWAY_CORS_METHODS=${process.env.RAILWAY_CORS_METHODS}`);
console.log(`  - RAILWAY_CORS_HEADERS=${process.env.RAILWAY_CORS_HEADERS}`);

const app = express();
const sessions = new Map();

// ===== CORS ULTRA-AGRESIVO PARA RAILWAY =====
// DEBE SER EL PRIMER MIDDLEWARE - ANTES QUE CUALQUIER COSA DE RAILWAY
console.log('🚨 IMPLEMENTANDO CORS ULTRA-AGRESIVO PARA RAILWAY');

// Interceptar TODAS las respuestas antes que Railway pueda tocarlas
app.use((req, res, next) => {
    console.log('🔥 CORS ULTRA-AGRESIVO - Interceptando request:');
    console.log('  - Origin:', req.get('Origin'));
    console.log('  - Method:', req.method);
    console.log('  - URL:', req.url);
    console.log('  - User-Agent:', req.get('User-Agent'));
    
    // SOBRESCRIBIR MÉTODO writeHead PARA FORZAR HEADERS
    const originalWriteHead = res.writeHead;
    res.writeHead = function(statusCode, statusMessage, headers) {
        console.log('🔥 CORS ULTRA-AGRESIVO - Interceptando writeHead()');
        
        // Forzar headers CORS sin importar lo que Railway haga
        this.setHeader('Access-Control-Allow-Origin', '*');
        this.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        this.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
        this.setHeader('Access-Control-Allow-Credentials', 'true');
        this.setHeader('Access-Control-Max-Age', '86400');
        
        // Remover headers problemáticos de Railway si existen
        this.removeHeader('Access-Control-Allow-Origin');
        this.setHeader('Access-Control-Allow-Origin', '*');
        
        console.log('🔥 CORS ULTRA-AGRESIVO - Headers forzados en writeHead');
        
        return originalWriteHead.call(this, statusCode, statusMessage, headers);
    };
    
    // TAMBIÉN interceptar setHeader para prevenir sobrescritura
    const originalSetHeader = res.setHeader;
    res.setHeader = function(name, value) {
        if (name.toLowerCase().startsWith('access-control-')) {
            console.log(`🔥 CORS ULTRA-AGRESIVO - Interceptando setHeader: ${name} = ${value}`);
            
            // Forzar nuestros valores para headers CORS
            if (name.toLowerCase() === 'access-control-allow-origin') {
                value = '*';
            } else if (name.toLowerCase() === 'access-control-allow-credentials') {
                value = 'true';
            } else if (name.toLowerCase() === 'access-control-allow-methods') {
                value = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
            } else if (name.toLowerCase() === 'access-control-allow-headers') {
                value = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token';
            }
            
            console.log(`🔥 CORS ULTRA-AGRESIVO - Header forzado: ${name} = ${value}`);
        }
        
        return originalSetHeader.call(this, name, value);
    };
    
    // Establecer headers inmediatamente
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Manejar preflight OPTIONS inmediatamente
    if (req.method === 'OPTIONS') {
        console.log('🔥 CORS ULTRA-AGRESIVO - Respondiendo a preflight OPTIONS inmediatamente');
        res.status(200).end();
        return;
    }
    
    next();
});

// Initialize database connection (with fallback)
Database.initialize().catch(error => {
    console.warn('⚠️ Database connection failed, running in degraded mode:', error.message);
    console.log('🚀 Railway Debug: Database connection error details:', error);
});

// JSON parsing middleware - MUST BE BEFORE ANY BODY PROCESSING
app.use(express.json({ limit: '10mb' }));

// URL encoded parsing middleware
app.use(express.urlencoded({ extended: true }));

// Debug middleware AFTER JSON parsing
app.use((req, res, next) => {
    console.log('🚨 IMMEDIATE DEBUG: Request received!', req.method, req.url);
    console.log('🚨 DEBUG: Processed Request Body:', req.body);
    console.log('🔥 MIDDLEWARE HIT!');
    console.log('🔥 METHOD:', req.method);
    console.log('🔥 URL:', req.originalUrl);
    next();
});

// Import and register chat routes AFTER middleware setup (PRD 1.5)
// Chat routes (real database)
// Endpoint de prueba simple
app.get('/test-simple', (req, res) => {
    console.log('🔍 DEBUG: /test-simple endpoint hit!');
    res.json({ message: 'Test endpoint works!', timestamp: new Date().toISOString() });
});

// ENDPOINT ESPECIAL PARA PROBAR CORS - BYPASS COMPLETO
app.get('/api/test-cors', (req, res) => {
    console.log('🔥 TEST-CORS: Request recibido desde:', req.get('Origin'));
    console.log('🔥 TEST-CORS: Headers del request:', JSON.stringify(req.headers, null, 2));
    
    // ESTABLECER HEADERS CORS MANUALMENTE CON res.setHeader()
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    console.log('🔥 TEST-CORS: Headers CORS establecidos manualmente');
    console.log('🔥 TEST-CORS: Access-Control-Allow-Origin: *');
    
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
    console.log('🔍 DEBUG: /debug/config endpoint hit!');
    try {
        console.log('🔍 DEBUG: Querying database...');
        const clientes = await Database.query('SELECT * FROM cfg_cliente WHERE is_active = 1');
        const chatbots = await Database.query('SELECT * FROM cfg_chatbot WHERE is_active = 1');
        const agentes = await Database.query('SELECT * FROM cfg_agente WHERE is_active = 1');
        
        console.log('🔍 DEBUG: Query results:', { clientes: clientes.length, chatbots: chatbots.length, agentes: agentes.length });
        
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

const chatRoutes = require('./routes/chat');
console.log('🚀 About to register chat routes...');
app.use('/api/chat', chatRoutes);
console.log('🚀 Chat routes registered successfully!');

// Register form routes
const formRoutes = require('./routes/forms');
app.use('/api/forms', formRoutes);
console.log('🚀 Form routes registered successfully!');
console.log('🚀 App router stack length after registration:', app._router ? app._router.stack.length : 'No router');

// Register API routes
const apiRoutes = require('./routes/index');
app.use('/api', apiRoutes);
console.log('🚀 API: API routes registered successfully!');


// Frontend-compatible chat endpoint


// Health check endpoint
app.get('/health', async (req, res) => {
    console.log("🚀 Railway Debug: /health endpoint hit from:", req.get('User-Agent')); // DEBUG LOG
    console.log("🚀 Railway Debug: Health check starting...");
    
    try {
        // Verificar estado de la base de datos
        const dbConnected = await Database.healthCheck();
        console.log("🚀 Railway Debug: Database health check result:", dbConnected);
        
        // Si se solicita configuración, incluirla en la respuesta
        const includeConfig = req.query.config === 'true';
        let configData = {};
        
        if (includeConfig) {
            try {
                console.log('🔍 DEBUG: Including config data in health response');
                const clientes = await Database.query('SELECT * FROM cfg_cliente WHERE is_active = 1');
                const chatbots = await Database.query('SELECT * FROM cfg_chatbot WHERE is_active = 1');
                const agentes = await Database.query('SELECT * FROM cfg_agente WHERE is_active = 1');
                
                configData = {
                    clientes,
                    chatbots,
                    agentes
                };
            } catch (error) {
                console.error('🔍 DEBUG: Error getting config data:', error);
                configData = { error: error.message };
            }
        }
        
        const healthResponse = {
            status: 'ok',
            database: dbConnected ? 'connected' : 'disconnected',
            message: 'Server is healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime() + 's',
            port: process.env.PORT || 3000,
            ...(includeConfig && { config: configData })
        };
        
        console.log("🚀 Railway Debug: Health response:", JSON.stringify(healthResponse, null, 2));
        res.status(200).json(healthResponse);
        console.log("🚀 Railway Debug: /health endpoint response sent successfully");
    } catch (error) {
        console.error("🚀 Railway Debug: Health check error:", error);
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});



app.get('/status', (req, res) => {
    console.log("DEBUG: app.js - /status endpoint hit."); // DEBUG LOG
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
    console.log("DEBUG: app.js - /status endpoint response sent."); // DEBUG LOG
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
    const toolsQuery = `
      SELECT 
        h.id,
        h.nombre,
        h.descripcion,
        h.base_url,
        h.agente_id,
        auth.nombre as auth_name,
        auth.tipo as auth_type,
        r.nombre as route_name,
        r.path as endpoint_path,
        r.metodo as endpoint_method,
        r.notas as endpoint_description
      FROM cfg_herramienta h
      LEFT JOIN cfg_herramienta_auth auth ON h.herramienta_auth_id = auth.id
      LEFT JOIN cfg_herramienta_ruta r ON h.id = r.herramienta_id
      WHERE h.is_active = 1
    `;
    
    const tools = await Database.query(toolsQuery);

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
    console.log('🔍 Getting agents for chatbot:', chatbotId);
    
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
    
    console.log('🔍 Found agents:', agentes);
    
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
    const herramientasQuery = `
      SELECT 
        h.id, h.nombre, h.descripcion, h.base_url, h.agente_id, h.tipo,
        auth.nombre as auth_name, auth.tipo as auth_type,
        r.nombre as route_name, r.path as endpoint_path, r.metodo as endpoint_method, r.notas as endpoint_description
      FROM cfg_herramienta h
      LEFT JOIN cfg_herramienta_auth auth ON h.herramienta_auth_id = auth.id
      LEFT JOIN cfg_herramienta_ruta r ON h.id = r.herramienta_id
      WHERE h.is_active = 1 AND h.agente_id IN (
        SELECT id FROM cfg_agente WHERE chatbot_id = ? AND is_active = 1
      )
      ORDER BY h.agente_id, h.nombre, r.nombre
    `;
    const herramientas = await Database.query(herramientasQuery, [chatbotId]);

    // Organizar herramientas por agente en las nuevas listas
    const agentesConHerramientas = agentes.map(agente => {
      const herramientasAgente = herramientas.filter(h => h.agente_id === agente.id);

      const invocables_api = herramientasAgente
        .filter(h => (h.tipo === 'api' || h.tipo === 'mcp') && h.route_name)
        .map(h => ({
          nombre: h.route_name,
          descripcion: h.notas || h.descripcion,
          endpoint: `${h.metodo.toUpperCase()} ${h.base_url || ''}${h.endpoint_path}`,
          auth: h.auth_name || 'none'
        }));

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
        total_herramientas: new Set(herramientas.map(h => h.id)).size,
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

// Legacy system info endpoint (keep for compatibility)
app.get('/system-info', async (req, res) => {
    console.log("DEBUG: app.js - /system-info endpoint hit (legacy)."); // DEBUG LOG
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
        
        console.log("DEBUG: app.js - /system-info endpoint response sent."); // DEBUG LOG
    } catch (error) {
        console.error('DEBUG: app.js - Error in /system-info:', error);
        res.status(500).json({ error: 'Error retrieving system information' });
    }
});

app.get('/', (req, res) => {
    console.log("DEBUG: app.js - / endpoint hit."); // DEBUG LOG
    res.send('Kargho Chatbot Backend is running!');
});

// Log all registered routes for debugging
setTimeout(() => {
    console.log('🗺️ REGISTERED ROUTES:');
    console.log('🔍 Router stack length:', app._router ? app._router.stack.length : 'No router');
    if (app._router && app._router.stack) {
        app._router.stack.forEach((middleware, index) => {
            console.log(`🔍 Middleware ${index}:`, {
                name: middleware.name,
                hasRoute: !!middleware.route,
                hasHandle: !!middleware.handle,
                regexp: middleware.regexp ? middleware.regexp.source : 'No regexp'
            });
            
            if (middleware.route) {
                console.log(`  ✅ ROUTE: ${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
            } else if (middleware.name === 'router' && middleware.handle && middleware.handle.stack) {
                console.log(`  🔍 Router has ${middleware.handle.stack.length} handlers`);
                middleware.handle.stack.forEach((handler, handlerIndex) => {
                    console.log(`    🔍 Handler ${handlerIndex}:`, {
                        hasRoute: !!handler.route,
                        path: handler.route ? handler.route.path : 'No path'
                    });
                    if (handler.route) {
                        console.log(`    ✅ SUBROUTE: ${Object.keys(handler.route.methods).join(',').toUpperCase()} /chat${handler.route.path}`);
                    }
                });
            }
        });
    }
    console.log('🗺️ END ROUTES LIST');
}, 100);

// Export the app and sessions for testing
module.exports = { app, sessions };

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log(`🚀 Railway: Server listening on 0.0.0.0:${PORT}`);
  console.log(`🏥 Health endpoint: http://localhost:${PORT}/health`);
});
