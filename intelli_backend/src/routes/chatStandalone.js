const express = require('express');
const Database = require('../database');
const { handleUserInput } = require('../bot_logic');

const router = express.Router();

// Almacén de sesiones en memoria
const sessions = new Map();

// Frontend-compatible chat endpoint
router.post('/', async (req, res) => {
    console.log("DEBUG: chatStandalone.js - /api/chat endpoint hit."); // DEBUG LOG
    const { message: userInput, sessionId, agentId, language = 'es', cliente_id, chatbot_id } = req.body;

    if (!userInput) {
        console.log("DEBUG: chatStandalone.js - No user input provided."); // DEBUG LOG
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        let chatId = sessionId;
        let currentClienteId = cliente_id;
        let currentChatbotId = chatbot_id;
        
        // Si no hay sessionId, crear nueva sesión
        if (!chatId) {
            console.log('DEBUG: chatStandalone.js - Creating new chat session');
            
            // Validar parámetros requeridos para nueva sesión
            if (!cliente_id || !chatbot_id) {
                return res.status(400).json({ 
                    error: 'cliente_id y chatbot_id son requeridos para crear nueva sesión',
                    success: false 
                });
            }
            
            console.log(`DEBUG: chatStandalone.js - Creating session for cliente_id=${cliente_id}, chatbot_id=${chatbot_id}`);
            
            // Crear nueva sesión de chat
            const result = await Database.query(
            'INSERT INTO ejec_chat (titulo, chatbot_id, cliente_id) VALUES (?, ?, ?)',
            [`Chat ${Date.now()}`, chatbot_id, cliente_id]
        );
            
            chatId = result.insertId;
            console.log(`DEBUG: chatStandalone.js - New chat created with ID: ${chatId}`);
        } else {
            // Si hay sessionId, obtener cliente_id y chatbot_id de la sesión existente
            const sessionRows = await Database.query(
            'SELECT cliente_id, chatbot_id FROM ejec_chat WHERE id = ?',
            [chatId]
        );
            
            if (!sessionRows || sessionRows.length === 0) {
                // Si no se encuentra la sesión, usar los valores del request
                console.log(`DEBUG: chatStandalone.js - Session not found, using request values: cliente_id=${cliente_id}, chatbot_id=${chatbot_id}`);
                currentClienteId = cliente_id;
                currentChatbotId = chatbot_id;
            } else {
                // Si se encuentra la sesión, usar sus valores con fallback al request
                currentClienteId = sessionRows[0].cliente_id || cliente_id;
                currentChatbotId = sessionRows[0].chatbot_id || chatbot_id;
            }
            console.log(`DEBUG: chatStandalone.js - Using existing session cliente_id=${currentClienteId}, chatbot_id=${currentChatbotId}`);
        }
        
        // Procesar mensaje con bot_logic usando sessionState persistente
        let sessionData = sessions.get(chatId);
        
        // Si no existe sesión, crear nueva
        if (!sessionData) {
            // Obtener agente por defecto si no se especifica
            let defaultAgent = agentId;
            if (!defaultAgent) {
                console.log(`DEBUG: chatStandalone.js - Getting default agent for cliente_id=${currentClienteId}, chatbot_id=${currentChatbotId}`);
                const defaultAgentRows = await Database.query(
                    'SELECT nombre FROM cfg_agente WHERE chatbot_id = ? AND is_active = 1 ORDER BY id LIMIT 1',
                    [currentChatbotId || null]
                );
                defaultAgent = defaultAgentRows[0]?.nombre || 'info';
                console.log(`DEBUG: chatStandalone.js - Default agent selected: ${defaultAgent}`);
            }
            
            sessionData = {
                sessionState: {
                    active_agent: defaultAgent,
                    chat_id: chatId,
                    cliente_id: currentClienteId,
                    chatbot_id: currentChatbotId,
                    language: language
                },
                conversationHistory: []
            };
            
            // Si es agente INFO y es una nueva sesión, generar mensaje de presentación automático
            const isInfoAgent = defaultAgent.toLowerCase().includes('info');
            if (isInfoAgent && userInput.trim() !== '') {
                console.log(`DEBUG: chatStandalone.js - Generating automatic greeting for INFO agent`);
                
                // Procesar mensaje de presentación automático primero
                const greetingResult = await handleUserInput(
                    'Preséntate brevemente y pregunta en qué puedes ayudar',
                    sessionData.sessionState,
                    sessionData.conversationHistory
                );
                
                // Actualizar sesión con el resultado del saludo
                sessionData.sessionState = greetingResult.sessionState;
                sessionData.conversationHistory = greetingResult.conversationHistory;
                
                // Registrar mensaje de presentación en BD
                await Database.query(
                    'INSERT INTO ejec_mensaje (chat_id, rol, contenido, created_at) VALUES (?, "assistant", ?, NOW())',
                    [chatId, greetingResult.botResponse.say.join('\n')]
                );
                
                console.log(`DEBUG: chatStandalone.js - Auto-greeting sent: ${greetingResult.botResponse.say}`);
            }
        }
        // Si existe sesión, mantener el agente activo actual (no sobrescribir con agentId del request)
        
        console.log(`DEBUG: chatStandalone.js - Processing with agent: ${sessionData.sessionState.active_agent}`);
        
        const botResult = await handleUserInput(
            userInput,
            sessionData.sessionState,
            sessionData.conversationHistory
        );
        
        // Guardar el agente anterior para detectar handoffs
        const previousAgent = sessionData.sessionState.active_agent;
        
        // Actualizar sesión con el nuevo estado (incluyendo posibles handoffs)
        // Preservar el agente actual si botResult.sessionState.active_agent es undefined
        if (botResult.sessionState.active_agent === undefined) {
            botResult.sessionState.active_agent = previousAgent;
            console.log(`DEBUG: chatStandalone.js - Preservando agente actual: ${previousAgent}`);
        }
        sessionData.sessionState = botResult.sessionState;
        sessionData.conversationHistory = botResult.conversationHistory;
        sessions.set(chatId, sessionData);
        
        // Obtener información del agente actual (puede haber cambiado por handoff)
        const currentAgentName = botResult.sessionState.active_agent;
        let agentRows = await Database.query(
            'SELECT id, nombre as name, descripcion as description, color FROM cfg_agente WHERE LOWER(nombre) = ? AND chatbot_id = ? AND is_active = 1',
            [currentAgentName.toLowerCase(), currentChatbotId || null]
        );
        
        // Si no encuentra el agente exacto, intentar con mapeo de nombres
        if (!agentRows || agentRows.length === 0) {
            let mappedName = currentAgentName.toLowerCase();
            
            // Mapeo pragmático para nombres de agentes que el LLM puede generar
            if (mappedName === 'onboarding') {
                mappedName = 'kargho-onboarding';
            } else if (mappedName === 'info') {
                mappedName = 'kargho-info';
            } else if (mappedName === 'clientes') {
                mappedName = 'kargho-clientes';
            }
            
            agentRows = await Database.query(
                'SELECT id, nombre as name, descripcion as description, color FROM cfg_agente WHERE LOWER(nombre) = ? AND chatbot_id = ? AND is_active = 1',
                [mappedName, currentChatbotId || null]
            );
        }
        
        console.log(`DEBUG: chatStandalone.js - Looking for agent '${currentAgentName}' in chatbot_id=${currentChatbotId}`);
        console.log(`DEBUG: chatStandalone.js - Agent found:`, agentRows[0]);
        
        const agente = agentRows[0] || {
            id: 1,
            name: currentAgentName.toUpperCase(),
            description: `Agente ${currentAgentName}`,
            color: '#6B7280' // Color gris por defecto si no se encuentra
        };
        
        // Validar que agente.id no sea undefined
        if (!agente.id) {
            console.error('ERROR: agente.id es undefined, usando ID por defecto');
            agente.id = 1;
        }

        // Obtener información del LLM para el agente actual
        const llmInfoRows = await Database.query(
            `SELECT lm.nombre_modelo as model, lp.nombre as provider
             FROM cfg_agente a
             LEFT JOIN cfg_llm_modelo lm ON a.llm_modelo_id = lm.id
             LEFT JOIN cfg_llm_proveedor lp ON lm.proveedor_id = lp.id
             WHERE a.id = ?`,
            [agente.id]
        );
        const llmInfo = llmInfoRows[0] || { model: 'N/A', provider: 'N/A' };
        
        // Usar transacción para registrar en BD
        const connection = await Database.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Registrar mensaje del usuario
            await connection.query(
                'INSERT INTO ejec_mensaje (chat_id, rol, contenido, created_at) VALUES (?, "user", ?, NOW())',
                [chatId, userInput]
            );
            
            // Registrar respuesta del bot
            await connection.query(
                'INSERT INTO ejec_mensaje (chat_id, rol, contenido, created_at) VALUES (?, "assistant", ?, NOW())',
                [chatId, botResult.botResponse.say.join('\n')]
            );
            
            // Si hubo handoff, registrar en logs (ejec_chat no tiene campo agente_id)
            if (botResult.sessionState.active_agent !== previousAgent) {
                console.log(`DEBUG: chatStandalone.js - Handoff detectado: ${previousAgent} -> ${botResult.sessionState.active_agent}`);
                // Nota: ejec_chat no tiene campo agente_id según db.sql
            }
            
            await connection.commit();
            connection.release();
            
            // Detectar handoff y obtener información detallada del agente de destino
            let handoffInfo = null;
            if (botResult.sessionState.active_agent !== previousAgent) {
                try {
                    console.log(`DEBUG: chatStandalone.js - Handoff detectado de ${previousAgent} a ${botResult.sessionState.active_agent}`);
                    console.log(`DEBUG: chatStandalone.js - Variables para consulta: active_agent='${botResult.sessionState.active_agent}', chatbot_id='${currentChatbotId}'`);
                    
                    // Verificar que las variables no sean undefined
                    if (!botResult.sessionState.active_agent || !currentChatbotId) {
                        throw new Error(`Variables undefined: active_agent=${botResult.sessionState.active_agent}, chatbot_id=${currentChatbotId}`);
                    }
                    
                    // Obtener información detallada del agente de destino
                    // Primero intentar búsqueda exacta, luego búsqueda que contenga el nombre
                    const targetAgentQuery = `
                        SELECT 
                            a.id,
                            a.nombre,
                            a.descripcion,
                            a.color,
                            a.system_prompt_es,
                            a.system_prompt_en,
                            a.temperatura,
                            a.max_tokens,
                            m.nombre_modelo as llm_model,
                            p.nombre as llm_provider
                        FROM cfg_agente a
                        LEFT JOIN cfg_llm_modelo m ON a.llm_modelo_id = m.id
                        LEFT JOIN cfg_llm_proveedor p ON m.proveedor_id = p.id
                        WHERE LOWER(a.nombre) = LOWER(?) AND a.chatbot_id = ? AND a.is_active = 1
                        LIMIT 1
                    `;
                    
                    const searchName = botResult.sessionState.active_agent;
                    let finalSearchName = searchName.toLowerCase();

                    // Mapeo pragmático para nombres de agentes que el LLM puede generar
                    if (finalSearchName === 'onboarding') {
                        finalSearchName = 'kargho-onboarding';
                    }

                    // Mapeo pragmático para nombres de agentes que el LLM puede generar
                    if (finalSearchName === 'onboarding') {
                        finalSearchName = 'kargho-onboarding';
                    }

                    const targetAgentRows = await Database.query(targetAgentQuery, [finalSearchName, currentChatbotId]);
                    const targetAgent = targetAgentRows[0];
                    
                    console.log(`DEBUG: chatStandalone.js - targetAgent encontrado:`, targetAgent);
                    
                    // Obtener herramientas del agente de destino solo si el agente existe
                    let targetToolsRows = [];
                    if (targetAgent && targetAgent.id) {
                        const targetToolsQuery = `
                            SELECT 
                                h.nombre as tool_name,
                                h.descripcion as tool_description,
                                r.nombre as route_name,
                                r.path as endpoint_path,
                                r.metodo as endpoint_method
                            FROM cfg_herramienta h
                            LEFT JOIN cfg_herramienta_ruta r ON h.id = r.herramienta_id
                            WHERE h.agente_id = ? AND h.is_active = 1
                        `;
                        
                        targetToolsRows = await Database.query(targetToolsQuery, [targetAgent.id]);
                        console.log(`DEBUG: chatStandalone.js - herramientas encontradas:`, targetToolsRows.length);
                    } else {
                        console.log(`DEBUG: chatStandalone.js - No se encontró el agente de destino, saltando consulta de herramientas`);
                    }
                    
                    // Organizar herramientas únicas con sus rutas
                    const uniqueTools = [];
                    const toolMap = new Map();
                    
                    targetToolsRows.forEach(row => {
                        if (!toolMap.has(row.tool_name)) {
                            toolMap.set(row.tool_name, {
                                name: row.tool_name,
                                description: row.tool_description,
                                routes: []
                            });
                            uniqueTools.push(toolMap.get(row.tool_name));
                        }
                        
                        if (row.route_name) {
                            toolMap.get(row.tool_name).routes.push({
                                name: row.route_name,
                                path: row.endpoint_path,
                                method: row.endpoint_method
                            });
                        }
                    });
                    
                    handoffInfo = {
                        from: previousAgent,
                        to: botResult.sessionState.active_agent,
                        reason: 'Agent handoff detected',
                        targetAgentInfo: targetAgent ? {
                            id: targetAgent.id,
                            name: targetAgent.nombre,
                            description: targetAgent.descripcion,
                            color: targetAgent.color,
                            prompt: targetAgent.system_prompt_es || targetAgent.system_prompt_en,
                            llmModel: targetAgent.llm_model,
                            llmProvider: targetAgent.llm_provider,
                            temperature: targetAgent.temperatura,
                            maxTokens: targetAgent.max_tokens,
                            tools: uniqueTools
                        } : null
                    };
                    
                    console.log('DEBUG: chatStandalone.js - Información del agente de destino obtenida:', JSON.stringify(handoffInfo, null, 2));
                    
                } catch (error) {
                    console.error('Error obteniendo información del agente de destino:', error);
                    handoffInfo = {
                        from: previousAgent,
                        to: botResult.sessionState.active_agent,
                        reason: 'Agent handoff detected',
                        error: 'Could not retrieve target agent info: ' + error.message
                    };
                }
            }

            // Verificar si hubo mensaje de presentación automático
            let finalResponse = botResult.botResponse.say.join('\n');
            let isNewInfoSession = false;
            
            // Si es una nueva sesión con agente INFO, verificar si hay mensaje de presentación
            const isInfoAgent = sessionData.sessionState.active_agent.toLowerCase().includes('info');
            if (isInfoAgent && sessionData.conversationHistory.length >= 2) {
                // Buscar el último mensaje del asistente (presentación automática)
                const lastAssistantMessage = sessionData.conversationHistory
                    .filter(msg => msg.role === 'assistant')
                    .pop();
                
                if (lastAssistantMessage && lastAssistantMessage.content !== botResult.botResponse.say.join('\n')) {
                    // Verificar si los mensajes son muy similares para evitar duplicación
                    const similarity = lastAssistantMessage.content.toLowerCase().includes(botResult.botResponse.say.join('\n').toLowerCase()) || 
                                     botResult.botResponse.say.join('\n').toLowerCase().includes(lastAssistantMessage.content.toLowerCase());
                    
                    if (!similarity) {
                        // Solo combinar si los mensajes son diferentes
                        finalResponse = `${lastAssistantMessage.content}\n\n${botResult.botResponse.say}`;
                        isNewInfoSession = true;
                        console.log(`DEBUG: chatStandalone.js - Combined auto-greeting with user response`);
                    } else {
                        // Si son similares, usar solo la respuesta del usuario
                        console.log(`DEBUG: chatStandalone.js - Skipping auto-greeting combination due to similarity`);
                    }
                }
            }

            // --- INICIO: Lógica de división de mensajes de Handoff ---
            let responsePayload = finalResponse;
            const handoffDetected = botResult.sessionState.active_agent !== previousAgent;

            if (handoffDetected) {
                const handoffMarker = '... Handoff al agente:';
                const handoffIndex = finalResponse.indexOf(handoffMarker);

                if (handoffIndex !== -1) {
                    // Busca el final de la línea que contiene el marcador
                    const handoffLineEndIndex = finalResponse.indexOf('\n', handoffIndex);
                    
                    if (handoffLineEndIndex !== -1) {
                        const part1 = finalResponse.substring(0, handoffLineEndIndex).trim();
                        const part2 = finalResponse.substring(handoffLineEndIndex).trim();

                        if (part1 && part2) {
                            responsePayload = [part1, part2];
                            console.log(`DEBUG: chatStandalone.js - Handoff message split into two parts.`);
                        }
                    }
                }
            }
            // --- FIN: Lógica de división de mensajes de Handoff ---

            // Respuesta compatible con el frontend
            const response = {
                success: true,
                sessionId: chatId.toString(),
                response: responsePayload, // AHORA PUEDE SER UN ARRAY
                agent: {
                    id: agente?.id?.toString() || '1',
                    name: agente?.name || currentAgentName.toUpperCase(),
                    description: agente?.description || `Agente ${currentAgentName}`,
                    color: agente?.color || '#3B82F6'
                },
                metadata: {
                    messageCount: sessionData.conversationHistory.length,
                    toolCalls: botResult.botResponse.call_tool ? [botResult.botResponse.call_tool] : [],
                    dbMode: 'database',
                    handoff: handoffInfo,
                    autoGreeting: isNewInfoSession
                }
            };
            
            console.log('DEBUG: chatStandalone.js - Sending frontend-compatible response:', JSON.stringify(response, null, 2));
            res.json(response);
            
        } catch (transactionError) {
            await connection.rollback();
            connection.release();
            throw transactionError;
        }
        
    } catch (error) {
        console.error('DEBUG: chatStandalone.js - Error processing chat input:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// Endpoint para obtener información del agente (compatible con frontend)
router.get('/agent-info', async (req, res) => {
    try {
        const { cliente_id, chatbot_id } = req.query;
        
        if (!cliente_id || !chatbot_id) {
            return res.status(400).json({ 
                error: 'cliente_id y chatbot_id son requeridos',
                success: false 
            });
        }
        
        // Obtener información del cliente
        const clienteRows = await Database.query('SELECT * FROM cfg_cliente WHERE id = ?', [cliente_id]);
        const cliente = clienteRows[0];
        
        // Obtener información del chatbot
        const chatbotRows = await Database.query('SELECT * FROM cfg_chatbot WHERE id = ?', [chatbot_id]);
        const chatbot = chatbotRows[0];
        
        // Obtener agente por defecto
        const agentRows = await Database.query(
            'SELECT id, nombre as name, descripcion as description, color FROM cfg_agente WHERE chatbot_id = ? AND is_active = 1 ORDER BY orden LIMIT 1',
            [chatbot_id]
        );
        const agent = agentRows[0] || {
            id: 1,
            name: 'INFO',
            description: 'Agente de información',
            color: '#3B82F6'
        };
        
        res.json({
            success: true,
            agent: {
                ...agent,
                cliente_nombre: cliente?.nombre || 'Cliente',
                chatbot: chatbot?.nombre || 'Chatbot'
            }
        });
        
    } catch (error) {
        console.error('Error en /agent-info:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            message: error.message
        });
    }
});

// Endpoint para obtener configuración de clientes, chatbots y agentes
router.get('/debug/config', async (req, res) => {
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
        res.status(500).json({
            error: error.message,
            status: 'error'
        });
    }
});

module.exports = router;