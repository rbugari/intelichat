const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function setupRagCartuchos() {
  let connection;
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    
    // Configuración de conexión desde .env
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Conexión exitosa a la base de datos');

    // Verificar que las tablas RAG existan
    console.log('\n📋 Verificando tablas RAG...');
    const [ragTables] = await connection.execute(`
      SHOW TABLES LIKE 'cfg_rag_%'
    `);
    
    if (ragTables.length === 0) {
      console.log('❌ Las tablas RAG no existen. Ejecuta primero el archivo rag.sql');
      return;
    }
    
    console.log(`✅ Encontradas ${ragTables.length} tablas RAG`);

    // 1. Insertar/actualizar cartucho Qdrant
    console.log('\n🔧 Configurando cartucho Qdrant...');
    
    const qdrantEndpoint = process.env.QDRANT_URL || 'https://975f390e-ebf6-4dd9-b1c5-2754aa237f40.europe-west3-0.gcp.cloud.qdrant.io:6333';
    
    await connection.execute(`
      INSERT INTO cfg_rag_cartucho (
        id, cliente_id, nombre, dominio_tag, proveedor, endpoint, indice_nombre,
        capacidades, topk_default, timeout_ms, habilitado, notas, creado_en
      ) VALUES (
        10, 4, 'Qdrant Production', 'general', 'qdrant', ?, 'intelichat_docs',
        '{"hybrid": true, "rerank": false, "filters": ["category", "date", "source"]}',
        5, 5000, 1, 'Cartucho Qdrant con credenciales reales', current_timestamp()
      ) ON DUPLICATE KEY UPDATE
        endpoint = VALUES(endpoint),
        capacidades = VALUES(capacidades),
        habilitado = VALUES(habilitado),
        notas = VALUES(notas)
    `, [qdrantEndpoint]);

    console.log('✅ Cartucho Qdrant configurado (ID: 10)');

    // 2. Insertar/actualizar cartucho Pinecone
    console.log('\n🔧 Configurando cartucho Pinecone...');
    
    const pineconeEndpoint = `https://${process.env.PINECONE_REGION || 'us-east-1'}.${process.env.PINECONE_CLOUD || 'aws'}.pinecone.io`;
    
    await connection.execute(`
      INSERT INTO cfg_rag_cartucho (
        id, cliente_id, nombre, dominio_tag, proveedor, endpoint, indice_nombre,
        capacidades, topk_default, timeout_ms, habilitado, notas, creado_en
      ) VALUES (
        11, 4, 'Pinecone Serverless', 'technical', 'pinecone', ?, 'intelichat-index',
        '{"hybrid": false, "rerank": true, "filters": ["namespace", "metadata"]}',
        10, 3000, 1, 'Cartucho Pinecone serverless con credenciales reales', current_timestamp()
      ) ON DUPLICATE KEY UPDATE
        endpoint = VALUES(endpoint),
        capacidades = VALUES(capacidades),
        habilitado = VALUES(habilitado),
        notas = VALUES(notas)
    `, [pineconeEndpoint]);

    console.log('✅ Cartucho Pinecone configurado (ID: 11)');

    // 3. Verificar que el agente ID 200 exista
    console.log('\n👤 Verificando agente RAG (ID: 200)...');
    
    const [agentRows] = await connection.execute(`
      SELECT id, nombre FROM cfg_agente WHERE id = 200
    `);

    if (agentRows.length === 0) {
      console.log('❌ El agente ID 200 no existe. Ejecuta primero el archivo rag.sql');
      return;
    }

    console.log(`✅ Agente encontrado: ${agentRows[0].nombre}`);

    // 4. Asociar agente con cartuchos RAG
    console.log('\n🔗 Asociando agente con cartuchos...');

    // Asociar con Qdrant
    await connection.execute(`
      INSERT INTO cfg_agente_rag_cartucho (
        agente_id, cartucho_id, cliente_id, es_default, permite_hybrid,
        permite_rerank, max_q_por_turno, max_q_por_conv, prioridad_orden, creado_en
      ) VALUES (
        200, 10, 4, 1, 1, 0, 3, 15, 100, current_timestamp()
      ) ON DUPLICATE KEY UPDATE
        es_default = VALUES(es_default),
        permite_hybrid = VALUES(permite_hybrid),
        max_q_por_turno = VALUES(max_q_por_turno),
        max_q_por_conv = VALUES(max_q_por_conv)
    `);

    // Asociar con Pinecone
    await connection.execute(`
      INSERT INTO cfg_agente_rag_cartucho (
        agente_id, cartucho_id, cliente_id, es_default, permite_hybrid,
        permite_rerank, max_q_por_turno, max_q_por_conv, prioridad_orden, creado_en
      ) VALUES (
        200, 11, 4, 0, 0, 1, 2, 10, 200, current_timestamp()
      ) ON DUPLICATE KEY UPDATE
        permite_rerank = VALUES(permite_rerank),
        max_q_por_turno = VALUES(max_q_por_turno),
        max_q_por_conv = VALUES(max_q_por_conv)
    `);

    console.log('✅ Agente asociado con ambos cartuchos');

    // 5. Mostrar resumen de configuración
    console.log('\n📊 RESUMEN DE CONFIGURACIÓN:');
    
    const [cartuchos] = await connection.execute(`
      SELECT c.id, c.nombre, c.proveedor, c.endpoint, c.habilitado,
             COUNT(arc.agente_id) as agentes_asociados
      FROM cfg_rag_cartucho c
      LEFT JOIN cfg_agente_rag_cartucho arc ON c.id = arc.cartucho_id
      WHERE c.cliente_id = 4
      GROUP BY c.id, c.nombre, c.proveedor, c.endpoint, c.habilitado
      ORDER BY c.id
    `);

    cartuchos.forEach(cartucho => {
      console.log(`  📦 ${cartucho.nombre} (${cartucho.proveedor})`);
      console.log(`     - ID: ${cartucho.id}`);
      console.log(`     - Endpoint: ${cartucho.endpoint}`);
      console.log(`     - Estado: ${cartucho.habilitado ? '🟢 Habilitado' : '🔴 Deshabilitado'}`);
      console.log(`     - Agentes: ${cartucho.agentes_asociados}`);
      console.log('');
    });

    console.log('🎉 Configuración de cartuchos RAG completada exitosamente!');
    console.log('\n💡 Próximos pasos:');
    console.log('   1. Ejecuta: node test_rag_connection.js');
    console.log('   2. Verifica que las conexiones funcionen correctamente');

  } catch (error) {
    console.error('❌ Error durante la configuración:', error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('\n💡 Solución: Ejecuta primero el archivo rag.sql para crear las tablas');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupRagCartuchos();
}

module.exports = { setupRagCartuchos };