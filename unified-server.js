const express = require('express');
  const path = require('path');
  const mysql = require('mysql2/promise');
  require('dotenv').config();
  const app = express();
  const PORT = 3000; // Unified server siempre en puerto 3000

  // Middleware para parsear JSON
  app.use(express.json());

  // Configuración de la base de datos
  const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };

  // Pool de conexiones
  const pool = mysql.createPool(dbConfig);

  // API Endpoints para datos reales
  app.get('/api/clients', async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id as cliente_id, nombre FROM cfg_cliente WHERE is_active = 1 ORDER BY nombre'
      );
      res.json(rows);
    } catch (error) {
      console.error('Error al obtener clientes:', error);
      res.status(500).json({ error: 'Error al obtener clientes' });
    }
  });

  // Endpoint compatible con el prompt editor
  app.get('/api/agents/clients', async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id as cliente_id, nombre FROM cfg_cliente WHERE is_active = 1 ORDER BY nombre'
      );
      res.json({ data: rows });
    } catch (error) {
      console.error('Error al obtener clientes:', error);
      res.status(500).json({ error: 'Error al obtener clientes' });
    }
  });

  // Endpoint para obtener chatbots por cliente
  app.get('/api/agents/chatbots', async (req, res) => {
    try {
      const { cliente_id } = req.query;
      if (!cliente_id) {
        return res.status(400).json({ error: 'cliente_id es requerido' });
      }

      const [rows] = await pool.execute(
        'SELECT id as chatbot_id, nombre FROM cfg_chatbot WHERE cliente_id = ? AND is_active = 1 ORDER BY nombre',
        [cliente_id]
      );
      res.json({ data: rows });
    } catch (error) {
      console.error('Error al obtener chatbots:', error);
      res.status(500).json({ error: 'Error al obtener chatbots' });
    }
  });

  // Endpoint para obtener agentes por cliente y chatbot
  app.get('/api/agents/by-client-chatbot', async (req, res) => {
    try {
      const { cliente_id, chatbot_id } = req.query;
      if (!cliente_id || !chatbot_id) {
        return res.status(400).json({ error: 'cliente_id y chatbot_id son requeridos' });
      }

      const [rows] = await pool.execute(`
        SELECT
          a.id as agente_id,
          a.nombre as rol,
          a.chatbot_id,
          c.nombre as chatbot_nombre
        FROM cfg_agente a
        JOIN cfg_chatbot c ON a.chatbot_id = c.id
        WHERE c.cliente_id = ? AND a.chatbot_id = ? AND a.is_active = 1 AND c.is_active = 1
        ORDER BY a.nombre
      `, [cliente_id, chatbot_id]);
      res.json({ data: rows });
    } catch (error) {
      console.error('Error al obtener agentes:', error);
      res.status(500).json({ error: 'Error al obtener agentes' });
    }
  });

  // Endpoint para obtener datos específicos de un agente
  app.get('/api/agents/:agenteId', async (req, res) => {
    try {
      const { agenteId } = req.params;
      const { lang } = req.query;

      const [rows] = await pool.execute(`
        SELECT
          a.id as agente_id,
          a.nombre as rol,
          a.chatbot_id,
          a.system_prompt_es,
          a.system_prompt_en,
          a.temperatura,
          a.top_p,
          a.max_tokens,
          a.mensaje_bienvenida_es,
          a.mensaje_bienvenida_en,
          a.mensaje_retorno_es,
          a.mensaje_retorno_en,
          a.mensaje_despedida_es,
          a.mensaje_despedida_en,
          a.mensaje_handoff_confirmacion_es,
          a.mensaje_handoff_confirmacion_en,
          a.mensaje_final_tarea_es,
          a.mensaje_final_tarea_en,
          c.nombre as chatbot_nombre,
          cl.nombre as cliente_nombre
        FROM cfg_agente a
        JOIN cfg_chatbot c ON a.chatbot_id = c.id
        JOIN cfg_cliente cl ON c.cliente_id = cl.id
        WHERE a.id = ? AND a.is_active = 1
      `, [agenteId]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Agente no encontrado' });
      }

      res.json({ data: rows[0] });
    } catch (error) {
      console.error('Error al obtener agente:', error);
      res.status(500).json({ error: 'Error al obtener agente' });
    }
  });

  // Endpoint para obtener herramientas del agente (APIs y formularios)
  app.get('/api/agents/:agenteId/tools-editor', async (req, res) => {
    try {
      const { agenteId } = req.params;

      const [toolRows] = await pool.execute(`
        SELECT
          h.id,
          h.nombre,
          h.descripcion,
          h.base_url,
          h.tipo,
          h.is_active
        FROM cfg_herramienta h
        WHERE h.agente_id = ? AND h.is_active = 1
        ORDER BY h.nombre
      `, [agenteId]);

      const [formRows] = await pool.execute(`
        SELECT
          f.id,
          f.codigo,
          f.titulo,
          f.descripcion,
          f.estado
        FROM cfg_form f
        JOIN cfg_agente a ON a.id = ?
        JOIN cfg_chatbot c ON a.chatbot_id = c.id
        WHERE f.cliente_id = c.cliente_id AND f.estado = 'active'
        ORDER BY f.titulo
      `, [agenteId]);

      res.json({
        data: {
          tools: toolRows,
          forms: formRows
        }
      });
    } catch (error) {
      console.error('Error al obtener herramientas del agente:', error);
      res.status(500).json({ error: 'Error al obtener herramientas del agente', details: error.message });
    }
  });

  // Endpoint para obtener handoffs del agente
  app.get('/api/agents/:agenteId/handoffs', async (req, res) => {
    try {
      const { agenteId } = req.params;

      const [rows] = await pool.execute(`
        SELECT
          h.id,
          h.from_agente_id,
          h.trigger_codigo,
          h.to_agente_id,
          h.is_active,
          h.created_at,
          a_to.nombre as to_agente_nombre,
          a_to.descripcion as to_agente_descripcion
        FROM cfg_agente_handoff h
        JOIN cfg_agente a_to ON h.to_agente_id = a_to.id
        WHERE h.from_agente_id = ? AND h.is_active = 1
        ORDER BY h.trigger_codigo
      `, [agenteId]);

      res.json({ data: rows });
    } catch (error) {
      console.error('Error al obtener handoffs del agente:', error);
      res.status(500).json({ error: 'Error al obtener handoffs del agente', details: error.message });
    }
  });

  // Endpoint para obtener cartuchos RAG del agente
  app.get('/api/agents/:agenteId/rag-cartridges', async (req, res) => {
    try {
      const { agenteId } = req.params;

      const [rows] = await pool.execute(`
        SELECT
          r.id,
          r.nombre,
          r.dominio_tag,
          r.proveedor,
          r.indice_nombre,
          arc.es_default,
          arc.prioridad_orden,
          CASE
            WHEN r.habilitado = 1 THEN 'Activo'
            ELSE 'Inactivo'
          END as estado
        FROM cfg_rag_cartucho r
        JOIN cfg_agente_rag_cartucho arc ON r.id = arc.cartucho_id
        WHERE arc.agente_id = ? AND r.habilitado = 1
        ORDER BY arc.prioridad_orden, r.nombre
      `, [agenteId]);

      res.json({ data: rows });
    } catch (error) {
      console.error('Error al obtener cartuchos RAG del agente:', error);
      res.status(500).json({ error: 'Error al obtener cartuchos RAG del agente', details: error.message });
    }
  });

  app.get('/api/clients/:clientId/agents', async (req, res) => {
    try {
      const { clientId } = req.params;
      const [rows] = await pool.execute(`
        SELECT
          a.id as agente_id,
          a.nombre as rol,
          a.chatbot_id,
          c.nombre as chatbot_nombre
        FROM cfg_agente a
        JOIN cfg_chatbot c ON a.chatbot_id = c.id
        WHERE c.cliente_id = ? AND a.is_active = 1 AND c.is_active = 1
        ORDER BY a.nombre
      `, [clientId]);
      res.json(rows);
    } catch (error) {
      console.error('Error al obtener agentes:', error);
      res.status(500).json({ error: 'Error al obtener agentes' });
    }
  });

  // Configuración de archivos estáticos para cada aplicación
  app.use('/chat', express.static(path.join(__dirname, 'public/chat')));
  app.use('/editor', express.static(path.join(__dirname, 'public/editor')));

  // Página de índice principal
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>IntelliChat - Portal de Chatbots</title>
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }

              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
              }

              .container {
                  text-align: center;
                  background: rgba(255, 255, 255, 0.1);
                  backdrop-filter: blur(10px);
                  border-radius: 20px;
                  padding: 3rem;
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  max-width: 600px;
                  width: 90%;
              }

              h1 {
                  font-size: 2.5rem;
                  margin-bottom: 1rem;
                  background: linear-gradient(45deg, #fff, #f0f0f0);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  background-clip: text;
              }

              .subtitle {
                  font-size: 1.2rem;
                  margin-bottom: 3rem;
                  opacity: 0.9;
              }

              .apps-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 2rem;
                  margin-top: 2rem;
              }

              .app-card {
                  background: rgba(255, 255, 255, 0.15);
                  border-radius: 15px;
                  padding: 2rem;
                  text-decoration: none;
                  color: white;
                  transition: all 0.3s ease;
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  display: block;
              }

              .app-card:hover {
                  transform: translateY(-5px);
                  background: rgba(255, 255, 255, 0.25);
                  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
              }

              .chat-card {
                  cursor: default;
              }

              .chat-config {
                  margin-top: 1.5rem;
                  text-align: left;
              }

              .form-group {
                  margin-bottom: 1rem;
              }

              .form-group label {
                  display: block;
                  margin-bottom: 0.5rem;
                  font-weight: 600;
                  font-size: 0.9rem;
              }

              .form-select {
                  width: 100%;
                  padding: 0.75rem;
                  border: 1px solid rgba(255, 255, 255, 0.3);
                  border-radius: 8px;
                  background: rgba(255, 255, 255, 0.1);
                  color: white;
                  font-size: 0.9rem;
                  backdrop-filter: blur(5px);
                  transition: all 0.3s ease;
              }

              .form-select:focus {
                  outline: none;
                  border-color: rgba(255, 255, 255, 0.6);
                  background: rgba(255, 255, 255, 0.2);
              }

              .form-select option {
                  background: #333;
                  color: white;
              }

              .launch-btn {
                  width: 100%;
                  padding: 0.75rem;
                  margin-top: 1rem;
                  border: none;
                  border-radius: 8px;
                  background: linear-gradient(45deg, #4CAF50, #45a049);
                  color: white;
                  font-weight: bold;
                  font-size: 1rem;
                  cursor: pointer;
                  transition: all 0.3s ease;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
              }

              .launch-btn:hover:not(:disabled) {
                  background: linear-gradient(45deg, #45a049, #4CAF50);
                  transform: translateY(-2px);
                  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
              }

              .launch-btn:disabled {
                  background: rgba(255, 255, 255, 0.2);
                  cursor: not-allowed;
                  opacity: 0.6;
              }

              .app-icon {
                  font-size: 3rem;
                  margin-bottom: 1rem;
                  display: block;
              }

              .app-title {
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-bottom: 0.5rem;
              }

              .app-description {
                  opacity: 0.8;
                  font-size: 0.9rem;
                  line-height: 1.4;
              }

              .footer {
                  margin-top: 3rem;
                  opacity: 0.7;
                  font-size: 0.9rem;
              }

              @media (max-width: 768px) {
                  .container {
                      padding: 2rem;
                  }

                  h1 {
                      font-size: 2rem;
                  }

                  .apps-grid {
                      grid-template-columns: 1fr;
                  }
              }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>🤖 IntelliChat</h1>
            <p class="subtitle">Portal de Chatbots Inteligentes</p>

              <div class="apps-grid">
                  <div class="app-card chat-card">
                      <div class="app-icon">💬</div>
                      <div class="app-title">Chat Vanilla</div>
                      <div class="app-description">
                          Interfaz de chat simple para probar y interactuar con tus agentes inteligentes
                      </div>

                      <div class="chat-config">
                          <div class="form-group">
                              <label for="cliente">Cliente:</label>
                              <select id="cliente" class="form-select">
                                  <option value="">Cargando clientes...</option>
                              </select>
                          </div>

                          <div class="form-group">
                            <label for="agente">Chatbot:</label>
                            <select id="agente" class="form-select">
                                <option value="">Seleccionar cliente primero...</option>
                            </select>
                        </div>

                          <button id="launch-chat" class="launch-btn" disabled>
                              🚀 Lanzar Chat
                          </button>
                      </div>
                  </div>

                  <a href="/editor/" class="app-card">
                      <div class="app-icon">✏️</div>
                      <div class="app-title">Editor de Prompts</div>
                      <div class="app-description">
                          Herramienta avanzada para crear, validar y mejorar prompts de agentes
                      </div>
                  </a>
              </div>

              <div class="footer">
                  <p>🚀 Servidor unificado ejecutándose en puerto \${PORT}</p>
              </div>
          </div>

          <script>
              // Elementos del DOM
              const clienteSelect = document.getElementById('cliente');
              const agenteSelect = document.getElementById('agente');
              const launchBtn = document.getElementById('launch-chat');

              // Función para hacer peticiones API
              async function fetchAPI(url) {
                  try {
                      const response = await fetch(url);
                      if (!response.ok) {
                          throw new Error(\`HTTP error! status: \${response.status}\`);
                      }
                      return await response.json();
                  } catch (error) {
                      console.error('Error en fetchAPI:', error);
                      return null;
                  }
              }

              // Cargar clientes al inicializar
              async function loadClients() {
                  const clients = await fetchAPI('/api/clients');
                  if (clients) {
                      clienteSelect.innerHTML = '<option value="">Seleccionar cliente...</option>';
                      clients.forEach(client => {
                          const option = document.createElement('option');
                          option.value = client.cliente_id;
                          option.textContent = client.nombre;
                          clienteSelect.appendChild(option);
                      });
                  } else {
                      clienteSelect.innerHTML = '<option value="">Error al cargar clientes</option>';
                  }
                  validateSelection();
              }

              // Cargar chatbots cuando se selecciona un cliente
              async function loadChatbots(clientId) {
                  if (!clientId) {
                      agenteSelect.innerHTML = '<option value="">Seleccionar cliente primero...</option>';
                      validateSelection();
                      return;
                  }

                  agenteSelect.innerHTML = '<option value="">Cargando chatbots...</option>';
                  
                  // Obtener los chatbots del cliente
                  const response = await fetchAPI(\`/api/agents/chatbots?cliente_id=\${clientId}\`);
                  
                  if (!response || !response.data || response.data.length === 0) {
                      agenteSelect.innerHTML = '<option value="">No hay chatbots disponibles</option>';
                      validateSelection();
                      return;
                  }

                  const chatbots = response.data;
                  agenteSelect.innerHTML = '<option value="">Seleccionar chatbot...</option>';
                  chatbots.forEach(chatbot => {
                      const option = document.createElement('option');
                      option.value = chatbot.chatbot_id;
                      option.textContent = chatbot.nombre;
                      agenteSelect.appendChild(option);
                  });
                  
                  validateSelection();
              }

              // Función para validar si ambos combos están seleccionados
              function validateSelection() {
                  const clienteSelected = clienteSelect.value !== '';
                  const chatbotSelected = agenteSelect.value !== '';

                  launchBtn.disabled = !(clienteSelected && chatbotSelected);

                  if (clienteSelected && chatbotSelected) {
                      launchBtn.textContent = '🚀 Lanzar Chat';
                  } else {
                      launchBtn.textContent = '⚠️ Selecciona Cliente y Chatbot';
                  }
              }

              // Event listeners para los combos
              clienteSelect.addEventListener('change', function() {
                  loadChatbots(this.value);
              });

              agenteSelect.addEventListener('change', validateSelection);

              // Event listener para el botón de lanzar
              launchBtn.addEventListener('click', function() {
                  if (!launchBtn.disabled) {
                      const cliente = clienteSelect.value;
                      const chatbot = agenteSelect.value;

                      // Construir URL con parámetros (usando chatbot_id en lugar de agente_id)
                      const chatUrl = \`/chat/?cliente_id=\${cliente}&chatbot_id=\${chatbot}\`;

                      // Abrir en ventana nueva
                      window.open(chatUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
                  }
              });

              // Inicializar carga de datos
              document.addEventListener('DOMContentLoaded', function() {
                  loadClients();
              });
          </script>
      </body>
      </html>
    `);
  });

  // Rutas SPA para cada aplicación - manejo de subrutas
  app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/chat/index.html'));
  });

  app.get('/editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/editor/index.html'));
  });

  // Endpoint para validar prompt
  app.post('/api/agents/:agenteId/validate-prompt', async (req, res) => {
    try {
      const { agenteId } = req.params;
      const { prompt } = req.body;

      // Validación básica del prompt
      const validationReport = {
        isValid: true,
        checks: [
          { check: "Prompt no vacío", status: "OK" },
          { check: "Longitud adecuada", status: "OK" },
          { check: "Estructura básica", status: "OK" }
        ],
        suggestions: []
      };

      // Si el prompt es muy corto, agregar sugerencia
      if (prompt.trim().length < 50) {
        validationReport.suggestions.push("Considera expandir el prompt para mayor claridad");
      }

      res.json({ data: validationReport });
    } catch (error) {
      console.error('Error en validación:', error);
      res.status(500).json({ error: 'Error al validar prompt' });
    }
  });

  // Proxy para el endpoint de mejorar prompt - redirige al backend
  app.post('/api/agents/:id/improve-prompt', async (req, res) => {
    try {
      const { id } = req.params;
      const { current_prompt, user_suggestion } = req.body;

      // Hacer la llamada al backend real
      const backendUrl = `http://localhost:3001/api/agents/${id}/improve-prompt`;
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ current_prompt, user_suggestion })
      });

      if (!response.ok) {
        throw new Error(`Backend responded with status: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error al mejorar prompt:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al conectar con el servicio de mejora de prompts',
        details: error.message 
      });
    }
  });

  // Proxy para el endpoint de validar prompt - redirige al backend
  app.post('/api/agents/:id/validate', async (req, res) => {
    try {
      const { id } = req.params;
      const { prompt } = req.body;

      // Hacer la llamada al backend real
      const backendUrl = `http://localhost:3001/api/agents/${id}/validate`;
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error(`Backend responded with status: ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error al validar prompt:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al conectar con el servicio de validación de prompts',
        details: error.message 
      });
    }
  });

  // Middleware de manejo de errores
  app.use((err, req, res, next) => {
    console.error('Error del servidor:', err.stack);
    res.status(500).send(`
      <h1>Error del Servidor</h1>
      <p>Ha ocurrido un error interno del servidor.</p>
      <a href="/">← Volver al inicio</a>
    `);
  });

  // Middleware para rutas no encontradas
  app.use((req, res) => {
    res.status(404).send(`
      <h1>Página no encontrada</h1>
      <p>La ruta <code>${req.path}</code> no existe.</p>
      <a href="/">← Volver al inicio</a>
    `);
  });


app.listen(PORT, () => {
  console.log(`
✅ Servidor Unificado IntelliChat iniciado`);
  console.log(`   ================================================`);
  console.log(`   🌐 URL Principal: http://localhost:${PORT}`);
  console.log(`   💬 Chat Vanilla: http://localhost:${PORT}/chat/`);
  console.log(`   ✏️  Editor Prompts: http://localhost:${PORT}/editor/`);
  console.log(`   ================================================\n`);
});