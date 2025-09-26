const Database = require('../database')
const logger = require('../utils/logger')

class LLMModelsService {
  // Obtener todos los modelos LLM con paginación y filtros
  static async getPaginated(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit
      let whereClause = 'WHERE 1=1'
      const params = []
      
      // Filtro por búsqueda (nombre o descripción)
      if (filters.search) {
        whereClause += ' AND (m.name LIKE ? OR m.description LIKE ?)'
        params.push(`%${filters.search}%`, `%${filters.search}%`)
      }
      
      // Filtro por proveedor
      if (filters.provider_id) {
        whereClause += ' AND m.provider_id = ?'
        params.push(filters.provider_id)
      }
      
      // Filtro por estado activo
      if (filters.is_active !== undefined) {
        whereClause += ' AND m.is_active = ?'
        params.push(filters.is_active)
      }
      
      // Filtro por tipo de modelo
      if (filters.model_type) {
        whereClause += ' AND m.model_type = ?'
        params.push(filters.model_type)
      }
      
      // Consulta para obtener el total de registros
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM llms_models m
        LEFT JOIN llms_providers p ON m.provider_id = p.id
        ${whereClause}
      `
      
      const countResult = await Database.query(countQuery, params)
      const total = countResult[0].total
      const totalPages = Math.ceil(total / limit)
      
      // Consulta para obtener los datos paginados
      const dataQuery = `
        SELECT 
          m.id,
          m.provider_id,
          m.name,
          m.description,
          m.model_type,
          m.context_length,
          m.max_tokens,
          m.pricing_input,
          m.pricing_output,
          m.is_active,
          m.metadata,
          m.created_at,
          m.updated_at,
          p.name as provider_name,
          p.api_base_url as provider_api_base_url
        FROM llms_models m
        LEFT JOIN llms_providers p ON m.provider_id = p.id
        ${whereClause}
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `
      
      const rows = await Database.query(dataQuery, [...params, limit, offset])
      
      return {
        data: rows.map(row => ({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : null
        })),
        page,
        limit,
        total,
        totalPages
      }
    } catch (error) {
      logger.error('Error en LLMModelsService.getPaginated:', error)
      throw error
    }
  }

  // Obtener modelo LLM por ID
  static async getById(id) {
    try {
      const query = `
        SELECT 
          m.id,
          m.provider_id,
          m.name,
          m.description,
          m.model_type,
          m.context_length,
          m.max_tokens,
          m.pricing_input,
          m.pricing_output,
          m.is_active,
          m.metadata,
          m.created_at,
          m.updated_at,
          p.name as provider_name,
          p.api_base_url as provider_api_base_url
        FROM llms_models m
        LEFT JOIN llms_providers p ON m.provider_id = p.id
        WHERE m.id = ?
      `
      
      const rows = await Database.query(query, [id])
      
      if (rows.length === 0) {
        return null
      }
      
      const model = rows[0]
      return {
        ...model,
        metadata: model.metadata ? JSON.parse(model.metadata) : null
      }
    } catch (error) {
      logger.error('Error en LLMModelsService.getById:', error)
      throw error
    }
  }

  // Crear nuevo modelo LLM
  static async create(modelData) {
    try {
      const {
        provider_id,
        name,
        description,
        model_type,
        context_length,
        max_tokens,
        pricing_input,
        pricing_output,
        is_active = true,
        metadata
      } = modelData
      
      const query = `
        INSERT INTO llms_models (
          provider_id, name, description, model_type, context_length, 
          max_tokens, pricing_input, pricing_output, is_active, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      
      const metadataJson = metadata ? JSON.stringify(metadata) : null
      
      const result = await Database.query(query, [
        provider_id,
        name,
        description,
        model_type,
        context_length,
        max_tokens,
        pricing_input,
        pricing_output,
        is_active,
        metadataJson
      ])
      
      return await this.getById(result.insertId)
    } catch (error) {
      logger.error('Error en LLMModelsService.create:', error)
      throw error
    }
  }

  // Actualizar modelo LLM
  static async update(id, updateData) {
    try {
      const existingModel = await this.getById(id)
      if (!existingModel) {
        return null
      }
      
      const {
        provider_id,
        name,
        description,
        model_type,
        context_length,
        max_tokens,
        pricing_input,
        pricing_output,
        is_active,
        metadata
      } = updateData
      
      const fields = []
      const values = []
      
      if (provider_id !== undefined) {
        fields.push('provider_id = ?')
        values.push(provider_id)
      }
      
      if (name !== undefined) {
        fields.push('name = ?')
        values.push(name)
      }
      
      if (description !== undefined) {
        fields.push('description = ?')
        values.push(description)
      }
      
      if (model_type !== undefined) {
        fields.push('model_type = ?')
        values.push(model_type)
      }
      
      if (context_length !== undefined) {
        fields.push('context_length = ?')
        values.push(context_length)
      }
      
      if (max_tokens !== undefined) {
        fields.push('max_tokens = ?')
        values.push(max_tokens)
      }
      
      if (pricing_input !== undefined) {
        fields.push('pricing_input = ?')
        values.push(pricing_input)
      }
      
      if (pricing_output !== undefined) {
        fields.push('pricing_output = ?')
        values.push(pricing_output)
      }
      
      if (is_active !== undefined) {
        fields.push('is_active = ?')
        values.push(is_active)
      }
      
      if (metadata !== undefined) {
        fields.push('metadata = ?')
        values.push(metadata ? JSON.stringify(metadata) : null)
      }
      
      if (fields.length === 0) {
        return existingModel
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP')
      values.push(id)
      
      const query = `
        UPDATE llms_models 
        SET ${fields.join(', ')}
        WHERE id = ?
      `
      
      await Database.query(query, values)
      
      return await this.getById(id)
    } catch (error) {
      logger.error('Error en LLMModelsService.update:', error)
      throw error
    }
  }

  // Eliminar modelo LLM
  static async delete(id) {
    try {
      const existingModel = await this.getById(id)
      if (!existingModel) {
        return false
      }
      
      const query = 'DELETE FROM llms_models WHERE id = ?'
      const result = await Database.query(query, [id])
      
      return result.affectedRows > 0
    } catch (error) {
      logger.error('Error en LLMModelsService.delete:', error)
      throw error
    }
  }

  // Obtener modelos por proveedor
  static async getByProvider(providerId, filters = {}) {
    try {
      let whereClause = 'WHERE m.provider_id = ?'
      const params = [providerId]
      
      // Filtro por estado activo
      if (filters.is_active !== undefined) {
        whereClause += ' AND m.is_active = ?'
        params.push(filters.is_active)
      }
      
      const query = `
        SELECT 
          m.id,
          m.provider_id,
          m.name,
          m.description,
          m.model_type,
          m.context_length,
          m.max_tokens,
          m.pricing_input,
          m.pricing_output,
          m.is_active,
          m.metadata,
          m.created_at,
          m.updated_at,
          p.name as provider_name
        FROM llms_models m
        LEFT JOIN llms_providers p ON m.provider_id = p.id
        ${whereClause}
        ORDER BY m.name ASC
      `
      
      const rows = await Database.query(query, params)
      
      return rows.map(row => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null
      }))
    } catch (error) {
      logger.error('Error en LLMModelsService.getByProvider:', error)
      throw error
    }
  }

  // Obtener todos los modelos activos (para selects)
  static async getActive() {
    try {
      const query = `
        SELECT 
          m.id, 
          m.name, 
          m.model_type,
          p.name as provider_name
        FROM llms_models m
        LEFT JOIN llms_providers p ON m.provider_id = p.id
        WHERE m.is_active = true AND p.is_active = true
        ORDER BY p.name ASC, m.name ASC
      `
      
      const rows = await Database.query(query)
      return rows
    } catch (error) {
      logger.error('Error en LLMModelsService.getActive:', error)
      throw error
    }
  }

  // Obtener estadísticas de uso de un modelo
  static async getUsageStats(modelId, filters = {}) {
    try {
      const { start_date, end_date } = filters
      let whereClause = 'WHERE 1=1'
      const params = []
      
      // Aquí se podría implementar la lógica para obtener estadísticas
      // desde tablas de logs o usage tracking si existen
      
      if (start_date) {
        whereClause += ' AND created_at >= ?'
        params.push(start_date)
      }
      
      if (end_date) {
        whereClause += ' AND created_at <= ?'
        params.push(end_date)
      }
      
      // Por ahora retornamos estadísticas básicas del modelo
      const model = await this.getById(modelId)
      if (!model) {
        throw new Error('Modelo no encontrado')
      }
      
      return {
        model_id: modelId,
        model_name: model.name,
        provider_name: model.provider_name,
        total_requests: 0, // Implementar cuando exista tabla de logs
        total_tokens: 0,   // Implementar cuando exista tabla de logs
        avg_response_time: 0, // Implementar cuando exista tabla de logs
        last_used: null    // Implementar cuando exista tabla de logs
      }
    } catch (error) {
      logger.error('Error en LLMModelsService.getUsageStats:', error)
      throw error
    }
  }

  // Obtener tipos de modelo únicos
  static async getModelTypes() {
    try {
      const query = `
        SELECT DISTINCT model_type
        FROM llms_models
        WHERE model_type IS NOT NULL
        ORDER BY model_type ASC
      `
      
      const rows = await Database.query(query)
      return rows.map(row => row.model_type)
    } catch (error) {
      logger.error('Error en LLMModelsService.getModelTypes:', error)
      throw error
    }
  }
}

module.exports = LLMModelsService