const fs = require('fs');
const path = require('path');
const Database = require('./database'); // Database connection

/**
 * Servicio híbrido de prompts que lee desde BD con fallback a archivos .md
 * Implementa el patrón DB-first con modo degradado
 */
class PromptsHybridService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 2 * 60 * 1000; // 2 minutos - reducido para mayor agilidad
    this.dbConfigCache = null;
    this.dbConfigCacheTime = 0;
    this.DB_CONFIG_CACHE_DURATION = 30000; // 30 segundos para configuración DB
  }

  /**
   * Obtiene el prompt de un agente desde BD con fallback a archivos
   * @param {string} agentName - Nombre del agente (info, onboarding, clientes)
   * @param {string} language - Idioma (es, en)
   * @param {number} chatbotId - ID del chatbot (opcional)
   * @returns {Promise<string>} - Prompt completo del agente
   */
  async getPromptByAgent(agentName, language = 'es', chatbotId = null) {
    const cacheKey = `${agentName}_${language}_${chatbotId}`;
    
    // Verificar cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📋 Prompt cache hit: ${cacheKey}`);
        return cached.agent; // Devolver el objeto de agente completo
      }
    }

    try {
      // Intentar obtener desde BD primero (DB-first)
      const agent = await this.getPromptFromDatabase(agentName, language, chatbotId);
      
      // Guardar en cache el objeto de agente completo
      this.cache.set(cacheKey, {
        agent: agent,
        timestamp: Date.now()
      });
      
      console.log(`📋 Prompt loaded from DB: ${agentName} (${language})`);
      return agent;
      
    } catch (dbError) {
      console.warn(`⚠️ DB prompt failed for ${agentName}: ${dbError.message}`);
      console.log(`📁 Falling back to file system for ${agentName}`);
      
      // Fallback a archivos .md (devuelve un objeto parcial, puede que no tenga todo)
      const promptText = this.getPromptFromFiles(agentName, language);
      return { system_prompt_es: promptText, system_prompt_en: promptText, nombre: agentName };
    }
  }

  /**
   * Obtiene el prompt desde la base de datos
   * @param {string} agentName - Nombre del agente
   * @param {string} language - Idioma
   * @param {number} chatbotId - ID del chatbot (opcional)
   * @returns {Promise<object>} - Objeto de agente completo desde BD
   */
  async getPromptFromDatabase(agentName, language, chatbotId = null) {
    try {
      let agent;
      const query = 'SELECT id, nombre, system_prompt_es, system_prompt_en, temperatura, max_tokens, mensaje_bienvenida_es, mensaje_bienvenida_en, mensaje_retorno_es, mensaje_retorno_en, mensaje_despedida_es, mensaje_despedida_en FROM cfg_agente WHERE LOWER(nombre) = ? AND chatbot_id = ? AND is_active = 1';
      const agents = await Database.query(query, [agentName.toLowerCase(), chatbotId]);

      if (agents.length === 0) {
        throw new Error(`Agent ${agentName} not found for chatbot ${chatbotId}`);
      }
      
      agent = agents[0];

      // No es necesario combinar con common prompt aquí, se puede hacer en el llamador si es necesario.
      // La función ahora devuelve el objeto de agente completo.
      return agent;
      
    } catch (error) {
      throw new Error(`Database prompt error: ${error.message}`);
    }
  }

  /**
   * Obtiene el prompt desde archivos .md (modo degradado)
   * @param {string} agentName - Nombre del agente
   * @param {string} language - Idioma
   * @returns {string} - Prompt desde archivos
   */
  getPromptFromFiles(agentName, language) {
    try {
      const basePath = path.join(__dirname, '../prompts', language);
      const commonPath = path.join(basePath, 'common.md');
      const agentPath = path.join(basePath, `${agentName}.md`);

      let commonContent = '';
      let agentContent = '';

      // Leer archivo común si existe
      try {
        commonContent = fs.readFileSync(commonPath, 'utf8');
      } catch (commonError) {
        console.log(`ℹ️ No common.md found for ${language}`);
      }

      // Leer archivo del agente
      try {
        agentContent = fs.readFileSync(agentPath, 'utf8');
      } catch (agentError) {
        throw new Error(`Agent file ${agentName}.md not found for ${language}`);
      }

      const fullPrompt = commonContent ? `${commonContent}\n\n${agentContent}` : agentContent;
      console.log(`📁 Prompt loaded from files: ${agentName} (${language})`);
      
      return fullPrompt;
      
    } catch (error) {
      console.error(`❌ File prompt error for ${agentName}:`, error.message);
      return this.getDefaultPrompt(agentName);
    }
  }

  /**
   * Prompt por defecto en caso de fallo total
   * @param {string} agentName - Nombre del agente
   * @returns {string} - Prompt básico de emergencia
   */
  getDefaultPrompt(agentName) {
    const defaultPrompts = {
      info: 'Eres un asistente de información de Kargho. Ayuda al usuario con información básica.',
      onboarding: 'Eres un asistente de registro. Ayuda al usuario a completar su registro.',
      clientes: 'Eres un asistente de clientes. Ayuda al usuario con sus consultas.'
    };

    const prompt = defaultPrompts[agentName] || 'Eres un asistente virtual. Ayuda al usuario.';
    console.log(`🚨 Using default prompt for ${agentName}`);
    
    return prompt;
  }

  /**
   * Limpia el cache de prompts
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Prompts cache cleared');
  }

  /**
   * Verifica el estado del servicio
   * @returns {Promise<Object>} - Estado del servicio
   */
  async getStatus() {
    const status = {
      cache_size: this.cache.size,
      database_available: false,
      files_available: false
    };

    // Verificar BD
    try {
      await Database.query('SELECT 1');
      status.database_available = true;
    } catch (error) {
      console.log('DB not available for prompts service');
    }

    // Verificar archivos
    try {
      const promptsPath = path.join(__dirname, '../prompts');
      fs.accessSync(promptsPath, fs.constants.R_OK);
      status.files_available = true;
    } catch (error) {
      console.log('Files not available for prompts service');
    }

    return status;
  }
}

// Export singleton instance
const promptsService = new PromptsHybridService();

// Mantener compatibilidad con la interfaz existente
function getPromptByAgent(agent, language = 'es', chatbotId = null) {
  return promptsService.getPromptByAgent(agent, language, chatbotId);
}

module.exports = {
  getPromptByAgent,
  promptsService
};