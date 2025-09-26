const Database = require('../database');

// GET /api/simple/agents - Listar todos los agentes
exports.getAll = async (req, res) => {
  try {
    const rows = await Database.query(`
      SELECT a.*, 
             p.name as provider_name, 
             m.model_name as model_name
      FROM agents a 
      LEFT JOIN llms_providers p ON a.llm_provider_id = p.id
      LEFT JOIN llms_models m ON a.llm_model_id = m.id
      ORDER BY a.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/simple/agents/:id - Obtener un agente por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await Database.query('SELECT * FROM agents WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agente no encontrado' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/simple/agents - Crear nuevo agente
exports.create = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      system_prompt, 
      temperature, 
      max_tokens, 
      tools, 
      is_active, 
      metadata, 
      llm_provider_id, 
      llm_model_id 
    } = req.body;
    
    const result = await Database.query(`
      INSERT INTO agents (
        name, description, system_prompt, temperature, max_tokens, 
        tools, is_active, metadata, llm_provider_id, llm_model_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name || 'Nuevo Agente',
      description || null,
      system_prompt || 'Eres un asistente útil',
      temperature || 0.7,
      max_tokens || null,
      tools || null,
      is_active !== undefined ? is_active : 1,
      metadata || null,
      llm_provider_id || 1,
      llm_model_id || 1
    ]);
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// PUT /api/simple/agents/:id - Actualizar agente
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      system_prompt, 
      temperature, 
      max_tokens, 
      tools, 
      is_active, 
      metadata, 
      llm_provider_id, 
      llm_model_id 
    } = req.body;
    
    const result = await Database.query(`
      UPDATE agents SET 
        name = ?, description = ?, system_prompt = ?, temperature = ?, 
        max_tokens = ?, tools = ?, is_active = ?, metadata = ?, 
        llm_provider_id = ?, llm_model_id = ?
      WHERE id = ?
    `, [
      name, description, system_prompt, temperature, max_tokens, 
      tools, is_active, metadata, llm_provider_id, llm_model_id, id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Agente no encontrado' });
    }
    res.json({ success: true, message: 'Agente actualizado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE /api/simple/agents/:id - Eliminar agente
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Database.query('DELETE FROM agents WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Agente no encontrado' });
    }
    res.json({ success: true, message: 'Agente eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};