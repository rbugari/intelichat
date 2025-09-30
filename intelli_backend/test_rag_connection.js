const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function testQdrantConnection() {
  console.log('🔍 Probando conexión a Qdrant...');
  
  try {
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantApiKey = process.env.QDRANT_API_KEY;
    
    if (!qdrantUrl || !qdrantApiKey) {
      console.log('❌ Faltan credenciales de Qdrant en .env');
      console.log('   QDRANT_URL:', qdrantUrl ? '✅ Configurado' : '❌ Faltante');
      console.log('   QDRANT_API_KEY:', qdrantApiKey ? '✅ Configurado' : '❌ Faltante');
      return false;
    }

    // Probar conexión básica
    const response = await fetch(`${qdrantUrl}/collections`, {
      method: 'GET',
      headers: {
        'api-key': qdrantApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Error de conexión: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('   Respuesta:', errorText);
      return false;
    }

    const collections = await response.json();
    console.log('✅ Conexión exitosa a Qdrant');
    console.log(`   Colecciones disponibles: ${collections.result?.collections?.length || 0}`);
    
    if (collections.result?.collections?.length > 0) {
      collections.result.collections.forEach(col => {
        console.log(`   - ${col.name} (${col.vectors_count || 0} vectores)`);
      });
    }

    // Probar si existe la colección específica
    const collectionName = 'intelichat_docs';
    console.log(`\n🔍 Verificando colección '${collectionName}'...`);
    
    const collectionResponse = await fetch(`${qdrantUrl}/collections/${collectionName}`, {
      method: 'GET',
      headers: {
        'api-key': qdrantApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (collectionResponse.ok) {
      const collectionInfo = await collectionResponse.json();
      console.log(`✅ Colección '${collectionName}' encontrada`);
      console.log(`   Vectores: ${collectionInfo.result?.vectors_count || 0}`);
      console.log(`   Estado: ${collectionInfo.result?.status || 'desconocido'}`);
    } else {
      console.log(`⚠️  Colección '${collectionName}' no encontrada (esto es normal si es la primera vez)`);
      console.log('   Se puede crear automáticamente cuando se inserten vectores');
    }

    return true;

  } catch (error) {
    console.log('❌ Error al conectar con Qdrant:', error.message);
    return false;
  }
}

async function testPineconeConnection() {
  console.log('\n🔍 Probando conexión a Pinecone...');
  
  try {
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeCloud = process.env.PINECONE_CLOUD || 'aws';
    const pineconeRegion = process.env.PINECONE_REGION || 'us-east-1';
    
    if (!pineconeApiKey) {
      console.log('❌ Falta PINECONE_API_KEY en .env');
      return false;
    }

    // Probar conexión a la API de control de Pinecone
    const controlPlaneUrl = 'https://api.pinecone.io';
    
    const response = await fetch(`${controlPlaneUrl}/indexes`, {
      method: 'GET',
      headers: {
        'Api-Key': pineconeApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Error de conexión: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('   Respuesta:', errorText);
      return false;
    }

    const indexes = await response.json();
    console.log('✅ Conexión exitosa a Pinecone');
    console.log(`   Índices disponibles: ${indexes.indexes?.length || 0}`);
    
    if (indexes.indexes?.length > 0) {
      indexes.indexes.forEach(index => {
        console.log(`   - ${index.name} (${index.dimension}D, ${index.metric})`);
        console.log(`     Estado: ${index.status?.state || 'desconocido'}`);
        console.log(`     Host: ${index.host || 'no disponible'}`);
      });
    }

    // Verificar si existe el índice específico
    const indexName = 'intelichat-index';
    const targetIndex = indexes.indexes?.find(idx => idx.name === indexName);
    
    if (targetIndex) {
      console.log(`\n✅ Índice '${indexName}' encontrado`);
      console.log(`   Dimensiones: ${targetIndex.dimension}`);
      console.log(`   Métrica: ${targetIndex.metric}`);
      console.log(`   Host: ${targetIndex.host}`);
      
      // Probar consulta básica al índice
      if (targetIndex.host) {
        console.log('\n🔍 Probando consulta al índice...');
        try {
          const queryResponse = await fetch(`https://${targetIndex.host}/describe_index_stats`, {
            method: 'POST',
            headers: {
              'Api-Key': pineconeApiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          });

          if (queryResponse.ok) {
            const stats = await queryResponse.json();
            console.log('✅ Consulta exitosa al índice');
            console.log(`   Vectores totales: ${stats.totalVectorCount || 0}`);
            console.log(`   Dimensiones: ${stats.dimension || 'N/A'}`);
          } else {
            console.log('⚠️  No se pudo consultar estadísticas del índice');
          }
        } catch (queryError) {
          console.log('⚠️  Error al consultar el índice:', queryError.message);
        }
      }
    } else {
      console.log(`\n⚠️  Índice '${indexName}' no encontrado`);
      console.log('   Necesitarás crear el índice antes de usarlo');
    }

    return true;

  } catch (error) {
    console.log('❌ Error al conectar con Pinecone:', error.message);
    return false;
  }
}

async function testOpenAIConnection() {
  console.log('\n🔍 Probando conexión a OpenAI...');
  
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.log('❌ Falta OPENAI_API_KEY en .env');
      return false;
    }

    // Probar conexión básica listando modelos
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Error de conexión: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('   Respuesta:', errorText);
      return false;
    }

    const models = await response.json();
    console.log('✅ Conexión exitosa a OpenAI');
    
    // Buscar modelos de embeddings
    const embeddingModels = models.data.filter(model => 
      model.id.includes('embedding') || model.id.includes('ada')
    );
    
    console.log(`   Modelos de embedding disponibles: ${embeddingModels.length}`);
    embeddingModels.slice(0, 3).forEach(model => {
      console.log(`   - ${model.id}`);
    });

    // Probar generación de embedding simple
    console.log('\n🔍 Probando generación de embedding...');
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'Texto de prueba para RAG'
      })
    });

    if (embeddingResponse.ok) {
      const embedding = await embeddingResponse.json();
      console.log('✅ Embedding generado exitosamente');
      console.log(`   Dimensiones: ${embedding.data[0]?.embedding?.length || 0}`);
      console.log(`   Modelo usado: ${embedding.model}`);
    } else {
      console.log('⚠️  No se pudo generar embedding de prueba');
    }

    return true;

  } catch (error) {
    console.log('❌ Error al conectar con OpenAI:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 INICIANDO PRUEBAS DE CONEXIÓN RAG');
  console.log('=====================================\n');

  const results = {
    qdrant: false,
    pinecone: false,
    openai: false
  };

  // Probar todas las conexiones
  results.qdrant = await testQdrantConnection();
  results.pinecone = await testPineconeConnection();
  results.openai = await testOpenAIConnection();

  // Resumen final
  console.log('\n📊 RESUMEN DE PRUEBAS:');
  console.log('======================');
  console.log(`Qdrant:   ${results.qdrant ? '✅ OK' : '❌ FALLO'}`);
  console.log(`Pinecone: ${results.pinecone ? '✅ OK' : '❌ FALLO'}`);
  console.log(`OpenAI:   ${results.openai ? '✅ OK' : '❌ FALLO'}`);

  const successCount = Object.values(results).filter(Boolean).length;
  console.log(`\n🎯 Resultado: ${successCount}/3 servicios funcionando`);

  if (successCount === 3) {
    console.log('\n🎉 ¡Todas las conexiones RAG están funcionando correctamente!');
    console.log('💡 Próximos pasos:');
    console.log('   1. Ejecuta: node setup_rag_cartuchos.js (si no lo has hecho)');
    console.log('   2. Configura tus colecciones/índices con datos');
    console.log('   3. Implementa la lógica RAG en tu aplicación');
  } else {
    console.log('\n⚠️  Algunas conexiones fallaron. Revisa:');
    console.log('   1. Las credenciales en tu archivo .env');
    console.log('   2. Que los servicios estén activos');
    console.log('   3. Los permisos de las API keys');
  }

  return results;
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { 
  testQdrantConnection, 
  testPineconeConnection, 
  testOpenAIConnection, 
  runAllTests 
};