const express = require('express');
const Database = require('../database');
const { handleUserInput } = require('../bot_logic');

const router = express.Router();

// Helper to manage session state via system messages
const findLastState = (messages) => {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'system' && messages[i].content.startsWith('SESSION_STATE:')) {
            try {
                return JSON.parse(messages[i].content.substring(14));
            } catch (e) {
                console.error('Error parsing session state:', e);
                return null;
            }
        }
    }
    return null;
};

router.post('', async (req, res) => {
  console.log('DEBUG: chat.js - POST /api/chat endpoint hit');
  try {
    const { cliente_id, chatbot_id, initial_message, message, sessionId } = req.body;
    let chat_id = sessionId;
    let cliente, chatbot, defaultAgent;

    const messageToProcess = initial_message !== undefined ? initial_message : message;

    if (!chat_id) {
        console.log('DEBUG: chat.js - No sessionId, creating new chat.');
        if (!cliente_id || !chatbot_id) {
            return res.status(400).json({ error: 'cliente_id y chatbot_id son requeridos para un nuevo chat', status: 'error' });
        }
        const clientRows = await Database.query('SELECT * FROM cfg_cliente WHERE id = ? AND is_active = 1', [cliente_id]);
        if (!clientRows.length) return res.status(404).json({ error: 'Cliente no encontrado o inactivo', status: 'error' });
        cliente = clientRows[0];

        const chatbotRows = await Database.query('SELECT * FROM cfg_chatbot WHERE id = ? AND cliente_id = ? AND is_active = 1', [chatbot_id, cliente_id]);
        if (!chatbotRows.length) return res.status(404).json({ error: 'Chatbot no encontrado o inactivo', status: 'error' });
        chatbot = chatbotRows[0];

        const result = await Database.query('INSERT INTO ejec_chat (cliente_id, chatbot_id, titulo) VALUES (?, ?, ?)', [cliente_id, chatbot_id, `Chat con ${chatbot.nombre}`]);
        chat_id = result.insertId;
    } else {
        const chatInfoRows = await Database.query(`SELECT c.id, cl.nombre as cliente_nombre, cb.nombre as chatbot_nombre, c.cliente_id, c.chatbot_id FROM ejec_chat c JOIN cfg_cliente cl ON c.cliente_id = cl.id JOIN cfg_chatbot cb ON c.chatbot_id = cb.id WHERE c.id = ?`, [chat_id]);
        if (!chatInfoRows.length) return res.status(404).json({ error: 'Chat session not found', status: 'error' });
        cliente = { id: chatInfoRows[0].cliente_id, nombre: chatInfoRows[0].cliente_nombre };
        chatbot = { id: chatInfoRows[0].chatbot_id, nombre: chatInfoRows[0].chatbot_nombre };
    }

    const allMessages = await Database.query('SELECT rol as role, contenido as content FROM ejec_mensaje WHERE chat_id = ? ORDER BY created_at ASC', [chat_id]);
    let conversationHistory = allMessages.map(msg => ({ role: msg.role, content: msg.content }));

    let sessionState = findLastState(conversationHistory);
    if (!sessionState) {
        const defaultAgentRows = await Database.query('SELECT nombre FROM cfg_agente WHERE chatbot_id = ? AND is_active = 1 ORDER BY orden ASC, id ASC LIMIT 1', [chatbot.id]);
        defaultAgent = defaultAgentRows.length > 0 ? defaultAgentRows[0] : { nombre: 'info' };
        sessionState = { 
            chat_id: chat_id,
            cliente_id: cliente.id,
            chatbot_id: chatbot.id,
            active_agent: defaultAgent.nombre.toLowerCase(),
            language: 'es',
            dot_number: null, // Initialize state variables
            email: null,
            intent: null,
            handoff_decision: null
        };
    }

    // Recuperar extra_json de ejec_chat y fusionarlo con sessionState
    if (chat_id) {
        const chatExtraJsonRows = await Database.query('SELECT extra_json FROM ejec_chat WHERE id = ?', [chat_id]);
        if (chatExtraJsonRows.length > 0 && chatExtraJsonRows[0].extra_json) {
            try {
                const storedExtraJson = JSON.parse(chatExtraJsonRows[0].extra_json);
                sessionState = { ...storedExtraJson, ...sessionState };
            } catch (e) {
                console.error('Error parsing extra_json from ejec_chat:', e);
            }
        }
    }

    if (messageToProcess && typeof messageToProcess === 'string') {
        conversationHistory.push({ role: 'user', content: messageToProcess });
    }

    const handleResult = await handleUserInput(messageToProcess || '', sessionState, conversationHistory);
    
    const botResponse = handleResult.botResponse;
    const newSessionState = handleResult.sessionState;

    // 1. Save user message if it exists
    if (messageToProcess && typeof messageToProcess === 'string') {
        await Database.query('INSERT INTO ejec_mensaje (chat_id, contenido, rol) VALUES (?, ?, "user")', [chat_id, messageToProcess]);
    }

    // 2. Process the structured messages from bot_logic
    const responsePayload = [];
    const agentDetailsCache = new Map();

    if (botResponse.messages && botResponse.messages.length > 0) {
        for (const msg of botResponse.messages) {
            // Save each message to DB
            if (msg.text) {
                await Database.query('INSERT INTO ejec_mensaje (chat_id, contenido, rol) VALUES (?, ?, "assistant")', [chat_id, msg.text]);
            }

            // Get agent details (with caching for performance)
            let agentInfo = agentDetailsCache.get(msg.agentName);
            if (!agentInfo) {
                const agentQuery = `
                    SELECT a.id, a.nombre, a.color 
                    FROM cfg_agente a 
                    WHERE LOWER(a.nombre) = ? AND a.chatbot_id = ?`;
                const agentRows = await Database.query(agentQuery, [msg.agentName.toLowerCase(), newSessionState.chatbot_id]);
                agentInfo = agentRows.length > 0 ? agentRows[0] : { id: null, nombre: msg.agentName.toUpperCase(), color: null };
                agentDetailsCache.set(msg.agentName, agentInfo);
            }
            
            // Add to the payload for the client, which expects the 'response.response' structure
            responsePayload.push({
                text: msg.text,
                agent: {
                    id: agentInfo.id,
                    name: agentInfo.nombre,
                    nombre: agentInfo.nombre,
                    color: agentInfo.color
                }
            });
        }
    }

    // 3. Save the final session state
    await Database.query('INSERT INTO ejec_mensaje (chat_id, contenido, rol) VALUES (?, ?, "system")', [chat_id, `SESSION_STATE:${JSON.stringify(newSessionState)}`]);

    // 4. Get details of the final active agent for the top-level response
    const finalAgentQuery = `
        SELECT a.id, a.nombre, a.color, m.nombre_modelo as model, p.nombre as provider 
        FROM cfg_agente a 
        LEFT JOIN cfg_llm_modelo m ON a.llm_modelo_id = m.id 
        LEFT JOIN cfg_llm_proveedor p ON m.proveedor_id = p.id 
        WHERE LOWER(a.nombre) = ? AND a.chatbot_id = ?`;
    const finalAgentRows = await Database.query(finalAgentQuery, [newSessionState.active_agent.toLowerCase(), newSessionState.chatbot_id]);
    let finalAgent = finalAgentRows.length > 0 ? finalAgentRows[0] : { id: null, nombre: newSessionState.active_agent.toUpperCase(), color: null, model: 'N/A', provider: 'N/A' };

    res.json({
      sessionId: chat_id,
      agent: { id: finalAgent.id, name: finalAgent.nombre, nombre: finalAgent.nombre, color: finalAgent.color },
      llm: { model: finalAgent.model || 'N/A', provider: finalAgent.provider || 'N/A' },
      cliente: { id: cliente.id, nombre: cliente.nombre },
      chatbot: { id: chatbot.id, nombre: chatbot.nombre },
      response: responsePayload,
      action: botResponse.action, // Añadir la acción a la respuesta
      status: 'success'
    });

  } catch (error) {
    console.error('Error en POST /api/chat:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message, status: 'error' });
  }
});

router.get('/agent-info', async (req, res) => {
  try {
    const { cliente_id, chatbot_id } = req.query;
    if (!cliente_id || !chatbot_id) {
      return res.status(400).json({ error: 'cliente_id y chatbot_id son requeridos', status: 'error' });
    }
    
    const agenteResult = await Database.query(
      `SELECT a.*, c.nombre as chatbot_nombre, cl.nombre as cliente_nombre
       FROM cfg_agente a
       LEFT JOIN cfg_chatbot c ON a.chatbot_id = c.id
       LEFT JOIN cfg_cliente cl ON c.cliente_id = cl.id
       WHERE a.is_active = 1 AND c.cliente_id = ? AND a.chatbot_id = ?
       ORDER BY a.orden ASC, a.id ASC 
       LIMIT 1`,
      [cliente_id, chatbot_id]
    );
    
    if (!agenteResult || agenteResult.length === 0) {
      return res.status(404).json({ error: `No se encontró agente activo para cliente_id=${cliente_id} y chatbot_id=${chatbot_id}`, status: 'error' });
    }
    const agente = agenteResult[0];

    const llmInfoQuery = `
        SELECT lm.nombre_modelo, lp.nombre as proveedor_nombre
        FROM cfg_agente a
        LEFT JOIN cfg_llm_modelo lm ON a.llm_modelo_id = lm.id
        LEFT JOIN cfg_llm_proveedor lp ON lm.proveedor_id = lp.id
        WHERE a.id = ?`;
    const llmInfo = await Database.query(llmInfoQuery, [agente.id]);
    console.log('DEBUG /agent-info, llmInfo result:', JSON.stringify(llmInfo, null, 2));

    const response = {
      agent: {
        id: agente.id,
        nombre: agente.nombre,
        chatbot: agente.chatbot_nombre,
        cliente_nombre: agente.cliente_nombre
      },
      llm: {
        provider: (llmInfo && llmInfo[0])?.proveedor_nombre || 'N/A',
        model: (llmInfo && llmInfo[0])?.nombre_modelo || 'N/A'
      },
      status: 'success'
    };
    res.json(response);

  } catch (error) {
    console.error('❌ Error en GET /chat/agent-info:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message, status: 'error' });
  }
});

module.exports = router;