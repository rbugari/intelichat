/**
 * Centralized Database Schema Configuration
 * This file contains all table definitions and field mappings for the project
 * Use this single source of truth for all database operations and tests
 */

const DATABASE_SCHEMA = {
  // Admin Users Table
  admin_users: {
    tableName: 'admin_users',
    fields: {
      id: 'id',
      username: 'username',
      email: 'email',
      password_hash: 'password_hash',
      role: 'role',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at',
      last_login: 'last_login'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user', 'moderator') NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login DATETIME NULL,
        
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_role (role),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Admin users for system management';
    `
  },

  // Admin Sessions Table
  admin_sessions: {
    tableName: 'admin_sessions',
    fields: {
      id: 'id',
      user_id: 'user_id',
      session_token: 'session_token',
      ip_address: 'ip_address',
      user_agent: 'user_agent',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at',
      expires_at: 'expires_at',
      access_token_jti: 'access_token_jti',
      refresh_token_jti: 'refresh_token_jti',
      last_activity: 'last_activity',
      ended_at: 'ended_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_token VARCHAR(255) NOT NULL UNIQUE,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        access_token_jti VARCHAR(36) NULL COMMENT 'Access token JWT ID',
        refresh_token_jti VARCHAR(36) NULL COMMENT 'Refresh token JWT ID',
        last_activity DATETIME NULL COMMENT 'Last activity timestamp',
        ended_at DATETIME NULL COMMENT 'Session end timestamp',
        
        FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_session_token (session_token),
        INDEX idx_is_active (is_active),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Admin user sessions for authentication tracking';
    `
  },

  // User Sessions Table (for regular users)
  user_sessions: {
    tableName: 'user_sessions',
    fields: {
      id: 'id',
      user_id: 'user_id',
      session_token: 'session_token',
      ip_address: 'ip_address',
      user_agent: 'user_agent',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at',
      expires_at: 'expires_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_token VARCHAR(255) NOT NULL UNIQUE,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        
        INDEX idx_user_id (user_id),
        INDEX idx_session_token (session_token),
        INDEX idx_is_active (is_active),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='User sessions for regular users';
    `
  },

  // Token Blacklist Table
  token_blacklist: {
    tableName: 'token_blacklist',
    fields: {
      id: 'id',
      jti: 'jti',
      reason: 'reason',
      expires_at: 'expires_at',
      created_at: 'created_at',
      updated_at: 'updated_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        jti VARCHAR(36) NOT NULL UNIQUE COMMENT 'JWT ID - unique identifier for the token',
        reason VARCHAR(100) NOT NULL DEFAULT 'manual_revocation' COMMENT 'Reason for blacklisting',
        expires_at DATETIME NULL COMMENT 'When this blacklist entry expires (NULL = never)',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_jti (jti),
        INDEX idx_expires_at (expires_at),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Stores blacklisted JWT tokens for security purposes';
    `
  },

  // Chat Messages Table
  chat_messages: {
    tableName: 'ejec_mensaje',
    fields: {
      id: 'id',
      chat_id: 'chat_id',
      contenido: 'contenido',
      rol: 'rol',
      created_at: 'created_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS ejec_mensaje (
        id BIGINT NOT NULL AUTO_INCREMENT,
        chat_id BIGINT NOT NULL,
        contenido LONGTEXT NOT NULL,
        rol ENUM('user','assistant','system') NOT NULL DEFAULT 'user',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        PRIMARY KEY (id),
        KEY idx_mensaje_chat (chat_id),
        KEY idx_mensaje_rol (rol),
        KEY idx_mensaje_created (created_at),
        CONSTRAINT fk_mensaje_chat FOREIGN KEY (chat_id) REFERENCES ejec_chat (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `
  },

  // ============================================
  // RELEASE 2 TABLES - TOOL MANAGEMENT
  // ============================================

  // Tool APIs Table
  tool_apis: {
    tableName: 'tool_apis',
    fields: {
      id: 'id',
      name: 'name',
      description: 'description',
      base_url: 'base_url',
      auth_type: 'auth_type',
      auth_config: 'auth_config',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS tool_apis (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        base_url VARCHAR(255) NOT NULL,
        auth_type ENUM('none', 'bearer', 'api_key', 'oauth2') DEFAULT 'none',
        auth_config JSON,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_name (name),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Tool API configurations for external services';
    `
  },

  // Tool Endpoints Table
  tool_endpoints: {
    tableName: 'tool_endpoints',
    fields: {
      id: 'id',
      api_id: 'api_id',
      name: 'name',
      description: 'description',
      path: 'path',
      method: 'method',
      request_schema: 'request_schema',
      response_schema: 'response_schema',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS tool_endpoints (
        id INT PRIMARY KEY AUTO_INCREMENT,
        api_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        path VARCHAR(255) NOT NULL,
        method ENUM('GET', 'POST', 'PUT', 'DELETE') NOT NULL,
        request_schema JSON,
        response_schema JSON,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (api_id) REFERENCES tool_apis(id) ON DELETE CASCADE,
        INDEX idx_api_id (api_id),
        INDEX idx_name (name),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Tool endpoint definitions for API calls';
    `
  },

  // Tool Versions Table
  tool_versions: {
    tableName: 'tool_versions',
    fields: {
      id: 'id',
      tool_name: 'tool_name',
      version: 'version',
      schema_definition: 'schema_definition',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS tool_versions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tool_name VARCHAR(100) NOT NULL,
        version VARCHAR(20) NOT NULL,
        schema_definition JSON NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_tool_version (tool_name, version),
        INDEX idx_tool_name (tool_name),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Tool version management and schema definitions';
    `
  },

  // Tool Cache Table
  tool_cache: {
    tableName: 'tool_cache',
    fields: {
      id: 'id',
      tool_name: 'tool_name',
      parameters_hash: 'parameters_hash',
      response_data: 'response_data',
      expires_at: 'expires_at',
      created_at: 'created_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS tool_cache (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tool_name VARCHAR(100) NOT NULL,
        parameters_hash VARCHAR(64) NOT NULL,
        response_data JSON,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_cache (tool_name, parameters_hash),
        INDEX idx_tool_name (tool_name),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Cache for tool responses to improve performance';
    `
  },

  // Tool Logs Table
  tool_logs: {
    tableName: 'tool_logs',
    fields: {
      id: 'id',
      tool_name: 'tool_name',
      parameters: 'parameters',
      response: 'response',
      execution_time_ms: 'execution_time_ms',
      success: 'success',
      error_message: 'error_message',
      created_at: 'created_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS tool_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tool_name VARCHAR(100) NOT NULL,
        parameters JSON,
        response JSON,
        execution_time_ms INT,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_tool_name (tool_name),
        INDEX idx_created_at (created_at),
        INDEX idx_success (success)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Logs for tool execution tracking and debugging';
    `
  },

  // Tool Usage Stats Table
  tool_usage_stats: {
    tableName: 'tool_usage_stats',
    fields: {
      id: 'id',
      tool_name: 'tool_name',
      date: 'date',
      call_count: 'call_count',
      average_execution_time_ms: 'average_execution_time_ms',
      success_rate: 'success_rate'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS tool_usage_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tool_name VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        call_count INT DEFAULT 0,
        average_execution_time_ms INT DEFAULT 0,
        success_rate DECIMAL(5,2) DEFAULT 0.00,
        
        UNIQUE KEY unique_tool_date (tool_name, date),
        INDEX idx_tool_name (tool_name),
        INDEX idx_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Daily usage statistics for tools';
    `
  },

  // ============================================
  // RELEASE 2 TABLES - CHAT AND AGENT MANAGEMENT
  // ============================================

  // Chats Table
  chats: {
    tableName: 'ejec_chat',
    fields: {
      id: 'id',
      titulo: 'titulo',
      chatbot_id: 'chatbot_id',
      cliente_id: 'cliente_id',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS ejec_chat (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        titulo VARCHAR(255) NOT NULL DEFAULT 'Nuevo Chat',
        chatbot_id BIGINT NOT NULL,
        cliente_id BIGINT NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        KEY idx_chat_chatbot (chatbot_id),
        KEY idx_chat_cliente (cliente_id),
        KEY idx_chat_active (is_active),
        CONSTRAINT fk_chat_chatbot FOREIGN KEY (chatbot_id) REFERENCES cfg_chatbot (id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_cliente FOREIGN KEY (cliente_id) REFERENCES cfg_cliente (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `
  },

  // Agents Table
  agents: {
    tableName: 'agents',
    fields: {
      id: 'id',
      name: 'name',
      description: 'description',
      system_prompt: 'system_prompt',
      llm_provider: 'llm_provider',
      llm_model: 'llm_model',
      temperature: 'temperature',
      max_tokens: 'max_tokens',
      tools: 'tools',
      is_active: 'is_active',
      metadata: 'metadata',
      created_at: 'created_at',
      updated_at: 'updated_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS agents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        llm_provider VARCHAR(50) NOT NULL,
        llm_model VARCHAR(100) NOT NULL,
        temperature DECIMAL(3,2) DEFAULT 0.70,
        max_tokens INT,
        tools JSON,
        is_active BOOLEAN DEFAULT TRUE,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_name (name),
        INDEX idx_llm_provider (llm_provider),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='AI agents with LLM configurations';
    `
  },

  // Agent Tools Table
  agent_tools: {
    tableName: 'agent_tools',
    fields: {
      id: 'id',
      agent_id: 'agent_id',
      tool_name: 'tool_name',
      is_active: 'is_active',
      created_at: 'created_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS agent_tools (
        id INT PRIMARY KEY AUTO_INCREMENT,
        agent_id INT NOT NULL,
        tool_name VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        UNIQUE KEY unique_agent_tool (agent_id, tool_name),
        INDEX idx_agent_id (agent_id),
        INDEX idx_tool_name (tool_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Tools assigned to agents';
    `
  },

  // ============================================
  // RELEASE 2 TABLES - LLM MANAGEMENT
  // ============================================

  // LLM Agents Table
  llms_agents: {
    tableName: 'llms_agents',
    fields: {
      id: 'id',
      agent_id: 'agent_id',
      name: 'name',
      description: 'description',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS llms_agents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        agent_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
        UNIQUE KEY unique_llm_agent_name (agent_id, name),
        INDEX idx_agent_id (agent_id),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='LLM configurations for agents';
    `
  },

  // LLM Providers Table
  llms_providers: {
    tableName: 'llms_providers',
    fields: {
      id: 'id',
      name: 'name',
      description: 'description',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS llms_providers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_provider_name (name),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='LLM provider configurations';
    `
  },

  // LLM Agent Configs Table
  llms_agent_configs: {
    tableName: 'llms_agent_configs',
    fields: {
      id: 'id',
      agent_id: 'agent_id',
      provider_id: 'provider_id',
      api_key_encrypted: 'api_key_encrypted',
      model_name: 'model_name',
      config_params: 'config_params',
      is_active: 'is_active',
      created_at: 'created_at',
      updated_at: 'updated_at'
    },
    createSQL: `
      CREATE TABLE IF NOT EXISTS llms_agent_configs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        agent_id INT NOT NULL,
        provider_id INT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        model_name VARCHAR(100) NOT NULL,
        config_params JSON,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (agent_id) REFERENCES llms_agents(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES llms_providers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_agent_provider (agent_id, provider_id),
        INDEX idx_agent_id (agent_id),
        INDEX idx_provider_id (provider_id),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='LLM configurations per agent with encrypted credentials';
    `
  }
};

/**
 * Helper functions for database operations
 */
class DatabaseSchemaHelper {
  /**
   * Get table definition by name
   * @param {string} tableName - Name of the table
   * @returns {object} Table definition object
   */
  static getTable(tableName) {
    return DATABASE_SCHEMA[tableName] || null;
  }

  /**
   * Get field name for a table
   * @param {string} tableName - Name of the table
   * @param {string} fieldName - Name of the field
   * @returns {string} Field name or null if not found
   */
  static getField(tableName, fieldName) {
    const table = this.getTable(tableName);
    return table && table.fields[fieldName] ? table.fields[fieldName] : null;
  }

  /**
   * Get CREATE SQL for a table
   * @param {string} tableName - Name of the table
   * @returns {string} CREATE SQL statement
   */
  static getCreateSQL(tableName) {
    const table = this.getTable(tableName);
    return table ? table.createSQL.trim() : null;
  }

  /**
   * Get all table names
   * @returns {Array<string>} Array of table names
   */
  static getAllTableNames() {
    return Object.keys(DATABASE_SCHEMA);
  }

  /**
   * Get all fields for a table
   * @param {string} tableName - Name of the table
   * @returns {object} Object with field mappings
   */
  static getAllFields(tableName) {
    const table = this.getTable(tableName);
    return table ? table.fields : {};
  }

  /**
   * Create test session data for a specific table
   * @param {string} tableName - Name of the table
   * @param {object} data - Data to insert
   * @returns {string} INSERT SQL statement
   */
  static createInsertSQL(tableName, data) {
    const table = this.getTable(tableName);
    if (!table) return null;

    const fields = Object.keys(data);
    const values = fields.map(field => {
      const value = data[field];
      if (value === null) return 'NULL';
      if (value instanceof Date) {
        // Convert JavaScript Date to MySQL DATETIME format
        return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
      }
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      return value;
    });

    return `INSERT INTO ${table.tableName} (${fields.join(', ')}) VALUES (${values.join(', ')})`;
  }

  /**
   * Create DELETE SQL for cleanup
   * @param {string} tableName - Name of the table
   * @param {object} whereConditions - WHERE conditions
   * @returns {string} DELETE SQL statement
   */
  static createDeleteSQL(tableName, whereConditions) {
    const table = this.getTable(tableName);
    if (!table) return null;

    const conditions = Object.keys(whereConditions).map(field => {
      const value = whereConditions[field];
      if (value === null) return `${field} IS NULL`;
      if (typeof value === 'string') return `${field} = '${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return `${field} = ${value ? 'TRUE' : 'FALSE'}`;
      return `${field} = ${value}`;
    });

    return `DELETE FROM ${table.tableName} WHERE ${conditions.join(' AND ')}`;
  }
}

module.exports = {
  DATABASE_SCHEMA,
  DatabaseSchemaHelper
};