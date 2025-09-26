/**
 * Middleware para manejar funciones asíncronas en Express
 * Captura errores automáticamente y los pasa al middleware de manejo de errores
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  asyncHandler
};