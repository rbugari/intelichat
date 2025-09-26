const express = require('express')
const llmProvidersController = require('../controllers/llmProvidersController')
const { authenticateToken } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { body, param, query } = require('express-validator')

const router = express.Router()

// Aplicar autenticación a todas las rutas
router.use(authenticateToken)

// Validaciones para crear proveedor LLM
const createProviderValidation = [
  body('name')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('api_base_url')
    .notEmpty()
    .withMessage('La URL base de la API es requerida')
    .isURL()
    .withMessage('Debe ser una URL válida'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
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

// Validaciones para actualizar proveedor LLM
const updateProviderValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('api_base_url')
    .optional()
    .isURL()
    .withMessage('Debe ser una URL válida'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
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
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active debe ser un valor booleano')
]

// Rutas CRUD

// GET /api/llm-providers - Obtener todos los proveedores con paginación
router.get('/', 
  paginationValidation,
  validateRequest,
  llmProvidersController.getAll
)

// GET /api/llm-providers/active - Obtener proveedores activos (para selects)
router.get('/active', llmProvidersController.getActive)

// GET /api/llm-providers/:id - Obtener proveedor por ID
router.get('/:id', 
  idValidation,
  validateRequest,
  llmProvidersController.getById
)

// GET /api/llm-providers/:id/models - Obtener modelos de un proveedor
router.get('/:id/models', 
  idValidation,
  validateRequest,
  llmProvidersController.getProviderModels
)

// POST /api/llm-providers - Crear nuevo proveedor
router.post('/', 
  createProviderValidation,
  validateRequest,
  llmProvidersController.create
)

// PUT /api/llm-providers/:id - Actualizar proveedor
router.put('/:id', 
  updateProviderValidation,
  validateRequest,
  llmProvidersController.update
)

// PATCH /api/llm-providers/:id/toggle-status - Cambiar estado activo/inactivo
router.patch('/:id/toggle-status', 
  idValidation,
  validateRequest,
  llmProvidersController.toggleStatus
)

// DELETE /api/llm-providers/:id - Eliminar proveedor
router.delete('/:id', 
  idValidation,
  validateRequest,
  llmProvidersController.delete
)

module.exports = router