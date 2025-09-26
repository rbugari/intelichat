const Database = require('../database');

// GET /api/simple/chats - Listar todos los chats
exports.getAll = async (req, res) => {
  try {
    const rows = await Database.query('SELECT * FROM ejec_chat ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/simple/chats/:id - Obtener un chat por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await Database.query('SELECT * FROM ejec_chat WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chat no encontrado' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/simple/chats - Crear nuevo chat
exports.create = async (req, res) => {
  try {
    const { titulo, chatbot_id, cliente_id } = req.body;
    const result = await Database.query(
      'INSERT INTO ejec_chat (titulo, chatbot_id, cliente_id) VALUES (?, ?, ?)',
      [titulo || 'Nuevo Chat', chatbot_id || 1, cliente_id || 1]
    );
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// PUT /api/simple/chats/:id - Actualizar chat
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, chatbot_id, cliente_id, is_active } = req.body;
    const result = await Database.query(
      'UPDATE ejec_chat SET titulo = ?, chatbot_id = ?, cliente_id = ?, is_active = ? WHERE id = ?',
      [titulo, chatbot_id, cliente_id, is_active, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Chat no encontrado' });
    }
    res.json({ success: true, message: 'Chat actualizado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE /api/simple/chats/:id - Eliminar chat
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Database.query('UPDATE ejec_chat SET is_active = 0 WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Chat no encontrado' });
    }
    res.json({ success: true, message: 'Chat eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};