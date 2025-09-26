/**
 * Minimal Authentication Middleware
 * Provides simplified authentication with development bypass capability
 * Based on PRD Release 2 security requirements
 */

const jwt = require('jsonwebtoken');

class MinimalAuthMiddleware {
  constructor() {
    this.requireAuth = process.env.REQUIRE_AUTH === 'true';
    this.jwtSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    
    if (this.requireAuth && !this.jwtSecret) {
      throw new Error('JWT_ACCESS_SECRET or JWT_SECRET must be provided when REQUIRE_AUTH=true');
    }
  }

  /**
   * Main authentication middleware
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  authenticate = (req, res, next) => {
    // If authentication is not required, bypass with warning
    if (!this.requireAuth) {
      console.warn('⚠️  DEVELOPMENT MODE: Authentication bypassed (REQUIRE_AUTH=false)');
      
      // Set mock user for development
      req.user = {
        id: 1,
        username: 'dev_user',
        email: 'dev@kargho.com',
        role: 'admin',
        is_active: true
      };
      
      req.token = 'dev_token';
      return next();
    }

    // Full JWT authentication when required
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header required'
        });
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Token required'
        });
      }

      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret);
      
      req.user = {
        id: decoded.id || decoded.userId,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role || 'user',
        is_active: decoded.is_active !== false
      };
      
      req.token = token;
      
      console.log(`✅ User authenticated: ${req.user.username} (${req.user.role})`);
      next();
      
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  };

  /**
   * Optional authentication - allows both authenticated and anonymous access
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  optionalAuth = (req, res, next) => {
    if (!this.requireAuth) {
      // Set mock user for development
      req.user = {
        id: 1,
        username: 'dev_user',
        email: 'dev@kargho.com',
        role: 'admin',
        is_active: true
      };
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // No authentication provided, continue as anonymous
      req.user = null;
      return next();
    }

    // Try to authenticate if token is provided
    try {
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      const decoded = jwt.verify(token, this.jwtSecret);
      
      req.user = {
        id: decoded.id || decoded.userId,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role || 'user',
        is_active: decoded.is_active !== false
      };
      
      req.token = token;
      
    } catch (error) {
      // Invalid token, continue as anonymous
      console.warn('⚠️  Invalid token provided, continuing as anonymous:', error.message);
      req.user = null;
    }
    
    next();
  };

  /**
   * Admin-only authentication
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  requireAdmin = (req, res, next) => {
    this.authenticate(req, res, (err) => {
      if (err) return next(err);
      
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }
      
      next();
    });
  };

  /**
   * Get authentication status
   */
  getStatus() {
    return {
      requireAuth: this.requireAuth,
      hasJwtSecret: !!this.jwtSecret,
      mode: this.requireAuth ? 'production' : 'development'
    };
  }
}

// Create singleton instance
const minimalAuth = new MinimalAuthMiddleware();

// Log current authentication mode
console.log(`🔐 Authentication Mode: ${minimalAuth.getStatus().mode.toUpperCase()}`);
if (!minimalAuth.requireAuth) {
  console.log('⚠️  DEVELOPMENT MODE: Set REQUIRE_AUTH=true for production security');
}

module.exports = minimalAuth;