-- rag.sql – Impacto de base de datos para IntelliChat v1.8 (RAG Read-Only)
-- Motor recomendado: InnoDB; juego de caracteres: utf8mb4
-- Compatible con MariaDB 10.3.39

-- NOTA: Se asume existencia de tablas:
--   cfg_cliente(id), cfg_agente(id, chatbot_id, cliente_id)
--   ejec_chat(id, cliente_id), ejec_mensaje(id, chat_id)
-- Ajustar nombres de FKs si difieren en tu db.sql.

/* =========================================================
   1) Catálogo de cartuchos RAG (solo lectura) – por cliente
   ========================================================= */
CREATE TABLE IF NOT EXISTS cfg_rag_cartucho (
  id              bigint(20) NOT NULL AUTO_INCREMENT,
  cliente_id      bigint(20) NOT NULL,
  nombre          varchar(100) NOT NULL,
  dominio_tag     varchar(80)  NOT NULL,                           -- ej. 'legal','marketing','codigo'
  proveedor       enum('qdrant','pinecone','databricks','pgvector','otro') NOT NULL,
  endpoint        varchar(255) NOT NULL,                            -- host/URL/DSN
  indice_nombre   varchar(128) NOT NULL,                            -- colección/índice/tabla
  capacidades     longtext NULL,                                    -- JSON: { "hybrid":true, "rerank":false, "filters":["year","product"] }
  topk_default    int(11) NOT NULL DEFAULT 5,
  timeout_ms      int(11) NOT NULL DEFAULT 3000,
  habilitado      tinyint(1) NOT NULL DEFAULT 1,
  notas           varchar(255) NULL,
  creado_en       datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uk_cliente_nombre (cliente_id, nombre),
  KEY idx_cliente_dominio (cliente_id, dominio_tag),
  KEY idx_proveedor (proveedor),
  CONSTRAINT fk_rag_cartucho_cliente
    FOREIGN KEY (cliente_id) REFERENCES cfg_cliente(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/* =========================================================
   2) Whitelist por agente (habilitación + límites + prioridad)
   ========================================================= */
CREATE TABLE IF NOT EXISTS cfg_agente_rag_cartucho (
  agente_id        bigint(20) NOT NULL,
  cartucho_id      bigint(20) NOT NULL,
  cliente_id       bigint(20) NOT NULL,                             -- redundante para blindar tenant
  es_default       tinyint(1) NOT NULL DEFAULT 0,
  permite_hybrid   tinyint(1) NOT NULL DEFAULT 0,
  permite_rerank   tinyint(1) NOT NULL DEFAULT 0,
  max_q_por_turno  int(11) NOT NULL DEFAULT 1,
  max_q_por_conv   int(11) NOT NULL DEFAULT 5,
  prioridad_orden  int(11) NOT NULL DEFAULT 100,
  creado_en        datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (agente_id, cartucho_id),
  KEY idx_agente_orden (agente_id, prioridad_orden),
  KEY idx_cliente (cliente_id),
  CONSTRAINT fk_arc_agente
    FOREIGN KEY (agente_id) REFERENCES cfg_agente(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_arc_cartucho
    FOREIGN KEY (cartucho_id) REFERENCES cfg_rag_cartucho(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_arc_cliente
    FOREIGN KEY (cliente_id) REFERENCES cfg_cliente(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Integridad multi-tenant sugerida (trigger o check lógico en aplicación):
-- cliente_id de cfg_agente_rag_cartucho debe coincidir con
--   cfg_agente.cliente_id y cfg_rag_cartucho.cliente_id

/* =========================================================
   3) Log de decisión por turno (usó/omitió/fallback/error)
   ========================================================= */
CREATE TABLE IF NOT EXISTS ejec_rag_uso (
  id               bigint(20) NOT NULL AUTO_INCREMENT,
  cliente_id       bigint(20) NOT NULL,
  chat_id          bigint(20) NOT NULL,
  mensaje_id       bigint(20) NOT NULL,
  agente_id        bigint(20) NOT NULL,
  cartucho_id      bigint(20) NULL,                                 -- NULL si se decidió no usar
  decision         enum('used','skipped','fallback','error') NOT NULL,
  razon_decision   varchar(200) NOT NULL,                           -- ej. 'intent=factual','no_scope','timeout','budget_exhausted'
  query_text       text NULL,
  top_k            int(11) NULL,
  hybrid           tinyint(1) NULL,
  rerank           tinyint(1) NULL,
  latencia_ms      int(11) NULL,
  error_code       varchar(80) NULL,
  creado_en        datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_chat_mensaje (cliente_id, chat_id, mensaje_id),
  KEY idx_agente_time (agente_id, creado_en),
  KEY idx_decision (decision),
  CONSTRAINT fk_ruso_cliente
    FOREIGN KEY (cliente_id) REFERENCES cfg_cliente(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ruso_cartucho
    FOREIGN KEY (cartucho_id) REFERENCES cfg_rag_cartucho(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_ruso_agente
    FOREIGN KEY (agente_id) REFERENCES cfg_agente(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ruso_mensaje
    FOREIGN KEY (mensaje_id) REFERENCES ejec_mensaje(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ruso_chat
    FOREIGN KEY (chat_id) REFERENCES ejec_chat(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Nota: se asume que ejec_mensaje ya referencia a ejec_chat y cliente_id.
-- Si no, añadir FK explícito a ejec_chat y checks de consistencia.

/* =========================================================
   4) Evidencias/citas devueltas por el RAG
   ========================================================= */
CREATE TABLE IF NOT EXISTS ejec_rag_chunk (
  uso_id           bigint(20) NOT NULL,
  orden_rank       int(11) NOT NULL,                                -- 1..top_k
  source_id        varchar(160) NOT NULL,                           -- ID/clave del documento
  source_uri       varchar(255) NULL,                               
  score            decimal(6,4) NULL,                               
  snippet          text NULL,                                       
  metadata         longtext NULL,                                   -- JSON: { "title":"...", "date":"YYYY-MM-DD", "author":"...", "version":"..." }
  PRIMARY KEY (uso_id, orden_rank),
  KEY idx_source (source_id),
  CONSTRAINT fk_rchunk_uso
    FOREIGN KEY (uso_id) REFERENCES ejec_rag_uso(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Privacidad: si el cliente lo exige, omitir 'snippet' y persistir solo IDs/URIs/metadata.

/* =========================================================
   5) (Opcional) Política declarativa por agente
   ========================================================= */
CREATE TABLE IF NOT EXISTS cfg_rag_politica (
  id               bigint(20) NOT NULL AUTO_INCREMENT,
  agente_id        bigint(20) NOT NULL,
  cliente_id       bigint(20) NOT NULL,
  dominios_allow   longtext NULL,                                   -- JSON: ["legal","marketing"] ; NULL = cualquiera de su whitelist
  intenciones_allow longtext NULL,                                  -- JSON: ["factual","validate","summarize"]
  confianza_min    decimal(3,2) NULL,                               -- si se calcula confianza propia
  latencia_max_ms  int(11) NULL,
  fallback_limite  tinyint(4) NULL DEFAULT 1,
  creado_en        datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uk_agente_cliente (agente_id, cliente_id),
  CONSTRAINT fk_rpol_agente
    FOREIGN KEY (agente_id) REFERENCES cfg_agente(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_rpol_cliente
    FOREIGN KEY (cliente_id) REFERENCES cfg_cliente(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/* =========================================================
   DATOS DE PRUEBA - Chatbot y Agente RAG
   ========================================================= */

-- Insertar chatbot de prueba para RAG (ID 100)
INSERT INTO cfg_chatbot (id, cliente_id, nombre, descripcion, default_lang, is_active, created_at, updated_at) 
VALUES (100, 4, 'RAG Test Bot', 'Chatbot de prueba para funcionalidad RAG', 'es', 1, current_timestamp(), current_timestamp())
ON DUPLICATE KEY UPDATE 
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  updated_at = current_timestamp();

-- Insertar agente de prueba para RAG (ID 200)
INSERT INTO cfg_agente (id, chatbot_id, nombre, descripcion, orden, llm_modelo_id, system_prompt_es, system_prompt_en, 
                       mensaje_bienvenida_es, mensaje_bienvenida_en, temperatura, top_p, max_tokens, 
                       is_active, is_default, created_at, updated_at)
VALUES (200, 100, 'Asistente RAG', 'Agente especializado en búsqueda y recuperación de información usando RAG', 1, 1,
        'Eres un asistente especializado en búsqueda y recuperación de información. Utilizas tecnología RAG (Retrieval-Augmented Generation) para proporcionar respuestas precisas basadas en documentos y fuentes de conocimiento específicas. Siempre cita tus fuentes cuando sea posible.',
        'You are an assistant specialized in information search and retrieval. You use RAG (Retrieval-Augmented Generation) technology to provide accurate answers based on specific documents and knowledge sources. Always cite your sources when possible.',
        '¡Hola! Soy tu asistente RAG. Puedo ayudarte a buscar información específica en nuestras bases de conocimiento. ¿En qué puedo ayudarte hoy?',
        'Hello! I am your RAG assistant. I can help you search for specific information in our knowledge bases. How can I help you today?',
        0.70, 1.00, 2048, 1, 1, current_timestamp(), current_timestamp())
ON DUPLICATE KEY UPDATE 
  nombre = VALUES(nombre),
  descripcion = VALUES(descripcion),
  system_prompt_es = VALUES(system_prompt_es),
  system_prompt_en = VALUES(system_prompt_en),
  mensaje_bienvenida_es = VALUES(mensaje_bienvenida_es),
  mensaje_bienvenida_en = VALUES(mensaje_bienvenida_en),
  updated_at = current_timestamp();

-- Insertar cartucho RAG de prueba
INSERT INTO cfg_rag_cartucho (id, cliente_id, nombre, dominio_tag, proveedor, endpoint, indice_nombre, 
                             capacidades, topk_default, timeout_ms, habilitado, notas, creado_en)
VALUES (1, 4, 'Documentación General', 'general', 'qdrant', 'http://localhost:6333', 'docs_general',
        '{"hybrid": true, "rerank": false, "filters": ["category", "date"]}', 5, 3000, 1, 
        'Cartucho de prueba para documentación general', current_timestamp())
ON DUPLICATE KEY UPDATE 
  nombre = VALUES(nombre),
  endpoint = VALUES(endpoint),
  habilitado = VALUES(habilitado),
  notas = VALUES(notas);

-- Asociar agente con cartucho RAG
INSERT INTO cfg_agente_rag_cartucho (agente_id, cartucho_id, cliente_id, es_default, permite_hybrid, 
                                    permite_rerank, max_q_por_turno, max_q_por_conv, prioridad_orden, creado_en)
VALUES (200, 1, 4, 1, 1, 0, 2, 10, 100, current_timestamp())
ON DUPLICATE KEY UPDATE 
  es_default = VALUES(es_default),
  permite_hybrid = VALUES(permite_hybrid),
  max_q_por_turno = VALUES(max_q_por_turno),
  max_q_por_conv = VALUES(max_q_por_conv);

-- FIN rag.sql
