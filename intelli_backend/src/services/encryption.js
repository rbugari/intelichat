const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const zxcvbn = require('zxcvbn'); // For password strength checking

/**
 * Encryption service for sensitive data like LLM credentials and password management
 */
class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    
    // Password policy configuration
    this.passwordPolicy = {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      minStrengthScore: 3, // zxcvbn score (0-4)
      preventCommonPasswords: true,
      preventUserInfo: true
    };
    
    // Bcrypt configuration
    this.saltRounds = 12;
    this.maxPasswordLength = 72; // bcrypt limitation
    
    // Get encryption key from environment or generate one
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  /**
   * Get encryption key from environment or create a new one
   */
  getOrCreateEncryptionKey() {
    const envKey = process.env.ENCRYPTION_KEY;
    const defaultDevKey = '12345678901234567890123456789012'; // Clave fija para desarrollo

    if (envKey && envKey.length === this.keyLength) {
        console.log('✅ ENCRYPTION_KEY encontrada en el entorno.');
        return Buffer.from(envKey, 'utf8');
    }
    
    console.warn(`⚠️  ENCRYPTION_KEY no encontrada o con longitud incorrecta. Usando clave de desarrollo por defecto. NO USAR EN PRODUCCIÓN.`);
    return Buffer.from(defaultDevKey, 'utf8');
  }

  /**
   * Encrypt sensitive data
   * @param {string} plaintext - Data to encrypt
   * @returns {string} - Encrypted data as base64 string
   */
  encrypt(plaintext) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey, { iv });
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine iv, tag, and encrypted data
      const combined = Buffer.concat([
        iv,
        tag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Base64 encrypted data
   * @returns {string} - Decrypted plaintext
   */
  decrypt(encryptedData) {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract iv, tag, and encrypted data
      const iv = combined.subarray(0, this.ivLength);
      const tag = combined.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.subarray(this.ivLength + this.tagLength);
      
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey, { iv });
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Validate password against security policy
   * @param {string} password - Password to validate
   * @param {Object} userInfo - User information to prevent password reuse
   * @returns {Object} - Validation result with details
   */
  validatePassword(password, userInfo = {}) {
    const errors = [];
    const warnings = [];
    
    // Basic length checks
    if (!password || typeof password !== 'string') {
      errors.push('Password is required and must be a string');
      return { isValid: false, errors, warnings, strength: null };
    }
    
    if (password.length < this.passwordPolicy.minLength) {
      errors.push(`Password must be at least ${this.passwordPolicy.minLength} characters long`);
    }
    
    if (password.length > this.passwordPolicy.maxLength) {
      errors.push(`Password must not exceed ${this.passwordPolicy.maxLength} characters`);
    }
    
    // Truncate for bcrypt if needed
    if (password.length > this.maxPasswordLength) {
      warnings.push(`Password will be truncated to ${this.maxPasswordLength} characters for hashing`);
    }
    
    // Character requirements
    if (this.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (this.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (this.passwordPolicy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (this.passwordPolicy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    // Strength analysis using zxcvbn
    let strength = null;
    try {
      const userInputs = [];
      if (userInfo.username) userInputs.push(userInfo.username);
      if (userInfo.email) userInputs.push(userInfo.email.split('@')[0]);
      if (userInfo.firstName) userInputs.push(userInfo.firstName);
      if (userInfo.lastName) userInputs.push(userInfo.lastName);
      
      strength = zxcvbn(password, userInputs);
      
      if (strength.score < this.passwordPolicy.minStrengthScore) {
        errors.push(`Password is too weak. ${strength.feedback.warning || 'Please choose a stronger password'}`);
        if (strength.feedback.suggestions && strength.feedback.suggestions.length > 0) {
          errors.push(`Suggestions: ${strength.feedback.suggestions.join(', ')}`);
        }
      }
      
      // Check for user information in password
      if (this.passwordPolicy.preventUserInfo && userInputs.length > 0) {
        const lowerPassword = password.toLowerCase();
        for (const input of userInputs) {
          if (input && lowerPassword.includes(input.toLowerCase())) {
            errors.push('Password should not contain personal information');
            break;
          }
        }
      }
    } catch (error) {
      warnings.push('Could not analyze password strength');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      strength: strength ? {
        score: strength.score,
        crackTimeDisplay: strength.crack_times_display.offline_slow_hashing_1e4_per_second,
        feedback: strength.feedback
      } : null
    };
  }
  
  /**
   * Hash password using bcrypt with validation
   * @param {string} password - Plain password
   * @param {Object} userInfo - User information for validation
   * @returns {Promise<Object>} - Hash result with validation info
   */
  async hashPassword(password, userInfo = {}) {
    // Validate password first
    const validation = this.validatePassword(password, userInfo);
    
    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }
    
    try {
      // Truncate password if needed for bcrypt
      const passwordToHash = password.length > this.maxPasswordLength 
        ? password.substring(0, this.maxPasswordLength)
        : password;
      
      const hash = await bcrypt.hash(passwordToHash, this.saltRounds);
      
      return {
        hash,
        validation,
        metadata: {
          algorithm: 'bcrypt',
          saltRounds: this.saltRounds,
          hashedAt: new Date().toISOString(),
          truncated: password.length > this.maxPasswordLength
        }
      };
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Verify password against hash with timing attack protection
   * @param {string} password - Plain password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - Verification result
   */
  async verifyPassword(password, hash) {
    if (!password || !hash) {
      // Always perform a hash operation to prevent timing attacks
      await bcrypt.compare('dummy', '$2b$12$dummy.hash.to.prevent.timing.attacks.dummy');
      return false;
    }
    
    try {
      // Truncate password if needed (same as during hashing)
      const passwordToVerify = password.length > this.maxPasswordLength 
        ? password.substring(0, this.maxPasswordLength)
        : password;
      
      return await bcrypt.compare(passwordToVerify, hash);
    } catch (error) {
      // Always perform a hash operation to prevent timing attacks
      await bcrypt.compare('dummy', '$2b$12$dummy.hash.to.prevent.timing.attacks.dummy');
      return false;
    }
  }
  
  /**
   * Generate a secure password that meets policy requirements
   * @param {number} length - Desired password length
   * @returns {string} - Generated secure password
   */
  generateSecurePassword(length = 16) {
    if (length < this.passwordPolicy.minLength) {
      length = this.passwordPolicy.minLength;
    }
    
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    let remainingLength = length;
    
    // Ensure at least one character from each required category
    if (this.passwordPolicy.requireUppercase) {
      password += uppercase[crypto.randomInt(0, uppercase.length)];
      remainingLength--;
    }
    
    if (this.passwordPolicy.requireLowercase) {
      password += lowercase[crypto.randomInt(0, lowercase.length)];
      remainingLength--;
    }
    
    if (this.passwordPolicy.requireNumbers) {
      password += numbers[crypto.randomInt(0, numbers.length)];
      remainingLength--;
    }
    
    if (this.passwordPolicy.requireSpecialChars) {
      password += specialChars[crypto.randomInt(0, specialChars.length)];
      remainingLength--;
    }
    
    // Fill remaining length with random characters from all categories
    const allChars = uppercase + lowercase + numbers + specialChars;
    for (let i = 0; i < remainingLength; i++) {
      password += allChars[crypto.randomInt(0, allChars.length)];
    }
    
    // Shuffle the password to avoid predictable patterns
    return password.split('').sort(() => crypto.randomInt(0, 3) - 1).join('');
  }
  
  /**
   * Check if password has been compromised (basic implementation)
   * In production, this could integrate with HaveIBeenPwned API
   * @param {string} password - Password to check
   * @returns {Promise<boolean>} - True if password appears compromised
   */
  async isPasswordCompromised(password) {
    // Basic check against common passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      '1234567890', 'password1', '123123', 'qwerty123'
    ];
    
    return commonPasswords.includes(password.toLowerCase());
  }
  
  /**
   * Get password policy information
   * @returns {Object} - Current password policy
   */
  getPasswordPolicy() {
    return { ...this.passwordPolicy };
  }
  
  /**
   * Update password policy (for admin configuration)
   * @param {Object} newPolicy - New policy settings
   */
  updatePasswordPolicy(newPolicy) {
    this.passwordPolicy = { ...this.passwordPolicy, ...newPolicy };
  }

  /**
   * Generate a secure random token
   * @param {number} length - Token length in bytes
   * @returns {string} - Random token as hex string
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
}

// Export class and singleton instance
module.exports = EncryptionService;
module.exports.instance = new EncryptionService();