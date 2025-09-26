const Database = require('../database');

// GET /api/simple/messages - Listar todos los mensajes
exports.getAll = async (req, res) => {
  try {
    const rows = await Database.query(`
      SELECT m.*, c.titulo as chat_title 
      FROM ejec_mensaje m 
      LEFT JOIN ejec_chat c ON m.chat_id = c.id 
      ORDER BY m.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/simple/messages/:id - Obtener un mensaje por ID
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await Database.query('SELECT * FROM ejec_mensaje WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Mensaje no encontrado' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/simple/messages/chat/:chatId - Obtener mensajes de un chat
exports.getByChatId = async (req, res) => {
  try {
    const { chatId } = req.params;
    const rows = await Database.query(
      'SELECT * FROM ejec_mensaje WHERE chat_id = ? ORDER BY created_at ASC',
      [chatId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/simple/messages - Crear nuevo mensaje
exports.create = async (req, res) => {
  try {
    const { chat_id, contenido, rol } = req.body;
    const result = await Database.query(
      'INSERT INTO ejec_mensaje (chat_id, contenido, rol) VALUES (?, ?, ?)',
      [chat_id, contenido || '', rol || 'user']
    );
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// PUT /api/simple/messages/:id - Actualizar mensaje
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { chat_id, contenido, rol } = req.body;
    const result = await Database.query(
      'UPDATE ejec_mensaje SET chat_id = ?, contenido = ?, rol = ? WHERE id = ?',
      [chat_id, contenido, rol, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Mensaje no encontrado' });
    }
    res.json({ success: true, message: 'Mensaje actualizado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// DELETE /api/simple/messages/:id - Eliminar mensaje
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Database.query('DELETE FROM ejec_mensaje WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Mensaje no encontrado' });
    }
    res.json({ success: true, message: 'Mensaje eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};