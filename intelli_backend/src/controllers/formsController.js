class FormsController {
    constructor(database) {
        this.db = database;
    }

    async getFormByCodigo(req, res) {
        const { codigo } = req.params;
        const { cliente_id } = req.query; // Tomar desde query params

        if (!codigo || !cliente_id) {
            return res.status(400).json({ error: 'Parámetros incompletos: se requiere código de formulario y cliente_id.' });
        }

        try {
            const query = `
                SELECT 
                    f.id, f.codigo, f.titulo, f.descripcion, f.schema_json, f.ui_schema_json, f.css_text
                FROM 
                    cfg_form f
                WHERE 
                    f.codigo = ? AND f.cliente_id = ? AND f.estado = 'active'
            `;
            const formRows = await this.db.query(query, [codigo, cliente_id]);

            if (formRows.length === 0) {
                return res.status(404).json({ error: 'Formulario no encontrado, inactivo o no autorizado.' });
            }

            const form = formRows[0];
            form.schema_json = JSON.parse(form.schema_json);
            if (form.ui_schema_json) {
                form.ui_schema_json = JSON.parse(form.ui_schema_json);
            }

            res.json(form);
        } catch (error) {
            console.error('Error al obtener el formulario:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener el formulario.' });
        }
    }

    async submitForm(req, res) {
        const { form_codigo, data, sessionId, cliente_id } = req.body;

        if (!form_codigo || !data || !sessionId || !cliente_id) {
            return res.status(400).json({ error: 'Parámetros incompletos.' });
        }

        try {
            const formQuery = 'SELECT id, version_actual_id FROM cfg_form WHERE codigo = ? AND cliente_id = ?';
            const formRows = await this.db.query(formQuery, [form_codigo, cliente_id]);

            if (formRows.length === 0) {
                return res.status(404).json({ error: 'Formulario no encontrado.' });
            }

            const form = formRows[0];

            const insertQuery = `
                INSERT INTO ejec_form (cliente_id, form_id, form_version_id, chat_id, data_json, estado, submitted_at)
                VALUES (?, ?, ?, ?, ?, 'submitted', NOW())
            `;
            const insertParams = [cliente_id, form.id, form.version_actual_id, sessionId, JSON.stringify(data)];

            await this.db.query(insertQuery, insertParams);

            // Actualizar el extra_json en ejec_chat con los datos del formulario
            const chatQuery = 'SELECT extra_json FROM ejec_chat WHERE id = ?';
            const chatRows = await this.db.query(chatQuery, [sessionId]);
            let chatExtraJson = {};
            if (chatRows.length > 0 && chatRows[0].extra_json) {
                chatExtraJson = JSON.parse(chatRows[0].extra_json);
            }
            const updatedExtraJson = { ...chatExtraJson, ...data };
            await this.db.query('UPDATE ejec_chat SET extra_json = ? WHERE id = ?', [JSON.stringify(updatedExtraJson), sessionId]);

            res.status(201).json({ message: 'Formulario enviado correctamente.' });
        } catch (error) {
            console.error('Error al guardar el formulario:', error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
}

module.exports = FormsController;