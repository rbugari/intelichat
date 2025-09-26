const database = require('../database');
const { AppError, NotFoundError, ValidationError, DatabaseError } = require('../middleware/errorHandler');
const JsonSchemaValidator = require('../validators/jsonSchemaValidator');

/**
 * Tools Controller
 * Handles CRUD operations for tools using tool_apis and tool_endpoints tables
 */
class ToolsController {
  /**
   * Get all tools with pagination and filtering
   */
  async getTools(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        q,
        api_name,
        is_active
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (q) {
        whereClause += ' AND (te.name LIKE ? OR te.description LIKE ? OR ta.name LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      
      if (api_name) {
        whereClause += ' AND ta.name = ?';
        params.push(api_name);
      }
      
      if (is_active !== undefined) {
        whereClause += ' AND te.is_active = ? AND ta.is_active = ?';
        params.push(is_active === 'true', is_active === 'true');
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM tool_endpoints te
        INNER JOIN tool_apis ta ON te.api_id = ta.id
        ${whereClause}
      `;
      
      const countResult = await database.query(countQuery, params);
      const total = countResult[0].total;
      
      // Get tools with API information
      const query = `
        SELECT 
          te.id,
          te.name,
          te.description,
          te.path,
          te.method,
          te.request_schema,
          te.response_schema,
          te.is_active,
          te.created_at,
          te.updated_at,
          ta.name as api_name,
          ta.base_url,
          ta.auth_type,
          COUNT(DISTINCT at.agent_id) as agent_count
        FROM tool_endpoints te
        INNER JOIN tool_apis ta ON te.api_id = ta.id
        LEFT JOIN agent_tools at ON at.tool_name = te.name
        ${whereClause}
        GROUP BY te.id, ta.id
        ORDER BY te.${sort} ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const tools = await database.query(query, params);
      
      // Parse JSON fields
      const processedTools = tools.map(tool => ({
        ...tool,
        request_schema: tool.request_schema ? JSON.parse(tool.request_schema) : {},
        response_schema: tool.response_schema ? JSON.parse(tool.response_schema) : {}
      }));
      
      res.json({
        success: true,
        data: {
          tools: processedTools,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch tools', error);
    }
  }
  
  /**
   * Get single tool by ID
   */
  async getToolById(req, res) {
    try {
      const { id } = req.params;
      
      const query = `
        SELECT 
          te.id,
          te.name,
          te.description,
          te.path,
          te.method,
          te.request_schema,
          te.response_schema,
          te.is_active,
          te.created_at,
          te.updated_at,
          ta.name as api_name,
          ta.base_url,
          ta.auth_type,
          ta.auth_config,
          COUNT(DISTINCT at.agent_id) as agent_count
        FROM tool_endpoints te
        INNER JOIN tool_apis ta ON te.api_id = ta.id
        LEFT JOIN agent_tools at ON at.tool_name = te.name
        WHERE te.id = ?
        GROUP BY te.id, ta.id
      `;
      
      const tools = await database.query(query, [id]);
      const tool = tools[0];
      
      if (!tool) {
        throw new NotFoundError('Tool');
      }
      
      // Parse JSON fields
      const processedTool = {
        ...tool,
        request_schema: tool.request_schema ? JSON.parse(tool.request_schema) : {},
        response_schema: tool.response_schema ? JSON.parse(tool.response_schema) : {},
        auth_config: tool.auth_config ? JSON.parse(tool.auth_config) : null
      };
      
      // Get agents using this tool
      const agentsQuery = `
        SELECT a.id, a.name, a.description
        FROM agents a
        INNER JOIN agent_tools at ON at.agent_id = a.id
        WHERE at.tool_name = ?
        AND a.is_active = TRUE
        AND at.is_active = TRUE
      `;
      
      const agents = await database.query(agentsQuery, [tool.name]);
      processedTool.used_by_agents = agents;
      
      res.json({
        success: true,
        data: processedTool
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch tool', error);
    }
  }
  
  /**
   * Create new tool endpoint
   */
  async createTool(req, res) {
    try {
      const {
        name,
        description,
        api_id,
        path,
        method = 'POST',
        request_schema,
        response_schema,
        is_active = true
      } = req.body;
      
      // Validate required fields
      if (!api_id) {
        throw new ValidationError('API ID is required');
      }
      
      if (!path) {
        throw new ValidationError('Path is required');
      }
      
      // Check if API exists
      const existingApi = await database.query(
        'SELECT id FROM tool_apis WHERE id = ?',
        [api_id]
      );
      
      if (!existingApi) {
        throw new ValidationError('API not found');
      }
      
      // Check if endpoint name is unique for this API
      const existingEndpoint = await database.query(
        'SELECT id FROM tool_endpoints WHERE api_id = ? AND name = ?',
        [api_id, name]
      );
      
      if (existingEndpoint) {
        throw new ValidationError('Endpoint name must be unique for this API');
      }
      
      // Validate schemas using JSON Schema validator
      const validator = new JsonSchemaValidator();
      
      if (request_schema) {
        if (typeof request_schema !== 'object') {
          throw new ValidationError('Request schema must be a valid JSON object');
        }
        
        try {
          validator.addSchema(request_schema, `request-schema-${Date.now()}`);
        } catch (schemaError) {
          throw new ValidationError(`Invalid request JSON Schema: ${schemaError.message}`);
        }
      }
      
      if (response_schema) {
        if (typeof response_schema !== 'object') {
          throw new ValidationError('Response schema must be a valid JSON object');
        }
        
        try {
          validator.addSchema(response_schema, `response-schema-${Date.now()}`);
        } catch (schemaError) {
          throw new ValidationError(`Invalid response JSON Schema: ${schemaError.message}`);
        }
      }
      
      const query = `
        INSERT INTO tool_endpoints (
          api_id, name, description, path, method, request_schema, response_schema, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await database.query(query, [
        api_id,
        name,
        description || null,
        path,
        method.toUpperCase(),
        request_schema ? JSON.stringify(request_schema) : null,
        response_schema ? JSON.stringify(response_schema) : null,
        is_active
      ]);
      
      // Get the created tool with API information
      const newTool = await database.query(`
        SELECT 
          te.*,
          ta.name as api_name,
          ta.base_url,
          ta.auth_type
        FROM tool_endpoints te
        INNER JOIN tool_apis ta ON te.api_id = ta.id
        WHERE te.id = ?
      `, [result.insertId]);
      
      // Parse JSON fields
      const processedTool = {
        ...newTool,
        request_schema: newTool.request_schema ? JSON.parse(newTool.request_schema) : {},
        response_schema: newTool.response_schema ? JSON.parse(newTool.response_schema) : {}
      };
      
      res.status(201).json({
        success: true,
        data: processedTool
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ValidationError('Tool name or function name already exists');
      }
      throw new DatabaseError('Failed to create tool', error);
    }
  }
  
  /**
   * Update tool
   */
  async updateTool(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        function_name,
        parameters,
        category,
        is_active,
        metadata
      } = req.body;
      
      // Check if tool exists
      const existingTool = await database.query(
        'SELECT id, function_name FROM tools WHERE id = ?',
        [id]
      );
      
      if (!existingTool) {
        throw new NotFoundError('Tool');
      }
      
      // Check if function_name is unique (if being updated)
      if (function_name && function_name !== existingTool.function_name) {
        const duplicateTool = await database.query(
          'SELECT id FROM tools WHERE function_name = ? AND id != ?',
          [function_name, id]
        );
        
        if (duplicateTool) {
          throw new ValidationError('Function name must be unique');
        }
      }
      
      // Validate parameters schema using JSON Schema validator
      if (parameters) {
        if (typeof parameters !== 'object') {
          throw new ValidationError('Parameters must be a valid JSON object');
        }
        
        const validator = new JsonSchemaValidator();
        try {
          validator.addSchema(parameters, `parameters-schema-${Date.now()}`);
        } catch (schemaError) {
          throw new ValidationError(`Invalid parameters JSON Schema: ${schemaError.message}`);
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
      
      if (function_name !== undefined) {
        updates.push('function_name = ?');
        params.push(function_name);
      }
      
      if (parameters !== undefined) {
        updates.push('parameters = ?');
        params.push(JSON.stringify(parameters));
      }
      
      if (category !== undefined) {
        updates.push('category = ?');
        params.push(category);
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
      
      const query = `UPDATE tools SET ${updates.join(', ')} WHERE id = ?`;
      await database.query(query, params);
      
      // Get updated tool
      const updatedTool = await database.query(
        'SELECT * FROM tools WHERE id = ?',
        [id]
      );
      
      // Parse JSON fields
      const processedTool = {
        ...updatedTool,
        parameters: updatedTool.parameters ? JSON.parse(updatedTool.parameters) : {},
        metadata: updatedTool.metadata ? JSON.parse(updatedTool.metadata) : null
      };
      
      res.json({
        success: true,
        data: processedTool
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update tool', error);
    }
  }
  
  /**
   * Delete tool (soft delete)
   */
  async deleteTool(req, res) {
    try {
      const { id } = req.params;
      
      // Check if tool exists
      const existingTool = await database.query(
        'SELECT id FROM tools WHERE id = ?',
        [id]
      );
      
      if (!existingTool) {
        throw new NotFoundError('Tool');
      }
      
      // Check if tool is being used by active agents
      const activeAgents = await database.query(
        'SELECT COUNT(*) as count FROM agents WHERE JSON_CONTAINS(tools, CAST(? AS JSON)) AND is_active = TRUE',
        [id]
      );
      
      if (activeAgents.count > 0) {
        throw new ValidationError(
          `Cannot delete tool: ${activeAgents.count} active agent(s) are using this tool`
        );
      }
      
      // Soft delete (set is_active to false)
      await database.query(
        'UPDATE tools SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        message: 'Tool deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete tool', error);
    }
  }
  
  /**
   * Test tool function
   */
  async testTool(req, res) {
    try {
      const { id } = req.params;
      const { test_parameters = {} } = req.body;
      
      // Get tool configuration
      const tool = await database.query(
        'SELECT * FROM tools WHERE id = ? AND is_active = TRUE',
        [id]
      );
      
      if (!tool) {
        throw new NotFoundError('Tool not found or inactive');
      }
      
      const toolConfig = {
        ...tool,
        parameters: tool.parameters ? JSON.parse(tool.parameters) : {}
      };
      
      // Import tools service (assuming it exists)
      const toolsService = require('../tools');
      
      // Test the tool function
      const testResult = await toolsService.executeFunction(
        toolConfig.function_name,
        test_parameters
      );
      
      res.json({
        success: true,
        data: {
          tool_id: id,
          tool_name: tool.name,
          function_name: tool.function_name,
          test_parameters,
          result: testResult
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new AppError(`Tool test failed: ${error.message}`, 500);
    }
  }
  
  /**
   * Get tool categories
   */
  async getToolCategories(req, res) {
    try {
      const query = `
        SELECT 
          category,
          COUNT(*) as tool_count
        FROM tools 
        WHERE category IS NOT NULL AND is_active = TRUE
        GROUP BY category
        ORDER BY tool_count DESC
      `;
      
      const categories = await database.query(query);
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch tool categories', error);
    }
  }
  
  /**
   * Get tool statistics
   */
  async getToolStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_tools,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_tools,
          COUNT(DISTINCT category) as categories_count
        FROM tools
      `;
      
      const stats = await database.query(statsQuery);
      
      // Get usage stats
      const usageQuery = `
        SELECT 
          t.id,
          t.name,
          t.function_name,
          COUNT(DISTINCT a.id) as agent_count
        FROM tools t
        LEFT JOIN agents a ON JSON_CONTAINS(a.tools, CAST(t.id AS JSON))
        WHERE t.is_active = TRUE
        GROUP BY t.id
        ORDER BY agent_count DESC
        LIMIT 10
      `;
      
      const topTools = await database.query(usageQuery);
      
      res.json({
        success: true,
        data: {
          ...stats,
          top_tools: topTools
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch tool statistics', error);
    }
  }
  
  /**
   * Validate tool parameters schema using JSON Schema validator
   */
  async validateToolSchema(req, res) {
    try {
      const { schema, test_data } = req.body;
      
      if (!schema || typeof schema !== 'object') {
        throw new ValidationError('Schema must be a valid JSON object');
      }
      
      const validator = new JsonSchemaValidator();
      
      // Validate the schema itself
      try {
        validator.addSchema(schema, 'test-schema');
      } catch (schemaError) {
        throw new ValidationError(`Invalid JSON Schema: ${schemaError.message}`);
      }
      
      let validationResult = null;
      
      // If test data is provided, validate it against the schema
      if (test_data) {
        validationResult = validator.validate(test_data, schema);
      }
      
      res.json({
        success: true,
        message: 'JSON Schema is valid',
        data: {
          schema_valid: true,
          schema: schema,
          test_validation: validationResult ? {
            valid: validationResult.valid,
            errors: validationResult.errors
          } : null
        }
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new AppError('Schema validation failed', 400);
    }
  }

  /**
   * Get all tool versions with pagination and filtering
   */
  async getToolVersions(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        q,
        tool_id,
        is_active
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (q) {
        whereClause += ' AND (tv.version LIKE ? OR tv.description LIKE ? OR tv.function_name LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      
      if (tool_id) {
        whereClause += ' AND tv.tool_id = ?';
        params.push(tool_id);
      }
      
      if (is_active !== undefined) {
        whereClause += ' AND tv.is_active = ?';
        params.push(is_active === 'true');
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM tool_versions tv 
        ${whereClause}
      `;
      
      const countResult = await database.query(countQuery, params);
      const total = countResult.total;
      
      // Get tool versions with tool info
      const query = `
        SELECT 
          tv.*,
          t.name as tool_name,
          t.category as tool_category
        FROM tool_versions tv
        INNER JOIN tools t ON tv.tool_id = t.id
        ${whereClause}
        ORDER BY ${sort} ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const versions = await database.query(query, params);
      
      // Parse JSON fields
      const processedVersions = versions.map(version => ({
        ...version,
        parameters_schema: version.parameters_schema ? JSON.parse(version.parameters_schema) : {},
        metadata: version.metadata ? JSON.parse(version.metadata) : null
      }));
      
      res.json({
        success: true,
        data: {
          versions: processedVersions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch tool versions', error);
    }
  }

  /**
   * Create new tool version
   */
  async createToolVersion(req, res) {
    try {
      const {
        tool_id,
        version,
        description,
        function_name,
        parameters_schema,
        is_active = true,
        metadata
      } = req.body;
      
      // Check if tool exists
      const tool = await database.query(
        'SELECT id FROM tools WHERE id = ?',
        [tool_id]
      );
      
      if (!tool) {
        throw new NotFoundError('Tool not found');
      }
      
      // Check if version already exists for this tool
      const existingVersion = await database.query(
        'SELECT id FROM tool_versions WHERE tool_id = ? AND version = ?',
        [tool_id, version]
      );
      
      if (existingVersion) {
        throw new ValidationError('Version already exists for this tool');
      }
      
      // Validate parameters schema
      if (parameters_schema && typeof parameters_schema !== 'object') {
        throw new ValidationError('Parameters schema must be a valid JSON object');
      }
      
      const query = `
        INSERT INTO tool_versions (
          tool_id, version, description, function_name, parameters_schema, is_active, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await database.query(query, [
        tool_id,
        version,
        description || null,
        function_name,
        JSON.stringify(parameters_schema || {}),
        is_active,
        metadata ? JSON.stringify(metadata) : null
      ]);
      
      // Get the created version
      const newVersion = await database.query(
        `SELECT tv.*, t.name as tool_name, t.category as tool_category
         FROM tool_versions tv
         INNER JOIN tools t ON tv.tool_id = t.id
         WHERE tv.id = ?`,
        [result.insertId]
      );
      
      // Parse JSON fields
      const processedVersion = {
        ...newVersion,
        parameters_schema: newVersion.parameters_schema ? JSON.parse(newVersion.parameters_schema) : {},
        metadata: newVersion.metadata ? JSON.parse(newVersion.metadata) : null
      };
      
      res.status(201).json({
        success: true,
        message: 'Tool version created successfully',
        data: processedVersion
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to create tool version', error);
    }
  }

  /**
   * Get versions for a specific tool
   */
  async getToolVersionsByToolId(req, res) {
    try {
      const { id } = req.params;
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        is_active
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Check if tool exists
      const tool = await database.query(
        'SELECT id, name FROM tools WHERE id = ?',
        [id]
      );
      
      if (!tool) {
        throw new NotFoundError('Tool');
      }
      
      // Build WHERE clause
      let whereClause = 'WHERE tool_id = ?';
      const params = [id];
      
      if (is_active !== undefined) {
        whereClause += ' AND is_active = ?';
        params.push(is_active === 'true');
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM tool_versions 
        ${whereClause}
      `;
      
      const countResult = await database.query(countQuery, params);
      const total = countResult.total;
      
      // Get versions
      const query = `
        SELECT *
        FROM tool_versions
        ${whereClause}
        ORDER BY ${sort} ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const versions = await database.query(query, params);
      
      // Parse JSON fields
      const processedVersions = versions.map(version => ({
        ...version,
        parameters_schema: version.parameters_schema ? JSON.parse(version.parameters_schema) : {},
        metadata: version.metadata ? JSON.parse(version.metadata) : null
      }));
      
      res.json({
        success: true,
        data: {
          tool: {
            id: tool.id,
            name: tool.name
          },
          versions: processedVersions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch tool versions', error);
    }
  }
}

module.exports = ToolsController;