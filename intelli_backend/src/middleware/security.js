/**
 * Security Middleware
 * Centralized security policies and route protection
 */

const { getRequiredRole, SECURITY_SETTINGS } = require('../config/security');
const minimalAuth = require('./minimalAuth');

class SecurityMiddleware {
  constructor() {
    this.minimalAuth = minimalAuth;
  }

  /**
   * Dynamic route protection based on security policies
   * Automatically applies appropriate authorization based on route
   * @param {Object} options - Security options
   */
  protectRoute(options = {}) {
    return (req, res, next) => {
      const method = req.method;
      const path = req.route?.path || req.path;
      const fullPath = req.baseUrl + path;
      
      // Get required role for this route
      const requiredRole = options.role || getRequiredRole(method, fullPath);
      
      // Apply authentication first
      this.minimalAuth.authenticate(req, res, (authError) => {
        if (authError) {
          return next(authError);
        }
        
        // Apply authorization if role is required
        if (requiredRole && requiredRole !== 'public') {
          if (requiredRole === 'admin') {
            return this.minimalAuth.requireAdmin(req, res, next);
          } else {
            return this.minimalAuth.optionalAuth(req, res, next);
          }
        }
        
        next();
      });
    };
  }

  /**
   * Resource ownership validation
   * Ensures users can only access their own resources unless they're admin
   * @param {string} resourceIdParam - Parameter name for resource ID
   * @param {string} ownerField - Field name that contains owner ID
   * @param {Function} getResourceOwner - Function to get resource owner
   */
  validateOwnership(resourceIdParam = 'id', ownerField = 'user_id', getResourceOwner = null) {
    return async (req, res, next) => {
      try {
        // Admin users bypass ownership checks
        if (req.user && req.user.role === 'admin') {
          return next();
        }
        
        const resourceId = req.params[resourceIdParam];
        if (!resourceId) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_RESOURCE_ID',
              message: 'Resource ID is required'
            }
          });
        }
        
        let ownerId;
        
        if (getResourceOwner && typeof getResourceOwner === 'function') {
          // Use custom function to get owner
          ownerId = await getResourceOwner(resourceId);
        } else {
          // Default: assume resource has direct owner field
          // This would need to be implemented based on your database structure
          ownerId = req.body[ownerField] || req.user.id;
        }
        
        if (ownerId !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'OWNERSHIP_REQUIRED',
              message: 'You can only access your own resources'
            }
          });
        }
        
        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'OWNERSHIP_CHECK_FAILED',
            message: 'Failed to validate resource ownership'
          }
        });
      }
    };
  }

  /**
   * API rate limiting with different limits for different user roles
   * @param {Object} options - Rate limiting options
   */
  rateLimitByRole(options = {}) {
    const limits = {
      user: options.userLimit || 100,
      admin: options.adminLimit || 1000,
      ...options.customLimits
    };
    
    const windowMs = options.windowMs || SECURITY_SETTINGS.RATE_LIMITS.API.windowMs;
    const requests = new Map();
    
    return (req, res, next) => {
      const identifier = req.user ? `${req.user.id}-${req.user.role}` : req.ip;
      const userRole = req.user?.role || 'user';
      const maxRequests = limits[userRole] || limits.user;
      
      const now = Date.now();
      const userRequests = requests.get(identifier) || [];
      
      // Clean old requests
      const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
      
      if (validRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 1000 / 60} minutes.`,
            retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000)
          }
        });
      }
      
      // Add current request
      validRequests.push(now);
      requests.set(identifier, validRequests);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - validRequests.length),
        'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
      });
      
      next();
    };
  }

  /**
   * Security headers middleware
   * Adds security-related HTTP headers
   */
  securityHeaders() {
    return (req, res, next) => {
      // Security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;",
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      });
      
      // Remove server information
      res.removeHeader('X-Powered-By');
      
      next();
    };
  }

  /**
   * Request logging for security monitoring
   * @param {Object} options - Logging options
   */
  securityLogger(options = {}) {
    const logSensitiveRoutes = options.logSensitiveRoutes !== false;
    const logFailedAuth = options.logFailedAuth !== false;
    
    return (req, res, next) => {
      const startTime = Date.now();
      const originalSend = res.send;
      
      res.send = function(data) {
        const duration = Date.now() - startTime;
        const logData = {
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: req.user?.id,
          userRole: req.user?.role,
          statusCode: res.statusCode,
          duration
        };
        
        // Log failed authentication attempts
        if (logFailedAuth && (res.statusCode === 401 || res.statusCode === 403)) {
          console.warn('Security Alert - Failed Auth:', JSON.stringify(logData));
        }
        
        // Log sensitive route access
        if (logSensitiveRoutes && (req.path.includes('/admin') || req.path.includes('/users'))) {
          console.log('Sensitive Route Access:', JSON.stringify(logData));
        }
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Input sanitization middleware
   * Sanitizes request data to prevent injection attacks
   */
  sanitizeInput() {
    return (req, res, next) => {
      // Sanitize query parameters
      if (req.query) {
        req.query = this._sanitizeObject(req.query);
      }
      
      // Sanitize request body
      if (req.body) {
        req.body = this._sanitizeObject(req.body);
      }
      
      next();
    };
  }

  /**
   * Sanitize object recursively
   * @param {Object} obj - Object to sanitize
   * @returns {Object} - Sanitized object
   */
  _sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? this._sanitizeString(obj) : obj;
    }
    
    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const sanitizedKey = this._sanitizeString(key);
        sanitized[sanitizedKey] = this._sanitizeObject(obj[key]);
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize string to prevent XSS and injection attacks
   * @param {string} str - String to sanitize
   * @returns {string} - Sanitized string
   */
  _sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/[<>"'&]/g, (match) => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[match];
      })
      .trim();
  }
}

// Export class and singleton instance
module.exports = SecurityMiddleware;
module.exports.instance = new SecurityMiddleware();