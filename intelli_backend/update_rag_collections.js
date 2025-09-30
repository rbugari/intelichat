const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Database = require('./src/database');

async function updateRagCollections() {
    console.log('🔧 Actualizando configuración de cartuchos RAG...\n');
    
    try {
        // Conectar a la base de datos
        console.log('📡 Conectando a la base de datos...');
        await Database.initialize();
        
        // 1. Verificar cartuchos existentes
        console.log('\n📋 Verificando cartuchos existentes...');
        const cartuchos = await Database.query(`
            SELECT id, nombre, proveedor, endpoint, indice_nombre, capacidades 
            FROM cfg_rag_cartucho 
            WHERE cliente_id = 4
            ORDER BY id
        `);
        
        if (cartuchos.length === 0) {
            console.log('❌ No se encontraron cartuchos RAG. Ejecuta setup_rag_cartuchos.js primero.');
            return;
        }
        
        console.log(`✅ Encontrados ${cartuchos.length} cartuchos:`);
        cartuchos.forEach(c => {
            console.log(`   - ID ${c.id}: ${c.nombre} (${c.proveedor})`);
        });
        
        // 2. Actualizar configuraciones
        console.log('\n🔧 Actualizando configuraciones de cartuchos...');
        
        // Buscar cartuchos por proveedor
        const qdrantCartucho = cartuchos.find(c => c.proveedor === 'qdrant');
        const pineconeCartucho = cartuchos.find(c => c.proveedor === 'pinecone');
        
        if (qdrantCartucho) {
            // Actualizar Qdrant para usar "docs-qdrant"
            await Database.query(`
                UPDATE cfg_rag_cartucho 
                SET indice_nombre = 'docs-qdrant'
                WHERE id = ?
            `, [qdrantCartucho.id]);
            console.log(`✅ Qdrant cartucho (ID: ${qdrantCartucho.id}) actualizado para usar "docs-qdrant"`);
        }

        if (pineconeCartucho) {
            // Actualizar Pinecone para usar "docs-pinecone"
            await Database.query(`
                UPDATE cfg_rag_cartucho 
                SET indice_nombre = 'docs-pinecone'
                WHERE id = ?
            `, [pineconeCartucho.id]);
            console.log(`✅ Pinecone cartucho (ID: ${pineconeCartucho.id}) actualizado para usar "docs-pinecone"`);
        }
        
        // 3. Verificar asociaciones con el agente RAG (ID: 200)
        console.log('\n🔗 Verificando asociaciones con agente RAG...');
        const asociaciones = await Database.query(`
            SELECT arc.agente_id, arc.cartucho_id, arc.es_default, arc.permite_hybrid,
                   c.nombre as cartucho_nombre, c.proveedor
            FROM cfg_agente_rag_cartucho arc
            JOIN cfg_rag_cartucho c ON arc.cartucho_id = c.id
            WHERE arc.agente_id = 200 AND c.cliente_id = 4
            ORDER BY arc.cartucho_id
        `);

        console.log('\n📊 Asociaciones encontradas:');
        asociaciones.forEach(asoc => {
            console.log(`   - Agente ${asoc.agente_id} → Cartucho ${asoc.cartucho_id} (${asoc.cartucho_nombre})`);
            console.log(`     Proveedor: ${asoc.proveedor}, Default: ${asoc.es_default ? 'Sí' : 'No'}, Hybrid: ${asoc.permite_hybrid ? 'Sí' : 'No'}`);
        });

        // 4. Mostrar configuración final
        console.log('\n📋 Configuración final de cartuchos:');
        const cartuchosFinal = await Database.query(`
            SELECT id, nombre, proveedor, endpoint, indice_nombre, capacidades, habilitado
            FROM cfg_rag_cartucho 
            WHERE cliente_id = 4
            ORDER BY id
        `);

        cartuchosFinal.forEach(cartucho => {
            console.log(`\n🔧 Cartucho ID: ${cartucho.id}`);
            console.log(`   Nombre: ${cartucho.nombre}`);
            console.log(`   Proveedor: ${cartucho.proveedor}`);
            console.log(`   Endpoint: ${cartucho.endpoint}`);
            console.log(`   Índice/Colección: ${cartucho.indice_nombre}`);
            console.log(`   Capacidades: ${cartucho.capacidades}`);
            console.log(`   Habilitado: ${cartucho.habilitado ? 'Sí' : 'No'}`);
        });
        
        // 6. Verificar agente RAG
        console.log('\n🤖 AGENTE RAG:');
        const agenteRag = await Database.query(`
            SELECT id, nombre, is_active, chatbot_id
            FROM cfg_agente 
            WHERE id = 200
        `);
        
        if (agenteRag.length > 0) {
            const agente = agenteRag[0];
            console.log(`✅ Agente RAG encontrado: "${agente.nombre}" (ID: ${agente.id})`);
            console.log(`   Estado: ${agente.is_active ? '✅ ACTIVO' : '❌ INACTIVO'}`);
            console.log(`   Chatbot ID: ${agente.chatbot_id}`);
        } else {
            console.log('❌ Agente RAG (ID: 200) no encontrado');
        }
        
        console.log('\n🎉 ¡Configuración de cartuchos RAG completada exitosamente!');
        console.log('\n📝 PRÓXIMOS PASOS:');
        console.log('1. Probar consultas RAG con el script test_chat_batch.js');
        console.log('2. Verificar que las respuestas usen los documentos de las colecciones');
        console.log('3. Ajustar el prompt del agente RAG si es necesario');
        
    } catch (error) {
        console.error('❌ Error actualizando configuración RAG:', error);
        console.error('Detalles:', error.message);
    } finally {
        await Database.close();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    updateRagCollections();
}

module.exports = { updateRagCollections };