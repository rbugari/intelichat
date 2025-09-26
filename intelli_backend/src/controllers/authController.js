const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// Usuario hardcodeado
const ADMIN_USER = {
  id: 1,
  username: 'admin',
  password: 'adm123',
  role: 'admin'
};

class AuthController {
  /**
   * Validación para login
   */
  static getLoginValidation() {
    return [
      body('username')
        .notEmpty()
        .withMessage('Username es requerido'),
      body('password')
        .notEmpty()
        .withMessage('Password es requerido')
    ];
  }

  /**
   * Validación para registro (método dummy para compatibilidad)
   */
  static getRegisterValidation() {
    return [
      body('username')
        .notEmpty()
        .withMessage('Username es requerido'),
      body('password')
        .notEmpty()
        .withMessage('Password es requerido')
    ];
  }

  /**
   * Validación para actualización de usuario
   */
  static getUpdateValidation() {
    return [
      body('username')
        .optional()
        .notEmpty()
        .withMessage('Username no puede estar vacío'),
      body('email')
        .optional()
        .isEmail()
        .withMessage('Email debe ser válido')
    ];
  }

  /**
   * Login simple con usuario hardcodeado
   */
  static async login(req, res) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de entrada inválidos',
            details: errors.array()
          }
        });
      }

      const { username, password } = req.body;

      // Verificar credenciales hardcodeadas
      if (username !== ADMIN_USER.username || password !== ADMIN_USER.password) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Usuario o contraseña incorrectos'
          }
        });
      }

      // Generar JWT token
      const tokenPayload = {
        id: ADMIN_USER.id,
        username: ADMIN_USER.username,
        role: ADMIN_USER.role
      };

      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'default-secret-key',
        { 
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          issuer: 'kargho-chat',
          audience: 'kargho-chat-client'
        }
      );

      res.json({
        success: true,
        message: 'Login exitoso',
        data: {
          token,
          tokenType: 'Bearer',
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          user: {
            id: ADMIN_USER.id,
            username: ADMIN_USER.username,
            role: ADMIN_USER.role
          }
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: 'Error interno del servidor'
        }
      });
    }
  }

  /**
   * Registro (método dummy para compatibilidad)
   */
  static async register(req, res) {
    try {
      res.status(400).json({ 
        success: false, 
        message: 'Registro no disponible en modo simple' 
      });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor' 
      });
    }
  }

  /**
   * Logout - invalidar token
   */
  static async logout(req, res) {
    try {
      // En una implementación simple, solo devolvemos éxito
      // En una implementación más completa, podríamos mantener una blacklist de tokens
      res.json({ 
        success: true, 
        message: 'Logout exitoso' 
      });
    } catch (error) {
      console.error('Error en logout:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor' 
      });
    }
  }

  /**
   * Verificar token (para rutas protegidas)
   */
  static async verify(req, res) {
    try {
      // El middleware ya verificó el token, solo devolvemos la info del usuario
      res.json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (error) {
      console.error('Error en verify:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VERIFY_ERROR',
          message: 'Error interno del servidor'
        }
      });
    }
  }

  /**
   * Verificar token JWT
   */
  static async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token no proporcionado' 
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      res.json({ 
        success: true, 
        data: { 
          user: decoded,
          valid: true 
        } 
      });
    } catch (error) {
      console.error('Error verificando token:', error);
      res.status(401).json({ 
        success: false, 
        message: 'Token inválido' 
      });
    }
  }

  /**
   * Métodos dummy para compatibilidad con rutas existentes
   */
  static async refreshToken(req, res) {
    res.status(501).json({ success: false, message: 'No implementado en modo simple' });
  }

  static async getProfile(req, res) {
    res.status(501).json({ success: false, message: 'No implementado en modo simple' });
  }

  static async getAllUsers(req, res) {
    res.status(501).json({ success: false, message: 'No implementado en modo simple' });
  }

  static async getUserById(req, res) {
    res.status(501).json({ success: false, message: 'No implementado en modo simple' });
  }

  static async updateUser(req, res) {
    res.status(501).json({ success: false, message: 'No implementado en modo simple' });
  }

  static async deleteUser(req, res) {
    res.status(501).json({ success: false, message: 'No implementado en modo simple' });
  }
}

module.exports = AuthController;