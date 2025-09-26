const db = require('../database');
const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');

const RECOMMEND_PROMPT_PATH = path.resolve(__dirname, '../../../prompt-editor/meta_prompt_recommend.md');
const GENERATE_PROMPT_PATH = path.resolve(__dirname, '../../../prompt-editor/meta_prompt_generate.md');

/**
 * Gets the agent's full context (tools, handoffs, params, messages) from the database.
 * @param {number} agentId - The agent's ID.
 * @returns {Promise<object>} - An object with the agent's context.
 */
async function getAgentContext(agentId) {
    const toolRows = await db.query(
        `SELECT hr.nombre, hr.path, hr.metodo, hr.notas 
         FROM cfg_herramienta_ruta AS hr
         JOIN cfg_herramienta AS h ON hr.herramienta_id = h.id
         WHERE h.agente_id = ? AND h.is_active = 1 AND hr.is_active = 1`,
        [agentId]
    );

    const handoffRows = await db.query(
        `SELECT ad.nombre, ad.descripcion 
         FROM cfg_agente_handoff AS h 
         JOIN cfg_agente AS ad ON h.to_agente_id = ad.id 
         WHERE h.from_agente_id = ? AND h.is_active = 1`,
        [agentId]
    );

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

    return {
        tools: toolRows.length > 0 ? JSON.stringify(toolRows, null, 2) : '[]',
        handoffs: handoffRows.length > 0 ? JSON.stringify(handoffRows, null, 2) : '[]',
        params: JSON.stringify(params, null, 2),
        messages: JSON.stringify(messages, null, 2)
    };
}

/**
 * Generic function to call the LLM API with enhanced logging.
 * @param {string} metaPrompt - The complete prompt to send to the LLM.
 * @returns {Promise<string>} - The LLM's response.
 */
async function callLlm(metaPrompt) {
    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        console.log('[callLlm] Making request to OpenAI with model:', process.env.OPENAI_MODEL || "gpt-4-turbo");
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4-turbo",
            messages: [{ role: "user", content: metaPrompt }],
            max_completion_tokens: 8000
        });

        console.log('[callLlm] Raw OpenAI response:', JSON.stringify(response, null, 2));

        return response.choices[0].message.content;
    } catch (error) {
        console.error('[callLlm] Error during OpenAI API call:', error);
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
        .replace('{{SUGERENCIA_USUARIO}}', safeUserSuggestion)
        .replace('{{LISTA_DE_MENSAJES}}', context.messages)
        .replace('{{PARAMETROS_LLM}}', context.params);

    console.log('[ASSISTANT_SERVICE] Calling LLM for recommendations...');
    const notes = await callLlm(recommendMetaPrompt);
    console.log('[ASSISTANT_SERVICE] Recommendations received.');

    // --- TAREA 2: Generar Prompt Mejorado ---
    const generateTemplate = await fs.readFile(GENERATE_PROMPT_PATH, 'utf-8');
    const generateMetaPrompt = generateTemplate
        .replace('{{PROMPT_ACTUAL}}', safeCurrentPrompt)
        .replace('{{LISTA_DE_HERRAMIENTAS}}', context.tools)
        .replace('{{LISTA_DE_HANDOFFS}}', context.handoffs)
        .replace('{{SUGERENCIA_USUARIO}}', safeUserSuggestion)
        .replace('{{LISTA_DE_MENSAJES}}', context.messages)
        .replace('{{PARAMETROS_LLM}}', context.params);

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
