const Database = require('../database');
const crypto = require('crypto');

class AuthSimpleController {
  /**
   * POST /auth-simple/start
   * Genera un código de login y lo "envía" (lo devuelve en la respuesta para el MVP).
   */
  async start(req, res) {
    const { cliente_id, email } = req.body;

    if (!cliente_id || !email) {
      return res.status(400).json({ ok: false, msg: 'cliente_id y email son requeridos.' });
    }

    try {
      // Generar código aleatorio de 6 dígitos
      const code = crypto.randomInt(100000, 999999).toString();
      
      // Calcular fecha de expiración (10 minutos)
      const expires_at = new Date(Date.now() + 10 * 60 * 1000);

      // Insertar el token en la base de datos
      await Database.query(
        'INSERT INTO adm_login_tokens (cliente_id, email, code, expires_at) VALUES (?, ?, ?, ?)',
        [cliente_id, email, code, expires_at]
      );

      // Para el MVP, devolvemos el código en la respuesta
      const verification_link = `${req.protocol}://${req.get('host')}/api/auth-simple/verify?cliente_id=${cliente_id}&email=${email}&code=${code}`;
      
      console.log(`[AuthSimple] Código generado para ${email}: ${code}`);
      
      res.status(200).json({
        ok: true, 
        code: code, // Devuelto para pruebas del MVP
        link: verification_link // Link de conveniencia para pruebas
      });

    } catch (error) {
      console.error('[AuthSimple] Error en /start:', error);
      res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
    }
  }

  /**
   * GET /auth-simple/verify
   * Verifica el código, actualiza el usuario y redirige.
   */
  async verify(req, res) {
    const { cliente_id, email, code } = req.query;

    if (!cliente_id || !email || !code) {
      return res.status(400).json({ ok: false, msg: 'Parámetros incompletos.' });
    }

    const connection = await Database.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Buscar el token
      const [tokens] = await connection.execute(
        'SELECT * FROM adm_login_tokens WHERE cliente_id = ? AND email = ? AND code = ? AND purpose = \'login\' AND used_at IS NULL AND expires_at > NOW() FOR UPDATE',
        [cliente_id, email, code]
      );

      if (tokens.length === 0) {
        await connection.rollback();
        return res.status(400).json({ ok: false, msg: 'Código inválido o expirado.' });
      }

      const token = tokens[0];

      // 2. Marcar el token como usado
      await connection.execute(
        'UPDATE adm_login_tokens SET used_at = NOW() WHERE id = ?',
        [token.id]
      );

      // 3. Crear o actualizar el usuario (UPSERT)
      const upsertQuery = `
        INSERT INTO adm_users (cliente_id, email, is_active, last_login_at)
        VALUES (?, ?, 1, NOW())
        ON DUPLICATE KEY UPDATE
          is_active = 1,
          last_login_at = NOW(),
          updated_at = NOW();
      `;
      await connection.execute(upsertQuery, [cliente_id, email]);
      
      await connection.commit();
      
      console.log(`[AuthSimple] Usuario verificado exitosamente: ${email}`);

      // 4. Devolver URL de bienvenida en la respuesta JSON
      const welcomeUrl = `/inteli_login/welcome.html?email=${encodeURIComponent(email)}&cliente_id=${cliente_id}`;
      res.status(200).json({ 
        ok: true, 
        message: 'Verificación exitosa.',
        welcomeUrl: welcomeUrl,
        expiresAt: token.expires_at
      });

    } catch (error) {
      await connection.rollback();
      console.error('[AuthSimple] Error en /verify:', error);
      res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
    } finally {
        if (connection) connection.release();
    }
  }
}

module.exports = new AuthSimpleController();
