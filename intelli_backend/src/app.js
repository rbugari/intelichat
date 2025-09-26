const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

if (dotenvResult.error) {
  console.error('❌ ERROR: Could not load .env file from root.', dotenvResult.error);
} else {
  console.log('✅ SUCCESS: Loaded .env file from:', path.resolve(__dirname, '../../.env'));
  // Optionally log a specific variable to confirm it's parsed
  if (dotenvResult.parsed) {
    console.log('🔍 DEBUG [dotenv]: Parsed OPENAI_MODEL:', dotenvResult.parsed.OPENAI_MODEL);
  }
}

const express = require('express');
const cors = require('cors');
const { handleUserInput } = require('./bot_logic');
const { agentReportData } = require('./startup_report');
const Database = require('./database');

console.log("DEBUG: app.js - Script started."); // DEBUG LOG

const app = express();
const sessions = new Map();

// NEW: Log req.body at the very beginning
app.use((req, res, next) => {
    console.log('🚨 DEBUG: Raw Request Body:', req.body);
    next();
});

// IMMEDIATE DEBUG MIDDLEWARE - FIRST THING AFTER EXPRESS INIT
app.use((req, res, next) => {
    console.log('🚨 IMMEDIATE DEBUG: Request received!', req.method, req.url);
    next();
});

// Initialize database connection (with fallback)
Database.initialize().catch(error => {
    console.warn('⚠️ Database connection failed, running in degraded mode:', error.message);
});

// Basic middleware
app.use(cors());
app.use(express.json());

// Debug middleware to log all requests - MUST BE BEFORE ROUTES
console.log('🚀 MIDDLEWARE REGISTERED - Debug middleware is being added');
app.use((req, res, next) => {
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
    console.log("DEBUG: app.js - /health endpoint hit from:", req.get('User-Agent')); // DEBUG LOG
    
    // Verificar estado de la base de datos
    const dbConnected = await Database.healthCheck();
    
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
    
    res.status(200).json({
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime() + 's',
        ...(includeConfig && { config: configData })
    });
    console.log("DEBUG: app.js - /health endpoint response sent."); // DEBUG LOG
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
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
});
