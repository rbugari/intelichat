const db = require('../database');
const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');

const RECOMMEND_PROMPT_PATH = path.resolve(__dirname, '../../../prompt-editor/meta_prompt_recommend.md');
const GENERATE_PROMPT_PATH = path.resolve(__dirname, '../../../prompt-editor/meta_prompt_generate.md');

/**
 * Gets the agent's full context (tools, handoffs, params, messages) from the database.
 * @param {number} agentId - The agent's ID.
 * @returns {Promise<object>} - An object with the agent's context including classification.
 */
async function getAgentContext(agentId) {
    // Obtener herramientas (APIs y Forms)
    const toolsQuery = `
        SELECT h.nombre, h.tipo, hr.nombre as ruta_nombre, hr.path, hr.metodo, hr.notas
        FROM cfg_herramienta h
        LEFT JOIN cfg_herramienta_ruta hr ON h.id = hr.herramienta_id AND hr.is_active = 1
        WHERE h.agente_id = ? AND h.is_active = 1
    `;
    const toolsRows = await db.query(toolsQuery, [agentId]);
    
    const tools = [];
    const forms = [];
    
    toolsRows.forEach(row => {
        if (row.tipo === 'form') {
            forms.push({ nombre: row.nombre });
        } else if (row.tipo === 'api' && row.ruta_nombre) {
            tools.push({ 
                nombre: row.ruta_nombre, 
                path: row.path, 
                metodo: row.metodo, 
                notas: row.notas 
            });
        }
    });

    // Obtener handoffs
    const handoffRows = await db.query(
        `SELECT ad.nombre, ad.descripcion 
         FROM cfg_agente_handoff AS h 
         JOIN cfg_agente AS ad ON h.to_agente_id = ad.id 
         WHERE h.from_agente_id = ? AND h.is_active = 1`,
        [agentId]
    );

    // Obtener cartuchos RAG
    const ragQuery = `
        SELECT rc.nombre, rc.dominio_tag, rc.notas
        FROM cfg_rag_cartucho rc
        INNER JOIN cfg_agente_rag_cartucho arc ON rc.id = arc.cartucho_id
        WHERE arc.agente_id = ? AND rc.habilitado = 1
    `;
    const ragRows = await db.query(ragQuery, [agentId]);
    const ragCartridges = ragRows.map(row => ({ 
        nombre: row.nombre, 
        dominio: row.dominio_tag,
        descripcion: row.notas || `Cartucho RAG del dominio ${row.dominio_tag}`
    }));

    const agentResult = await db.query(
        `SELECT temperatura, top_p, max_tokens, mensaje_bienvenida_es, mensaje_retorno_es, mensaje_despedida_es, mensaje_handoff_confirmacion_es, mensaje_final_tarea_es 
         FROM cfg_agente WHERE id = ?`,
        [agentId]
    );

    const agentData = agentResult[0] || {};

    const params = {
        temperatura: agentData.temperatura,
        top_p: agentData.top_p,
        max_tokens: agentData.max_tokens
    };

    const messages = {
        mensaje_bienvenida_es: agentData.mensaje_bienvenida_es,
        mensaje_retorno_es: agentData.mensaje_retorno_es,
        mensaje_despedida_es: agentData.mensaje_despedida_es,
        mensaje_handoff_confirmacion_es: agentData.mensaje_handoff_confirmacion_es,
        mensaje_final_tarea_es: agentData.mensaje_final_tarea_es
    };

    // Clasificar agente automáticamente
    const hasTools = tools.length > 0;
    const hasForms = forms.length > 0;
    const hasHandoffs = handoffRows.length > 0;
    const hasRAG = ragCartridges.length > 0;
    const isComplex = hasTools || hasForms || hasHandoffs || hasRAG;
    const classification = isComplex ? "COMPLEJO" : "SIMPLE";

    return {
        tools: tools.length > 0 ? JSON.stringify(tools, null, 2) : '[]',
        forms: forms.length > 0 ? JSON.stringify(forms, null, 2) : '[]',
        handoffs: handoffRows.length > 0 ? JSON.stringify(handoffRows, null, 2) : '[]',
        ragCartridges: ragCartridges.length > 0 ? JSON.stringify(ragCartridges, null, 2) : '[]',
        params: JSON.stringify(params, null, 2),
        messages: JSON.stringify(messages, null, 2),
        classification,
        hasTools,
        hasForms,
        hasHandoffs,
        hasRAG
    };
}

/**
 * Generic function to call the LLM API with enhanced logging.
 * @param {string} metaPrompt - The complete prompt to send to the LLM.
 * @returns {Promise<string>} - The LLM's response.
 */
async function callLlm(metaPrompt) {
    const provider = process.env.LLM_PROVIDER || 'openai';
    let client;
    let model;
    let requestOptions;

    try {
        switch (provider) {
            case 'openrouter':
                if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');
                client = new OpenAI({
                    apiKey: process.env.OPENROUTER_API_KEY,
                    baseURL: 'https://openrouter.ai/api/v1',
                    defaultHeaders: {
                        'HTTP-Referer': process.env.OPENROUTER_REFERRER || 'http://localhost:3000',
                        'X-Title': process.env.OPENROUTER_X_TITLE || 'InteliChat Improvement'
                    }
                });
                model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
                requestOptions = {
                    model: model,
                    messages: [{ role: "user", content: metaPrompt }],
                    max_tokens: 8000,
                };
                break;

            case 'groq':
                if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
                const Groq = require('groq-sdk');
                client = new Groq({ apiKey: process.env.GROQ_API_KEY });
                model = process.env.GROQ_MODEL || 'llama3-70b-8192';
                requestOptions = {
                    model: model,
                    messages: [{ role: "user", content: metaPrompt }],
                    max_tokens: 8000,
                };
                break;

            case 'openai':
            default:
                if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
                client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                model = process.env.OPENAI_MODEL || 'gpt-4-turbo';
                requestOptions = {
                    model: model,
                    messages: [{ role: "user", content: metaPrompt }],
                    max_tokens: 8000,
                };
                break;
        }

        console.log(`[callLlm] Making request to ${provider} with model:`, model);
        const response = await client.chat.completions.create(requestOptions);
        console.log(`[callLlm] Raw ${provider} response:`, JSON.stringify(response, null, 2));
        return response.choices[0].message.content;

    } catch (error) {
        console.error(`[callLlm] Error during ${provider} API call:`, error);
        return ""; // Return empty string on error to avoid crashing
    }
}

/**
 * Main service function. Orchestrates the two-step prompt improvement process.
 * @param {number} agentId - The agent's ID.
 * @param {string} currentPrompt - The current prompt from the editor.
 * @param {string} userSuggestion - The instruction provided by the user.
 * @returns {Promise<string>} - The combined analysis and final prompt.
 */
async function improvePrompt(agentId, currentPrompt, userSuggestion) {
    const context = await getAgentContext(agentId);
    const safeCurrentPrompt = currentPrompt || '[PROMPT VACÍO]';
    const safeUserSuggestion = userSuggestion || 'No se proporcionaron instrucciones adicionales.';

    // --- TAREA 1: Generar Recomendaciones ---
    const recommendTemplate = await fs.readFile(RECOMMEND_PROMPT_PATH, 'utf-8');
    const recommendMetaPrompt = recommendTemplate
        .replace('{{PROMPT_ACTUAL}}', safeCurrentPrompt)
        .replace('{{LISTA_DE_HERRAMIENTAS}}', context.tools)
        .replace('{{LISTA_DE_HANDOFFS}}', context.handoffs)
        .replace('{{LISTA_DE_FORMS}}', context.forms || '[]')
        .replace('{{LISTA_DE_RAG_CARTRIDGES}}', context.ragCartridges || '[]')
        .replace('{{SUGERENCIA_USUARIO}}', safeUserSuggestion)
        .replace('{{LISTA_DE_MENSAJES}}', context.messages)
        .replace('{{PARAMETROS_LLM}}', context.params)
        .replace('{{AGENT_CLASSIFICATION}}', context.classification);

    console.log('[ASSISTANT_SERVICE] Calling LLM for recommendations...');
    const notes = await callLlm(recommendMetaPrompt);
    console.log('[ASSISTANT_SERVICE] Recommendations received.');

    // --- TAREA 2: Generar Prompt Mejorado ---
    const generateTemplate = await fs.readFile(GENERATE_PROMPT_PATH, 'utf-8');
    const generateMetaPrompt = generateTemplate
        .replace('{{PROMPT_ACTUAL}}', safeCurrentPrompt)
        .replace('{{LISTA_DE_HERRAMIENTAS}}', context.tools)
        .replace('{{LISTA_DE_HANDOFFS}}', context.handoffs)
        .replace('{{LISTA_DE_FORMS}}', context.forms || '[]')
        .replace('{{LISTA_DE_RAG_CARTRIDGES}}', context.ragCartridges || '[]')
        .replace('{{SUGERENCIA_USUARIO}}', safeUserSuggestion)
        .replace('{{LISTA_DE_MENSAJES}}', context.messages)
        .replace('{{PARAMETROS_LLM}}', context.params)
        .replace('{{AGENT_CLASSIFICATION}}', context.classification);

    console.log('[ASSISTANT_SERVICE] Calling LLM for improved prompt...');
    const improvedPrompt = await callLlm(generateMetaPrompt);
    console.log('[ASSISTANT_SERVICE] Improved prompt received.');

    // --- Combinar Resultados ---
    const combinedResponse = `${notes}===PROMPT_DIVIDER===${improvedPrompt}`;

    return combinedResponse;
}

module.exports = {
    improvePrompt,
};
