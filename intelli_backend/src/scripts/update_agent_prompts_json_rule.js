// Aplica regla de salida JSON y formato de acciones a los system_prompt ES/EN
(async () => {
  try {
    const path = require('path');
    const fs = require('fs');
    const envPath = path.resolve(__dirname, '../../../.env');
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      console.log('✅ .env cargado:', envPath);
    }

    const Database = require('../database');
    await Database.initialize();

    const ruleES = [
      'REGLA DE SALIDA (AGENTES COMPLEJOS): Devuelve SIEMPRE JSON con la forma {"say":"...","action":{...}}.',
      'Define "action.type" ∈ {"call_tool","handoff","finish_turn"} y "action.payload" con los campos obligatorios.',
      'Especificaciones:',
      '- call_tool: { tool: "findByDotEmail"|"pendingDocuments"|"registerCarrier", args: { ... } }',
      '- handoff: { target: "CLIENTES"|"ONBOARDING", reason: "..." }',
      '- finish_turn: { reason: "..." }',
      'Evita duplicaciones; tono cordial, claro y directo.'
    ].join(' ');

    const ruleEN = [
      'OUTPUT RULE (COMPLEX AGENTS): ALWAYS return JSON {"say":"...","action":{...}}.',
      'Mandatory: "action.type" ∈ {"call_tool","handoff","finish_turn"} and "action.payload" with required fields.',
      'Specs:',
      '- call_tool: { tool: "findByDotEmail"|"pendingDocuments"|"registerCarrier", args: { ... } }',
      '- handoff: { target: "CLIENTES"|"ONBOARDING", reason: "..." }',
      '- finish_turn: { reason: "..." }',
      'Avoid duplication; be cordial, clear and direct.'
    ].join(' ');

    const targets = [1,2,3,4,7,8,103,104,105,107,200];
    for (const id of targets) {
      const rows = await Database.query('SELECT id, system_prompt_es, system_prompt_en FROM cfg_agente WHERE id = ?', [id]);
      if (!rows.length) continue;
      const cur = rows[0];
      let extraES = '';
      let extraEN = '';
      if (id === 1) {
        extraES = 'GENERAL: Usa handoff a UTILIDADES o DATOS según la intención del usuario; si no se requiere herramienta, termina con finish_turn. Respuestas breves.';
        extraEN = 'GENERAL: Use handoff to UTILIDADES or DATOS based on user intent; if no tool is needed, end with finish_turn. Keep responses short.';
      } else if (id === 2) {
        extraES = 'UTILIDADES: Emplea call_tool con "math-calc" o "unit-convert" y valida argumentos; no asumas unidades; devuelve resultado y finaliza con finish_turn.';
        extraEN = 'UTILIDADES: Use call_tool with "math-calc" or "unit-convert" validating arguments; do not assume units; return result and finish_turn.';
      } else if (id === 3) {
        extraES = 'DATOS: Usa call_tool con "crypto-price" o "weather-api" y valida argumentos (ciudad/fecha/moneda). Devuelve resumen breve; cita fuente si aplica.';
        extraEN = 'DATOS: Use call_tool with "crypto-price" or "weather-api" validating arguments (city/date/currency). Return a brief summary; cite source if applicable.';
      } else if (id === 4) {
        extraES = 'INFO: Acumula DOT y email; si ambos presentes, call_tool "findByDotEmail" con {dot_number,email}. Según resultado, handoff a CLIENTES u ONBOARDING con reason.';
        extraEN = 'INFO: Accumulate DOT and email; when both present, call_tool "findByDotEmail" with {dot_number,email}. Based on result, handoff to CLIENTES or ONBOARDING with reason.';
      } else if (id === 7) {
        extraES = 'ONBOARDING: Solicita y valida dot_number, email, language para "registerCarrier". No avances si faltan; confirma antes de invocar.';
        extraEN = 'ONBOARDING: Request and validate dot_number, email, language for "registerCarrier". Do not proceed if missing; confirm before invoking.';
      } else if (id === 8) {
        extraES = 'CLIENTES: Para validar documentación, usa "pendingDocuments" con { email } cuando esté disponible; cierra con finish_turn.';
        extraEN = 'CLIENTES: To validate documentation, use "pendingDocuments" with { email } when available; close with finish_turn.';
      } else if (id === 104) {
        extraES = [
          'ONBOARDING: Solicita y valida los campos requeridos por la herramienta "registerCarrier". Si faltan, pide explícitamente: dot_number, email, language. No avances si faltan.',
          'Ejemplo: {"say":"...","action":{"type":"call_tool","payload":{"tool":"registerCarrier","args":{"dot_number":"...","email":"...","language":"es"}}}}'
        ].join(' ');
        extraEN = [
          'ONBOARDING: Request and validate fields required by "registerCarrier". If missing, explicitly ask for: dot_number, email, language. Do not proceed if missing.',
          'Example: {"say":"...","action":{"type":"call_tool","payload":{"tool":"registerCarrier","args":{"dot_number":"...","email":"...","language":"en"}}}}'
        ].join(' ');
      } else if (id === 103) {
        extraES = 'INFO: No devuelvas claves vacías. Si "action.type"="call_tool", incluye "tool" y "args" con valores no vacíos y pertinentes.';
        extraEN = 'INFO: Do not return empty keys. If "action.type"="call_tool", include "tool" and "args" with non-empty, relevant values.';
      } else if (id === 105) {
        extraES = 'CLIENTES: Para validar documentación, usa "pendingDocuments" con { email } cuando dispongas del correo.';
        extraEN = 'CLIENTES: To validate documentation, use "pendingDocuments" with { email } when email is available.';
      } else if (id === 107) {
        extraES = 'FORM: Para "seleccion_ciudad" (form), usa call_tool con args requeridos; si corresponde, invoca "wttr_weather" después. Pide campos faltantes y no avances si faltan.';
        extraEN = 'FORM: For "seleccion_ciudad" (form), use call_tool with required args; if appropriate, invoke "wttr_weather" afterwards. Ask for missing fields and do not proceed if missing.';
      } else if (id === 200) {
        extraES = 'RAG: Si hay contexto relevante, responde citando fuentes (id/uri) y confiabilidad; si no hay, indícalo claramente. Mantén salida JSON y finaliza con finish_turn.';
        extraEN = 'RAG: If relevant context exists, respond citing sources (id/uri) and confidence; if none, state it clearly. Keep JSON output and finish_turn.';
      }
      const nextES = `${(cur.system_prompt_es || '').trim()}\n\n${ruleES}${extraES ? '\n\n' + extraES : ''}`.trim();
      const nextEN = `${(cur.system_prompt_en || '').trim()}\n\n${ruleEN}${extraEN ? '\n\n' + extraEN : ''}`.trim();
      await Database.query('UPDATE cfg_agente SET system_prompt_es = ?, system_prompt_en = ? WHERE id = ?', [nextES, nextEN, id]);
      console.log(`✅ Actualizado agente ${id}`);
    }

    await Database.close();
    console.log('✅ Regla JSON aplicada a INFO(103), ONBOARDING(104), CLIENTES(105)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error actualizando prompts:', err.message);
    process.exit(1);
  }
})();