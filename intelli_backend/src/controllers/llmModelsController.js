const LLMModelsService = require('../services/llmModelsService')
const { validationResult } = require('express-validator')
const logger = require('../utils/logger')

class LLMModelsController {
  // Obtener todos los modelos LLM con paginación
  static async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', provider_id, is_active, model_type } = req.query
      
      const filters = {
        search: search.trim(),
        provider_id: provider_id ? parseInt(provider_id) : undefined,
        is_active: is_active !== undefined ? is_active === 'true' : undefined,
        model_type: model_type || undefined
      }
      
      const result = await LLMModelsService.getPaginated(
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
      logger.error('Error al obtener modelos LLM:', error)
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Obtener modelo LLM por ID
  static async getById(req, res) {
    try {
      const { id } = req.params
      const model = await LLMModelsService.getById(parseInt(id))
      
      if (!model) {
        return res.status(404).json({
          success: false,
          message: 'Modelo LLM no encontrado'
        })
      }
      
      res.json({
        success: true,
        data: model
      })
    } catch (error) {
      logger.error('Error al obtener modelo LLM:', error)
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Crear nuevo modelo LLM
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

      const modelData = req.body
      const newModel = await LLMModelsService.create(modelData)
      
      logger.info(`Modelo LLM creado: ${newModel.id} - ${newModel.name}`)
      
      res.status(201).json({
        success: true,
        message: 'Modelo LLM creado exitosamente',
        data: newModel
      })
    } catch (error) {
      logger.error('Error al crear modelo LLM:', error)
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un modelo LLM con ese nombre para este proveedor'
        })
      }
      
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
          success: false,
          message: 'El proveedor LLM especificado no existe'
        })
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Actualizar modelo LLM
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
      
      const updatedModel = await LLMModelsService.update(parseInt(id), updateData)
      
      if (!updatedModel) {
        return res.status(404).json({
          success: false,
          message: 'Modelo LLM no encontrado'
        })
      }
      
      logger.info(`Modelo LLM actualizado: ${id} - ${updatedModel.name}`)
      
      res.json({
        success: true,
        message: 'Modelo LLM actualizado exitosamente',
        data: updatedModel
      })
    } catch (error) {
      logger.error('Error al actualizar modelo LLM:', error)
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Ya existe un modelo LLM con ese nombre para este proveedor'
        })
      }
      
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
          success: false,
          message: 'El proveedor LLM especificado no existe'
        })
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Eliminar modelo LLM
  static async delete(req, res) {
    try {
      const { id } = req.params
      const deleted = await LLMModelsService.delete(parseInt(id))
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Modelo LLM no encontrado'
        })
      }
      
      logger.info(`Modelo LLM eliminado: ${id}`)
      
      res.json({
        success: true,
        message: 'Modelo LLM eliminado exitosamente'
      })
    } catch (error) {
      logger.error('Error al eliminar modelo LLM:', error)
      
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(409).json({
          success: false,
          message: 'No se puede eliminar el modelo porque está siendo utilizado'
        })
      }
      
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Obtener modelos por proveedor
  static async getByProvider(req, res) {
    try {
      const { providerId } = req.params
      const { page = 1, limit = 10, is_active } = req.query
      
      const filters = {
        provider_id: parseInt(providerId),
        is_active: is_active !== undefined ? is_active === 'true' : undefined
      }
      
      const result = await LLMModelsService.getPaginated(
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
      logger.error('Error al obtener modelos por proveedor:', error)
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Activar/desactivar modelo LLM
  static async toggleStatus(req, res) {
    try {
      const { id } = req.params
      const { is_active } = req.body
      
      const updatedModel = await LLMModelsService.update(parseInt(id), { is_active })
      
      if (!updatedModel) {
        return res.status(404).json({
          success: false,
          message: 'Modelo LLM no encontrado'
        })
      }
      
      logger.info(`Estado del modelo LLM ${id} cambiado a: ${is_active ? 'activo' : 'inactivo'}`)
      
      res.json({
        success: true,
        message: `Modelo LLM ${is_active ? 'activado' : 'desactivado'} exitosamente`,
        data: updatedModel
      })
    } catch (error) {
      logger.error('Error al cambiar estado del modelo LLM:', error)
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }

  // Obtener estadísticas de uso de modelos
  static async getUsageStats(req, res) {
    try {
      const { id } = req.params
      const { start_date, end_date } = req.query
      
      const stats = await LLMModelsService.getUsageStats(parseInt(id), {
        start_date,
        end_date
      })
      
      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('Error al obtener estadísticas de uso:', error)
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
}

module.exports = LLMModelsController