const Joi = require('joi');

/**
 * Validation schemas for all entities
 */
const schemas = {
  // Chat schemas
  chat: {
    create: Joi.object({
      title: Joi.string().min(1).max(255).required(),
      chatbot_id: Joi.number().integer().positive().required(),
      cliente_id: Joi.number().integer().positive().optional()
    }),
    
    update: Joi.object({
      titulo: Joi.string().min(1).max(255).optional(),
      chatbot_id: Joi.number().integer().positive().optional(),
      is_active: Joi.boolean().optional()
    }),
    
    message: Joi.object({
      contenido: Joi.string().min(1).required(),
      rol: Joi.string().valid('user', 'assistant', 'system').required()
    })
  },

  // Agent schemas
  agent: {
    create: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      description: Joi.string().max(500).optional(),
      system_prompt: Joi.string().required(),
      llm_provider_id: Joi.number().integer().positive().required(),
      llm_model: Joi.string().max(100).required(),
      temperature: Joi.number().min(0).max(2).default(0.7),
      max_tokens: Joi.number().integer().min(1).max(32000).optional(),
      tools: Joi.array().items(Joi.number().integer().positive()).optional(),
      is_active: Joi.boolean().default(true),
      metadata: Joi.object().optional()
    }),
    
    update: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      description: Joi.string().max(500).optional(),
      system_prompt: Joi.string().optional(),
      system_prompt_es: Joi.string().optional(),
      system_prompt_en: Joi.string().optional(),
      llm_provider_id: Joi.number().integer().positive().optional(),
      llm_model: Joi.string().max(100).optional(),
      temperature: Joi.number().min(0).max(2).optional(),
      max_tokens: Joi.number().integer().min(1).max(32000).optional(),
      tools: Joi.array().items(Joi.number().integer().positive()).optional(),
      is_active: Joi.boolean().optional(),
      metadata: Joi.object().optional()
    }),
    
    assignAgentTools: Joi.object({
      tool_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required()
    }),

    // LLM Configuration validation
    createLLMConfig: Joi.object({
      agent_id: Joi.number().integer().positive().required(),
      llm_id: Joi.number().integer().positive().required(),
      config_name: Joi.string().min(1).max(100).required(),
      parameters: Joi.object().required(),
      is_default: Joi.boolean().default(false),
      is_active: Joi.boolean().default(true)
    }),

    updateLLMConfig: Joi.object({
      config_name: Joi.string().min(1).max(100),
      parameters: Joi.object(),
      is_default: Joi.boolean(),
      is_active: Joi.boolean()
    }).min(1)
  },

  // Prompt schemas
  prompt: {
    create: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      description: Joi.string().max(500).optional(),
      content: Joi.string().required(),
      category: Joi.string().max(50).optional(),
      tags: Joi.array().items(Joi.string().max(50)).optional(),
      is_active: Joi.boolean().default(true),
      metadata: Joi.object().optional()
    }),
    
    update: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      description: Joi.string().max(500).optional(),
      content: Joi.string().optional(),
      category: Joi.string().max(50).optional(),
      tags: Joi.array().items(Joi.string().max(50)).optional(),
      is_active: Joi.boolean().optional(),
      metadata: Joi.object().optional()
    })
  },

  // Tool schemas
  tool: {
    create: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      description: Joi.string().max(500).optional(),
      function_name: Joi.string().min(1).max(100).required(),
      parameters: Joi.object().required(),
      category: Joi.string().max(50).optional(),
      is_active: Joi.boolean().default(true),
      metadata: Joi.object().optional()
    }),
    
    update: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      description: Joi.string().max(500).optional(),
      function_name: Joi.string().min(1).max(100).optional(),
      parameters: Joi.object().optional(),
      category: Joi.string().max(50).optional(),
      is_active: Joi.boolean().optional(),
      metadata: Joi.object().optional()
    }),
    
    createToolVersion: Joi.object({
      tool_id: Joi.number().integer().positive().required(),
      version: Joi.string().min(1).max(20).required(),
      description: Joi.string().max(500).optional(),
      function_name: Joi.string().max(100).required(),
      parameters_schema: Joi.object().required(),
      is_active: Joi.boolean().default(true),
      metadata: Joi.object().optional()
    })
  },

  // LLM schemas
  llm: {
    create: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      provider: Joi.string().valid('openai', 'groq', 'anthropic').required(),
      api_key: Joi.string().required(),
      api_url: Joi.string().uri().optional(),
      models: Joi.array().items(Joi.string()).required(),
      max_tokens: Joi.number().integer().min(1).max(32000).optional(),
      rate_limit: Joi.number().integer().min(1).optional(),
      is_active: Joi.boolean().default(true),
      metadata: Joi.object().optional()
    }),
    
    update: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      provider: Joi.string().valid('openai', 'groq', 'anthropic').optional(),
      api_key: Joi.string().optional(),
      api_url: Joi.string().uri().optional(),
      models: Joi.array().items(Joi.string()).optional(),
      max_tokens: Joi.number().integer().min(1).max(32000).optional(),
      rate_limit: Joi.number().integer().min(1).optional(),
      is_active: Joi.boolean().optional(),
      metadata: Joi.object().optional()
    })
  },

  // Auth schemas
  auth: {
    login: Joi.object({
      username: Joi.string().min(3).max(50).required(),
      password: Joi.string().min(6).required()
    }),
    
    register: Joi.object({
      username: Joi.string().min(3).max(50).required(),
      password: Joi.string().min(6).required(),
      role: Joi.string().valid('admin', 'user').default('user')
    })
  },

  // Query schemas
  query: {
    pagination: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sort: Joi.string().max(50).optional(),
      order: Joi.string().valid('asc', 'desc').default('desc')
    }),
    
    search: Joi.object({
      q: Joi.string().max(255).optional(),
      category: Joi.string().max(50).optional(),
      is_active: Joi.boolean().optional(),
      created_after: Joi.date().iso().optional(),
      created_before: Joi.date().iso().optional()
    })
  },

  // ID parameter validation
  id: Joi.number().integer().positive().required()
};

// Schema mapping for string-based validation
const schemaMap = {
  // Chat validations
  'createChat': schemas.chat.create,
  'updateChat': schemas.chat.update,
  'createMessage': schemas.chat.message,
  'updateMessage': schemas.chat.message,
  
  // Agent validations
  'createAgent': schemas.agent.create,
  'updateAgent': schemas.agent.update,
  'assignAgentTools': schemas.agent.assignAgentTools,
  'createLLMConfig': schemas.agent.createLLMConfig,
  'updateLLMConfig': schemas.agent.updateLLMConfig,
  
  // Prompt validations
  'createPrompt': schemas.prompt.create,
  'updatePrompt': schemas.prompt.update,
  
  // Tool validations
  'createTool': schemas.tool.create,
  'updateTool': schemas.tool.update,
  'createToolVersion': schemas.tool.createToolVersion,
  
  // LLM validations
  'createLLM': schemas.llm.create,
  'updateLLM': schemas.llm.update,
  'updateLLMCredentials': schemas.llm.update,
  
  // Query validations
  'paginationQuery': schemas.query.pagination,
  'searchQuery': schemas.query.search,
  
  // Auth validations
  'login': schemas.auth.login,
  'register': schemas.auth.register,
  
  // ID validation
  'id': schemas.id
};

/**
 * Validation middleware factory
 * @param {Object|string} schema - Joi schema to validate against or string key for schemaMap
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    // If schema is a string, get it from schemaMap
    let validationSchema = schema;
    if (typeof schema === 'string') {
      validationSchema = schemaMap[schema];
      if (!validationSchema) {
        return res.status(500).json({
          success: false,
          error: 'Invalid validation schema key: ' + schema
        });
      }
    }
    
    const data = req[source];
    
    const { error, value } = validationSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    // Replace original data with validated/sanitized data
    req[source] = value;
    next();
  };
}

/**
 * Combine multiple validation schemas
 * @param {Object} validations - Object with source as key and schema as value
 */
function validateMultiple(validations) {
  return (req, res, next) => {
    const errors = [];
    
    for (const [source, schema] of Object.entries(validations)) {
      const data = req[source];
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });
      
      if (error) {
        errors.push(...error.details.map(detail => ({
          source,
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })));
      } else {
        req[source] = value;
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    next();
  };
}

module.exports = {
  schemas,
  validate,
  validateMultiple
};