const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación JWT simplificado
 */
class AuthMiddleware {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
  }

  /**
   * Verificar token JWT
   */
  verifyToken(token) {
    return jwt.verify(token, this.jwtSecret);
  }

  /**
   * Middleware de autenticación simple
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'NO_AUTH_HEADER',
              message: 'Token de autorización requerido'
            }
          });
        }
        
        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.slice(7) 
          : authHeader;
        
        if (!token) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'NO_TOKEN',
              message: 'Token no proporcionado'
            }
          });
        }
        
        // Verificar token
        let decoded;
        try {
          decoded = this.verifyToken(token);
        } catch (tokenError) {
          console.error('Error de verificación de token:', tokenError);
          
          let message = 'Token inválido';
          if (tokenError.name === 'TokenExpiredError') {
            message = 'Token expirado';
          } else if (tokenError.name === 'JsonWebTokenError') {
            message = 'Token malformado';
          }
          
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_TOKEN',
              message
            }
          });
        }
        
        // Agregar información del usuario a la request
        req.user = {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role || 'admin'
        };
        req.token = token;
        req.tokenPayload = decoded;
        
        next();
      } catch (error) {
        console.error('Error en middleware de autenticación:', error);
        return res.status(500).json({
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: 'Error interno de autenticación'
          }
        });
      }
    };
  }

  /**
   * Middleware opcional - permite acceso sin autenticación
   */
  optionalAuth() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
          return next();
        }
        
        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.slice(7) 
          : authHeader;
        
        if (!token) {
          return next();
        }
        
        try {
          const decoded = this.verifyToken(token);
          req.user = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role || 'admin'
          };
          req.token = token;
          req.tokenPayload = decoded;
        } catch (tokenError) {
          // Token inválido, pero continuamos sin autenticación
          console.warn('Token inválido en auth opcional:', tokenError.message);
        }
        
        next();
      } catch (error) {
        console.error('Error en middleware de auth opcional:', error);
        next();
      }
    };
  }

  /**
   * Verificar si el usuario tiene el rol requerido
   */
  requireRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Autenticación requerida'
          }
        });
      }

      const userRole = req.user.role;
      
      // Para simplicidad, solo verificamos admin
      if (requiredRole === 'admin' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Permisos insuficientes'
          }
        });
      }

      next();
    };
  }
}

// Crear instancia y exportar métodos
const authMiddleware = new AuthMiddleware();

module.exports = {
  AuthMiddleware,
  authenticate: authMiddleware.authenticate(),
  optionalAuth: authMiddleware.optionalAuth(),
  requireRole: authMiddleware.requireRole.bind(authMiddleware)
};