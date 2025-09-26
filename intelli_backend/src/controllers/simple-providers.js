const Database = require('../database');

// GET /api/simple/providers - Listar todos los proveedores
exports.getAll = async (req, res) => {
  try {
    const rows = await Database.query('SELECT * FROM llms_providers ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/simple/providers/:id - Obtener un proveedor por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await Database.query('SELECT * FROM llms_providers WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/simple/providers - Crear nuevo proveedor
exports.create = async (req, res) => {
  try {
    const { 
      name, 
      api_key, 
      base_url, 
      api_version, 
      is_active, 
      metadata, 
      rate_limit_rpm, 
      rate_limit_tpm 
    } = req.body;
    
    const result = await Database.query(`
      INSERT INTO llms_providers (
        name, api_key, base_url, api_version, is_active, 
        metadata, rate_limit_rpm, rate_limit_tpm
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name || 'Nuevo Proveedor',
      api_key || '',
      base_url || null,
      api_version || null,
      is_active !== undefined ? is_active : 1,
      metadata || null,
      rate_limit_rpm || null,
      rate_limit_tpm || null
    ]);
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// PUT /api/simple/providers/:id - Actualizar proveedor
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      api_key, 
      base_url, 
      api_version, 
      is_active, 
      metadata, 
      rate_limit_rpm, 
      rate_limit_tpm 
    } = req.body;
    
    const result = await Database.query(`
      UPDATE llms_providers SET 
        name = ?, api_key = ?, base_url = ?, api_version = ?, 
        is_active = ?, metadata = ?, rate_limit_rpm = ?, rate_limit_tpm = ?
      WHERE id = ?
    `, [
      name, api_key, base_url, api_version, is_active, 
      metadata, rate_limit_rpm, rate_limit_tpm, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }
    res.json({ success: true, message: 'Proveedor actualizado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE /api/simple/providers/:id - Eliminar proveedor
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Database.query('DELETE FROM llms_providers WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }
    res.json({ success: true, message: 'Proveedor eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};