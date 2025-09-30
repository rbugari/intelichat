const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function verifyPineconeContent() {
    console.log('🔍 Verificando contenido de Pinecone...\n');
    
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    
    if (!pineconeApiKey) {
        console.error('❌ PINECONE_API_KEY no encontrada en .env');
        return;
    }
    
    console.log('✅ API Key configurada');
    
    try {
        // 1. Obtener lista de índices
        console.log('\n📋 Obteniendo lista de índices...');
        const indexResponse = await fetch('https://api.pinecone.io/indexes', {
            method: 'GET',
            headers: {
                'Api-Key': pineconeApiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!indexResponse.ok) {
            throw new Error(`Error obteniendo índices: ${indexResponse.status}`);
        }

        const indexes = await indexResponse.json();
        console.log('📊 Índices disponibles:', indexes.indexes?.map(idx => idx.name) || []);
        
        // 2. Buscar el índice docs-pinecone
        const targetIndex = indexes.indexes?.find(idx => idx.name === 'docs-pinecone');
        
        if (!targetIndex) {
            console.error('❌ Índice "docs-pinecone" no encontrado');
            return;
        }
        
        console.log('✅ Índice "docs-pinecone" encontrado');
        console.log('🔗 Host:', targetIndex.host);
        console.log('📏 Dimensiones:', targetIndex.dimension);
        console.log('📊 Métrica:', targetIndex.metric);
        
        // 3. Obtener estadísticas del índice
        console.log('\n📈 Obteniendo estadísticas del índice...');
        const statsResponse = await fetch(`https://${targetIndex.host}/describe_index_stats`, {
            method: 'POST',
            headers: {
                'Api-Key': pineconeApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (!statsResponse.ok) {
            throw new Error(`Error obteniendo estadísticas: ${statsResponse.status}`);
        }

        const stats = await statsResponse.json();
        console.log('📊 Total de vectores:', stats.totalVectorCount || 0);
        console.log('📊 Namespaces:', Object.keys(stats.namespaces || {}));
        
        if (stats.totalVectorCount === 0) {
            console.warn('⚠️ El índice está vacío');
            
            // Verificar si hay otros índices con contenido
            console.log('\n🔍 Verificando otros índices...');
            for (const index of indexes.indexes || []) {
                if (index.name !== 'docs-pinecone') {
                    console.log(`\n📊 Verificando índice: ${index.name}`);
                    try {
                        const otherStatsResponse = await fetch(`https://${index.host}/describe_index_stats`, {
                            method: 'POST',
                            headers: {
                                'Api-Key': pineconeApiKey,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({})
                        });

                        if (otherStatsResponse.ok) {
                            const otherStats = await otherStatsResponse.json();
                            console.log(`   📊 Vectores: ${otherStats.totalVectorCount || 0}`);
                            if (otherStats.totalVectorCount > 0) {
                                console.log(`   ✅ Este índice tiene contenido!`);
                            }
                        }
                    } catch (err) {
                        console.log(`   ❌ Error verificando ${index.name}: ${err.message}`);
                    }
                }
            }
            return;
        }
        
        // 4. Hacer una query de prueba para ver contenido
        console.log('\n🔍 Realizando query de prueba...');
        
        // Generar un embedding de prueba con OpenAI
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            console.error('❌ OPENAI_API_KEY no encontrada para generar embedding');
            return;
        }
        
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: 'documentos contables presupuesto gastos'
            })
        });

        if (!embeddingResponse.ok) {
            throw new Error(`Error generando embedding: ${embeddingResponse.status}`);
        }

        const embeddingData = await embeddingResponse.json();
        const queryVector = embeddingData.data[0].embedding;
        
        // Query en Pinecone
        const queryResponse = await fetch(`https://${targetIndex.host}/query`, {
            method: 'POST',
            headers: {
                'Api-Key': pineconeApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                vector: queryVector,
                topK: 5,
                includeMetadata: true,
                includeValues: false
            })
        });

        if (!queryResponse.ok) {
            throw new Error(`Error en query: ${queryResponse.status}`);
        }

        const queryData = await queryResponse.json();
        console.log('🎯 Resultados encontrados:', queryData.matches?.length || 0);
        
        if (queryData.matches && queryData.matches.length > 0) {
            console.log('\n📄 Ejemplos de documentos encontrados:');
            queryData.matches.forEach((match, index) => {
                console.log(`\n--- Documento ${index + 1} ---`);
                console.log('🔢 Score:', match.score.toFixed(4));
                console.log('🆔 ID:', match.id);
                
                if (match.metadata) {
                    console.log('📋 Metadatos:');
                    Object.entries(match.metadata).forEach(([key, value]) => {
                        if (key === 'content' || key === 'text') {
                            // Mostrar solo los primeros 200 caracteres del contenido
                            const preview = typeof value === 'string' ? value.substring(0, 200) + '...' : value;
                            console.log(`   ${key}: ${preview}`);
                        } else {
                            console.log(`   ${key}: ${value}`);
                        }
                    });
                }
            });
        }
        
        // 5. Query específica sobre documentos contables
        console.log('\n🎯 Query específica sobre documentos contables...');
        const specificEmbeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: 'MC RC documentos contables presupuesto gastos autorización firma electrónica'
            })
        });

        if (specificEmbeddingResponse.ok) {
            const specificEmbeddingData = await specificEmbeddingResponse.json();
            const specificQueryVector = specificEmbeddingData.data[0].embedding;
            
            const specificQueryResponse = await fetch(`https://${targetIndex.host}/query`, {
                method: 'POST',
                headers: {
                    'Api-Key': pineconeApiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    vector: specificQueryVector,
                    topK: 3,
                    includeMetadata: true,
                    includeValues: false
                })
            });

            if (specificQueryResponse.ok) {
                const specificQueryData = await specificQueryResponse.json();
                console.log('📊 Documentos relevantes sobre contabilidad:', specificQueryData.matches?.length || 0);
                
                if (specificQueryData.matches && specificQueryData.matches.length > 0) {
                    specificQueryData.matches.forEach((match, index) => {
                        console.log(`\n🎯 Resultado ${index + 1} (Score: ${match.score.toFixed(4)})`);
                        if (match.metadata && match.metadata.content) {
                            const preview = match.metadata.content.substring(0, 300) + '...';
                            console.log(`📄 Contenido: ${preview}`);
                        }
                    });
                }
            }
        }
        
        console.log('\n✅ Verificación completada');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Ejecutar verificación
verifyPineconeContent();