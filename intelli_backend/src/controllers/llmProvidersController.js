const LLMProvidersService = require('../services/llmProvidersService')
const { validationResult } = require('express-validator')
const logger = require('../utils/logger')

class LLMProvidersController {
  // Obtener todos los proveedores LLM con paginación
  static async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', is_active } = req.query
      
      const filters = {
        search: search.trim(),
        is_active: is_active !== undefined ? is_active === 'true' : undefined
      }
      
      const result = await LLMProvidersService.getPaginated(
        parseInt(page),
        parseInt(limit),
        filters
      )
      
      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      })
    } catch (error) {
      logger.error('Error al obtener proveedores LLM:', error)
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Obtener proveedor LLM por ID
  static async getById(req, res) {
    try {
      const { id } = req.params
      const provider = await LLMProvidersService.getById(parseInt(id))
      
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor LLM no encontrado'
        })
      }
      
      res.json({
        success: true,
        data: provider
      })
    } catch (error) {
      logger.error('Error al obtener proveedor LLM:', error)
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Crear nuevo proveedor LLM
  static async create(req, res) {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        })
      }

      const providerData = req.body
      const newProvider = await LLMProvidersService.create(providerData)
      
      logger.info(`Proveedor LLM creado: ${newProvider.id} - ${newProvider.name}`)
      
      res.status(201).json({
        success: true,
        message: 'Proveedor LLM creado exitosamente',
        data: newProvider
      })
    } catch (error) {
      logger.error('Error al crear proveedor LLM:', error)
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un proveedor LLM con ese nombre'
        })
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Actualizar proveedor LLM
  static async update(req, res) {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        })
      }

      const { id } = req.params
      const updateData = req.body
      
      const updatedProvider = await LLMProvidersService.update(parseInt(id), updateData)
      
      if (!updatedProvider) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor LLM no encontrado'
        })
      }
      
      logger.info(`Proveedor LLM actualizado: ${id} - ${updatedProvider.name}`)
      
      res.json({
        success: true,
        message: 'Proveedor LLM actualizado exitosamente',
        data: updatedProvider
      })
    } catch (error) {
      logger.error('Error al actualizar proveedor LLM:', error)
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un proveedor LLM con ese nombre'
        })
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Eliminar proveedor LLM
  static async delete(req, res) {
    try {
      const { id } = req.params
      const deleted = await LLMProvidersService.delete(parseInt(id))
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor LLM no encontrado'
        })
      }
      
      logger.info(`Proveedor LLM eliminado: ${id}`)
      
      res.json({
        success: true,
        message: 'Proveedor LLM eliminado exitosamente'
      })
    } catch (error) {
      logger.error('Error al eliminar proveedor LLM:', error)
      
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({
          success: false,
          message: 'No se puede eliminar el proveedor porque tiene modelos asociados'
        })
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Obtener modelos de un proveedor específico
  static async getProviderModels(req, res) {
    try {
      const { id } = req.params
      const { page = 1, limit = 10, is_active } = req.query
      
      const filters = {
        provider_id: parseInt(id),
        is_active: is_active !== undefined ? is_active === 'true' : undefined
      }
      
      const result = await LLMProvidersService.getProviderModels(
        parseInt(page),
        parseInt(limit),
        filters
      )
      
      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      })
    } catch (error) {
      logger.error('Error al obtener modelos del proveedor:', error)
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Activar/desactivar proveedor LLM
  static async toggleStatus(req, res) {
    try {
      const { id } = req.params
      const { is_active } = req.body
      
      const updatedProvider = await LLMProvidersService.update(parseInt(id), { is_active })
      
      if (!updatedProvider) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor LLM no encontrado'
        })
      }
      
      logger.info(`Estado del proveedor LLM ${id} cambiado a: ${is_active ? 'activo' : 'inactivo'}`)
      
      res.json({
        success: true,
        message: `Proveedor LLM ${is_active ? 'activado' : 'desactivado'} exitosamente`,
        data: updatedProvider
      })
    } catch (error) {
      logger.error('Error al cambiar estado del proveedor LLM:', error)
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
}

module.exports = LLMProvidersController