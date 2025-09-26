const Database = require('../database');

// GET /api/simple/models - Listar todos los modelos
exports.getAll = async (req, res) => {
  try {
    const rows = await Database.query(`
      SELECT m.*, p.name as provider_name 
      FROM llms_models m 
      LEFT JOIN llms_providers p ON m.provider_id = p.id 
      ORDER BY m.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/simple/models/:id - Obtener un modelo por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await Database.query('SELECT * FROM llms_models WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Modelo no encontrado' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/simple/models/provider/:providerId - Obtener modelos de un proveedor
exports.getByProviderId = async (req, res) => {
  try {
    const { providerId } = req.params;
    const rows = await Database.query(
      'SELECT * FROM llms_models WHERE provider_id = ? ORDER BY model_name ASC',
      [providerId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/simple/models - Crear nuevo modelo
exports.create = async (req, res) => {
  try {
    const { 
      provider_id, 
      model_name, 
      model_key, 
      max_tokens, 
      supports_streaming, 
      supports_functions, 
      cost_per_input_token, 
      cost_per_output_token, 
      is_active, 
      metadata 
    } = req.body;
    
    const result = await Database.query(`
      INSERT INTO llms_models (
        provider_id, model_name, model_key, max_tokens, supports_streaming, 
        supports_functions, cost_per_input_token, cost_per_output_token, 
        is_active, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      provider_id || 1,
      model_name || 'Nuevo Modelo',
      model_key || '',
      max_tokens || null,
      supports_streaming !== undefined ? supports_streaming : 1,
      supports_functions !== undefined ? supports_functions : 0,
      cost_per_input_token || null,
      cost_per_output_token || null,
      is_active !== undefined ? is_active : 1,
      metadata || null
    ]);
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// PUT /api/simple/models/:id - Actualizar modelo
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      provider_id, 
      model_name, 
      model_key, 
      max_tokens, 
      supports_streaming, 
      supports_functions, 
      cost_per_input_token, 
      cost_per_output_token, 
      is_active, 
      metadata 
    } = req.body;
    
    const result = await Database.query(`
      UPDATE llms_models SET 
        provider_id = ?, model_name = ?, model_key = ?, max_tokens = ?, 
        supports_streaming = ?, supports_functions = ?, cost_per_input_token = ?, 
        cost_per_output_token = ?, is_active = ?, metadata = ?
      WHERE id = ?
    `, [
      provider_id, model_name, model_key, max_tokens, supports_streaming, 
      supports_functions, cost_per_input_token, cost_per_output_token, 
      is_active, metadata, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Modelo no encontrado' });
    }
    res.json({ success: true, message: 'Modelo actualizado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE /api/simple/models/:id - Eliminar modelo
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Database.query('DELETE FROM llms_models WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Modelo no encontrado' });
    }
    res.json({ success: true, message: 'Modelo eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};