const express = require('express')
const llmModelsController = require('../controllers/llmModelsController')
const { authenticateToken } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { body, param, query } = require('express-validator')

const router = express.Router()

// Aplicar autenticación a todas las rutas
router.use(authenticateToken)

// Validaciones para crear modelo LLM
const createModelValidation = [
  body('provider_id')
    .isInt({ min: 1 })
    .withMessage('provider_id debe ser un número entero positivo'),
  body('name')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  body('model_type')
    .notEmpty()
    .withMessage('El tipo de modelo es requerido')
    .isIn(['text', 'chat', 'embedding', 'image', 'audio', 'multimodal'])
    .withMessage('Tipo de modelo no válido'),
  body('context_length')
    .optional()
    .isInt({ min: 1 })
    .withMessage('context_length debe ser un número entero positivo'),
  body('max_tokens')
    .optional()
    .isInt({ min: 1 })
    .withMessage('max_tokens debe ser un número entero positivo'),
  body('pricing_input')
    .optional()
    .isDecimal({ decimal_digits: '0,6' })
    .withMessage('pricing_input debe ser un número decimal válido'),
  body('pricing_output')
    .optional()
    .isDecimal({ decimal_digits: '0,6' })
    .withMessage('pricing_output debe ser un número decimal válido'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active debe ser un valor booleano'),
  body('metadata')
    .optional()
    .custom((value) => {
      if (value && typeof value !== 'object') {
        throw new Error('metadata debe ser un objeto JSON válido')
      }
      return true
    })
]

// Validaciones para actualizar modelo LLM
const updateModelValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  body('provider_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('provider_id debe ser un número entero positivo'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  body('model_type')
    .optional()
    .isIn(['text', 'chat', 'embedding', 'image', 'audio', 'multimodal'])
    .withMessage('Tipo de modelo no válido'),
  body('context_length')
    .optional()
    .isInt({ min: 1 })
    .withMessage('context_length debe ser un número entero positivo'),
  body('max_tokens')
    .optional()
    .isInt({ min: 1 })
    .withMessage('max_tokens debe ser un número entero positivo'),
  body('pricing_input')
    .optional()
    .isDecimal({ decimal_digits: '0,6' })
    .withMessage('pricing_input debe ser un número decimal válido'),
  body('pricing_output')
    .optional()
    .isDecimal({ decimal_digits: '0,6' })
    .withMessage('pricing_output debe ser un número decimal válido'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active debe ser un valor booleano'),
  body('metadata')
    .optional()
    .custom((value) => {
      if (value && typeof value !== 'object') {
        throw new Error('metadata debe ser un objeto JSON válido')
      }
      return true
    })
]

// Validaciones para parámetros de ID
const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo')
]

// Validaciones para consultas paginadas
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page debe ser un número entero positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit debe ser un número entre 1 y 100'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('search debe tener entre 1 y 100 caracteres'),
  query('provider_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('provider_id debe ser un número entero positivo'),
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active debe ser un valor booleano'),
  query('model_type')
    .optional()
    .isIn(['text', 'chat', 'embedding', 'image', 'audio', 'multimodal'])
    .withMessage('Tipo de modelo no válido')
]

// Validaciones para estadísticas
const statsValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('start_date debe ser una fecha válida en formato ISO8601'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('end_date debe ser una fecha válida en formato ISO8601')
]

// Rutas CRUD

// GET /api/llm-models - Obtener todos los modelos con paginación
router.get('/', 
  paginationValidation,
  validateRequest,
  llmModelsController.getAll
)

// GET /api/llm-models/active - Obtener modelos activos (para selects)
router.get('/active', llmModelsController.getActive)

// GET /api/llm-models/types - Obtener tipos de modelo únicos
router.get('/types', llmModelsController.getModelTypes)

// GET /api/llm-models/by-provider/:providerId - Obtener modelos por proveedor
router.get('/by-provider/:providerId', 
  [
    param('providerId')
      .isInt({ min: 1 })
      .withMessage('providerId debe ser un número entero positivo'),
    query('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active debe ser un valor booleano')
  ],
  validateRequest,
  llmModelsController.getByProvider
)

// GET /api/llm-models/:id - Obtener modelo por ID
router.get('/:id', 
  idValidation,
  validateRequest,
  llmModelsController.getById
)

// GET /api/llm-models/:id/stats - Obtener estadísticas de uso de un modelo
router.get('/:id/stats', 
  statsValidation,
  validateRequest,
  llmModelsController.getUsageStats
)

// POST /api/llm-models - Crear nuevo modelo
router.post('/', 
  createModelValidation,
  validateRequest,
  llmModelsController.create
)

// PUT /api/llm-models/:id - Actualizar modelo
router.put('/:id', 
  updateModelValidation,
  validateRequest,
  llmModelsController.update
)

// PATCH /api/llm-models/:id/toggle-status - Cambiar estado activo/inactivo
router.patch('/:id/toggle-status', 
  idValidation,
  validateRequest,
  llmModelsController.toggleStatus
)

// DELETE /api/llm-models/:id - Eliminar modelo
router.delete('/:id', 
  idValidation,
  validateRequest,
  llmModelsController.delete
)

module.exports = router