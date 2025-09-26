const crypto = require('crypto');

/**
 * Encryption service for sensitive data like LLM credentials
 */
class EncryptionService {
  constructor() {
    // Use environment variable or generate a temporary key
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateTemporaryKey();
    this.algorithm = 'aes-256-gcm';
    this.ivLength = 16; // For GCM, this is 12 bytes, but we'll use 16 for compatibility
    this.tagLength = 16;
    
    if (!process.env.ENCRYPTION_KEY) {
      console.warn('⚠️  No ENCRYPTION_KEY found in environment. Generating temporary key.');
    }
  }

  /**
   * Generate a temporary encryption key for development
   * @returns {string} - Base64 encoded key
   */
  generateTemporaryKey() {
    const key = crypto.randomBytes(32);
    return key.toString('base64');
  }

  /**
   * Encrypt sensitive data
   * @param {string} text - Text to encrypt
   * @returns {string} - Encrypted data with IV and tag (base64 encoded)
   */
  encrypt(text) {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Text to encrypt must be a non-empty string');
      }

      const key = Buffer.from(this.encryptionKey, 'base64');
      const iv = crypto.randomBytes(12); // 12 bytes for GCM
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('kargho-llm-credentials', 'utf8'));
      
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const combined = Buffer.concat([
        iv,
        tag,
        Buffer.from(encrypted, 'base64')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @returns {string} - Decrypted text
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Encrypted data must be a non-empty string');
      }

      const key = Buffer.from(this.encryptionKey, 'base64');
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract IV, tag, and encrypted data
      const iv = combined.slice(0, 12);
      const tag = combined.slice(12, 28);
      const encrypted = combined.slice(28);
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAuthTag(tag);
      decipher.setAAD(Buffer.from('kargho-llm-credentials', 'utf8'));
      
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt LLM credentials object
   * @param {Object} credentials - Credentials object
   * @returns {string} - Encrypted credentials
   */
  encryptCredentials(credentials) {
    try {
      if (!credentials || typeof credentials !== 'object') {
        throw new Error('Credentials must be an object');
      }

      const credentialsString = JSON.stringify(credentials);
      return this.encrypt(credentialsString);
    } catch (error) {
      throw new Error(`Failed to encrypt credentials: ${error.message}`);
    }
  }

  /**
   * Decrypt LLM credentials
   * @param {string} encryptedCredentials - Encrypted credentials string
   * @returns {Object} - Decrypted credentials object
   */
  decryptCredentials(encryptedCredentials) {
    try {
      if (!encryptedCredentials) {
        return null;
      }

      const decryptedString = this.decrypt(encryptedCredentials);
      return JSON.parse(decryptedString);
    } catch (error) {
      throw new Error(`Failed to decrypt credentials: ${error.message}`);
    }
  }

  /**
   * Hash sensitive data (one-way)
   * @param {string} data - Data to hash
   * @returns {string} - Hashed data
   */
  hash(data) {
    try {
      if (!data || typeof data !== 'string') {
        throw new Error('Data to hash must be a non-empty string');
      }

      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      throw new Error(`Hashing failed: ${error.message}`);
    }
  }

  /**
   * Generate a secure random string
   * @param {number} length - Length of the random string
   * @returns {string} - Random string
   */
  generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Validate if data is encrypted by this service
   * @param {string} data - Data to validate
   * @returns {boolean} - True if data appears to be encrypted
   */
  isEncrypted(data) {
    try {
      if (!data || typeof data !== 'string') {
        return false;
      }

      // Try to decode as base64 and check minimum length
      const buffer = Buffer.from(data, 'base64');
      return buffer.length >= (12 + 16); // IV + tag minimum
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
module.exports = new EncryptionService();
module.exports.EncryptionService = EncryptionService;