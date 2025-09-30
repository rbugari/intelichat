const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function executeRagSchema() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('✅ Conectado a la base de datos');

    // 1. Ejecutar esquema RAG adaptado
    console.log('\n📋 Ejecutando esquema RAG adaptado...');
    const ragSqlPath = path.join(__dirname, 'docs', 'rag.sql');
    const ragSqlContent = fs.readFileSync(ragSqlPath, 'utf8');
    
    await connection.execute(ragSqlContent);
    console.log('✅ Esquema RAG ejecutado correctamente');

    // 2. Ejecutar INSERTs del agente de prueba
    console.log('\n🤖 Insertando agente de prueba RAG...');
    
    const insertChatbot = `
      INSERT IGNORE INTO cfg_chatbot (id, cliente_id, nombre, descripcion, default_lang, is_active, created_at, updated_at) 
      VALUES (100, 4, 'RAG Test Bot', 'Chatbot de prueba para funcionalidad RAG', 'es', 1, NOW(), NOW())
    `;
    
    await connection.execute(insertChatbot);
    console.log('✅ Chatbot RAG Test Bot insertado');

    const insertAgente = `
      INSERT IGNORE INTO cfg_agente (
        id, chatbot_id, nombre, descripcion, orden, llm_modelo_id, 
        system_prompt_es, system_prompt_en, 
        mensaje_bienvenida_es, mensaje_bienvenida_en,
        temperatura, top_p, max_tokens, is_active, is_default, 
        created_at, updated_at
      ) VALUES (
        200, 100, 'Asistente RAG', 'Agente de prueba con capacidades RAG', 1, 1,
        'Soy un asistente inteligente que puede consultar información especializada mediante RAG (Retrieval-Augmented Generation) cuando sea necesario para responder mejor a tus preguntas. Puedo acceder a bases de conocimiento específicas para brindarte respuestas más precisas y actualizadas sobre documentos contables, presupuestarios y normativa legal.',
        'I am an intelligent assistant that can query specialized information through RAG (Retrieval-Augmented Generation) when necessary to better answer your questions. I can access specific knowledge bases to provide you with more accurate and up-to-date responses.',
        '¡Hola! Soy tu asistente RAG especializado en documentos contables y presupuestarios. Puedo consultar información especializada para ayudarte mejor. ¿En qué puedo asistirte?',
        'Hello! I am your RAG assistant specialized in accounting and budgetary documents. I can query specialized information to help you better. How can I assist you?',
        0.70, 1.00, 2048, 1, 1, NOW(), NOW()
      )
    `;
    
    await connection.execute(insertAgente);
    console.log('✅ Agente RAG insertado');

    // 3. Verificar tablas
    console.log('\n🔍 Verificando tablas RAG creadas...');
    
    const tablesToCheck = [
      'cfg_rag_cartucho',
      'cfg_agente_rag_cartucho', 
      'ejec_rag_uso',
      'ejec_rag_chunk',
      'cfg_rag_politica'
    ];

    for (const table of tablesToCheck) {
      const [rows] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
      if (rows.length > 0) {
        console.log(`✅ Tabla ${table} creada correctamente`);
      } else {
        console.log(`❌ Error: Tabla ${table} no encontrada`);
      }
    }

    // 4. Verificar agente
    console.log('\n🔍 Verificando agente de prueba...');
    
    const [chatbotRows] = await connection.execute(
      'SELECT * FROM cfg_chatbot WHERE id = 100 AND cliente_id = 4'
    );
    
    const [agenteRows] = await connection.execute(
      'SELECT * FROM cfg_agente WHERE id = 200 AND chatbot_id = 100'
    );

    if (chatbotRows.length > 0) {
      console.log('✅ Chatbot RAG Test Bot verificado:', chatbotRows[0].nombre);
    } else {
      console.log('❌ Error: Chatbot no encontrado');
    }

    if (agenteRows.length > 0) {
      console.log('✅ Agente RAG verificado:', agenteRows[0].nombre);
    } else {
      console.log('❌ Error: Agente no encontrado');
    }

    console.log('\n🎉 ¡Ejecución completada exitosamente!');
    console.log('\n📝 El agente está listo para responder preguntas sobre:');
    console.log('   - Documentos contables del Presupuesto de Gastos');
    console.log('   - Autorización y firma electrónica de documentos');
    console.log('   - Orden de 1 de febrero de 1996');
    console.log('   - Ley 47/2003 y principios presupuestarios');
    console.log('   - Clasificación del sector público estatal');

  } catch (error) {
    console.error('❌ Error durante la ejecución:', error.message);
    if (error.sql) {
      console.error('SQL que causó el error:', error.sql);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

executeRagSchema();