/**
 * Administrative Routes
 * Protected routes for user management and system administration
 */

const express = require('express');
const router = express.Router();
const minimalAuth = require('../middleware/minimalAuth');
const SecurityMiddleware = require('../middleware/security');
const { SECURITY_SETTINGS } = require('../config/security');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { validate } = require('../validators/schemas');
const Joi = require('joi');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatmini',
  charset: 'utf8mb4'
};

// Helper function to execute database queries
async function executeQuery(query, params = []) {
  const database = mysql.createConnection(dbConfig);
  try {
    const [results] = await database.execute(query, params);
    return results;
  } finally {
    await database.end();
  }
}

// Initialize security middleware
const securityMiddleware = new SecurityMiddleware();

// Apply minimal authentication and admin authorization to all routes
router.use(minimalAuth.authenticate);
router.use(minimalAuth.requireAdmin);
router.use(securityMiddleware.securityHeaders());
router.use(securityMiddleware.securityLogger());

// Validation schemas
const createUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]')).required(),
  role: Joi.string().valid('admin', 'user').default('user'),
  is_active: Joi.boolean().default(true)
});

const updateUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30),
  email: Joi.string().email(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]')),
  role: Joi.string().valid('admin', 'user'),
  is_active: Joi.boolean()
});

/**
 * @route GET /api/admin/users
 * @desc Get all users with pagination and filtering
 * @access Admin only
 */
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, is_active, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, username, email, role, is_active, created_at, updated_at, last_login FROM admin_users';
    let countQuery = 'SELECT COUNT(*) as total FROM admin_users';
    const queryParams = [];
    const conditions = [];
    
    // Apply filters
    if (role) {
      conditions.push('role = ?');
      queryParams.push(role);
    }
    
    if (is_active !== undefined) {
      conditions.push('is_active = ?');
      queryParams.push(is_active === 'true');
    }
    
    if (search) {
      conditions.push('(username LIKE ? OR email LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const [users, totalResult] = await Promise.all([
      executeQuery(query, queryParams),
      executeQuery(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
    ]);
    
    const total = totalResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/admin/users/:id
 * @desc Get user by ID
 * @access Admin only
 */
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const users = await executeQuery(
      'SELECT id, username, email, role, is_active, created_at, updated_at, last_login FROM admin_users WHERE id = ?',
      [id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user sessions
    const sessions = await executeQuery(
      'SELECT id, ip_address, user_agent, created_at, last_activity, is_active FROM admin_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [id]
    );
    
    res.json({
      success: true,
      data: {
        user: users[0],
        sessions
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route POST /api/admin/users
 * @desc Create new user
 * @access Admin only
 */
router.post('/users', securityMiddleware.sanitizeInput(), async (req, res) => {
  try {
    const { error, value } = createUserSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    const { username, email, password, role, is_active } = value;
    
    // Check if username or email already exists
    const existingUsers = await executeQuery(
      'SELECT id FROM admin_users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    
    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const result = await executeQuery(
      'INSERT INTO admin_users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role, is_active]
    );
    
    // Fetch created user (without password)
    const newUser = await executeQuery(
      'SELECT id, username, email, role, is_active, created_at FROM admin_users WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: newUser[0]
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route PUT /api/admin/users/:id
 * @desc Update user
 * @access Admin only
 */
router.put('/users/:id', securityMiddleware.sanitizeInput(), async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateUserSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    // Check if user exists
    const existingUsers = await executeQuery(
      'SELECT id FROM admin_users WHERE id = ?',
      [id]
    );
    
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent admin from deactivating themselves
    if (req.user.id == id && value.is_active === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }
    
    // Prevent admin from changing their own role
    if (req.user.id == id && value.role && value.role !== req.user.role) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }
    
    const updateFields = [];
    const updateValues = [];
    
    // Build dynamic update query
    Object.keys(value).forEach(key => {
      if (key === 'password') {
        updateFields.push('password_hash = ?');
        // Hash password if provided
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        updateValues.push(bcrypt.hashSync(value[key], saltRounds));
      } else {
        updateFields.push(`${key} = ?`);
        updateValues.push(value[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    updateFields.push('updated_at = NOW()');
    updateValues.push(id);
    
    await executeQuery(
      `UPDATE admin_users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Fetch updated user
    const updatedUser = await executeQuery(
      'SELECT id, username, email, role, is_active, created_at, updated_at FROM admin_users WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: updatedUser[0]
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route DELETE /api/admin/users/:id
 * @desc Delete user
 * @access Admin only
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent admin from deleting themselves
    if (req.user.id == id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    // Check if user exists
    const existingUsers = await executeQuery(
      'SELECT id FROM admin_users WHERE id = ?',
      [id]
    );
    
    if (existingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete user sessions first
    await executeQuery('DELETE FROM admin_sessions WHERE user_id = ?', [id]);
    
    // Delete user
    await executeQuery('DELETE FROM admin_users WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/admin/sessions
 * @desc Get all active sessions
 * @access Admin only
 */
router.get('/sessions', async (req, res) => {
  try {
    const { page = 1, limit = 20, user_id, is_active } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT s.id, s.user_id, s.ip_address, s.user_agent, s.created_at, s.last_activity, s.is_active,
             u.username, u.email, u.role
      FROM admin_sessions s
      JOIN admin_users u ON s.user_id = u.id
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM admin_sessions s JOIN admin_users u ON s.user_id = u.id';
    const queryParams = [];
    const conditions = [];
    
    // Apply filters
    if (user_id) {
      conditions.push('s.user_id = ?');
      queryParams.push(user_id);
    }
    
    if (is_active !== undefined) {
      conditions.push('s.is_active = ?');
      queryParams.push(is_active === 'true');
    }
    
    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }
    
    query += ' ORDER BY s.last_activity DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const [sessions, totalResult] = await Promise.all([
      executeQuery(query, queryParams),
      executeQuery(countQuery, queryParams.slice(0, -2))
    ]);
    
    const total = totalResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route DELETE /api/admin/sessions/:id
 * @desc Terminate session
 * @access Admin only
 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if session exists
    const sessions = await executeQuery(
      'SELECT id, user_id FROM admin_sessions WHERE id = ?',
      [id]
    );
    
    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    // Prevent admin from terminating their own session
    if (req.user.sessionId == id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot terminate your own session'
      });
    }
    
    // Terminate session
    await executeQuery(
      'UPDATE admin_sessions SET is_active = FALSE, ended_at = NOW() WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    console.error('Error terminating session:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * @route GET /api/admin/stats
 * @desc Get system statistics
 * @access Admin only
 */
router.get('/stats', async (req, res) => {
  try {
    const [userStats, sessionStats, tokenStats] = await Promise.all([
      // User statistics
      executeQuery(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_users,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_users_30d
        FROM admin_users
      `),
      
      // Session statistics
      executeQuery(`
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_sessions,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as sessions_24h
        FROM admin_sessions
      `),
      
      // Token blacklist statistics
      executeQuery(`
        SELECT 
          COUNT(*) as blacklisted_tokens,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as blacklisted_24h
        FROM token_blacklist
      `)
    ]);
    
    res.json({
      success: true,
      data: {
        users: userStats[0],
        sessions: sessionStats[0],
        tokens: tokenStats[0],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;