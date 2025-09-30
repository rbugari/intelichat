const { getLLMResponse } = require('../llm');
const { getPromptByAgent } = require('./prompts_hybrid');
const { dynamicToolsService } = require('./services/dynamicToolsService');
const Database = require('./database');
const RAGService = require('./services/ragService');

function summarizeToolResult(toolName, toolResult) {
    console.log(`DEBUG: bot_logic.js - summarizeToolResult called for ${toolName}`);
    if (toolResult.error) {
        return `TOOL_ERROR: ${toolResult.error}`;
    }

    switch (toolName) {
        case 'findByDotEmail':
            return toolResult.is_registered_carrier ? `TOOL_RESULT: STATUS_ALREADY_REGISTERED` : `TOOL_RESULT: STATUS_NOT_REGISTERED`;
        case 'registerCarrier':
            return (toolResult.message && toolResult.message.includes('exitosamente')) ? `TOOL_RESULT: REGISTRATION_SUCCESSFUL` : `TOOL_ERROR: ${JSON.stringify(toolResult)}`;
        case 'pendingDocuments':
            return (toolResult.pending_documents_info && toolResult.pending_documents_info.has_pending_documents) 
                ? `TOOL_RESULT: PENDING_DOCS_FOUND: ${JSON.stringify(toolResult.pending_documents_info.pending_documents)}` 
                : `TOOL_RESULT: NO_PENDING_DOCS`;
        default:
            return `TOOL_RESULT: ${JSON.stringify(toolResult)}`;
    }
}

async function handleUserInput(userInput, currentSessionState, conversationHistory) {
    console.log("DEBUG: bot_logic.js (v5) - handleUserInput called.");
    let sessionState = { ...currentSessionState };
    const specialist_agents = ['ONBOARDING', 'CLIENTES'];

    if (!sessionState.cliente_id && sessionState.chatbot_id) {
        try {
            const chatbotInfo = await Database.query('SELECT cliente_id FROM cfg_chatbot WHERE id = ?', [sessionState.chatbot_id]);
            if (chatbotInfo.length > 0) sessionState.cliente_id = chatbotInfo[0].cliente_id;
        } catch (dbError) { console.error(`Database error fetching cliente_id:`, dbError); }
    }

    let currentHistory = [...conversationHistory];
    let responses = [];
    const MAX_TURNS = 5;
    let isHandbackTurn = sessionState.isHandbackTurn || false; // Flag para manejar el retorno

    // El flag solo debe vivir un turno
    if (sessionState.isHandbackTurn) {
        delete sessionState.isHandbackTurn;
    }

    // --- Lógica de Bienvenida Determinista ---
    if (conversationHistory.length === 0) {
        const initialPrompt = await getPromptByAgent(sessionState.active_agent, sessionState.language, sessionState.chatbot_id);
        const welcomeMessage = sessionState.language === 'en' ? initialPrompt.mensaje_bienvenida_en : initialPrompt.mensaje_bienvenida_es;
        if (welcomeMessage) {
            console.log("[Flow] Usando mensaje de bienvenida desde la BD.");
            responses.push({ text: welcomeMessage, agentName: sessionState.active_agent });
            currentHistory.push({ role: 'assistant', content: welcomeMessage });
            return { sessionState, botResponse: { messages: responses, action: null } };
        }
    }
    
    // --- Lógica de Retorno (Handback) Determinista ---
    if (isHandbackTurn) {
        const coordinatorPrompt = await getPromptByAgent(sessionState.active_agent, sessionState.language, sessionState.chatbot_id);
        const returnMessage = sessionState.language === 'en' ? coordinatorPrompt.mensaje_retorno_en : coordinatorPrompt.mensaje_retorno_es;
        if (returnMessage) {
            console.log("[Flow] Usando mensaje de retorno desde la BD.");
            responses.push({ text: returnMessage, agentName: sessionState.active_agent });
            currentHistory.push({ role: 'assistant', content: returnMessage });
            return { sessionState, botResponse: { messages: responses, action: null } };
        }
    }

    for (let turn = 0; turn < MAX_TURNS; turn++) {
        const currentAgentName = sessionState.active_agent.toUpperCase();
        const currentPrompt = await getPromptByAgent(sessionState.active_agent, sessionState.language, sessionState.chatbot_id);
        console.log(`\n--- Turn ${turn + 1}/${MAX_TURNS} ---\n🔄 PROCESANDO - Agente: ${currentAgentName}`);

        // --- Integración RAG para agente ID 200 ---
        let ragContext = '';
        if (currentPrompt.id === 200) { // Agente RAG
            console.log('🔍 Detectado agente RAG - Buscando contexto relevante...');
            try {
                const ragService = new RAGService();
                const ragResults = await ragService.search(
                    userInput, 
                    currentPrompt.id, 
                    sessionState.cliente_id,
                    { maxResults: 5, scoreThreshold: 0.7 }
                );
                
                if (ragResults.totalResults > 0) {
                    ragContext = ragService.formatResultsForPrompt(ragResults);
                    console.log(`✅ RAG: Encontrados ${ragResults.totalResults} resultados relevantes`);
                } else {
                    console.log('⚠️ RAG: No se encontraron resultados relevantes');
                }
                
                await ragService.disconnect();
            } catch (error) {
                console.error('❌ Error en búsqueda RAG:', error);
            }
        }

        // Agregar contexto RAG al historial si existe
        let modifiedHistory = [...currentHistory];
        if (ragContext) {
            // Insertar contexto RAG antes de la consulta del usuario
            const lastUserMessage = modifiedHistory[modifiedHistory.length - 1];
            if (lastUserMessage && lastUserMessage.role === 'user') {
                lastUserMessage.content = ragContext + lastUserMessage.content;
            }
        }

        const llmResponse = await getLLMResponse(currentPrompt, modifiedHistory, sessionState, currentPrompt.id);

        if (llmResponse.say) {
            responses.push({ text: llmResponse.say, agentName: sessionState.active_agent });
            currentHistory.push({ role: 'assistant', content: llmResponse.say });
        }

        const action = llmResponse.action;

        // --- Lógica de Confirmación de Handoff Determinista (si el usuario acepta) ---
        if (action && action.type === 'handoff' && userInput && (userInput.toLowerCase() === 'si' || userInput.toLowerCase() === 'yes')) {
            const handoffConfirmMessage = sessionState.language === 'en' ? currentPrompt.mensaje_handoff_confirmacion_en : currentPrompt.mensaje_handoff_confirmacion_es;
            if (handoffConfirmMessage) {
                console.log("[Flow] Usando mensaje de confirmación de handoff desde la BD.");
                responses.push({ text: handoffConfirmMessage, agentName: sessionState.active_agent });
                currentHistory.push({ role: 'assistant', content: handoffConfirmMessage });
                sessionState.active_agent = action.target_agent; // Cambiar agente
                return { sessionState, botResponse: { messages: responses, action: null } }; // Terminar el turno aquí
            }
        }

        if (!action || !action.type) {
            break;
        }

        console.log(`[ACTION] Agente ${currentAgentName} declaró la intención: ${action.type}`);

        switch (action.type) {
            case 'set_state':
                sessionState = { ...sessionState, ...action.payload };
                console.log(`[STATE] Estado de la sesión actualizado:`, action.payload);
                break;

            case 'call_tool':
                try {
                    const { tool_name, args } = action;
                    const toolResult = await dynamicToolsService.execute(tool_name, args);
                    const toolResultSummary = summarizeToolResult(tool_name, toolResult);
                    currentHistory.push({ role: 'user', content: toolResultSummary });
                    continue;
                } catch (error) {
                    console.error(`❌ Error en la ejecución de la herramienta ${action.tool_name}:`, error.message);
                    currentHistory.push({ role: 'user', content: `TOOL_ERROR: ${error.message}` });
                    continue;
                }

            case 'handoff':
                sessionState.active_agent = action.target_agent;
                console.log(`[STATE] Agente activo cambiado a: ${sessionState.active_agent}`);
                continue;

            case 'finish_turn':
                if (specialist_agents.includes(currentAgentName)) {
                    console.log(`[STATE] Especialista ${currentAgentName} ha terminado. Devolviendo control a INFO.`);
                    sessionState.active_agent = 'info';
                    sessionState.isHandbackTurn = true; // Flag para el siguiente ciclo
                }
                // --- Lógica de Mensaje Final de Tarea Determinista ---
                const finalTaskMessage = sessionState.language === 'en' ? currentPrompt.mensaje_final_tarea_en : currentPrompt.mensaje_final_tarea_es;
                if (finalTaskMessage) {
                    console.log("[Flow] Usando mensaje de final de tarea desde la BD.");
                    // Reemplazar el último mensaje si es necesario
                    const lastResponse = responses.pop();
                    if (lastResponse) {
                         responses.push({ text: finalTaskMessage, agentName: sessionState.active_agent });
                         currentHistory.pop();
                         currentHistory.push({ role: 'assistant', content: finalTaskMessage });
                    }
                }
                break;

            case 'end_conversation':
                const farewellMessage = sessionState.language === 'en' ? currentPrompt.mensaje_despedida_en : currentPrompt.mensaje_despedida_es;
                if (farewellMessage) {
                    console.log("[Flow] Usando mensaje de despedida desde la BD.");
                    // Reemplazar el último mensaje si es necesario
                    const lastResponse = responses.pop();
                    if (lastResponse) {
                         responses.push({ text: farewellMessage, agentName: sessionState.active_agent });
                         currentHistory.pop();
                         currentHistory.push({ role: 'assistant', content: farewellMessage });
                    }
                }
                console.log("[STATE] El agente ha finalizado la conversación.");
                break;

            default:
                console.warn(`Intención desconocida: ${action.type}`);
                break;
        }
        
        break;
    }

    console.log("DEBUG: bot_logic.js (v5) - handleUserInput finished.");
    return { sessionState, botResponse: { messages: responses, action: null } };
}

module.exports = { handleUserInput };