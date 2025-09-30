# PRD – IntelliChat v1.8
## Implementación de RAG Read‑Only (RO) opcional por agente

### 0) Resumen ejecutivo
**Objetivo:** habilitar en IntelliChat v1.8 el uso de **RAG Read‑Only** como **capacidad opcional** por agente, multi‑tenant (SaaS), para consultar bases vectoriales externas (“cartuchos”) **sin** administrar su indexación/embeddings/chunking. El RAG se invoca **solo cuando conviene** según **políticas de elegibilidad** y las respuestas incluyen **citas** cuando se usa.

**Ámbitos:** motor de agentes por intenciones, configuración por cliente/agente, observabilidad, seguridad y base de datos (`cfg_*`, `ejec_*`).

**No objetivos:** no UI de carga documental, no pipelines de indexación, no escritura en cartuchos.

---

### 1) Roles/Personas
- **Usuario final del chat:** interactúa con agentes; puede recibir respuestas con citas.
- **Owner de agente (cliente):** habilita cartuchos y límites de uso.
- **Admin del tenant:** gestiona cartuchos disponibles para su organización.
- **Ops/Soporte:** audita decisiones, monitorea latencia, errores y utilidad.

---

### 2) Definiciones
- **Cartucho RAG (RO):** conexión declarada a un índice/colección vectorial externo de **solo lectura** (Qdrant/pgvector/Databricks/otro).
- **Capacidad RAG por agente:** whitelist de cartuchos con límites y prioridad (fallback).
- **Elegibilidad:** pipeline de decisión por turno (intención, dominio, señales, SLA/coste, privacidad).
- **Citas:** metadatos mínimos (source_id/URI/fecha/autor/version) cuando se usó RAG.

---

### 3) Requisitos funcionales
**F1. Configuración multi‑tenant**
- Registrar cartuchos RAG por `cliente_id`: proveedor, endpoint, índice, capacidades (hybrid/rerank), límites (top‑k, timeout), estado.
- Asignar cartuchos a **agentes** del cliente con límites por turno/conversación y **prioridad** para fallback.
- (Opcional) Política declarativa por agente (dominios, intenciones, umbrales y fallback máximo).

**F2. Ejecución (por turno)**
- Evaluar **elegibilidad**; si procede, invocar **un** cartucho (según prioridad). Si 0 resultados/timeout/error: registrar y **no bloquear**; permitir **un** fallback.
- Al usar RAG, incluir **citas** en la respuesta visible y guardar evidencias en `ejec_*`.

**F3. Observabilidad**
- Registrar decisión por turno: `used | skipped | fallback | error`, razón, parámetros (top_k, hybrid, rerank), latencia y evidencias (citas).
- Métricas por cliente/agente/cartucho.

---

### 4) Requisitos no funcionales
- **SaaS multi‑tenant:** todos los registros con `cliente_id`, prohibido cruzar tenants.
- **Rendimiento:** timeout por cartucho (default 3 s), objetivo P95 decisión ≤ 4 s cuando se usa RAG.
- **Seguridad:** principio de mínimo privilegio (credenciales RO externas), whitelists, rate‑limits.
- **Privacidad:** opción de **no** persistir `snippet`; sanitización de logs (hash/IDs).

---

### 5) Arquitectura lógica
- Agente → (política de elegibilidad) → `rag.retrieve(cartucho)` → pasajes + metadatos → **respuesta con citas**.
- Datos: `cfg_*` para configuración; `ejec_*` para decisiones y evidencias.
- No se persiste contenido sensible salvo configuración (política del cliente).

---

### 6) Políticas de elegibilidad (pipeline)
1. **Gate 0 – Habilitación:** agente con cartucho en whitelist + `cliente_id` coincidente.
2. **Gate 1 – Intención:** factual/validate/summarize → candidatos; creativo/operativo → no usar.
3. **Gate 2 – Señales de necesidad:** referencias normativas, petición de citas, ambigüedad, baja confianza.
4. **Gate 3 – SLA/coste:** presupuesto de queries y `timeout_ms` disponibles.
5. **Gate 4 – Privacidad/alcance:** dominio/tenant/capacidades alineadas.
**Salida:** Usar / No usar / Preguntar (pedir precisión) / Fallback (1×).

---

### 7) Esquema de datos (impacto v1.8)
> Tablas nuevas y claves pensadas para MySQL/MariaDB con prefijos existentes. Se asume `cfg_cliente`, `cfg_agente`, `ejec_conversacion`, `ejec_turno` ya existen.

- `cfg_rag_cartucho` (catálogo de cartuchos RAG RO por cliente)
- `cfg_agente_rag_cartucho` (whitelist y límites por agente)
- `ejec_rag_uso` (log de decisiones por turno)
- `ejec_rag_chunk` (evidencias/citas asociadas a un uso)
- (Opcional) `cfg_rag_politica` (política declarativa por agente)

**Integridad multi‑tenant:** `cliente_id` debe coincidir en asignaciones y logs. Ver SQL en `rag.sql`.

---

### 8) Reglas de negocio
- **Opt‑in por agente**: sin whitelist, el agente no puede usar RAG.
- **Un cartucho por turno** (regla); **un fallback** máximo.
- **Citas obligatorias** cuando `decision='used'`.
- **No‑blocking** ante error/timeout; registrar `error` y continuar.
- **Presupuestos**: respetar `max_q_por_turno` y `max_q_por_conv`.

---

### 9) Seguridad y cumplimiento
- Credenciales externas gestionadas en Secret Manager (fuera del alcance).
- Scopes por cartucho y rate‑limits por agente.
- Sanitización de logs; opción “sin snippet” por política de cliente.

---

### 10) Observabilidad y KPIs
- **Uso:** % `used` vs `skipped` por agente/cliente/cartucho.
- **Calidad:** % respuestas con citas; win‑rate percibido; *hit@k* (etiquetado offline).
- **Rendimiento:** latencia media/P95; timeouts/errores.
- **Coste:** consultas por conversación; cartuchos más costosos/menos útiles.

---

### 11) Pruebas / Aceptación
- **Smoke por cartucho:** devuelve ≥1 cita válida dentro del timeout.
- **Política:** intenciones factuales activan RAG; creativas no.
- **Errores/Timeout:** conversación no se bloquea; queda log `error`/`fallback`.
- **Privacidad:** modo “sin snippet” almacena solo IDs/URIs/metadata.
- **Aceptación:** tablas creadas, integridad `cliente_id` y respuestas con ≥1 cita cuando se usó RAG.

---

### 12) Roadmap de entrega
- **Fase A:** configuración (cartuchos por cliente, whitelist por agente).
- **Fase B:** ejecución (elegibilidad + retrieve + citas; fallback 1×).
- **Fase C:** observabilidad (logs, métricas básicas).
- **Fase D (opcional):** política declarativa por agente.

---

### 13) Riesgos y mitigaciones
- **Desalineación de tenants:** constraints y validaciones de `cliente_id` en joins.
- **Latencia variable:** timeouts y degradación elegante; priorización de cartuchos.
- **Calidad heterogénea:** monitor de win‑rate y ajuste de prioridades.
- **Privacidad:** modo sin snippet, minimización de datos, cifrado en reposo.
