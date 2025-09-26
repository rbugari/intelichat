const Groq = require('groq-sdk');
const OpenAI = require('openai');
const database = require('./src/database');

// Cache para configuraciones LLM (por cliente) y clientes de API (por proveedor)
const llmConfigCache = {};
const llmConfigCacheTime = {};
const clientCache = {};
const LLM_CONFIG_CACHE_DURATION = 60000; // 1 minuto

/**
 * Obtiene la configuración del LLM para un agente específico, usando caché.
 * La configuración es por agente, lo que permite diferentes modelos/proveedores por agente.
 * @param {number} agente_id - El ID del agente para el cual obtener la configuración.
 * @returns {Promise<object>} La configuración del LLM (provider, model, apiKey, baseUrl).
 */
async function getLLMConfig(agente_id) {
    const now = Date.now();
    if (llmConfigCache[agente_id] && (now - llmConfigCacheTime[agente_id]) < LLM_CONFIG_CACHE_DURATION) {
        return llmConfigCache[agente_id];
    }

    try {
        const query = `
            SELECT 
                m.nombre_modelo,
                p.nombre as proveedor_nombre,
                p.base_url,
                p.api_key
            FROM cfg_agente a
            JOIN cfg_llm_modelo m ON a.llm_modelo_id = m.id
            JOIN cfg_llm_proveedor p ON m.proveedor_id = p.id
            WHERE a.id = ? AND a.is_active = 1 AND m.is_active = 1 AND p.is_active = 1
            LIMIT 1
        `;
        const modelRows = await database.query(query, [agente_id]);

        if (modelRows.length > 0) {
            const config = {
                model: modelRows[0].nombre_modelo,
                provider: modelRows[0].proveedor_nombre.toLowerCase(),
                baseUrl: modelRows[0].base_url,
                apiKey: modelRows[0].api_key
            };
            llmConfigCache[agente_id] = config;
            llmConfigCacheTime[agente_id] = now;
            console.log(`Configuración LLM cargada desde BD para agente ${agente_id}:`, { ...config, apiKey: '***' });
            return config;
        } else {
            throw new Error(`No se encontró configuración LLM activa para el agente ${agente_id}`);
        }
    } catch (error) {
        console.error('Error cargando configuración LLM desde BD:', error);
        throw error; // Lanza el error para que sea manejado por el llamador
    }
}

/**
 * Obtiene o crea una instancia de cliente de API para un proveedor dado.
 * @param {string} provider - El nombre del proveedor (openai, groq, openrouter).
 * @param {object} config - El objeto de configuración con apiKey y baseUrl.
 * @returns {object} Una instancia del cliente de API.
 */
function getClient(provider, config) {
    const cacheKey = `${provider}-${config.apiKey.slice(-4)}`;
    if (clientCache[cacheKey]) {
        return clientCache[cacheKey];
    }

    let client;
    switch (provider) {
        case 'openrouter':
            client = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl,
                defaultHeaders: {
                    'HTTP-Referer': 'http://localhost:3000', // Requerido por OpenRouter
                    'X-Title': 'InteliChat' // Opcional, para identificación
                }
            });
            break;
        case 'openai':
            client = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl
            });
            break;
        case 'groq':
        default:
            client = new Groq({
                apiKey: config.apiKey
            });
            break;
    }
    clientCache[cacheKey] = client;
    return client;
}

/**
 * Procesa la solicitud del usuario y obtiene una respuesta del LLM configurado.
 * @param {object} currentPrompt - El objeto de prompt del agente actual.
 * @param {Array<object>} conversationHistory - El historial de la conversación.
 * @param {object} currentState - El estado actual de la sesión.
 * @param {number} agente_id - El ID del agente que está procesando la solicitud.
 * @returns {Promise<object>} La respuesta parseada del LLM.
 */
async function getLLMResponse(currentPrompt, conversationHistory, currentState, agente_id) {
    if (!agente_id) {
        throw new Error("agente_id es requerido para la configuración del LLM.");
    }

    const systemPrompt = currentPrompt.system_prompt_es || currentPrompt.system_prompt_en || 'Eres un asistente útil.';
    let processedSystemPrompt = systemPrompt;
    for (const key in currentState) {
        if (Object.hasOwnProperty.call(currentState, key)) {
            const placeholder = new RegExp(`{{sessionState.${key}}}`, 'g');
            processedSystemPrompt = processedSystemPrompt.replace(placeholder, currentState[key]);
        }
    }
    
    const jsonSystemPrompt = processedSystemPrompt.trim() + '\n\nIMPORTANTE: Responde SIEMPRE en formato JSON válido con la estructura: {"say": "tu respuesta", "control": {"handoff_to": null, "set": {}}, "call_tool": {"name": null, "args": {}}}';
    
    const messages = [
        { role: 'system', content: jsonSystemPrompt },
        { role: 'user', content: `Estado actual: ${JSON.stringify(currentState)}` },
        ...conversationHistory
    ];
    
    console.log('DEBUG: messages sent to LLM:', JSON.stringify(messages, null, 2));

    try {
        const config = await getLLMConfig(agente_id);
        const client = getClient(config.provider, config);

        if (!client) {
            throw new Error(`Cliente LLM para el proveedor '${config.provider}' no está disponible.`);
        }

        const chatCompletion = await client.chat.completions.create({
            messages: messages,
            model: config.model,
            temperature: parseFloat(currentPrompt.temperatura) || 0.7,
            max_tokens: parseInt(currentPrompt.max_tokens, 10) || 1024,
            top_p: 1,
            stream: false,
            response_format: { type: "json_object" },
        });

        const llmResponse = chatCompletion.choices[0]?.message?.content;
        if (!llmResponse) {
            throw new Error('La respuesta del LLM está vacía.');
        }

        console.log('🔍 DEBUG LLM RAW RESPONSE:', llmResponse);
        const parsedResponse = JSON.parse(llmResponse);
        console.log('🔍 DEBUG LLM PARSED RESPONSE:', JSON.stringify(parsedResponse, null, 2));
        
        return parsedResponse;

    } catch (error) {
        console.error("Error al obtener o parsear la respuesta del LLM:", error);
        return {
            say: "Hubo un problema procesando tu solicitud. Por favor, intenta de nuevo.",
            control: { handoff_to: null, set: {} },
            call_tool: { name: null, args: {} }
        };
    }
}

module.exports = { getLLMResponse };