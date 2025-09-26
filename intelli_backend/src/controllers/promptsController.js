const database = require('../database');
const { AppError, NotFoundError, ValidationError, DatabaseError } = require('../middleware/errorHandler');

/**
 * Prompts Controller
 * Handles CRUD operations for prompts
 */
class PromptsController {
  /**
   * Get all prompts with pagination and filtering
   */
  async getPrompts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        q,
        category,
        is_active,
        is_system
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (q) {
        whereClause += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.content LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      
      if (category) {
        whereClause += ' AND p.category = ?';
        params.push(category);
      }
      
      if (is_active !== undefined) {
        whereClause += ' AND p.is_active = ?';
        params.push(is_active === 'true');
      }
      
      if (is_system !== undefined) {
        whereClause += ' AND p.is_system = ?';
        params.push(is_system === 'true');
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM prompts p 
        ${whereClause}
      `;
      
      const countResult = await database.query(countQuery, params);
      const total = countResult.total;
      
      // Get prompts with usage stats
      const query = `
        SELECT 
          p.*,
          COUNT(DISTINCT a.id) as agent_count
        FROM prompts p
        LEFT JOIN agents a ON a.system_prompt_id = p.id OR a.user_prompt_id = p.id
        ${whereClause}
        GROUP BY p.id
        ORDER BY ${sort} ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const prompts = await database.query(query, params);
      
      // Parse JSON fields and add content preview
      const processedPrompts = prompts.map(prompt => ({
        ...prompt,
        variables: prompt.variables ? JSON.parse(prompt.variables) : [],
        metadata: prompt.metadata ? JSON.parse(prompt.metadata) : null,
        content_preview: prompt.content ? prompt.content.substring(0, 200) + (prompt.content.length > 200 ? '...' : '') : null
      }));
      
      res.json({
        success: true,
        data: {
          prompts: processedPrompts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch prompts', error);
    }
  }
  
  /**
   * Get single prompt by ID
   */
  async getPromptById(req, res) {
    try {
      const { id } = req.params;
      
      const query = `
        SELECT 
          p.*,
          COUNT(DISTINCT a.id) as agent_count
        FROM prompts p
        LEFT JOIN agents a ON a.system_prompt_id = p.id OR a.user_prompt_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
      `;
      
      const prompt = await database.query(query, [id]);
      
      if (!prompt) {
        throw new NotFoundError('Prompt');
      }
      
      // Parse JSON fields
      const processedPrompt = {
        ...prompt,
        variables: prompt.variables ? JSON.parse(prompt.variables) : [],
        metadata: prompt.metadata ? JSON.parse(prompt.metadata) : null
      };
      
      // Get agents using this prompt
      const agentsQuery = `
        SELECT 
          id, name, description,
          CASE 
            WHEN system_prompt_id = ? THEN 'system'
            WHEN user_prompt_id = ? THEN 'user'
            ELSE 'unknown'
          END as prompt_type
        FROM agents 
        WHERE (system_prompt_id = ? OR user_prompt_id = ?)
        AND is_active = TRUE
      `;
      
      const agents = await database.query(agentsQuery, [id, id, id, id]);
      processedPrompt.used_by_agents = agents;
      
      res.json({
        success: true,
        data: processedPrompt
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch prompt', error);
    }
  }
  
  /**
   * Create new prompt
   */
  async createPrompt(req, res) {
    try {
      const {
        name,
        description,
        content,
        category,
        variables = [],
        is_system = false,
        is_active = true,
        metadata
      } = req.body;
      
      // Validate variables array
      if (variables && !Array.isArray(variables)) {
        throw new ValidationError('Variables must be an array');
      }
      
      // Validate each variable
      if (variables.length > 0) {
        for (const variable of variables) {
          if (!variable.name || typeof variable.name !== 'string') {
            throw new ValidationError('Each variable must have a name');
          }
          if (!variable.type || !['string', 'number', 'boolean', 'array', 'object'].includes(variable.type)) {
            throw new ValidationError('Variable type must be one of: string, number, boolean, array, object');
          }
        }
      }
      
      // Extract and validate variables from content
      const contentVariables = this.extractVariablesFromContent(content);
      const declaredVariables = variables.map(v => v.name);
      const undeclaredVariables = contentVariables.filter(v => !declaredVariables.includes(v));
      
      if (undeclaredVariables.length > 0) {
        throw new ValidationError(
          `Undeclared variables found in content: ${undeclaredVariables.join(', ')}`
        );
      }
      
      const query = `
        INSERT INTO prompts (
          name, description, content, category, variables, is_system, is_active, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await database.query(query, [
        name,
        description || null,
        content,
        category || null,
        JSON.stringify(variables),
        is_system,
        is_active,
        metadata ? JSON.stringify(metadata) : null
      ]);
      
      // Get the created prompt
      const newPrompt = await database.query(
        'SELECT * FROM prompts WHERE id = ?',
        [result.insertId]
      );
      
      // Parse JSON fields
      const processedPrompt = {
        ...newPrompt,
        variables: newPrompt.variables ? JSON.parse(newPrompt.variables) : [],
        metadata: newPrompt.metadata ? JSON.parse(newPrompt.metadata) : null
      };
      
      res.status(201).json({
        success: true,
        data: processedPrompt
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ValidationError('Prompt name already exists');
      }
      throw new DatabaseError('Failed to create prompt', error);
    }
  }
  
  /**
   * Update prompt
   */
  async updatePrompt(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        content,
        category,
        variables,
        is_system,
        is_active,
        metadata
      } = req.body;
      
      // Check if prompt exists
      const existingPrompt = await database.query(
        'SELECT id, is_system FROM prompts WHERE id = ?',
        [id]
      );
      
      if (!existingPrompt) {
        throw new NotFoundError('Prompt');
      }
      
      // Prevent changing system prompts if they're being used
      if (existingPrompt.is_system && is_system === false) {
        const agentCount = await database.query(
          'SELECT COUNT(*) as count FROM agents WHERE system_prompt_id = ? AND is_active = TRUE',
          [id]
        );
        
        if (agentCount.count > 0) {
          throw new ValidationError('Cannot change system prompt type while being used by active agents');
        }
      }
      
      // Validate variables if provided
      if (variables !== undefined) {
        if (!Array.isArray(variables)) {
          throw new ValidationError('Variables must be an array');
        }
        
        for (const variable of variables) {
          if (!variable.name || typeof variable.name !== 'string') {
            throw new ValidationError('Each variable must have a name');
          }
          if (!variable.type || !['string', 'number', 'boolean', 'array', 'object'].includes(variable.type)) {
            throw new ValidationError('Variable type must be one of: string, number, boolean, array, object');
          }
        }
      }
      
      // Validate content variables if content is being updated
      if (content !== undefined && variables !== undefined) {
        const contentVariables = this.extractVariablesFromContent(content);
        const declaredVariables = variables.map(v => v.name);
        const undeclaredVariables = contentVariables.filter(v => !declaredVariables.includes(v));
        
        if (undeclaredVariables.length > 0) {
          throw new ValidationError(
            `Undeclared variables found in content: ${undeclaredVariables.join(', ')}`
          );
        }
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
      
      if (content !== undefined) {
        updates.push('content = ?');
        params.push(content);
      }
      
      if (category !== undefined) {
        updates.push('category = ?');
        params.push(category);
      }
      
      if (variables !== undefined) {
        updates.push('variables = ?');
        params.push(JSON.stringify(variables));
      }
      
      if (is_system !== undefined) {
        updates.push('is_system = ?');
        params.push(is_system);
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
      
      const query = `UPDATE prompts SET ${updates.join(', ')} WHERE id = ?`;
      await database.query(query, params);
      
      // Get updated prompt
      const updatedPrompt = await database.query(
        'SELECT * FROM prompts WHERE id = ?',
        [id]
      );
      
      // Parse JSON fields
      const processedPrompt = {
        ...updatedPrompt,
        variables: updatedPrompt.variables ? JSON.parse(updatedPrompt.variables) : [],
        metadata: updatedPrompt.metadata ? JSON.parse(updatedPrompt.metadata) : null
      };
      
      res.json({
        success: true,
        data: processedPrompt
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update prompt', error);
    }
  }
  
  /**
   * Delete prompt (soft delete)
   */
  async deletePrompt(req, res) {
    try {
      const { id } = req.params;
      
      // Check if prompt exists
      const existingPrompt = await database.query(
        'SELECT id FROM prompts WHERE id = ?',
        [id]
      );
      
      if (!existingPrompt) {
        throw new NotFoundError('Prompt');
      }
      
      // Check if prompt is being used by active agents
      const activeAgents = await database.query(
        'SELECT COUNT(*) as count FROM agents WHERE (system_prompt_id = ? OR user_prompt_id = ?) AND is_active = TRUE',
        [id, id]
      );
      
      if (activeAgents.count > 0) {
        throw new ValidationError(
          `Cannot delete prompt: ${activeAgents.count} active agent(s) are using this prompt`
        );
      }
      
      // Soft delete (set is_active to false)
      await database.query(
        'UPDATE prompts SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        message: 'Prompt deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete prompt', error);
    }
  }
  
  /**
   * Preview prompt with variables
   */
  async previewPrompt(req, res) {
    try {
      const { id } = req.params;
      const { variables: variableValues = {} } = req.body;
      
      // Get prompt
      const prompt = await database.query(
        'SELECT * FROM prompts WHERE id = ? AND is_active = TRUE',
        [id]
      );
      
      if (!prompt) {
        throw new NotFoundError('Prompt not found or inactive');
      }
      
      const promptVariables = prompt.variables ? JSON.parse(prompt.variables) : [];
      
      // Validate provided variables
      for (const variable of promptVariables) {
        if (variable.required && !variableValues.hasOwnProperty(variable.name)) {
          throw new ValidationError(`Required variable '${variable.name}' is missing`);
        }
      }
      
      // Replace variables in content
      let processedContent = prompt.content;
      
      for (const [varName, varValue] of Object.entries(variableValues)) {
        const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
        processedContent = processedContent.replace(regex, String(varValue));
      }
      
      // Check for unreplaced variables
      const unreplacedVariables = this.extractVariablesFromContent(processedContent);
      
      res.json({
        success: true,
        data: {
          prompt_id: id,
          prompt_name: prompt.name,
          original_content: prompt.content,
          processed_content: processedContent,
          variables_used: variableValues,
          unreplaced_variables: unreplacedVariables
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to preview prompt', error);
    }
  }
  
  /**
   * Get prompt categories
   */
  async getPromptCategories(req, res) {
    try {
      const query = `
        SELECT 
          category,
          COUNT(*) as prompt_count,
          COUNT(CASE WHEN is_system = TRUE THEN 1 END) as system_prompts,
          COUNT(CASE WHEN is_system = FALSE THEN 1 END) as user_prompts
        FROM prompts 
        WHERE category IS NOT NULL AND is_active = TRUE
        GROUP BY category
        ORDER BY prompt_count DESC
      `;
      
      const categories = await database.query(query);
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch prompt categories', error);
    }
  }
  
  /**
   * Get prompt statistics
   */
  async getPromptStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_prompts,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_prompts,
          COUNT(CASE WHEN is_system = TRUE THEN 1 END) as system_prompts,
          COUNT(CASE WHEN is_system = FALSE THEN 1 END) as user_prompts,
          COUNT(DISTINCT category) as categories_count
        FROM prompts
      `;
      
      const stats = await database.query(statsQuery);
      
      // Get usage stats
      const usageQuery = `
        SELECT 
          p.id,
          p.name,
          p.category,
          p.is_system,
          COUNT(DISTINCT a.id) as agent_count
        FROM prompts p
        LEFT JOIN agents a ON a.system_prompt_id = p.id OR a.user_prompt_id = p.id
        WHERE p.is_active = TRUE
        GROUP BY p.id
        ORDER BY agent_count DESC
        LIMIT 10
      `;
      
      const topPrompts = await database.query(usageQuery);
      
      res.json({
        success: true,
        data: {
          ...stats,
          top_prompts: topPrompts
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch prompt statistics', error);
    }
  }
  
  /**
   * Validate prompt content and variables
   */
  async validatePrompt(req, res) {
    try {
      const { content, variables = [] } = req.body;
      
      if (!content) {
        throw new ValidationError('Content is required for validation');
      }
      
      // Extract variables from content
      const contentVariables = this.extractVariablesFromContent(content);
      const declaredVariables = variables.map(v => v.name);
      
      // Find issues
      const undeclaredVariables = contentVariables.filter(v => !declaredVariables.includes(v));
      const unusedVariables = declaredVariables.filter(v => !contentVariables.includes(v));
      
      // Validate variable definitions
      const variableErrors = [];
      for (const variable of variables) {
        if (!variable.name || typeof variable.name !== 'string') {
          variableErrors.push('Variable must have a name');
        }
        if (!variable.type || !['string', 'number', 'boolean', 'array', 'object'].includes(variable.type)) {
          variableErrors.push(`Invalid type for variable '${variable.name}'`);
        }
      }
      
      const isValid = undeclaredVariables.length === 0 && variableErrors.length === 0;
      
      res.json({
        success: true,
        data: {
          valid: isValid,
          content_variables: contentVariables,
          declared_variables: declaredVariables,
          undeclared_variables: undeclaredVariables,
          unused_variables: unusedVariables,
          variable_errors: variableErrors,
          warnings: unusedVariables.length > 0 ? ['Some declared variables are not used in content'] : []
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppError('Prompt validation failed', 400);
    }
  }
  
  /**
   * Extract variables from prompt content
   * Variables are in the format {{variable_name}}
   */
  extractVariablesFromContent(content) {
    if (!content) return [];
    
    const variableRegex = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g;
    const variables = [];
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      const variableName = match[1].trim();
      if (!variables.includes(variableName)) {
        variables.push(variableName);
      }
    }
    
    return variables;
  }
  
  /**
   * Duplicate prompt
   */
  async duplicatePrompt(req, res) {
    try {
      const { id } = req.params;
      const { name: newName } = req.body;
      
      // Get original prompt
      const originalPrompt = await database.query(
        'SELECT * FROM prompts WHERE id = ?',
        [id]
      );
      
      if (!originalPrompt) {
        throw new NotFoundError('Prompt');
      }
      
      const duplicateName = newName || `${originalPrompt.name} (Copy)`;
      
      // Create duplicate
      const query = `
        INSERT INTO prompts (
          name, description, content, category, variables, is_system, is_active, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await database.query(query, [
        duplicateName,
        originalPrompt.description,
        originalPrompt.content,
        originalPrompt.category,
        originalPrompt.variables,
        originalPrompt.is_system,
        true, // Always activate duplicates
        originalPrompt.metadata
      ]);
      
      // Get the duplicated prompt
      const newPrompt = await database.query(
        'SELECT * FROM prompts WHERE id = ?',
        [result.insertId]
      );
      
      // Parse JSON fields
      const processedPrompt = {
        ...newPrompt,
        variables: newPrompt.variables ? JSON.parse(newPrompt.variables) : [],
        metadata: newPrompt.metadata ? JSON.parse(newPrompt.metadata) : null
      };
      
      res.status(201).json({
        success: true,
        data: processedPrompt
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ValidationError('Prompt name already exists');
      }
      throw new DatabaseError('Failed to duplicate prompt', error);
    }
  }

  /**
   * Create agent prompt (multi-language support)
   */
  async createAgentPrompt(req, res) {
    try {
      const { agente_id, nombre, contenido } = req.body;
      
      // Validate required fields
      if (!agente_id || !nombre || !contenido) {
        throw new ValidationError('agente_id, nombre, and contenido are required');
      }
      
      // Verify agent exists
      const agent = await database.query(
        'SELECT id FROM cfg_agente WHERE id = ?',
        [agente_id]
      );
      
      if (!agent) {
        throw new ValidationError('Invalid agent ID');
      }
      
      const insertQuery = `
        INSERT INTO cfg_agente_prompt (agente_id, nombre, contenido, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
      `;
      
      const result = await database.query(insertQuery, [agente_id, nombre, contenido]);
      
      // Get the created prompt
      const newPrompt = await database.query(
        'SELECT * FROM cfg_agente_prompt WHERE id = ?',
        [result.insertId]
      );
      
      res.status(201).json({
        success: true,
        data: newPrompt,
        message: 'Agent prompt created successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ValidationError('Prompt name already exists for this agent');
      }
      throw new DatabaseError('Failed to create agent prompt', error);
    }
  }

  /**
   * Update agent prompt
   */
  async updateAgentPrompt(req, res) {
    try {
      const { id } = req.params;
      const { nombre, contenido } = req.body;
      
      // Check if prompt exists
      const existingPrompt = await database.query(
        'SELECT id FROM cfg_agente_prompt WHERE id = ?',
        [id]
      );
      
      if (!existingPrompt) {
        throw new NotFoundError('Agent prompt');
      }
      
      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      
      if (nombre !== undefined) {
        updateFields.push('nombre = ?');
        updateValues.push(nombre);
      }
      if (contenido !== undefined) {
        updateFields.push('contenido = ?');
        updateValues.push(contenido);
      }
      
      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }
      
      updateFields.push('updated_at = NOW()');
      updateValues.push(id);
      
      const updateQuery = `
        UPDATE cfg_agente_prompt 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;
      
      await database.query(updateQuery, updateValues);
      
      // Get updated prompt
      const updatedPrompt = await database.query(
        'SELECT * FROM cfg_agente_prompt WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        data: updatedPrompt,
        message: 'Agent prompt updated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update agent prompt', error);
    }
  }

  /**
   * Delete agent prompt
   */
  async deleteAgentPrompt(req, res) {
    try {
      const { id } = req.params;
      
      // Check if prompt exists
      const existingPrompt = await database.query(
        'SELECT id FROM cfg_agente_prompt WHERE id = ?',
        [id]
      );
      
      if (!existingPrompt) {
        throw new NotFoundError('Agent prompt');
      }
      
      // Delete prompt
      await database.query(
        'DELETE FROM cfg_agente_prompt WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        message: 'Agent prompt deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete agent prompt', error);
    }
  }

  /**
   * Preview multi-language prompt with variables
   */
  async previewMultiLanguagePrompt(req, res) {
    try {
      const { 
        system_prompt_es, 
        system_prompt_en, 
        variables = {}, 
        language = 'es' 
      } = req.body;
      
      // Select the appropriate prompt based on language
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
        throw new ValidationError('No prompt content available for preview');
      }
      
      // Replace variables in the prompt
      let processedContent = selectedPrompt;
      const variableRegex = /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g;
      const foundVariables = [];
      const missingVariables = [];
      
      // Find all variables in content
      let match;
      while ((match = variableRegex.exec(selectedPrompt)) !== null) {
        const variableName = match[1].trim();
        if (!foundVariables.includes(variableName)) {
          foundVariables.push(variableName);
        }
      }
      
      // Replace variables with provided values
      for (const variableName of foundVariables) {
        const variableValue = variables[variableName];
        if (variableValue !== undefined) {
          const regex = new RegExp(`{{\\s*${variableName}\\s*}}`, 'g');
          processedContent = processedContent.replace(regex, String(variableValue));
        } else {
          missingVariables.push(variableName);
        }
      }
      
      res.json({
        success: true,
        data: {
          original_content: selectedPrompt,
          processed_content: processedContent,
          language_used: language,
          variables_found: foundVariables,
          variables_provided: Object.keys(variables),
          missing_variables: missingVariables,
          has_missing_variables: missingVariables.length > 0
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppError('Preview failed', 400);
    }
  }
}

module.exports = PromptsController;