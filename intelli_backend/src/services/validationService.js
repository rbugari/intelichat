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

    // Obtener configuraciones del agente
    const agentConfig = await getAgentConfiguration(agentId);

    // Construir el meta-prompt dinámicamente basado en la configuración
    const metaPromptPath = path.join(__dirname, '..', '..', '..', 'prompt-editor', 'meta_prompt_validate_llm.md');
    let metaPromptContent = await fs.readFile(metaPromptPath, 'utf8');

    // Hacer el template condicional basado en la configuración del agente
    metaPromptContent = buildContextualMetaPrompt(metaPromptContent, agentConfig, currentPrompt, agent.nombre);

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
 * @returns {{summary: string, details: Array<{status: string, check: string}>, suggestions: Array<string>, classification: string, validationMode: string}}
 */
function translateLLMReport(llmReport) {
    const details = [];
    let issuesCount = 0;
    const areas = Object.keys(llmReport.summary);

    // Extraer información de clasificación si está disponible
    const classification = llmReport.agent_classification || "DESCONOCIDO";
    const validationMode = llmReport.validation_mode || "desconocida";

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
            const message = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : msg;
            details.push({ status: 'ERROR', check: `Herramientas: ${message}` });
            issuesCount++;
        });
        llmReport.details.tools.warnings?.forEach(msg => {
            const message = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : msg;
            details.push({ status: 'WARNING', check: `Herramientas: ${message}` });
        });
        llmReport.details.tools.success?.forEach(msg => {
            const message = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : msg;
            details.push({ status: 'OK', check: `Herramientas: ${message}` });
        });
    }

    // Handoffs
    if (llmReport.details.handoffs) {
        llmReport.details.handoffs.errors?.forEach(msg => {
            const message = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : msg;
            details.push({ status: 'ERROR', check: `Handoffs: ${message}` });
            issuesCount++;
        });
        llmReport.details.handoffs.warnings?.forEach(msg => {
            const message = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : msg;
            details.push({ status: 'WARNING', check: `Handoffs: ${message}` });
        });
        llmReport.details.handoffs.success?.forEach(msg => {
            const message = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : msg;
            details.push({ status: 'OK', check: `Handoffs: ${message}` });
        });
    }

    // Forms
    if (llmReport.details.forms) {
        llmReport.details.forms.errors?.forEach(msg => {
            const message = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : msg;
            details.push({ status: 'ERROR', check: `Formularios: ${message}` });
            issuesCount++;
        });
        llmReport.details.forms.warnings?.forEach(msg => {
            const message = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : msg;
            details.push({ status: 'WARNING', check: `Formularios: ${message}` });
        });
        llmReport.details.forms.success?.forEach(msg => {
            const message = typeof msg === 'object' ? (msg.message || JSON.stringify(msg)) : msg;
            details.push({ status: 'OK', check: `Formularios: ${message}` });
        });
    }

    // Generar el resumen contextual basado en la clasificación
    let summary;
    if (classification === "SIMPLE") {
        summary = issuesCount === 0
            ? `✅ Agente SIMPLE validado correctamente. Modo de validación relajada aplicado.`
            : `⚠️ Agente SIMPLE con ${issuesCount} sugerencias de mejora. Validación relajada aplicada.`;
    } else if (classification === "COMPLEJO") {
        summary = issuesCount === 0
            ? `✅ Agente COMPLEJO validado correctamente. Cumple con arquitectura v2.`
            : `❌ Agente COMPLEJO con ${issuesCount} errores críticos. Requiere corrección para funcionar.`;
    } else {
        summary = issuesCount === 0
            ? `Validación completada con éxito en las ${areas.length} áreas.`
            : `Se encontraron problemas en la validación. Revisa los detalles.`;
    }

    // Las sugerencias no están en el nuevo formato del meta-prompt, se deja como array vacío.
    const suggestions = []; 

    return { 
        summary, 
        details, 
        suggestions,
        classification,
        validationMode
    };
}

/**
 * Clasifica automáticamente un agente como SIMPLE o COMPLEJO
 * @param {object} config - Configuración del agente
 * @returns {string} - "SIMPLE" o "COMPLEJO"
 */
function classifyAgent(config) {
    const isComplex = config.hasTools || config.hasForms || config.hasHandoffs || config.hasRAG;
    return isComplex ? "COMPLEJO" : "SIMPLE";
}

/**
 * Obtiene la configuración completa del agente (tools, handoffs, RAG, forms)
 * @param {number} agentId - El ID del agente
 * @returns {Promise<object>} - Configuración del agente con clasificación
 */
async function getAgentConfiguration(agentId) {
    // Obtener herramientas (APIs y Forms)
    const toolsQuery = `
        SELECT h.nombre, h.tipo, hr.nombre as ruta_nombre
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
            tools.push({ nombre: row.ruta_nombre });
        }
    });

    // Obtener handoffs
    const handoffsQuery = `
        SELECT ad.nombre 
        FROM cfg_agente_handoff h 
        JOIN cfg_agente ad ON h.to_agente_id = ad.id 
        WHERE h.from_agente_id = ? AND h.is_active = 1
    `;
    const handoffsRows = await db.query(handoffsQuery, [agentId]);
    const handoffs = handoffsRows.map(row => ({ nombre: row.nombre }));

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

    const config = {
        tools,
        forms,
        handoffs,
        ragCartridges,
        hasTools: tools.length > 0,
        hasForms: forms.length > 0,
        hasHandoffs: handoffs.length > 0,
        hasRAG: ragCartridges.length > 0
    };

    // Añadir clasificación automática
    config.classification = classifyAgent(config);
    config.validationMode = config.classification === "SIMPLE" ? "relajada" : "estricta";

    return config;
}

/**
 * Construye el meta-prompt de validación de forma contextual
 * @param {string} template - Template base del meta-prompt
 * @param {object} config - Configuración del agente
 * @param {string} currentPrompt - Prompt actual del agente
 * @param {string} agentName - Nombre del agente
 * @returns {string} - Meta-prompt contextual
 */
function buildContextualMetaPrompt(template, config, currentPrompt, agentName) {
    let contextualTemplate = template;

    // Reemplazar variables básicas
    contextualTemplate = contextualTemplate.replace('{{PROMPT_ACTUAL}}', currentPrompt);
    contextualTemplate = contextualTemplate.replace('{{AGENT_NAME}}', agentName);

    // Construir secciones condicionales
    if (config.hasTools) {
        contextualTemplate = contextualTemplate.replace('{{LISTA_DE_HERRAMIENTAS}}', JSON.stringify(config.tools, null, 2));
    } else {
        // Remover sección de herramientas si no las tiene
        contextualTemplate = contextualTemplate.replace(/## HERRAMIENTAS CONFIGURADAS[\s\S]*?```json\s*{{LISTA_DE_HERRAMIENTAS}}\s*```/g, '## HERRAMIENTAS CONFIGURADAS\nEste agente no tiene herramientas configuradas.');
    }

    if (config.hasHandoffs) {
        contextualTemplate = contextualTemplate.replace('{{LISTA_DE_HANDOFFS}}', JSON.stringify(config.handoffs, null, 2));
    } else {
        // Remover sección de handoffs si no los tiene
        contextualTemplate = contextualTemplate.replace(/## HANDOFFS CONFIGURADOS[\s\S]*?```json\s*{{LISTA_DE_HANDOFFS}}\s*```/g, '## HANDOFFS CONFIGURADOS\nEste agente no tiene handoffs configurados.');
    }

    if (config.hasRAG) {
        contextualTemplate = contextualTemplate.replace('{{LISTA_DE_RAG_CARTRIDGES}}', JSON.stringify(config.ragCartridges, null, 2));
    } else {
        // Remover sección de RAG si no los tiene
        contextualTemplate = contextualTemplate.replace(/## CARTUCHOS RAG DISPONIBLES[\s\S]*?```json\s*{{LISTA_DE_RAG_CARTRIDGES}}\s*```/g, '## CARTUCHOS RAG DISPONIBLES\nEste agente no tiene cartuchos RAG configurados.');
    }

    if (config.hasForms) {
        contextualTemplate = contextualTemplate.replace('{{LISTA_DE_FORMS}}', JSON.stringify(config.forms, null, 2));
    } else {
        // Remover sección de forms si no los tiene
        contextualTemplate = contextualTemplate.replace(/## FORMULARIOS CONFIGURADOS[\s\S]*?```json\s*{{LISTA_DE_FORMS}}\s*```/g, '## FORMULARIOS CONFIGURADOS\nEste agente no tiene formularios configurados.');
    }

    return contextualTemplate;
}

module.exports = {
    validateAgent,
};