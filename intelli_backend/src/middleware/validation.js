const { validationResult } = require('express-validator');

/**
 * Middleware para validar requests usando express-validator
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: errors.array()
    });
  }
  
  next();
};

module.exports = {
  validateRequest
};