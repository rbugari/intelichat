const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });

async function executeRagSchema() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Conectado a la base de datos');

    // 1. Ejecutar esquema RAG adaptado
    console.log('📋 Ejecutando esquema RAG adaptado...');
    const ragSqlPath = path.join(__dirname, '..', 'docs', 'rag.sql');
    const ragSqlContent = fs.readFileSync(ragSqlPath, 'utf8');
    
    // Limpiar comentarios y dividir en declaraciones
    const cleanedSql = ragSqlContent
      .replace(/--.*$/gm, '')  // Remover comentarios de línea
      .replace(/\/\*[\s\S]*?\*\//g, '')  // Remover comentarios de bloque
      .replace(/\n\s*\n/g, '\n')  // Remover líneas vacías múltiples
      .trim();
    
    const sqlStatements = cleanedSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && stmt.toUpperCase().includes('CREATE TABLE'));
    
    console.log(`📊 Ejecutando ${sqlStatements.length} declaraciones CREATE TABLE...`);
    
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i] + ';';  // Agregar punto y coma
      const tableName = statement.match(/CREATE TABLE.*?(\w+)\s*\(/i)?.[1];
      console.log(`🔨 Creando tabla: ${tableName || 'desconocida'}`);
      
      try {
        await connection.execute(statement);
        console.log(`✅ Tabla ${tableName} creada exitosamente`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️ Tabla ${tableName} ya existe`);
        } else {
          console.error(`❌ Error creando tabla ${tableName}:`, error.message);
        }
      }
    }
    
    console.log('✅ Esquema RAG ejecutado correctamente');

    // 2. Ejecutar INSERTs del agente de prueba
    console.log('🤖 Insertando agente de prueba RAG...');
    
    const insertChatbot = `INSERT IGNORE INTO cfg_chatbot (id, cliente_id, nombre, descripcion, default_lang, is_active, created_at, updated_at) VALUES (100, 4, 'RAG Test Bot', 'Chatbot de prueba para funcionalidad RAG', 'es', 1, NOW(), NOW())`;
    
    await connection.execute(insertChatbot);
    console.log('✅ Chatbot RAG Test Bot insertado');

    const insertAgente = `INSERT IGNORE INTO cfg_agente (id, chatbot_id, nombre, descripcion, orden, llm_modelo_id, system_prompt_es, temperatura, top_p, max_tokens, is_active, is_default, created_at, updated_at) VALUES (200, 100, 'Asistente RAG', 'Agente de prueba con capacidades RAG', 1, 1, 'Soy un asistente inteligente que puede consultar información especializada mediante RAG cuando sea necesario para responder mejor a tus preguntas.', 0.70, 1.00, 2048, 1, 1, NOW(), NOW())`;
    
    await connection.execute(insertAgente);
    console.log('✅ Agente RAG insertado');

    // 3. Verificar que las tablas se crearon correctamente
    console.log('🔍 Verificando tablas RAG...');
    const [ragTables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND (TABLE_NAME LIKE 'cfg_rag%' OR TABLE_NAME LIKE 'ejec_rag%')
    `, [process.env.DB_NAME]);
    
    console.log('📊 Tablas RAG encontradas:', ragTables.map(t => t.TABLE_NAME));

    // 4. Verificar que el agente se insertó correctamente
    console.log('🔍 Verificando agente de prueba...');
    const [agentResult] = await connection.execute(`
      SELECT c.id as chatbot_id, c.nombre as chatbot_nombre, a.id as agente_id, a.nombre as agente_nombre
      FROM cfg_chatbot c 
      JOIN cfg_agente a ON c.id = a.chatbot_id 
      WHERE c.id = 100 AND a.id = 200
    `);
    
    if (agentResult.length > 0) {
      console.log('✅ Agente verificado:', agentResult[0]);
    } else {
      console.log('⚠️ No se encontró el agente de prueba');
    }

    console.log('🎉 ¡Ejecución completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la ejecución:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexión cerrada');
    }
  }
}

executeRagSchema();