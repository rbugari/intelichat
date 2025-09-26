const database = require('../database');
const { AppError, NotFoundError, ValidationError, DatabaseError } = require('../middleware/errorHandler');

/**
 * Chat Controller
 * Handles CRUD operations for chats and messages
 */
class ChatsController {
  /**
   * Get all chats with pagination and filtering
   */
  async getChats(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = 'created_at',
        order = 'desc',
        q,
        cliente_id,
        chatbot_id,
        is_active
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      // Filter by cliente_id if provided
      if (cliente_id) {
        whereClause += ' AND c.cliente_id = ?';
        params.push(cliente_id);
      }
      
      if (q) {
        whereClause += ' AND c.titulo LIKE ?';
        params.push(`%${q}%`);
      }
      
      if (chatbot_id) {
        whereClause += ' AND c.chatbot_id = ?';
        params.push(chatbot_id);
      }
      
      if (is_active !== undefined) {
        whereClause += ' AND c.is_active = ?';
        params.push(is_active === 'true');
      }
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM ejec_chat c 
        ${whereClause}
      `;
      
      const countResult = await database.query(countQuery, params);
      const total = countResult.total;
      
      // Get chats with chatbot info
      const query = `
        SELECT 
          c.id,
          c.titulo as title,
          c.chatbot_id,
          cb.nombre as chatbot_name,
          c.cliente_id,
          c.is_active,
          c.created_at,
          c.updated_at,
          COUNT(m.id) as message_count,
          MAX(m.created_at) as last_message_at
        FROM ejec_chat c
        LEFT JOIN cfg_chatbot cb ON c.chatbot_id = cb.id
        LEFT JOIN ejec_mensaje m ON c.id = m.chat_id
        ${whereClause}
        GROUP BY c.id
        ORDER BY ${sort} ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const chats = await database.query(query, params);
      
      res.json({
        success: true,
        data: {
          chats,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch chats', error);
    }
  }
  
  /**
   * Get single chat by ID with messages
   */
  async getChatById(req, res) {
    try {
      const { id } = req.params;
      
      // Get chat with chatbot info
      const chatQuery = `
        SELECT 
          c.*,
          c.titulo as title,
          cb.nombre as chatbot_name,
          cb.descripcion as chatbot_description,
          cl.nombre as cliente_name
        FROM ejec_chat c
        LEFT JOIN cfg_chatbot cb ON c.chatbot_id = cb.id
        LEFT JOIN cfg_cliente cl ON c.cliente_id = cl.id
        WHERE c.id = ?
      `;
      
      const chat = await database.query(chatQuery, [id]);
      
      if (!chat) {
        throw new NotFoundError('Chat');
      }
      
      // Get messages for this chat
      const messagesQuery = `
        SELECT 
          id,
          contenido as content,
          rol as role,
          created_at
        FROM ejec_mensaje 
        WHERE chat_id = ? 
        ORDER BY created_at ASC
      `;
      
      const messages = await database.query(messagesQuery, [id]);
      
      res.json({
        success: true,
        data: {
          ...chat,
          messages
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch chat', error);
    }
  }

  /**
   * Get chat messages with pagination
   */
  async getChatMessages(req, res) {
    try {
      const { id } = req.params;
      const {
        page = 1,
        limit = 50,
        order = 'asc'
      } = req.query;
      
      const offset = (page - 1) * limit;
      
      // Check if chat exists
      const chat = await database.query(
        'SELECT id FROM ejec_chat WHERE id = ?',
        [id]
      );
      
      if (!chat) {
        throw new NotFoundError('Chat');
      }
      
      // Get total message count
      const countResult = await database.query(
        'SELECT COUNT(*) as total FROM ejec_mensaje WHERE chat_id = ?',
        [id]
      );
      const total = countResult.total;
      
      // Get messages
      const messagesQuery = `
        SELECT 
          id,
          contenido as content,
          rol as role,
          created_at
        FROM ejec_mensaje 
        WHERE chat_id = ? 
        ORDER BY created_at ${order.toUpperCase()}
        LIMIT ? OFFSET ?
      `;
      
      const messages = await database.query(messagesQuery, [id, parseInt(limit), offset]);
      
      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to fetch chat messages', error);
    }
  }
  
  /**
   * Create new chat
   */
  async createChat(req, res) {
    try {
      const { title, chatbot_id, cliente_id } = req.body;
      
      // Use default cliente_id if not provided (assuming there's a default client)
      const finalClienteId = cliente_id || 1;
      
      // Verify chatbot exists
      const chatbot = await database.query(
        'SELECT id FROM cfg_chatbot WHERE id = ? AND is_active = TRUE',
        [chatbot_id]
      );
      
      if (!chatbot) {
        throw new ValidationError('Invalid chatbot_id: Chatbot not found or inactive');
      }
      
      const query = `
        INSERT INTO ejec_chat (titulo, chatbot_id, cliente_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, TRUE, NOW(), NOW())
      `;
      
      const result = await database.query(query, [
        title || 'Nuevo Chat',
        chatbot_id,
        finalClienteId
      ]);
      
      // Get the created chat with chatbot info
      const newChat = await database.query(`
        SELECT 
          c.id,
          c.titulo as title,
          c.chatbot_id,
          cb.nombre as chatbot_name,
          c.cliente_id,
          c.is_active,
          c.created_at,
          c.updated_at
        FROM ejec_chat c
        LEFT JOIN cfg_chatbot cb ON c.chatbot_id = cb.id
        WHERE c.id = ?
      `, [result.insertId]);
      
      res.status(201).json({
        success: true,
        data: newChat
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to create chat', error);
    }
  }
  
  /**
   * Update chat
   */
  async updateChat(req, res) {
    try {
      const { id } = req.params;
      const { title, agent_id, is_active, metadata } = req.body;
      
      // Check if chat exists
      const existingChat = await database.query(
        'SELECT id FROM ejec_chat WHERE id = ?',
        [id]
      );
      
      if (!existingChat) {
        throw new NotFoundError('Chat');
      }
      
      // If agent_id is being updated, verify it exists
      if (agent_id) {
        const agent = await database.query(
          'SELECT id FROM agents WHERE id = ? AND is_active = TRUE',
          [agent_id]
        );
        
        if (!agent) {
          throw new ValidationError('Invalid agent_id: Agent not found or inactive');
        }
      }
      
      // Build update query dynamically
      const updates = [];
      const params = [];
      
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      
      if (agent_id !== undefined) {
        updates.push('agent_id = ?');
        params.push(agent_id);
      }
      
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
      }
      
      if (metadata !== undefined) {
        updates.push('metadata = ?');
        params.push(metadata ? JSON.stringify(metadata) : null);
      }
      
      if (updates.length === 0) {
        throw new ValidationError('No valid fields to update');
      }
      
      updates.push('updated_at = NOW()');
      params.push(id);
      
      const query = `UPDATE ejec_chat SET ${updates.join(', ')} WHERE id = ?`;
      await database.query(query, params);

      // Get updated chat
      const updatedChat = await database.query(
        'SELECT * FROM ejec_chat WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        data: updatedChat
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update chat', error);
    }
  }
  
  /**
   * Delete chat (soft delete)
   */
  async deleteChat(req, res) {
    try {
      const { id } = req.params;
      
      // Check if chat exists
      const existingChat = await database.query(
        'SELECT id FROM ejec_chat WHERE id = ?',
        [id]
      );

      if (!existingChat) {
        throw new NotFoundError('Chat');
      }

      // Soft delete (set is_active to false)
      await database.query(
        'UPDATE ejec_chat SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
        [id]
      );
      
      res.json({
        success: true,
        message: 'Chat deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to delete chat', error);
    }
  }
  
  /**
   * Add message to chat
   */
  async addMessage(req, res) {
    try {
      const { id } = req.params;
      const { contenido, rol = 'user' } = req.body;
      
      // Check if chat exists and is active
      const chat = await database.query(
        'SELECT id, chatbot_id FROM ejec_chat WHERE id = ? AND is_active = TRUE',
        [id]
      );
      
      if (!chat) {
        throw new NotFoundError('Chat not found or inactive');
      }
      
      // Insert user message
      const userMessageQuery = `
        INSERT INTO ejec_mensaje (chat_id, contenido, rol, created_at)
        VALUES (?, ?, ?, NOW())
      `;
      
      const userResult = await database.query(userMessageQuery, [
        id,
        contenido,
        rol
      ]);
      
      // Get the created user message
      const userMessage = await database.query(
        'SELECT id, contenido as content, rol as role, created_at FROM ejec_mensaje WHERE id = ?',
        [userResult.insertId]
      );
      
      // Generate bot response if user message
      let botMessage = null;
      if (rol === 'user') {
        // Simple bot response logic - can be enhanced later
        const botResponse = await this.generateBotResponse(contenido, chat.chatbot_id);
        
        const botMessageQuery = `
          INSERT INTO ejec_mensaje (chat_id, contenido, rol, created_at)
          VALUES (?, ?, 'assistant', NOW())
        `;
        
        const botResult = await database.query(botMessageQuery, [
          id,
          botResponse
        ]);
        
        // Get the created bot message
        const botMsg = await database.query(
          'SELECT id, contenido as content, rol as role, created_at FROM ejec_mensaje WHERE id = ?',
          [botResult.insertId]
        );
        
        botMessage = botMsg;
      }
      
      res.status(201).json({
        success: true,
        data: {
          userMessage,
          botMessage
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to add message', error);
    }
  }
  
  /**
   * Generate bot response (simple implementation)
   */
  async generateBotResponse(userMessage, chatbotId) {
    try {
      // Get chatbot info
      const chatbot = await database.query(
        'SELECT nombre, descripcion FROM cfg_chatbot WHERE id = ?',
        [chatbotId]
      );
      
      if (!chatbot) {
        return 'Lo siento, no puedo procesar tu mensaje en este momento.';
      }
      
      // Simple response logic - can be enhanced with AI integration
      const responses = [
        `Hola, soy ${chatbot.nombre}. He recibido tu mensaje: "${userMessage}". ¿En qué más puedo ayudarte?`,
        `Gracias por tu mensaje. Como ${chatbot.nombre}, estoy aquí para asistirte. ¿Tienes alguna pregunta específica?`,
        `Entiendo tu consulta sobre "${userMessage}". Permíteme ayudarte con eso.`,
        `Hola, soy ${chatbot.nombre}. Tu mensaje es muy interesante. ¿Podrías darme más detalles?`
      ];
      
      // Return a random response for now
      return responses[Math.floor(Math.random() * responses.length)];
    } catch (error) {
      console.error('Error generating bot response:', error);
      return 'Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.';
    }
  }
  
  /**
   * Get chat statistics
   */
  async getChatStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_chats,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_chats,
          COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_chats,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as week_chats
        FROM ejec_chat
      `;
      
      const stats = await database.query(statsQuery);
      
      // Get message stats
      const messageStatsQuery = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_messages,
          AVG(message_count) as avg_messages_per_chat
        FROM (
          SELECT chat_id, COUNT(*) as message_count
          FROM ejec_mensaje
          GROUP BY chat_id
        ) as chat_messages
      `;
      
      const messageStats = await database.query(messageStatsQuery);
      
      res.json({
        success: true,
        data: {
          ...stats,
          ...messageStats
        }
      });
    } catch (error) {
      throw new DatabaseError('Failed to fetch chat statistics', error);
    }
  }
}

module.exports = ChatsController;