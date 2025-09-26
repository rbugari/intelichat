const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const minimalAuth = require('../middleware/minimalAuth');
const { param } = require('express-validator');

const router = express.Router();
// AuthController usa métodos estáticos, no necesita instanciación

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *         username:
 *           type: string
 *           description: Username
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         role:
 *           type: string
 *           enum: [super_admin, admin, moderator, user]
 *           description: User role
 *         is_active:
 *           type: boolean
 *           description: Whether user is active
 *         last_login:
 *           type: string
 *           format: date-time
 *           description: Last login timestamp
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     
 *     LoginRequest:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: Username or email
 *         password:
 *           type: string
 *           description: User password
 *         rememberMe:
 *           type: boolean
 *           description: Whether to extend token expiration
 *     
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: Username (3-50 chars, alphanumeric + underscore)
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         password:
 *           type: string
 *           description: Password (min 8 chars, must include uppercase, lowercase, number, special char)
 *         role:
 *           type: string
 *           enum: [super_admin, admin, moderator, user]
 *           description: User role (admin only)
 *     
 *     TokenPair:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: JWT access token
 *         refreshToken:
 *           type: string
 *           description: JWT refresh token
 *         accessTokenId:
 *           type: string
 *           description: Access token unique identifier
 *         refreshTokenId:
 *           type: string
 *           description: Refresh token unique identifier
 *         expiresIn:
 *           type: integer
 *           description: Access token expiration in seconds
 *   
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 *       403:
 *         description: Insufficient permissions (admin required for role assignment)
 */
router.post('/register', 
  // Rate limiting will be handled by security middleware
  authenticate, // Require authentication for user creation
  ...AuthController.getRegisterValidation(),
  AuthController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       $ref: '#/components/schemas/TokenPair'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 */
router.post('/login',
  // Rate limiting will be handled by security middleware
  ...AuthController.getLoginValidation(),
  AuthController.login
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 */
router.post('/logout',
  authenticate,
  AuthController.logout
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh',
  // Rate limiting will be handled by security middleware
  AuthController.refreshToken
);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Authentication required
 */
router.get('/profile',
  authenticate,
  AuthController.getProfile
);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [User Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by username or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [super_admin, admin, moderator, user]
 *         description: Filter by role
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       403:
 *         description: Admin access required
 */
router.get('/users',
  minimalAuth.authenticate,
  minimalAuth.requireAdmin,
  AuthController.getAllUsers
);

/**
 * @swagger
 * /api/auth/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [User Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       403:
 *         description: Admin access required or ownership required
 */
router.get('/users/:id',
  param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
  minimalAuth.authenticate,
  minimalAuth.optionalAuth, // Users can view their own profile, admins can view any
  AuthController.getUserById
);

/**
 * @swagger
 * /api/auth/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [User Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: New username
 *               email:
 *                 type: string
 *                 format: email
 *                 description: New email
 *               role:
 *                 type: string
 *                 enum: [super_admin, admin, moderator, user]
 *                 description: New role (admin only)
 *               is_active:
 *                 type: boolean
 *                 description: Active status (admin only)
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or no changes
 *       404:
 *         description: User not found
 *       409:
 *         description: Username or email already exists
 *       403:
 *         description: Insufficient permissions
 */
router.put('/users/:id',
  AuthController.getUpdateValidation(),
  minimalAuth.authenticate,
  minimalAuth.optionalAuth, // Users can update their own profile, admins can update any
  AuthController.updateUser
);

/**
 * @swagger
 * /api/auth/users/{id}:
 *   delete:
 *     summary: Delete user (admin only)
 *     tags: [User Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot delete own account
 *       404:
 *         description: User not found
 *       403:
 *         description: Admin access required
 */
router.delete('/users/:id',
  param('id').isInt({ min: 1 }).withMessage('Invalid user ID'),
  minimalAuth.authenticate,
  minimalAuth.requireAdmin,
  AuthController.deleteUser
);

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Get user sessions
 *     tags: [Session Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           token_id:
 *                             type: string
 *                           ip_address:
 *                             type: string
 *                           user_agent:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           expires_at:
 *                             type: string
 *                             format: date-time
 *                           is_current:
 *                             type: boolean
 */
router.get('/sessions',
  minimalAuth.authenticate,
  async (req, res) => {
    try {
      const { user, tokenPayload } = req;
      const Database = require('../database');
      
      const sessions = await Database.query(
        'SELECT id, token_id, ip_address, user_agent, created_at, expires_at FROM admin_sessions WHERE user_id = ? AND expires_at > NOW() ORDER BY created_at DESC',
        [user.id]
      );
      
      // Mark current session
      const sessionsWithCurrent = sessions.map(session => ({
        ...session,
        is_current: session.token_id === tokenPayload?.jti
      }));
      
      res.json({
        success: true,
        data: {
          sessions: sessionsWithCurrent
        }
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SESSIONS_ERROR',
          message: 'Failed to get sessions'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific session
 *     tags: [Session Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session revoked successfully
 *       404:
 *         description: Session not found
 *       403:
 *         description: Cannot revoke session of another user
 */
router.delete('/sessions/:sessionId',
  param('sessionId').isInt({ min: 1 }).withMessage('Invalid session ID'),
  minimalAuth.authenticate,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { user } = req;
      const Database = require('../database');
      const authMiddleware = new AuthMiddleware();
      
      // Get session details
      const sessions = await Database.query(
        'SELECT id, token_id, user_id FROM admin_sessions WHERE id = ?',
        [sessionId]
      );
      
      if (!sessions || sessions.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found'
          }
        });
      }
      
      const session = sessions[0];
      
      // Check ownership (users can only revoke their own sessions, admins can revoke any)
      if (session.user_id !== user.id && !authMiddleware.hasPermission(user.role, 'admin')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'You can only revoke your own sessions'
          }
        });
      }
      
      // Add token to blacklist
      await authMiddleware.blacklistToken(session.token_id, new Date(Date.now() + 24 * 60 * 60 * 1000)); // 24 hours
      
      // Delete session
      await Database.query('DELETE FROM admin_sessions WHERE id = ?', [sessionId]);
      
      res.json({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (error) {
      console.error('Revoke session error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REVOKE_SESSION_ERROR',
          message: 'Failed to revoke session'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/auth/sessions/revoke-all:
 *   post:
 *     summary: Revoke all sessions except current
 *     tags: [Session Management]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All other sessions revoked successfully
 */
router.post('/sessions/revoke-all',
  minimalAuth.authenticate,
  async (req, res) => {
    try {
      const { user, tokenPayload } = req;
      const Database = require('../database');
      const authMiddleware = new AuthMiddleware();
      
      // Get all other sessions
      const sessions = await Database.query(
        'SELECT token_id FROM admin_sessions WHERE user_id = ? AND token_id != ?',
        [user.id, tokenPayload?.jti || '']
      );
      
      // Blacklist all other tokens
      for (const session of sessions) {
        await authMiddleware.blacklistToken(session.token_id, new Date(Date.now() + 24 * 60 * 60 * 1000));
      }
      
      // Delete all other sessions
      await Database.query(
        'DELETE FROM admin_sessions WHERE user_id = ? AND token_id != ?',
        [user.id, tokenPayload?.jti || '']
      );
      
      res.json({
        success: true,
        message: `${sessions.length} sessions revoked successfully`
      });
    } catch (error) {
      console.error('Revoke all sessions error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REVOKE_ALL_SESSIONS_ERROR',
          message: 'Failed to revoke sessions'
        }
      });
    }
  }
);

module.exports = router;