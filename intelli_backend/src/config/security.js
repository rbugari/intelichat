/**
 * Security Configuration
 * Defines role-based access control policies for different routes and operations
 */

const SECURITY_POLICIES = {
  // LLM Management - Admin only operations
  LLM_ADMIN_OPERATIONS: [
    'POST /api/llms',           // Create LLM
    'PUT /api/llms/:id',        // Update LLM
    'DELETE /api/llms/:id',     // Delete LLM
    'POST /api/llms/:id/test',  // Test LLM connection
    'PUT /api/llms/:id/credentials', // Update credentials
  ],

  // Agent Management - Admin operations for system-wide agents
  AGENT_ADMIN_OPERATIONS: [
    'DELETE /api/agents/:id',   // Delete agent (system-wide)
  ],

  // Tool Management - Admin operations for system tools
  TOOL_ADMIN_OPERATIONS: [
    'DELETE /api/tools/:id',    // Delete tool (system-wide)
    'POST /api/tools/:id/test', // Test tool function
  ],

  // User Management - Admin only
  USER_ADMIN_OPERATIONS: [
    'GET /api/auth/users',      // List all users
    'GET /api/auth/users/:id',  // Get user by ID
    'PUT /api/auth/users/:id',  // Update user
    'DELETE /api/auth/users/:id', // Delete user
    'GET /api/auth/sessions',   // View all sessions
  ],

  // Statistics and Analytics - Admin access
  STATS_ADMIN_OPERATIONS: [
    'GET /api/llms/stats',      // LLM statistics
    'GET /api/agents/stats',    // Agent statistics
    'GET /api/tools/stats',     // Tool statistics
    'GET /api/chats/stats',     // Chat statistics
    'GET /api/prompts/stats',   // Prompt statistics
  ],

  // Public operations (authenticated users)
  USER_OPERATIONS: [
    'GET /api/llms',            // List LLMs
    'GET /api/llms/providers',  // Get providers
    'GET /api/llms/:id',        // Get LLM details
    'GET /api/agents',          // List agents
    'GET /api/agents/:id',      // Get agent details
    'POST /api/agents',         // Create agent
    'PUT /api/agents/:id',      // Update own agent
    'GET /api/tools',           // List tools
    'GET /api/tools/:id',       // Get tool details
    'POST /api/tools',          // Create tool
    'PUT /api/tools/:id',       // Update own tool
    'GET /api/chats',           // List own chats
    'GET /api/chats/:id',       // Get own chat
    'POST /api/chats',          // Create chat
    'PUT /api/chats/:id',       // Update own chat
    'DELETE /api/chats/:id',    // Delete own chat
    'GET /api/prompts',         // List prompts
    'GET /api/prompts/:id',     // Get prompt details
    'POST /api/prompts',        // Create prompt
    'PUT /api/prompts/:id',     // Update own prompt
    'DELETE /api/prompts/:id',  // Delete own prompt
  ],
};

/**
 * Role hierarchy for permission checking
 */
const ROLE_HIERARCHY = {
  'user': 1,
  'moderator': 2,
  'admin': 3,
  'super_admin': 4
};

/**
 * Default security settings
 */
const SECURITY_SETTINGS = {
  // Admin Operations
  ADMIN_OPERATIONS: {
    LLM_MANAGEMENT: ['create', 'update', 'delete', 'test'],
    AGENT_MANAGEMENT: ['delete'],
    TOOL_MANAGEMENT: ['delete', 'test'],
    USER_MANAGEMENT: ['list', 'create', 'update', 'delete'],
    SESSION_MANAGEMENT: ['view_all', 'terminate'],
    STATS_ACCESS: ['llm', 'agent', 'tool', 'chat', 'prompt']
  },

  // User Operations
  USER_OPERATIONS: {
    LLM_ACCESS: ['list', 'view', 'providers'],
    AGENT_MANAGEMENT: ['list', 'view', 'create', 'update_own'],
    TOOL_MANAGEMENT: ['list', 'view', 'create', 'update_own'],
    CHAT_MANAGEMENT: ['list_own', 'view_own', 'create', 'update_own', 'delete_own'],
    PROMPT_MANAGEMENT: ['list', 'view', 'create', 'update_own', 'delete_own']
  },

  // Role Hierarchy
  ROLE_HIERARCHY: ROLE_HIERARCHY,

  // JWT Configuration
  JWT: {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    ALGORITHM: 'HS256',
    ISSUER: 'kargho-chat-api',
  },

  // Rate Limiting
  RATE_LIMITS: {
    AUTH: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
      skipSuccessfulRequests: true
    },
    API: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: false
    }
  },

  // Password Policy
  PASSWORD_POLICY: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    minStrengthScore: 3, // zxcvbn score (0-4)
    preventCommonPasswords: true,
    preventUserInfo: true
  },

  // Session Management
  SESSION: {
    maxConcurrentSessions: 5,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    trackUserAgent: true,
    trackIpAddress: true
  }
};

/**
 * Check if a route requires admin privileges
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @returns {boolean} - True if admin access required
 */
function requiresAdminAccess(method, path) {
  const route = `${method.toUpperCase()} ${path}`;
  
  return [
    ...SECURITY_POLICIES.LLM_ADMIN_OPERATIONS,
    ...SECURITY_POLICIES.AGENT_ADMIN_OPERATIONS,
    ...SECURITY_POLICIES.TOOL_ADMIN_OPERATIONS,
    ...SECURITY_POLICIES.USER_ADMIN_OPERATIONS,
    ...SECURITY_POLICIES.STATS_ADMIN_OPERATIONS
  ].some(adminRoute => {
    // Handle parameterized routes
    const routePattern = adminRoute.replace(/:id/g, '[^/]+');
    const regex = new RegExp(`^${routePattern}$`);
    return regex.test(route);
  });
}

/**
 * Check if a route is accessible to regular users
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @returns {boolean} - True if user access allowed
 */
function allowsUserAccess(method, path) {
  const route = `${method.toUpperCase()} ${path}`;
  
  return SECURITY_POLICIES.USER_OPERATIONS.some(userRoute => {
    const routePattern = userRoute.replace(/:id/g, '[^/]+');
    const regex = new RegExp(`^${routePattern}$`);
    return regex.test(route);
  });
}

/**
 * Get required role for a specific route
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @returns {string} - Required role ('user', 'admin', etc.)
 */
function getRequiredRole(method, path) {
  if (requiresAdminAccess(method, path)) {
    return 'admin';
  }
  
  if (allowsUserAccess(method, path)) {
    return 'user';
  }
  
  // Default to user access for undefined routes
  return 'user';
}

/**
 * Check if a user role has permission to perform an action requiring a specific role
 * @param {string} userRole - The user's role
 * @param {string} requiredRole - The required role for the action
 * @returns {boolean} - True if user has permission
 */
function hasPermission(userRole, requiredRole) {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

module.exports = {
  SECURITY_POLICIES,
  ROLE_HIERARCHY,
  SECURITY_SETTINGS,
  requiresAdminAccess,
  allowsUserAccess,
  getRequiredRole,
  hasPermission
};