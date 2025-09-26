/**
 * Enhanced JWT Token Service
 * Provides comprehensive token management with security features
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { SECURITY_SETTINGS } = require('../config/security');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kargho_chat',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

class TokenService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || crypto.randomBytes(64).toString('hex');
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
    this.blacklistedTokens = new Set();
    this.tokenMetrics = {
      issued: 0,
      verified: 0,
      blacklisted: 0,
      expired: 0
    };
  }

  /**
   * Generate access token with enhanced payload
   * @param {Object} user - User object
   * @param {Object} options - Token options
   * @returns {string} - JWT access token
   */
  generateAccessToken(user, options = {}) {
    const jti = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      jti, // JWT ID for token tracking
      iat: now,
      exp: now + this._parseExpiry(options.expiresIn || SECURITY_SETTINGS.JWT.ACCESS_TOKEN_EXPIRY),
      iss: SECURITY_SETTINGS.JWT.ISSUER,
      aud: options.audience || 'kargho-chat-client',
      sub: user.id.toString(),
      // Security context
      sessionId: options.sessionId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent ? this._hashUserAgent(options.userAgent) : null,
      permissions: this._getUserPermissions(user.role),
      tokenType: 'access'
    };

    const token = jwt.sign(payload, this.accessTokenSecret, {
      algorithm: SECURITY_SETTINGS.JWT.ALGORITHM
    });

    this.tokenMetrics.issued++;
    return { token, jti, expiresAt: new Date(payload.exp * 1000) };
  }

  /**
   * Generate refresh token
   * @param {Object} user - User object
   * @param {Object} options - Token options
   * @returns {Object} - Refresh token data
   */
  generateRefreshToken(user, options = {}) {
    const jti = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      id: user.id,
      jti,
      iat: now,
      exp: now + this._parseExpiry(options.expiresIn || SECURITY_SETTINGS.JWT.REFRESH_TOKEN_EXPIRY),
      iss: SECURITY_SETTINGS.JWT.ISSUER,
      aud: options.audience || 'kargho-chat-client',
      sub: user.id.toString(),
      sessionId: options.sessionId,
      tokenType: 'refresh',
      // Refresh tokens have limited payload for security
      role: user.role // Minimal role info for refresh validation
    };

    const token = jwt.sign(payload, this.refreshTokenSecret, {
      algorithm: SECURITY_SETTINGS.JWT.ALGORITHM
    });

    return { token, jti, expiresAt: new Date(payload.exp * 1000) };
  }

  /**
   * Verify access token with comprehensive validation
   * @param {string} token - JWT token
   * @param {Object} options - Verification options
   * @returns {Object} - Decoded token payload
   */
  async verifyAccessToken(token, options = {}) {
    try {
      // Basic JWT verification
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        algorithms: [SECURITY_SETTINGS.JWT.ALGORITHM],
        issuer: SECURITY_SETTINGS.JWT.ISSUER,
        audience: options.audience || 'kargho-chat-client'
      });

      // Validate token type
      if (decoded.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }

      // Check if token is blacklisted
      if (decoded.jti && await this.isTokenBlacklisted(decoded.jti)) {
        this.tokenMetrics.blacklisted++;
        throw new Error('Token has been revoked');
      }

      // Validate session if provided
      if (decoded.sessionId && options.validateSession) {
        const sessionValid = await this._validateSession(decoded.sessionId, decoded.id);
        if (!sessionValid) {
          throw new Error('Session is no longer valid');
        }
      }

      // IP address validation (optional)
      if (options.validateIP && decoded.ipAddress && options.currentIP) {
        if (decoded.ipAddress !== options.currentIP) {
          console.warn(`IP mismatch for user ${decoded.id}: ${decoded.ipAddress} vs ${options.currentIP}`);
          // Don't throw error, just log for monitoring
        }
      }

      // User agent validation (optional)
      if (options.validateUserAgent && decoded.userAgent && options.currentUserAgent) {
        const currentHash = this._hashUserAgent(options.currentUserAgent);
        if (decoded.userAgent !== currentHash) {
          console.warn(`User agent mismatch for user ${decoded.id}`);
          // Don't throw error, just log for monitoring
        }
      }

      this.tokenMetrics.verified++;
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        this.tokenMetrics.expired++;
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - Refresh token
   * @param {Object} options - Verification options
   * @returns {Object} - Decoded token payload
   */
  async verifyRefreshToken(token, options = {}) {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        algorithms: [SECURITY_SETTINGS.JWT.ALGORITHM],
        issuer: SECURITY_SETTINGS.JWT.ISSUER,
        audience: options.audience || 'kargho-chat-client'
      });

      // Validate token type
      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if token is blacklisted
      if (decoded.jti && await this.isTokenBlacklisted(decoded.jti)) {
        throw new Error('Refresh token has been revoked');
      }

      // Validate session
      if (decoded.sessionId) {
        const sessionValid = await this._validateSession(decoded.sessionId, decoded.id);
        if (!sessionValid) {
          throw new Error('Session is no longer valid');
        }
      }

      return decoded;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Blacklist a token
   * @param {string} jti - JWT ID
   * @param {string} reason - Reason for blacklisting
   * @param {Date} expiresAt - When the blacklist entry expires
   */
  async blacklistToken(jti, reason = 'manual_revocation', expiresAt = null) {
    try {
      // Add to in-memory blacklist for fast lookup
      this.blacklistedTokens.add(jti);

      // Store in database for persistence
      const database = await mysql.createConnection(dbConfig);
      try {
        await database.execute(
          `INSERT INTO token_blacklist (jti, reason, expires_at, created_at) 
           VALUES (?, ?, ?, NOW()) 
           ON DUPLICATE KEY UPDATE reason = VALUES(reason)`,
          [jti, reason, expiresAt]
        );
      } finally {
        await database.end();
      }

      this.tokenMetrics.blacklisted++;
    } catch (error) {
      console.error('Failed to blacklist token:', error);
      throw error;
    }
  }

  /**
   * Check if token is blacklisted
   * @param {string} jti - JWT ID
   * @returns {boolean} - True if blacklisted
   */
  async isTokenBlacklisted(jti) {
    // Check in-memory cache first
    if (this.blacklistedTokens.has(jti)) {
      return true;
    }

    try {
      // Check database
      const database = await mysql.createConnection(dbConfig);
      let result;
      try {
        [result] = await database.execute(
          'SELECT 1 FROM token_blacklist WHERE jti = ? AND (expires_at IS NULL OR expires_at > NOW())',
          [jti]
        );
      } finally {
        await database.end();
      }

      const isBlacklisted = result && result.length > 0;
      
      // Cache the result
      if (isBlacklisted) {
        this.blacklistedTokens.add(jti);
      }

      return isBlacklisted;
    } catch (error) {
      console.error('Failed to check token blacklist:', error);
      // Fail secure - assume blacklisted if we can't check
      return true;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Valid refresh token
   * @param {Object} options - Refresh options
   * @returns {Object} - New token pair
   */
  async refreshAccessToken(refreshToken, options = {}) {
    try {
      // Verify refresh token
      const decoded = await this.verifyRefreshToken(refreshToken, options);

      // Get current user data
      const database = await mysql.createConnection(dbConfig);
      let userResult;
      try {
        [userResult] = await database.execute(
          'SELECT id, username, email, role, is_active FROM admin_users WHERE id = ? AND is_active = TRUE',
          [decoded.id]
        );
      } finally {
        await database.end();
      }

      if (!userResult || userResult.length === 0) {
        throw new Error('User not found or inactive');
      }

      const user = userResult[0];

      // Generate new access token
      const accessTokenData = this.generateAccessToken(user, {
        sessionId: decoded.sessionId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        audience: options.audience
      });

      // Optionally rotate refresh token
      let newRefreshToken = null;
      if (options.rotateRefreshToken) {
        // Blacklist old refresh token
        await this.blacklistToken(decoded.jti, 'refresh_token_rotation');
        
        // Generate new refresh token
        const refreshTokenData = this.generateRefreshToken(user, {
          sessionId: decoded.sessionId,
          audience: options.audience
        });
        newRefreshToken = refreshTokenData;
      }

      return {
        accessToken: accessTokenData.token,
        refreshToken: newRefreshToken ? newRefreshToken.token : refreshToken,
        expiresAt: accessTokenData.expiresAt,
        tokenType: 'Bearer'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get token metrics for monitoring
   * @returns {Object} - Token metrics
   */
  getTokenMetrics() {
    return {
      ...this.tokenMetrics,
      blacklistedCount: this.blacklistedTokens.size
    };
  }

  /**
   * Clean expired blacklisted tokens
   */
  async cleanExpiredBlacklist() {
    try {
      const database = await mysql.createConnection(dbConfig);
      try {
        await database.execute(
          'DELETE FROM token_blacklist WHERE expires_at IS NOT NULL AND expires_at < NOW()'
        );
      } finally {
        await database.end();
      }
      
      // Clear in-memory cache (will be rebuilt as needed)
      this.blacklistedTokens.clear();
    } catch (error) {
      console.error('Failed to clean expired blacklist:', error);
    }
  }

  /**
   * Parse expiry string to seconds
   * @param {string} expiry - Expiry string (e.g., '15m', '7d')
   * @returns {number} - Seconds
   */
  _parseExpiry(expiry) {
    const units = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400
    };

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiry format');
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  /**
   * Hash user agent for privacy
   * @param {string} userAgent - User agent string
   * @returns {string} - Hashed user agent
   */
  _hashUserAgent(userAgent) {
    return crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 16);
  }

  /**
   * Get user permissions based on role
   * @param {string} role - User role
   * @returns {Array} - Array of permissions
   */
  _getUserPermissions(role) {
    const permissions = {
      user: ['read:own', 'write:own'],
      moderator: ['read:own', 'write:own', 'read:others'],
      admin: ['read:all', 'write:all', 'delete:all', 'manage:users'],
      super_admin: ['*']
    };

    return permissions[role] || permissions.user;
  }

  /**
   * Validate session exists and is active
   * @param {string} sessionId - Session ID
   * @param {number} userId - User ID
   * @returns {boolean} - True if session is valid
   */
  async _validateSession(sessionId, userId) {
    try {
      const database = await mysql.createConnection(dbConfig);
      let result;
      try {
        [result] = await database.execute(
          'SELECT 1 FROM user_sessions WHERE id = ? AND user_id = ? AND is_active = TRUE AND expires_at > NOW()',
          [sessionId, userId]
        );
      } finally {
        await database.end();
      }
      return result && result.length > 0;
    } catch (error) {
      console.error('Failed to validate session:', error);
      return false;
    }
  }
}

// Export class and singleton instance
module.exports = TokenService;
module.exports.instance = new TokenService();