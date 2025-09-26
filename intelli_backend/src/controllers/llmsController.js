const database = require('../database');
const EncryptionService = require('../services/encryption');
const { AppError, NotFoundError, ValidationError, DatabaseError } = require('../middleware/errorHandler');

/**
 * LLMs Controller
 * Handles CRUD operations for LLM providers with credential encryption
 */
class LLMsController {
  constructor() {
    this.encryptionService = new EncryptionService();
  }
  
  /**
   * Get all LLMs with pagination and filtering
   */
  async getLLMs(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        q,
        provider,
        is_active
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (q) {
        whereClause += ' AND (l.name LIKE ? OR l.description LIKE ? OR l.model_name LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      
      if (provider) {
        whereClause += ' AND l.provider = ?';
        params.push(provider);
      }
      
      if (is_active !== undefined) {
        whereClause += ' AND l.is_active = ?';
        params.push(is_active === 'true');
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM llms l 
        ${whereClause}
      `;
      
      const countResult = await database.query(countQuery, params);
      const total = countResult.total;
      
      // Get LLMs with usage stats
      const query = `
        SELECT 
          l.*,
          COUNT(DISTINCT a.id) as agent_count
        FROM llms l
        LEFT JOIN agents a ON a.llm_id = l.id
        ${whereClause}
        GROUP BY l.id
        ORDER BY ${sort} ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const llms = await database.query(query, params);
      
      // Process LLMs (remove sensitive data and parse JSON)
      const processedLLMs = llms.map(llm => {
        const { api_key, ...safeLLM } = llm;
        return {
          ...safeLLM,
          configuration: llm.configuration ? JSON.parse(llm.configuration) : {},
          metadata: llm.metadata ? JSON.parse(llm.metadata) : null,
          has_credentials: !!api_key
        };
      });
      
      res.json({
        success: true,
        data: {
          llms: processedLLMs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch LLMs', error);
    }
  }
  
  /**
   * Get single LLM by ID
   */
  async getLLMById(req, res) {
    try {
      const { id } = req.params;
      const { include_credentials = false } = req.query;
      
      const query = `
        SELECT 
          l.*,
          COUNT(DISTINCT a.id) as agent_count
        FROM llms l
        LEFT JOIN agents a ON a.llm_id = l.id
        WHERE l.id = ?
        GROUP BY l.id
      `;
      
      const llm = await database.query(query, [id]);
      
      if (!llm) {
        throw new NotFoundError('LLM');
      }
      
      // Process LLM data
      let processedLLM = {
        ...llm,
        configuration: llm.configuration ? JSON.parse(llm.configuration) : {},
        metadata: llm.metadata ? JSON.parse(llm.metadata) : null,
        has_credentials: !!llm.api_key
      };
      
      // Include decrypted credentials if requested and user has permission
      if (include_credentials === 'true' && req.user?.role === 'admin') {
        if (llm.api_key) {
          try {
            processedLLM.api_key = this.encryptionService.decrypt(llm.api_key);
          } catch (error) {
            processedLLM.api_key_error = 'Failed to decrypt credentials';
          }
        }
      } else {
        delete processedLLM.api_key;
      }
      
      // Get agents using this LLM
      const agentsQuery = `
        SELECT id, name, description
        FROM agents 
        WHERE llm_id = ?
        AND is_active = TRUE
      `;
      
      const agents = await database.query(agentsQuery, [id]);
      processedLLM.used_by_agents = agents;
      
      res.json({
        success: true,
        data: processedLLM
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch LLM', error);
    }
  }
  
  /**
   * Create new LLM
   */
  async createLLM(req, res) {
    try {
      const {
        name,
        description,
        provider,
        model_name,
        api_key,
        api_endpoint,
        configuration,
        is_active = true,
        metadata
      } = req.body;
      
      // Validate provider
      const validProviders = ['openai', 'anthropic', 'groq', 'google', 'custom'];
      if (!validProviders.includes(provider)) {
        throw new ValidationError(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
      }
      
      // Encrypt API key if provided
      let encryptedApiKey = null;
      if (api_key) {
        encryptedApiKey = this.encryptionService.encrypt(api_key);
      }
      
      // Validate configuration
      if (configuration && typeof configuration !== 'object') {
        throw new ValidationError('Configuration must be a valid JSON object');
      }
      
      const query = `
        INSERT INTO llms (
          name, description, provider, model_name, api_key, api_endpoint, 
          configuration, is_active, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await database.query(query, [
        name,
        description || null,
        provider,
        model_name,
        encryptedApiKey,
        api_endpoint || null,
        configuration ? JSON.stringify(configuration) : null,
        is_active,
        metadata ? JSON.stringify(metadata) : null
      ]);
      
      // Get the created LLM (without sensitive data)
      const newLLM = await database.query(
        'SELECT * FROM llms WHERE id = ?',
        [result.insertId]
      );
      
      // Process response (remove sensitive data)
      const { api_key: _, ...safeLLM } = newLLM;
      const processedLLM = {
        ...safeLLM,
        configuration: newLLM.configuration ? JSON.parse(newLLM.configuration) : {},
        metadata: newLLM.metadata ? JSON.parse(newLLM.metadata) : null,
        has_credentials: !!encryptedApiKey
      };
      
      res.status(201).json({
        success: true,
        data: processedLLM
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ValidationError('LLM name already exists');
      }
      throw new DatabaseError('Failed to create LLM', error);
    }
  }
  
  /**
   * Update LLM
   */
  async updateLLM(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        provider,
        model_name,
        api_key,
        api_endpoint,
        configuration,
        is_active,
        metadata
      } = req.body;
      
      // Check if LLM exists
      const existingLLM = await database.query(
        'SELECT id FROM llms WHERE id = ?',
        [id]
      );
      
      if (!existingLLM) {
        throw new NotFoundError('LLM');
      }
      
      // Validate provider if being updated
      if (provider) {
        const validProviders = ['openai', 'anthropic', 'groq', 'google', 'custom'];
        if (!validProviders.includes(provider)) {
          throw new ValidationError(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
        }
      }
      
      // Validate configuration
      if (configuration && typeof configuration !== 'object') {
        throw new ValidationError('Configuration must be a valid JSON object');
      }
      
      // Build update query dynamically
      const updates = [];
      const params = [];
      
      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      
      if (provider !== undefined) {
        updates.push('provider = ?');
        params.push(provider);
      }
      
      if (model_name !== undefined) {
        updates.push('model_name = ?');
        params.push(model_name);
      }
      
      if (api_key !== undefined) {
        updates.push('api_key = ?');
        params.push(api_key ? this.encryptionService.encrypt(api_key) : null);
      }
      
      if (api_endpoint !== undefined) {
        updates.push('api_endpoint = ?');
        params.push(api_endpoint);
      }
      
      if (configuration !== undefined) {
        updates.push('configuration = ?');
        params.push(configuration ? JSON.stringify(configuration) : null);
      }
      
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
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
      
      const query = `UPDATE llms SET ${updates.join(', ')} WHERE id = ?`;
      await database.query(query, params);
      
      // Get updated LLM (without sensitive data)
      const updatedLLM = await database.query(
        'SELECT * FROM llms WHERE id = ?',
        [id]
      );
      
      // Process response
      const { api_key: _, ...safeLLM } = updatedLLM;
      const processedLLM = {
        ...safeLLM,
        configuration: updatedLLM.configuration ? JSON.parse(updatedLLM.configuration) : {},
        metadata: updatedLLM.metadata ? JSON.parse(updatedLLM.metadata) : null,
        has_credentials: !!updatedLLM.api_key
      };
      
      res.json({
        success: true,
        data: processedLLM
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update LLM', error);
    }
  }
  
  /**
   * Delete LLM (soft delete)
   */
  async deleteLLM(req, res) {
    try {
      const { id } = req.params;
      
      // Check if LLM exists
      const existingLLM = await database.query(
        'SELECT id FROM llms WHERE id = ?',
        [id]
      );
      
      if (!existingLLM) {
        throw new NotFoundError('LLM');
      }
      
      // Check if LLM is being used by active agents
      const activeAgents = await database.query(
        'SELECT COUNT(*) as count FROM agents WHERE llm_id = ? AND is_active = TRUE',
        [id]
      );
      
      if (activeAgents.count > 0) {
        throw new ValidationError(
          `Cannot delete LLM: ${activeAgents.count} active agent(s) are using this LLM`
        );
      }
      
      // Soft delete (set is_active to false)
      await database.query(
        'UPDATE llms SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        message: 'LLM deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete LLM', error);
    }
  }
  
  /**
   * Test LLM connection
   */
  async testLLM(req, res) {
    try {
      const { id } = req.params;
      const { test_message = 'Hello, this is a test message.' } = req.body;
      
      // Get LLM configuration
      const llm = await database.query(
        'SELECT * FROM llms WHERE id = ? AND is_active = TRUE',
        [id]
      );
      
      if (!llm) {
        throw new NotFoundError('LLM not found or inactive');
      }
      
      if (!llm.api_key) {
        throw new ValidationError('LLM has no API credentials configured');
      }
      
      // Decrypt API key
      let decryptedApiKey;
      try {
        decryptedApiKey = this.encryptionService.decrypt(llm.api_key);
      } catch (error) {
        throw new AppError('Failed to decrypt LLM credentials', 500);
      }
      
      // Import LLM service (assuming it exists)
      const llmService = require('../llm');
      
      // Test the LLM connection
      const testResult = await llmService.testConnection({
        provider: llm.provider,
        model: llm.model_name,
        apiKey: decryptedApiKey,
        endpoint: llm.api_endpoint,
        configuration: llm.configuration ? JSON.parse(llm.configuration) : {},
        testMessage: test_message
      });
      
      res.json({
        success: true,
        data: {
          llm_id: id,
          llm_name: llm.name,
          provider: llm.provider,
          model: llm.model_name,
          test_message,
          response: testResult.response,
          latency: testResult.latency,
          tokens_used: testResult.tokens_used
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new AppError(`LLM test failed: ${error.message}`, 500);
    }
  }
  
  /**
   * Get LLM providers
   */
  async getLLMProviders(req, res) {
    try {
      const query = `
        SELECT 
          id,
          name,
          description,
          \`key\`,
          is_active,
          created_at,
          updated_at
        FROM llms_providers 
        ORDER BY name ASC
      `;
      
      const providers = await database.query(query);
      
      // Process providers data
      const processedProviders = providers.map(provider => ({
        ...provider,
        has_credentials: !!provider.key // Check if provider has API key configured
      }));
      
      res.json({
        success: true,
        data: {
          providers: processedProviders
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch LLM providers', error);
    }
  }
  
  /**
   * Get LLM statistics
   */
  async getLLMStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_llms,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_llms,
          COUNT(CASE WHEN api_key IS NOT NULL THEN 1 END) as configured_llms,
          COUNT(DISTINCT provider) as providers_count
        FROM llms
      `;
      
      const stats = await database.query(statsQuery);
      
      // Get usage stats
      const usageQuery = `
        SELECT 
          l.id,
          l.name,
          l.provider,
          l.model_name,
          COUNT(DISTINCT a.id) as agent_count
        FROM llms l
        LEFT JOIN agents a ON a.llm_id = l.id
        WHERE l.is_active = TRUE
        GROUP BY l.id
        ORDER BY agent_count DESC
        LIMIT 10
      `;
      
      const topLLMs = await database.query(usageQuery);
      
      res.json({
        success: true,
        data: {
          ...stats,
          top_llms: topLLMs
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch LLM statistics', error);
    }
  }
  
  /**
   * Update LLM credentials only
   */
  async updateCredentials(req, res) {
    try {
      const { id } = req.params;
      const { api_key } = req.body;
      
      if (!api_key) {
        throw new ValidationError('API key is required');
      }
      
      // Check if LLM exists
      const existingLLM = await database.query(
        'SELECT id FROM llms WHERE id = ?',
        [id]
      );
      
      if (!existingLLM) {
        throw new NotFoundError('LLM');
      }
      
      // Encrypt new API key
      const encryptedApiKey = this.encryptionService.encrypt(api_key);
      
      // Update only the API key
      await database.query(
        'UPDATE llms SET api_key = ?, updated_at = NOW() WHERE id = ?',
        [encryptedApiKey, id]
      );
      
      res.json({
        success: true,
        message: 'LLM credentials updated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update LLM credentials', error);
    }
  }

  /**
   * Get all LLM configurations with pagination
   */
  async getLLMConfigs(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        q,
        agent_id,
        llm_id,
        is_active
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (q) {
        whereClause += ' AND lc.config_name LIKE ?';
        params.push(`%${q}%`);
      }
      
      if (agent_id) {
        whereClause += ' AND lc.agent_id = ?';
        params.push(agent_id);
      }
      
      if (llm_id) {
        whereClause += ' AND lc.llm_id = ?';
        params.push(llm_id);
      }
      
      if (is_active !== undefined) {
        whereClause += ' AND lc.is_active = ?';
        params.push(is_active === 'true');
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM llm_configs lc 
        ${whereClause}
      `;
      
      const countResult = await database.query(countQuery, params);
      const total = countResult.total;
      
      // Get configurations with related data
      const query = `
        SELECT 
          lc.*,
          a.name as agent_name,
          l.name as llm_name,
          l.provider as llm_provider,
          l.model_name as llm_model
        FROM llm_configs lc
        LEFT JOIN agents a ON a.id = lc.agent_id
        LEFT JOIN llms l ON l.id = lc.llm_id
        ${whereClause}
        ORDER BY ${sort} ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const configs = await database.query(query, params);
      
      // Process configurations (parse JSON parameters)
      const processedConfigs = configs.map(config => ({
        ...config,
        parameters: config.parameters ? JSON.parse(config.parameters) : {}
      }));
      
      res.json({
        success: true,
        data: {
          configs: processedConfigs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch LLM configurations', error);
    }
  }

  /**
   * Create new LLM configuration
   */
  async createLLMConfig(req, res) {
    try {
      const {
        agent_id,
        llm_id,
        config_name,
        parameters,
        is_default = false,
        is_active = true
      } = req.body;
      
      // Validate agent exists
      const agent = await database.query(
        'SELECT id FROM agents WHERE id = ?',
        [agent_id]
      );
      
      if (!agent) {
        throw new ValidationError('Agent not found');
      }
      
      // Validate LLM exists
      const llm = await database.query(
        'SELECT id FROM llms WHERE id = ?',
        [llm_id]
      );
      
      if (!llm) {
        throw new ValidationError('LLM not found');
      }
      
      // Check for duplicate config name for the same agent
      const existingConfig = await database.query(
        'SELECT id FROM llm_configs WHERE agent_id = ? AND config_name = ?',
        [agent_id, config_name]
      );
      
      if (existingConfig) {
        throw new ValidationError('Configuration name already exists for this agent');
      }
      
      // If this is set as default, unset other defaults for this agent
      if (is_default) {
        await database.query(
          'UPDATE llm_configs SET is_default = FALSE WHERE agent_id = ?',
          [agent_id]
        );
      }
      
      // Create configuration
      const result = await database.query(
        `INSERT INTO llm_configs 
         (agent_id, llm_id, config_name, parameters, is_default, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [agent_id, llm_id, config_name, JSON.stringify(parameters), is_default, is_active]
      );
      
      const configId = result.insertId;
      
      // Fetch the created configuration with related data
      const newConfig = await database.query(
        `SELECT 
          lc.*,
          a.name as agent_name,
          l.name as llm_name,
          l.provider as llm_provider,
          l.model_name as llm_model
        FROM llm_configs lc
        LEFT JOIN agents a ON a.id = lc.agent_id
        LEFT JOIN llms l ON l.id = lc.llm_id
        WHERE lc.id = ?`,
        [configId]
      );
      
      res.status(201).json({
        success: true,
        data: {
          ...newConfig,
          parameters: JSON.parse(newConfig.parameters)
        },
        message: 'LLM configuration created successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to create LLM configuration', error);
    }
  }

  /**
   * Get single LLM configuration by ID
   */
  async getLLMConfigById(req, res) {
    try {
      const { id } = req.params;
      
      const query = `
        SELECT 
          lc.*,
          a.name as agent_name,
          l.name as llm_name,
          l.provider as llm_provider,
          l.model_name as llm_model
        FROM llm_configs lc
        LEFT JOIN agents a ON a.id = lc.agent_id
        LEFT JOIN llms l ON l.id = lc.llm_id
        WHERE lc.id = ?
      `;
      
      const config = await database.query(query, [id]);
      
      if (!config) {
        throw new NotFoundError('LLM configuration');
      }
      
      res.json({
        success: true,
        data: {
          ...config,
          parameters: config.parameters ? JSON.parse(config.parameters) : {}
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch LLM configuration', error);
    }
  }

  /**
   * Update LLM configuration
   */
  async updateLLMConfig(req, res) {
    try {
      const { id } = req.params;
      const {
        config_name,
        parameters,
        is_default,
        is_active
      } = req.body;
      
      // Check if configuration exists
      const existingConfig = await database.query(
        'SELECT agent_id FROM llm_configs WHERE id = ?',
        [id]
      );
      
      if (!existingConfig) {
        throw new NotFoundError('LLM configuration');
      }
      
      // Check for duplicate config name if name is being updated
      if (config_name) {
        const duplicateConfig = await database.query(
          'SELECT id FROM llm_configs WHERE agent_id = ? AND config_name = ? AND id != ?',
          [existingConfig.agent_id, config_name, id]
        );
        
        if (duplicateConfig) {
          throw new ValidationError('Configuration name already exists for this agent');
        }
      }
      
      // If this is set as default, unset other defaults for this agent
      if (is_default === true) {
        await database.query(
          'UPDATE llm_configs SET is_default = FALSE WHERE agent_id = ? AND id != ?',
          [existingConfig.agent_id, id]
        );
      }
      
      // Build update query
      const updates = [];
      const params = [];
      
      if (config_name !== undefined) {
        updates.push('config_name = ?');
        params.push(config_name);
      }
      
      if (parameters !== undefined) {
        updates.push('parameters = ?');
        params.push(JSON.stringify(parameters));
      }
      
      if (is_default !== undefined) {
        updates.push('is_default = ?');
        params.push(is_default);
      }
      
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
      }
      
      updates.push('updated_at = NOW()');
      params.push(id);
      
      await database.query(
        `UPDATE llm_configs SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      
      // Fetch updated configuration
      const updatedConfig = await database.query(
        `SELECT 
          lc.*,
          a.name as agent_name,
          l.name as llm_name,
          l.provider as llm_provider,
          l.model_name as llm_model
        FROM llm_configs lc
        LEFT JOIN agents a ON a.id = lc.agent_id
        LEFT JOIN llms l ON l.id = lc.llm_id
        WHERE lc.id = ?`,
        [id]
      );
      
      res.json({
        success: true,
        data: {
          ...updatedConfig,
          parameters: JSON.parse(updatedConfig.parameters)
        },
        message: 'LLM configuration updated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update LLM configuration', error);
    }
  }

  /**
   * Delete LLM configuration
   */
  async deleteLLMConfig(req, res) {
    try {
      const { id } = req.params;
      
      // Check if configuration exists
      const existingConfig = await database.query(
        'SELECT id FROM llm_configs WHERE id = ?',
        [id]
      );
      
      if (!existingConfig) {
        throw new NotFoundError('LLM configuration');
      }
      
      // Delete configuration
      await database.query(
        'DELETE FROM llm_configs WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        message: 'LLM configuration deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete LLM configuration', error);
    }
  }
}

module.exports = LLMsController;