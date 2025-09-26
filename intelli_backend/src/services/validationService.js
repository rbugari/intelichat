const db = require('../database');
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generic function to call the LLM API directly.
 * @param {string} metaPrompt - The complete prompt to send to the LLM.
 * @returns {Promise<string>} - The LLM's raw string response.
 */
async function callLlm(metaPrompt) {
    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4-turbo",
            messages: [{ role: "user", content: metaPrompt }],
            max_completion_tokens: 4000, // Increased token limit for potentially large reports
            response_format: { type: "json_object" }, // Ensure the output is a JSON object
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error('[validationService.callLlm] Error during OpenAI API call:', error);
        throw new Error('Failed to get response from LLM for validation.');
    }
}

/**
 * Servicio principal para validar la consistencia de un agente utilizando un LLM.
 * @param {number} agentId - El ID del agente a validar.
 * @param {string} currentPrompt - El prompt actual del agente (desde el frontend).
 * @returns {Promise<object>} - El informe de validación completo en formato JSON.
 */
async function validateAgent(agentId, currentPrompt) {
    const agentRows = await db.query('SELECT id, nombre, system_prompt_es FROM cfg_agente WHERE id = ?', [agentId]);
    const agent = agentRows[0];
    if (!agent) {
        throw new Error(`Agente con ID ${agentId} no encontrado.`);
    }

    const toolsDbRows = await db.query('SELECT hr.nombre FROM cfg_herramienta_ruta AS hr JOIN cfg_herramienta AS h ON hr.herramienta_id = h.id WHERE h.agente_id = ? AND h.is_active = 1 AND hr.is_active = 1', [agentId]);
    const toolsInDb = toolsDbRows.map(row => ({ nombre: row.nombre }));

    const handoffsDbRows = await db.query('SELECT ad.nombre FROM cfg_agente_handoff AS h JOIN cfg_agente AS ad ON h.to_agente_id = ad.id WHERE h.from_agente_id = ? AND h.is_active = 1', [agentId]);
    const handoffsInDb = handoffsDbRows.map(row => ({ nombre: row.nombre }));

    const metaPromptPath = path.join(__dirname, '..', '..', '..', 'prompt-editor', 'meta_prompt_validate_llm.md');
    let metaPromptContent = await fs.readFile(metaPromptPath, 'utf8');

    metaPromptContent = metaPromptContent.replace('{{PROMPT_ACTUAL}}', currentPrompt);
    metaPromptContent = metaPromptContent.replace('{{LISTA_DE_HERRAMIENTAS}}', JSON.stringify(toolsInDb, null, 2));
    metaPromptContent = metaPromptContent.replace('{{LISTA_DE_HANDOFFS}}', JSON.stringify(handoffsInDb, null, 2));
    metaPromptContent = metaPromptContent.replace('{{AGENT_NAME}}', agent.nombre);

    const llmResponseString = await callLlm(metaPromptContent);
    let llmResponse;
    try {
        llmResponse = JSON.parse(llmResponseString);
    } catch (parseError) {
        console.error('Error parsing LLM response as JSON:', parseError);
        console.error('Raw LLM response string:', llmResponseString);
        throw new Error('La respuesta del LLM no es un JSON válido.');
    }

    if (typeof llmResponse === 'object' && llmResponse !== null && llmResponse.summary && llmResponse.details) {
        const translatedReport = translateLLMReport(llmResponse);
        return {
            agentId: agent.id,
            agentName: agent.nombre,
            lastValidation: new Date().toISOString(),
            ...translatedReport
        };
    } else {
        console.error('La respuesta del LLM no tiene la estructura esperada (summary/details):', llmResponse);
        throw new Error('La respuesta del LLM no tiene el formato de informe esperado.');
    }
}

/**
 * Traduce el informe complejo del LLM al formato simple que espera el frontend.
 * @param {object} llmReport - El objeto JSON crudo devuelto por el LLM.
 * @returns {{summary: string, details: Array<{status: string, check: string}>, suggestions: Array<string>}}
 */
function translateLLMReport(llmReport) {
    const details = [];
    let issuesCount = 0;
    const areas = Object.keys(llmReport.summary);

    // Arquitectura
    if (llmReport.details.architecture && llmReport.details.architecture.messages) {
        llmReport.details.architecture.messages.forEach(msg => {
            const isOk = msg.type.toLowerCase() === 'ok';
            details.push({ status: isOk ? 'OK' : 'ERROR', check: msg.message });
            if (!isOk) issuesCount++;
        });
    }

    // Herramientas
    if (llmReport.details.tools) {
        llmReport.details.tools.errors?.forEach(msg => {
            details.push({ status: 'ERROR', check: `Herramientas: ${msg}` });
            issuesCount++;
        });
        llmReport.details.tools.warnings?.forEach(msg => {
            details.push({ status: 'WARNING', check: `Herramientas: ${msg}` });
        });
        llmReport.details.tools.success?.forEach(msg => {
            details.push({ status: 'OK', check: `Herramientas: ${msg}` });
        });
    }

    // Handoffs
    if (llmReport.details.handoffs) {
        llmReport.details.handoffs.errors?.forEach(msg => {
            details.push({ status: 'ERROR', check: `Handoffs: ${msg}` });
            issuesCount++;
        });
        llmReport.details.handoffs.warnings?.forEach(msg => {
            details.push({ status: 'WARNING', check: `Handoffs: ${msg}` });
        });
        llmReport.details.handoffs.success?.forEach(msg => {
            details.push({ status: 'OK', check: `Handoffs: ${msg}` });
        });
    }

    // Generar el resumen en string
    const summary = issuesCount === 0
        ? `Validación completada con éxito en las ${areas.length} áreas.`
        : `Se encontraron problemas en la validación. Revisa los detalles.`;

    // Las sugerencias no están en el nuevo formato del meta-prompt, se deja como array vacío.
    const suggestions = []; 

    return { summary, details, suggestions };
}

module.exports = {
    validateAgent,
};