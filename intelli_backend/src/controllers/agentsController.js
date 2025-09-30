const database = require('../database');
const { AppError, NotFoundError, ValidationError, DatabaseError } = require('../middleware/errorHandler');
const promptImprovementService = require('../services/promptImprovementService');
const validationService = require('../services/validationService');

/**
 * Agents Controller
 * Handles CRUD operations for agents
 */
class AgentsController {
  /**
   * Get all agents with pagination and filtering
   */
  async getAgents(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        q,
        llm_provider,
        is_active
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (q) {
        whereClause += ' AND (a.nombre LIKE ? OR a.descripcion LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
      }
      
      if (llm_provider) {
        whereClause += ' AND lp.nombre = ?';
        params.push(llm_provider);
      }
      
      if (is_active !== undefined) {
        whereClause += ' AND a.is_active = ?';
        params.push(is_active === 'true');
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM cfg_agente a 
        LEFT JOIN cfg_llm_modelo lm ON a.llm_modelo_id = lm.id
        LEFT JOIN cfg_llm_proveedor lp ON lm.proveedor_id = lp.id
        ${whereClause}
      `;
      
      const countResult = await database.query(countQuery, params);
      const total = countResult[0].total;
      
      // Get agents with usage stats and multi-language prompts
      const query = `
        SELECT 
          a.*,
          lm.nombre_modelo as llm_model_name,
          lp.nombre as llm_provider_name,
          lp.notas as llm_provider_description,
          COUNT(DISTINCT c.id) as chat_count,
          MAX(c.created_at) as last_used_at
        FROM cfg_agente a
        LEFT JOIN cfg_llm_modelo lm ON a.llm_modelo_id = lm.id
        LEFT JOIN cfg_llm_proveedor lp ON lm.proveedor_id = lp.id
        LEFT JOIN ejec_chat c ON a.chatbot_id = c.chatbot_id
        ${whereClause}
        GROUP BY a.id, lm.id, lp.id
        ORDER BY a.${sort} ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const agents = await database.query(query, params);
      
      // Process agents with multi-language support
      const processedAgents = agents.map(agent => ({
        ...agent,
        // Multi-language prompts support
        system_prompts: {
          es: agent.system_prompt_es || null,
          en: agent.system_prompt_en || null
        },
        // Legacy support
        system_prompt: agent.system_prompt_es || agent.system_prompt_en || null,
        metadata: agent.metadata ? JSON.parse(agent.metadata) : null
      }));
      
      res.json({
        success: true,
        data: {
          agents: processedAgents,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error in getAgents:', error);
      throw new DatabaseError('Failed to fetch agents', error);
    }
  }
  
  /**
   * Get single agent by ID
   */
  async getAgentById(req, res) {
    try {
      const { id } = req.params;
      const { lang } = req.query; // Obtener el parámetro de idioma
      
      const query = `
        SELECT 
          a.*,
          lm.nombre_modelo as llm_model_name,
          lp.nombre as llm_provider_name,
          lp.notas as llm_provider_description,
          COUNT(DISTINCT c.id) as chat_count,
          MAX(c.created_at) as last_used_at
        FROM cfg_agente a
        LEFT JOIN cfg_llm_modelo lm ON a.llm_modelo_id = lm.id
        LEFT JOIN cfg_llm_proveedor lp ON lm.proveedor_id = lp.id
        LEFT JOIN ejec_chat c ON a.chatbot_id = c.chatbot_id
        WHERE a.id = ?
        GROUP BY a.id, lm.id, lp.id
      `;
      
      const agent = await database.query(query, [id]);
      
      if (!agent) {
        throw new NotFoundError('Agent');
      }
      
      // Process agent with multi-language support
      const processedAgent = {
        ...agent,
        // Multi-language prompts support
        system_prompts: {
          es: agent.system_prompt_es || null,
          en: agent.system_prompt_en || null
        },
        // Legacy support - usar el idioma solicitado o español por defecto
        system_prompt: lang === 'en' ? 
          (agent.system_prompt_en || agent.system_prompt_es) : 
          (agent.system_prompt_es || agent.system_prompt_en),
        metadata: agent.metadata ? JSON.parse(agent.metadata) : null
      };
      
      // Get associated prompts from cfg_agente_prompt table
      const promptsQuery = `
        SELECT id, nombre, contenido, created_at, updated_at
        FROM cfg_agente_prompt 
        WHERE agente_id = ?
        ORDER BY created_at DESC
      `;
      
      const prompts = await database.query(promptsQuery, [id]);
      processedAgent.custom_prompts = prompts;
      
      res.json({
        success: true,
        data: processedAgent
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch agent', error);
    }
  }
  
  /**
   * Create new agent
   */
  async createAgent(req, res) {
    try {
      const {
        nombre,
        descripcion,
        system_prompt_es,
        system_prompt_en,
        llm_modelo_id,
        temperatura = 0.7,
        max_tokens = 2000,
        is_active = true,
        metadata = null,
        chatbot_id
      } = req.body;
      
      // Validate required fields
      if (!nombre || (!system_prompt_es && !system_prompt_en) || !llm_modelo_id) {
        throw new ValidationError('nombre, at least one system_prompt (es or en), and llm_modelo_id are required');
      }
      
      // Validate LLM model exists
      const modelQuery = `
        SELECT lm.id, lp.nombre as provider_name 
        FROM cfg_llm_modelo lm
        JOIN cfg_llm_proveedor lp ON lm.proveedor_id = lp.id
        WHERE lm.id = ? AND lm.activo = TRUE AND lp.activo = TRUE
      `;
      const model = await database.query(modelQuery, [llm_modelo_id]);
      
      if (!model) {
        throw new ValidationError('Invalid LLM model ID or model is not active');
      }
      
      const insertQuery = `
        INSERT INTO cfg_agente (
          nombre, descripcion, system_prompt_es, system_prompt_en, 
          llm_modelo_id, temperatura, max_tokens, activo, metadata,
          chatbot_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const result = await database.query(insertQuery, [
        nombre,
        descripcion,
        system_prompt_es,
        system_prompt_en,
        llm_modelo_id,
        temperatura,
        max_tokens,
        is_active,
        metadata ? JSON.stringify(metadata) : null,
        chatbot_id
      ]);
      
      // Get the created agent
      const createdAgent = await this.getAgentById(
        { params: { id: result.insertId } },
        { json: (data) => data }
      );
      
      res.status(201).json({
        success: true,
        data: createdAgent.data,
        message: 'Agent created successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to create agent', error);
    }
  }
  
  /**
   * Update agent
   */
  async updateAgent(req, res) {
    try {
      const { id } = req.params;
      const {
        nombre,
        descripcion,
        system_prompt_es,
        system_prompt_en,
        llm_modelo_id,
        temperatura,
        max_tokens,
        activo,
        metadata
      } = req.body;
      
      // Check if agent exists
      const existingAgent = await database.query(
        'SELECT id FROM cfg_agente WHERE id = ?',
        [id]
      );
      
      if (!existingAgent) {
        throw new NotFoundError('Agent');
      }
      
      // Validate LLM model if provided
      if (llm_modelo_id !== undefined) {
        const modelQuery = `
          SELECT lm.id, lp.nombre as provider_name 
          FROM cfg_llm_modelo lm
          JOIN cfg_llm_proveedor lp ON lm.proveedor_id = lp.id
          WHERE lm.id = ? AND lm.activo = TRUE AND lp.activo = TRUE
        `;
        const model = await database.query(modelQuery, [llm_modelo_id]);
        
        if (!model) {
          throw new ValidationError('Invalid LLM model ID or model is not active');
        }
      }
      
      // Build update query dynamically
      const updates = [];
      const params = [];
      
      if (nombre !== undefined) {
        updates.push('nombre = ?');
        params.push(nombre);
      }
      
      if (descripcion !== undefined) {
        updates.push('descripcion = ?');
        params.push(descripcion);
      }
      
      if (system_prompt_es !== undefined) {
        updates.push('system_prompt_es = ?');
        params.push(system_prompt_es);
      }
      
      if (system_prompt_en !== undefined) {
        updates.push('system_prompt_en = ?');
        params.push(system_prompt_en);
      }
      
      if (llm_modelo_id !== undefined) {
        updates.push('llm_modelo_id = ?');
        params.push(llm_modelo_id);
      }
      
      if (temperatura !== undefined) {
        updates.push('temperatura = ?');
        params.push(temperatura);
      }
      
      if (max_tokens !== undefined) {
        updates.push('max_tokens = ?');
        params.push(max_tokens);
      }
      
      if (activo !== undefined) {
        updates.push('activo = ?');
        params.push(activo);
      }
      
      if (metadata !== undefined) {
        updates.push('metadata = ?');
        params.push(metadata ? JSON.stringify(metadata) : null);
      }
      
      if (updates.length === 0) {
        throw new ValidationError('No valid fields to update');
      }
      
      updates.push('updated_at = NOW()');
      params.push(id);
      
      const query = `UPDATE cfg_agente SET ${updates.join(', ')} WHERE id = ?`;
      const result = await database.query(query, params);
      
      res.json({
        success: true,
        message: 'Agent updated successfully',
        affected_rows: result.affectedRows
      });
    } catch (error) {
      console.error('Update agent error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage
      });
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update agent', error);
    }
  }
  
  /**
   * Delete agent (soft delete)
   */
  async deleteAgent(req, res) {
    try {
      const { id } = req.params;
      
      // Check if agent exists
      const existingAgent = await database.query(
        'SELECT id FROM cfg_agente WHERE id = ?',
        [id]
      );
      
      if (!existingAgent) {
        throw new NotFoundError('Agent');
      }
      
      // Check if agent is being used in active chats
      const activeChats = await database.query(
        'SELECT COUNT(*) as count FROM ejec_chat WHERE chatbot_id = (SELECT chatbot_id FROM cfg_agente WHERE id = ?) AND estado = "activo"',
        [id]
      );
      
      if (activeChats.count > 0) {
        throw new ValidationError(
          `Cannot delete agent: ${activeChats.count} active chat(s) are using this agent`
        );
      }
      
      // Soft delete (set activo to false)
      await database.query(
        'UPDATE cfg_agente SET activo = FALSE, updated_at = NOW() WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        message: 'Agent deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete agent', error);
    }
  }
  
  /**
   * Test agent configuration
   */
  async testAgent(req, res) {
    try {
      const { id } = req.params;
      const { test_message = 'Hello, this is a test message.' } = req.body;
      
      // Get agent configuration with LLM provider
      const agent = await database.query(
        `SELECT a.*, lp.name as llm_provider_name, lp.display_name as llm_provider_display_name
         FROM agents a
         LEFT JOIN llms_providers lp ON a.llm_provider_id = lp.id
         WHERE a.id = ? AND a.is_active = TRUE`,
        [id]
      );
      
      if (!agent) {
        throw new NotFoundError('Agent not found or inactive');
      }
      
      // Import LLM service (assuming it exists)
      const llmService = require('../llm');
      
      // Test the agent with a simple message
      const testResult = await llmService.generateResponse({
        provider: agent.llm_provider_name,
        model: agent.llm_model,
        messages: [
          { role: 'system', content: agent.system_prompt },
          { role: 'user', content: test_message }
        ],
        temperature: agent.temperature,
        max_tokens: agent.max_tokens
      });
      
      res.json({
        success: true,
        data: {
          agent_id: id,
          agent_name: agent.name,
          test_message,
          response: testResult.content,
          usage: testResult.usage || null
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new AppError(`Agent test failed: ${error.message}`, 500);
    }
  }
  
  /**
   * Get agent statistics
   */
  async getAgentStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_agents,
          COUNT(CASE WHEN a.is_active = TRUE THEN 1 END) as active_agents,
          COUNT(CASE WHEN lp.name = 'openai' THEN 1 END) as openai_agents,
          COUNT(CASE WHEN lp.name = 'groq' THEN 1 END) as groq_agents,
          COUNT(CASE WHEN lp.name = 'anthropic' THEN 1 END) as anthropic_agents
        FROM agents a
        LEFT JOIN llms_providers lp ON a.llm_provider_id = lp.id
      `;
      
      const stats = await database.query(statsQuery);
      
      // Get usage stats
      const usageQuery = `
        SELECT 
          a.id,
          a.name,
          COUNT(c.id) as chat_count,
          MAX(c.created_at) as last_used_at
        FROM agents a
        LEFT JOIN ejec_chat c ON a.id = c.agent_id
        WHERE a.is_active = TRUE
        GROUP BY a.id
        ORDER BY chat_count DESC
        LIMIT 10
      `;
      
      const topAgents = await database.query(usageQuery);
      
      res.json({
        success: true,
        data: {
          ...stats,
          top_agents: topAgents
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch agent statistics', error);
    }
  }

  /**
   * Get tools assigned to agent
   */
  async getAgentTools(req, res) {
    try {
      const { id } = req.params;
      
      // Check if agent exists
      const agent = await database.query(
        'SELECT id, name, tools FROM agents WHERE id = ? AND is_active = TRUE',
        [id]
      );
      
      if (!agent) {
        throw new NotFoundError('Agent');
      }
      
      const toolIds = agent.tools ? JSON.parse(agent.tools) : [];
      
      if (toolIds.length === 0) {
        return res.json({
          success: true,
          data: {
            agent_id: id,
            agent_name: agent.name,
            tools: []
          }
        });
      }
      
      // Get tool details
      const toolsQuery = `
        SELECT id, name, description, function_name, version, is_active
        FROM tools 
        WHERE id IN (${toolIds.map(() => '?').join(',')})
        ORDER BY name
      `;
      
      const tools = await database.query(toolsQuery, toolIds);
      
      res.json({
        success: true,
        data: {
          agent_id: id,
          agent_name: agent.name,
          tools
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch agent tools', error);
    }
  }

  /**
   * Assign tools to agent
   */
  async assignAgentTools(req, res) {
    try {
      const { id } = req.params;
      const { tool_ids } = req.body;
      
      if (!Array.isArray(tool_ids) || tool_ids.length === 0) {
        throw new ValidationError('tool_ids must be a non-empty array');
      }
      
      // Check if agent exists
      const agent = await database.query(
        'SELECT id, name, tools FROM agents WHERE id = ? AND is_active = TRUE',
        [id]
      );
      
      if (!agent) {
        throw new NotFoundError('Agent');
      }
      
      // Validate all tools exist and are active
      const toolsQuery = `
        SELECT id FROM tools 
        WHERE id IN (${tool_ids.map(() => '?').join(',')}) 
        AND is_active = TRUE
      `;
      
      const existingTools = await database.query(toolsQuery, tool_ids);
      
      if (existingTools.length !== tool_ids.length) {
        throw new ValidationError('One or more tool IDs are invalid or inactive');
      }
      
      // Get current tools and merge with new ones (avoid duplicates)
      const currentTools = agent.tools ? JSON.parse(agent.tools) : [];
      const mergedTools = [...new Set([...currentTools, ...tool_ids])];
      
      // Update agent with new tools
      await database.query(
        'UPDATE agents SET tools = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(mergedTools), id]
      );
      
      // Get updated tool details
      const updatedToolsQuery = `
        SELECT id, name, description, function_name, version
        FROM tools 
        WHERE id IN (${mergedTools.map(() => '?').join(',')})
        AND is_active = TRUE
        ORDER BY name
      `;
      
      const updatedTools = await database.query(updatedToolsQuery, mergedTools);
      
      res.json({
        success: true,
        message: 'Tools assigned successfully',
        data: {
          agent_id: id,
          agent_name: agent.name,
          tools: updatedTools
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to assign tools to agent', error);
    }
  }

  /**
   * Get available LLM providers
   */
  async getLLMProviders(req, res) {
    try {
      const query = `
        SELECT id, name, display_name, description, is_active
        FROM llms_providers
        WHERE is_active = TRUE
        ORDER BY display_name
      `;
      
      const providers = await database.query(query);
      
      res.json({
        success: true,
        data: providers
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch LLM providers', error);
    }
  }

  /**
   * Remove tool from agent
   */
  async removeAgentTool(req, res) {
    try {
      const { id, toolId } = req.params;
      
      // Check if agent exists
      const agent = await database.query(
        'SELECT id, name, tools FROM agents WHERE id = ? AND is_active = TRUE',
        [id]
      );
      
      if (!agent) {
        throw new NotFoundError('Agent');
      }
      
      const currentTools = agent.tools ? JSON.parse(agent.tools) : [];
      
      if (!currentTools.includes(parseInt(toolId))) {
        throw new NotFoundError('Tool not assigned to this agent');
      }
      
      // Remove tool from array
      const updatedTools = currentTools.filter(tid => tid !== parseInt(toolId));
      
      // Update agent
      await database.query(
        'UPDATE agents SET tools = ?, updated_at = NOW() WHERE id = ?',
        [updatedTools.length > 0 ? JSON.stringify(updatedTools) : null, id]
      );
      
      res.json({
        success: true,
        message: 'Tool removed from agent successfully',
        data: {
          agent_id: id,
          agent_name: agent.name,
          removed_tool_id: parseInt(toolId),
          remaining_tools: updatedTools
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to remove tool from agent', error);
    }
  }

  /**
   * Get custom prompts for agent
   */
  async getAgentPrompts(req, res) {
    try {
      const { id: agentId } = req.params;
      
      // Check if agent exists
      const agent = await database.query(
        'SELECT id, nombre FROM cfg_agente WHERE id = ?',
        [agentId]
      );
      
      if (!agent) {
        throw new NotFoundError('Agent');
      }
      
      // Get custom prompts for this agent
      const prompts = await database.query(
        `SELECT 
          id,
          nombre,
          contenido,
          created_at,
          updated_at
        FROM cfg_agente_prompt 
        WHERE agente_id = ?
        ORDER BY created_at DESC`,
        [agentId]
      );
      
      res.json({
        success: true,
        data: {
          agent: agent,
          prompts: prompts
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to get agent prompts', error);
    }
  }

  /**
   * Test agent with multi-language prompt
   */
  async testAgentMultiLang(req, res) {
    try {
      const { id: agentId } = req.params;
      const { 
        system_prompt_es, 
        system_prompt_en, 
        language = 'es', 
        test_message = 'Hola, ¿cómo estás?' 
      } = req.body;
      
      // Get agent configuration
      const agent = await database.query(
        `SELECT 
          a.id,
          a.nombre,
          a.llm_modelo_id,
          a.temperatura,
          a.max_tokens,
          m.nombre as modelo_nombre,
          p.nombre as proveedor_nombre,
          p.api_key,
          p.base_url
        FROM cfg_agente a
        JOIN cfg_llm_modelo m ON a.llm_modelo_id = m.id
        JOIN cfg_llm_proveedor p ON m.proveedor_id = p.id
        WHERE a.id = ? AND a.activo = 1`,
        [agentId]
      );
      
      if (!agent) {
        throw new NotFoundError('Agent or agent is not active');
      }
      
      // Select appropriate prompt based on language
      let selectedPrompt;
      if (language === 'en' && system_prompt_en) {
        selectedPrompt = system_prompt_en;
      } else if (language === 'es' && system_prompt_es) {
        selectedPrompt = system_prompt_es;
      } else {
        // Fallback to available prompt
        selectedPrompt = system_prompt_es || system_prompt_en;
      }
      
      if (!selectedPrompt) {
        throw new ValidationError('No prompt content available for testing');
      }
      
      // Here you would integrate with your LLM service
      // For now, we'll return a mock response
      const mockResponse = {
        agent_id: agentId,
        agent_name: agent.nombre,
        model: agent.modelo_nombre,
        provider: agent.proveedor_nombre,
        language_used: language,
        system_prompt_used: selectedPrompt,
        test_message: test_message,
        response: `Test response from ${agent.nombre} using ${language} prompt. Model: ${agent.modelo_nombre}`,
        timestamp: new Date().toISOString(),
        settings: {
          temperature: agent.temperatura,
          max_tokens: agent.max_tokens
        }
      };
      
      res.json({
        success: true,
        data: mockResponse,
        message: 'Agent test completed successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to test agent', error);
    }
  }

  /**
   * Get clients for prompt editor
   */
  async getClients(req, res) {
    try {
      const query = `
        SELECT id as cliente_id, nombre, descripcion
        FROM cfg_cliente
        WHERE is_active = 1
        ORDER BY nombre ASC
      `;
      
      const clients = await database.query(query);
      
      res.json({
        success: true,
        data: clients
      });
      
    } catch (error) {
      console.error('Error getting clients:', error);
      throw new DatabaseError('Failed to fetch clients');
    }
  }

  /**
   * Get chatbots by client for prompt editor
   */
  async getChatbotsByClient(req, res) {
    try {
      const { cliente_id } = req.query;
      
      if (!cliente_id) {
        throw new ValidationError('cliente_id is required');
      }
      
      const query = `
        SELECT id as chatbot_id, nombre, descripcion
        FROM cfg_chatbot
        WHERE cliente_id = ? AND is_active = 1
        ORDER BY nombre ASC
      `;
      
      const chatbots = await database.query(query, [cliente_id]);
      
      res.json({
        success: true,
        data: chatbots
      });
      
    } catch (error) {
      console.error('Error getting chatbots:', error);
      throw new DatabaseError('Failed to fetch chatbots');
    }
  }

  /**
   * Get agents by client and chatbot for prompt editor
   */
  async getAgentsByClientChatbot(req, res) {
    try {
      const { cliente_id, chatbot_id } = req.query;
      
      if (!cliente_id || !chatbot_id) {
        throw new ValidationError('cliente_id and chatbot_id are required');
      }
      
      const query = `
        SELECT id as agente_id, nombre as rol, is_active as estado, system_prompt_es as system_prompt, created_at
        FROM cfg_agente
        WHERE chatbot_id = ?
        ORDER BY nombre ASC
      `;
      
      const agents = await database.query(query, [chatbot_id]);
      
      res.json({
        success: true,
        data: agents
      });
      
    } catch (error) {
      console.error('Error getting agents:', error);
      throw new DatabaseError('Failed to fetch agents');
    }
  }

  /**
   * Get agent tools for prompt editor
   */
  async getAgentToolsForEditor(req, res) {
    try {
      const { id } = req.params;

      // New query with a simple LEFT JOIN
      const query = `
        SELECT 
          h.id,
          h.nombre,
          h.descripcion,
          h.base_url,
          h.tipo,
          auth.nombre as auth_name,
          r.nombre as route_name,
          r.path as endpoint_path,
          r.metodo as endpoint_method,
          r.notas as endpoint_description
        FROM cfg_herramienta h
        LEFT JOIN cfg_herramienta_auth auth ON h.herramienta_auth_id = auth.id
        LEFT JOIN cfg_herramienta_ruta r ON h.id = r.herramienta_id
        WHERE h.agente_id = ? AND h.is_active = 1
        ORDER BY h.nombre, r.nombre
      `;
      
      const toolsResult = await database.query(query, [id]);

      // Process the flat list into the desired structure
      const invocables_api = toolsResult
        .filter(h => (h.tipo === 'api' || h.tipo === 'mcp') && h.route_name)
        .map(h => ({
          nombre: h.route_name,
          descripcion: h.endpoint_description || h.descripcion,
          endpoint: `${h.endpoint_method.toUpperCase()} ${h.base_url || ''}${h.endpoint_path}`,
          auth: h.auth_name || 'none'
        }));

      const forms = {};
      toolsResult.forEach(h => {
        if (h.tipo === 'form') {
          forms[h.id] = {
            nombre: h.nombre,
            descripcion: h.descripcion
          };
        }
      });
      const invocables_form = Object.values(forms);
      
      res.json({
        success: true,
        data: {
          apis: invocables_api,
          forms: invocables_form
        }
      });
      
    } catch (error) {
      console.error('Error getting agent tools for editor:', error);
      throw new DatabaseError('Failed to fetch agent tools for editor');
    }
  }

  /**
   * Get agent handoffs for prompt editor
   */
  async getAgentHandoffs(req, res) {
    try {
      const { id } = req.params;
      
      const query = `
        SELECT 
          ah.id,
          ah.from_agente_id,
          ah.trigger_codigo,
          ah.to_agente_id,
          ah.is_active
        FROM cfg_agente_handoff ah
        WHERE ah.from_agente_id = ? AND ah.is_active = 1
        ORDER BY ah.trigger_codigo ASC
      `;
      
      const handoffs = await database.query(query, [id]);
      
      res.json({
        success: true,
        data: handoffs
      });
      
    } catch (error) {
      console.error('Error getting agent handoffs:', error);
      throw new DatabaseError('Failed to fetch agent handoffs');
    }
  }

  /**
   * Update agent system prompt
   */
  async updateAgentPrompt(req, res) {
    try {
      const { id } = req.params;
      const { system_prompt } = req.body;
      
      if (!system_prompt) {
        throw new ValidationError('system_prompt is required');
      }
      
      // Check if agent exists
      const checkQuery = 'SELECT id FROM cfg_agente WHERE id = ?';
      const existingAgent = await database.query(checkQuery, [id]);
      
      if (existingAgent.length === 0) {
        throw new NotFoundError('Agent not found');
      }
      
      // Update system prompt
      const updateQuery = `
        UPDATE cfg_agente 
        SET system_prompt_es = ?, updated_at = NOW()
        WHERE id = ?
      `;
      
      await database.query(updateQuery, [system_prompt, id]);
      
      res.json({
        success: true,
        message: 'System prompt updated successfully',
        data: {
          agente_id: id,
          system_prompt: system_prompt,
          updated_at: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Error updating agent prompt:', error);
      throw error;
    }
  }

  async improvePrompt(req, res) {
    const { id } = req.params;
    const { current_prompt, user_suggestion } = req.body;

    if (!current_prompt) {
      return res.status(400).json({ success: false, message: 'El prompt actual es requerido.' });
    }

    try {
      const combinedResponse = await promptImprovementService.improvePrompt(id, current_prompt, user_suggestion);
      
      const parts = combinedResponse.split('===PROMPT_DIVIDER===');
      const suggestions = {
        notes: parts[0] ? parts[0].trim() : 'No se generaron notas.',
        example_prompt: parts[1] ? parts[1].trim() : 'No se generó un prompt de ejemplo.'
      };

      console.log('[IMPROVE_PROMPT_CONTROLLER] Parsed suggestions object:', suggestions);

      res.json({ success: true, suggestions });
    } catch (error) {
      console.error(`Error improving prompt for agent ${id}:`, error);
      res.status(500).json({ success: false, message: 'Error al generar sugerencias del LLM.' });
    }
  }

  /**
   * Get RAG cartridges associated with agent
   */
  async getAgentRAGCartridges(req, res) {
    try {
      const { id } = req.params;
      
      // Check if agent exists
      const checkQuery = 'SELECT id FROM cfg_agente WHERE id = ?';
      const existingAgent = await database.query(checkQuery, [id]);
      
      if (existingAgent.length === 0) {
        throw new NotFoundError('Agent not found');
      }
      
      // Get RAG cartridges associated with the agent
      const query = `
        SELECT 
          rc.id,
          rc.nombre,
          rc.dominio_tag,
          rc.proveedor,
          rc.indice_nombre,
          rc.habilitado as activo,
          arc.creado_en as associated_at
        FROM cfg_rag_cartucho rc
        INNER JOIN cfg_agente_rag_cartucho arc ON rc.id = arc.cartucho_id
        WHERE arc.agente_id = ?
        ORDER BY rc.nombre ASC
      `;
      
      const ragCartridges = await database.query(query, [id]);
      
      res.json({
        success: true,
        data: ragCartridges
      });
      
    } catch (error) {
      console.error('Error getting agent RAG cartridges:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch agent RAG cartridges');
    }
  }

  /**
   * Validate agent consistency
   */
  async validateAgent(req, res) {
    const { id } = req.params;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, message: 'El texto del prompt es requerido para la validación.' });
    }

    try {
      const report = await validationService.validateAgent(id, prompt);
      res.json({ success: true, data: { report } });
    } catch (error) {
      console.error(`Error validating agent ${id}:`, error);
      res.status(500).json({ success: false, message: 'Error al validar el agente.' });
    }
  }
}

module.exports = AgentsController;