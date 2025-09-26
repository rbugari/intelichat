const Database = require('../database')
const logger = require('../utils/logger')

class LLMProvidersService {
  // Obtener todos los proveedores LLM con paginación y filtros
  static async getPaginated(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit
      let whereClause = 'WHERE 1=1'
      const params = []
      
      // Filtro por búsqueda (nombre o descripción)
      if (filters.search) {
        whereClause += ' AND (name LIKE ? OR description LIKE ?)'
        params.push(`%${filters.search}%`, `%${filters.search}%`)
      }
      
      // Filtro por estado activo
      if (filters.is_active !== undefined) {
        whereClause += ' AND is_active = ?'
        params.push(filters.is_active)
      }
      
      // Consulta para obtener el total de registros
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM llms_providers 
        ${whereClause}
      `
      
      const countResult = await Database.query(countQuery, params)
      const total = countResult[0].total
      const totalPages = Math.ceil(total / limit)
      
      // Consulta para obtener los datos paginados
      const dataQuery = `
        SELECT 
          id,
          name,
          description,
          api_base_url,
          api_version,
          is_active,
          metadata,
          created_at,
          updated_at,
          (SELECT COUNT(*) FROM llms_models WHERE provider_id = llms_providers.id) as models_count
        FROM llms_providers 
        ${whereClause}
        ORDER BY created_at DESC
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
      logger.error('Error en LLMProvidersService.getPaginated:', error)
      throw error
    }
  }

  // Obtener proveedor LLM por ID
  static async getById(id) {
    try {
      const query = `
        SELECT 
          id,
          name,
          description,
          api_base_url,
          api_version,
          is_active,
          metadata,
          created_at,
          updated_at,
          (SELECT COUNT(*) FROM llms_models WHERE provider_id = llms_providers.id) as models_count
        FROM llms_providers 
        WHERE id = ?
      `
      
      const rows = await Database.query(query, [id])
      
      if (rows.length === 0) {
        return null
      }
      
      const provider = rows[0]
      return {
        ...provider,
        metadata: provider.metadata ? JSON.parse(provider.metadata) : null
      }
    } catch (error) {
      logger.error('Error en LLMProvidersService.getById:', error)
      throw error
    }
  }

  // Crear nuevo proveedor LLM
  static async create(providerData) {
    try {
      const {
        name,
        description,
        api_base_url,
        api_version,
        is_active = true,
        metadata
      } = providerData
      
      const query = `
        INSERT INTO llms_providers (
          name, description, api_base_url, api_version, is_active, metadata
        ) VALUES (?, ?, ?, ?, ?, ?)
      `
      
      const metadataJson = metadata ? JSON.stringify(metadata) : null
      
      const result = await Database.query(query, [
        name,
        description,
        api_base_url,
        api_version,
        is_active,
        metadataJson
      ])
      
      return await this.getById(result.insertId)
    } catch (error) {
      logger.error('Error en LLMProvidersService.create:', error)
      throw error
    }
  }

  // Actualizar proveedor LLM
  static async update(id, updateData) {
    try {
      const existingProvider = await this.getById(id)
      if (!existingProvider) {
        return null
      }
      
      const {
        name,
        description,
        api_base_url,
        api_version,
        is_active,
        metadata
      } = updateData
      
      const fields = []
      const values = []
      
      if (name !== undefined) {
        fields.push('name = ?')
        values.push(name)
      }
      
      if (description !== undefined) {
        fields.push('description = ?')
        values.push(description)
      }
      
      if (api_base_url !== undefined) {
        fields.push('api_base_url = ?')
        values.push(api_base_url)
      }
      
      if (api_version !== undefined) {
        fields.push('api_version = ?')
        values.push(api_version)
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
        return existingProvider
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP')
      values.push(id)
      
      const query = `
        UPDATE llms_providers 
        SET ${fields.join(', ')}
        WHERE id = ?
      `
      
      await Database.query(query, values)
      
      return await this.getById(id)
    } catch (error) {
      logger.error('Error en LLMProvidersService.update:', error)
      throw error
    }
  }

  // Eliminar proveedor LLM
  static async delete(id) {
    try {
      const existingProvider = await this.getById(id)
      if (!existingProvider) {
        return false
      }
      
      const query = 'DELETE FROM llms_providers WHERE id = ?'
      const result = await Database.query(query, [id])
      
      return result.affectedRows > 0
    } catch (error) {
      logger.error('Error en LLMProvidersService.delete:', error)
      throw error
    }
  }

  // Obtener modelos de un proveedor específico
  static async getProviderModels(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit
      let whereClause = 'WHERE provider_id = ?'
      const params = [filters.provider_id]
      
      // Filtro por estado activo
      if (filters.is_active !== undefined) {
        whereClause += ' AND is_active = ?'
        params.push(filters.is_active)
      }
      
      // Consulta para obtener el total de registros
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM llms_models 
        ${whereClause}
      `
      
      const countResult = await Database.query(countQuery, params)
      const total = countResult[0].total
      const totalPages = Math.ceil(total / limit)
      
      // Consulta para obtener los datos paginados
      const dataQuery = `
        SELECT 
          m.*,
          p.name as provider_name
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
      logger.error('Error en LLMProvidersService.getProviderModels:', error)
      throw error
    }
  }

  // Obtener todos los proveedores activos (para selects)
  static async getActive() {
    try {
      const query = `
        SELECT id, name, description
        FROM llms_providers 
        WHERE is_active = true
        ORDER BY name ASC
      `
      
      const rows = await Database.query(query)
      return rows
    } catch (error) {
      logger.error('Error en LLMProvidersService.getActive:', error)
      throw error
    }
  }
}

module.exports = LLMProvidersService