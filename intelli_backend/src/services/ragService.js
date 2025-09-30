const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const mysql = require('mysql2/promise');

class RAGService {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    };
    
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.qdrantUrl = process.env.QDRANT_URL;
    this.qdrantApiKey = process.env.QDRANT_API_KEY;
    this.pineconeApiKey = process.env.PINECONE_API_KEY;
    
    this.connection = null;
  }

  async connect() {
    if (!this.connection) {
      this.connection = await mysql.createConnection(this.dbConfig);
    }
    return this.connection;
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  /**
   * Genera embedding usando OpenAI
   */
  async generateEmbedding(text) {
    try {
      // Validar que tenemos API key
      if (!this.openaiApiKey || this.openaiApiKey.trim() === '') {
        throw new Error('OpenAI API key no configurada');
      }

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.substring(0, 8000) // Limitar longitud del texto
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API response:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Respuesta inválida de OpenAI API');
      }
      
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generando embedding:', error);
      throw error;
    }
  }

  /**
   * Busca en Qdrant
   */
  async searchQdrant(query, collectionName = 'docs-qdrant', topK = 5) {
    try {
      // Validar configuración
      if (!this.qdrantUrl || this.qdrantUrl === 'undefined') {
        console.warn('⚠️ QDRANT_URL no configurada - saltando búsqueda Qdrant');
        return [];
      }

      const embedding = await this.generateEmbedding(query);
      
      const response = await fetch(`${this.qdrantUrl}/collections/${collectionName}/points/search`, {
        method: 'POST',
        headers: {
          'api-key': this.qdrantApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vector: embedding,
          limit: topK,
          with_payload: true,
          with_vector: false
        })
      });

      if (!response.ok) {
        console.warn(`⚠️ Qdrant search failed: ${response.status} - saltando`);
        return [];
      }

      const data = await response.json();
      return data.result.map(item => ({
        score: item.score,
        content: item.payload?.content || item.payload?.text || '',
        metadata: item.payload || {},
        source: 'qdrant'
      }));
    } catch (error) {
      console.warn('⚠️ Error en búsqueda Qdrant - saltando:', error.message);
      return [];
    }
  }

  /**
   * Busca en Pinecone
   */
  async searchPinecone(query, indexName = 'docs-pinecone', topK = 5) {
    try {
      // Validar configuración
      if (!this.pineconeApiKey || this.pineconeApiKey.trim() === '') {
        console.warn('Pinecone API key no configurada');
        return [];
      }

      const embedding = await this.generateEmbedding(query);
      
      // Primero obtener la información del índice
      const indexResponse = await fetch('https://api.pinecone.io/indexes', {
        method: 'GET',
        headers: {
          'Api-Key': this.pineconeApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!indexResponse.ok) {
        console.warn(`Pinecone index list error: ${indexResponse.status}`);
        return [];
      }

      const indexes = await indexResponse.json();
      const targetIndex = indexes.indexes?.find(idx => idx.name === indexName);
      
      if (!targetIndex || !targetIndex.host) {
        console.warn(`Índice ${indexName} no encontrado o sin host`);
        return [];
      }

      // Realizar la búsqueda
      const searchResponse = await fetch(`https://${targetIndex.host}/query`, {
        method: 'POST',
        headers: {
          'Api-Key': this.pineconeApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vector: embedding,
          topK: topK,
          includeMetadata: true,
          includeValues: false
        })
      });

      if (!searchResponse.ok) {
        console.warn(`Pinecone search error: ${searchResponse.status} ${searchResponse.statusText}`);
        return [];
      }

      const data = await searchResponse.json();
      return data.matches?.map(item => ({
        score: item.score,
        content: item.metadata?.content || item.metadata?.text || '',
        metadata: item.metadata || {},
        source: 'pinecone'
      })) || [];
    } catch (error) {
      console.error('Error buscando en Pinecone:', error);
      return [];
    }
  }

  /**
   * Obtiene cartuchos RAG configurados para un agente
   */
  async getAgentRagCartridges(agenteId, clienteId) {
    try {
      const conn = await this.connect();
      
      const [rows] = await conn.execute(`
        SELECT 
          c.id,
          c.nombre,
          c.proveedor as tipo,
          c.endpoint,
          c.indice_nombre,
          c.capacidades,
          c.topk_default,
          arc.es_default,
          arc.permite_hybrid,
          arc.permite_rerank,
          arc.max_q_por_turno,
          arc.prioridad_orden
        FROM cfg_rag_cartucho c
        INNER JOIN cfg_agente_rag_cartucho arc ON c.id = arc.cartucho_id
        WHERE arc.agente_id = ? AND c.cliente_id = ? AND c.habilitado = 1
        ORDER BY arc.prioridad_orden ASC
      `, [agenteId, clienteId]);

      return rows;
    } catch (error) {
      console.error('Error obteniendo cartuchos RAG:', error);
      return [];
    }
  }

  /**
   * Realiza búsqueda RAG completa
   */
  async search(query, agentId, clientId) {
    try {
      console.log(`🔍 Iniciando búsqueda RAG para agente ${agentId}`);
      
      // Obtener cartuchos RAG del agente
      const cartridges = await this.getAgentRagCartridges(agentId, clientId);
      
      if (!cartridges || cartridges.length === 0) {
        console.log('No hay cartuchos RAG configurados para este agente');
        return { results: [], totalResults: 0 };
      }
      
      console.log(`📦 Encontrados ${cartridges.length} cartuchos RAG`);
      
      let allResults = [];
      
      // TEMPORAL: Solo usar Pinecone para las pruebas
      const pineconeCartridges = cartridges.filter(c => c.tipo === 'pinecone');
      
      if (pineconeCartridges.length === 0) {
        console.log('⚠️ No hay cartuchos Pinecone configurados');
        return { results: [], totalResults: 0 };
      }
      
      // Buscar solo en cartuchos Pinecone
      for (const cartridge of pineconeCartridges) {
        console.log(`🔍 Buscando en cartucho Pinecone: ${cartridge.nombre}`);
        
        // Usar indice_nombre si está disponible, sino extraer de endpoint
        const indexName = cartridge.indice_nombre || this.extractPineconeIndex(cartridge.endpoint) || 'docs-pinecone';
        const results = await this.searchPinecone(query, indexName);
        
        // Agregar información del cartucho a cada resultado
        const enrichedResults = results.map(result => ({
          ...result,
          cartridge: cartridge.nombre,
          provider: cartridge.tipo
        }));
        
        allResults = allResults.concat(enrichedResults);
        console.log(`📊 Encontrados ${results.length} resultados en ${cartridge.nombre}`);
      }
      
      // Ordenar por score descendente
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Limitar resultados
      const maxResults = 10;
      const finalResults = allResults.slice(0, maxResults);
      
      console.log(`✅ Búsqueda RAG completada: ${finalResults.length} resultados`);
      
      // Log de uso (temporalmente deshabilitado)
      await this.logRagUsage(agentId, clientId, query, finalResults.length);
      
      return {
        results: finalResults,
        totalResults: allResults.length
      };
      
    } catch (error) {
      console.error('Error en búsqueda RAG:', error);
      return { results: [], totalResults: 0 };
    }
  }

  /**
   * Extrae nombre de colección de Qdrant del endpoint
   */
  extractQdrantCollection(endpoint) {
    try {
      // Si el endpoint contiene el nombre de la colección, extraerlo
      // Por ejemplo: "https://host:6333/collections/docs-qdrant"
      const match = endpoint.match(/\/collections\/([^\/]+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extrae nombre de índice de Pinecone del endpoint
   */
  extractPineconeIndex(endpoint) {
    try {
      // Si el endpoint contiene el nombre del índice, extraerlo
      // Por ejemplo: "https://docs-pinecone-abc123.svc.region.pinecone.io"
      const match = endpoint.match(/https:\/\/([^-]+(?:-[^-]+)*)-[^.]+\./);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Registra el uso de RAG en la base de datos
   */
  async logRagUsage(agenteId, clienteId, query, resultsCount, cartridges = []) {
    try {
      // Por ahora solo loguear en consola, la tabla ejec_rag_uso puede no existir
      console.log(`📊 RAG Usage: Agent ${agenteId}, Client ${clienteId}, Query: "${query.substring(0, 100)}", Results: ${resultsCount}, Cartridges: ${cartridges.length}`);
    } catch (error) {
      console.error('Error registrando uso RAG:', error);
    }
  }

  /**
   * Formatea resultados RAG para incluir en prompt
   */
  formatResultsForPrompt(ragResults) {
    if (!ragResults.results || ragResults.results.length === 0) {
      return '';
    }

    let context = '\n\n--- CONTEXTO RAG ---\n';
    context += `Información relevante encontrada (${ragResults.totalResults} resultados):\n\n`;

    ragResults.results.forEach((result, index) => {
      context += `[${index + 1}] (Score: ${result.score.toFixed(3)}, Fuente: ${result.cartridge})\n`;
      context += `${result.content}\n\n`;
    });

    context += '--- FIN CONTEXTO RAG ---\n\n';
    context += 'Usa esta información para responder la pregunta del usuario de manera precisa y completa.\n';

    return context;
  }
}

module.exports = RAGService;