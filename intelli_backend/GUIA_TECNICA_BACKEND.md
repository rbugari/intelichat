# Guía Técnica del Backend (Arquitectura v2)

## 1. Introducción

Este documento proporciona una explicación detallada de la arquitectura, componentes y funcionamiento interno del backend de Kargho Chat bajo la nueva **Arquitectura v2: Basada en Intenciones**.

## 2. Visión General y Arquitectura (v2)

El backend sigue siendo el cerebro central de la aplicación, pero su lógica interna ha sido refactorizada para ser más robusta y predecible, separando la conversación de la ejecución de acciones.

**Filosofía de Diseño (v2): El Código es el Director**
- **El Prompt Conversa, el Código Ejecuta:** La responsabilidad del LLM es entender al usuario y declarar una **intención** simple (ej: `call_tool`, `finish_turn`).
- **El Backend Dirige:** El código (`bot_logic.js`) recibe la intención y, basándose en reglas de negocio y la configuración de la BD, ejecuta la acción correspondiente. El flujo de la conversación es ahora predecible.

**Diagrama de Flujo de Conversación (v2):**
```mermaid
graph TD
    A[Frontend] -->|1. Envía msg| B(Backend: /api/chat);
    B -->|2. Carga estado| C[DB: ejec_chat];
    B -->|3. Llama a bot_logic| D(bot_logic.js);
    D -->|4. Consulta al LLM| E[llm.js];
    E -->|5. API Externa LLM| F[Groq/OpenAI];
    F -->|6. Respuesta LLM con INTENCIÓN| E;
    E -->|7. Devuelve Intención simple| D;
    
    subgraph "bot_logic.js (Director de Orquesta)"
        direction LR
        D -->|8. Lee Intención| G{Switch (action.type)};
        G -->|call_tool| H[Llama a dynamicToolsService];
        G -->|handoff| I[Cambia de Agente Activo];
        G -->|finish_turn| J[Fuerza Handoff a INFO];
        G -->|say| K[Solo hablar];
    end

    H --> L[DB: cfg_herramienta];
    I --> D;
    J --> D;
    
    D -->|10. Respuesta Final| B;
    B -->|11. Persiste estado| C;
    B -->|12. Envía msg al Frontend| A;
```

## 3. Módulos de Lógica Central (Refactorizado)

### 3.1. `bot_logic.js` (El Director de Orquesta)

Este archivo ha sido rediseñado para funcionar como un **director de orquesta basado en intenciones**.

1.  **Llamada al LLM:** Llama a `llm.js` como antes, pero ahora espera un objeto JSON simple con la estructura `{"say": "...", "action": {"type": "..."}}`.

2.  **Interpretación de Intenciones:** El núcleo de la nueva función es un `switch` que lee el valor de `action.type` y ejecuta una lógica específica y determinista para cada caso:
    -   **`case 'call_tool' `:** Si la intención es llamar a una herramienta, el código valida que el agente tenga permiso y llama a `dynamicToolsService` para ejecutarla.
    -   **`case 'handoff' `:** Si la intención es un handoff, el código actualiza el `active_agent` en el estado de la sesión.
    -   **`case 'finish_turn' `:** Esta es la intención clave para los especialistas. Cuando el código la recibe, **fuerza** el cambio del `active_agent` de vuelta a `INFO`, asegurando que el ciclo se cierre correctamente.
    -   **`default` (o si `action` es `null`):** Si el agente solo quiere hablar, el código simplemente procesa el mensaje `say` y termina el turno.

Este nuevo modelo elimina la fragilidad del sistema. El LLM ya no puede "olvidarse" de hacer un handoff; si un especialista declara que ha terminado, el código se encarga de la transición.

### 3.2. `dynamicToolsService.js`

Este servicio no cambia. Sigue siendo un ejecutor genérico de herramientas. La diferencia es que ahora es invocado por la lógica determinista de `bot_logic.js`.

### 3.3. `llm.js` y `prompts_hybrid.js`

Estos servicios no cambian. Su responsabilidad sigue siendo la comunicación con las APIs de LLM y la carga de prompts desde la base de datos.

## 4. Estructura de la Base de Datos y Endpoints

La estructura de la base de datos y los endpoints de la API no requieren cambios para soportar esta nueva arquitectura, ya que la modificación es a nivel de la lógica de negocio interna.

## 5. Flujo de Desarrollo

El flujo de desarrollo se mantiene, pero la creación de prompts ahora se rige por la nueva `GUIA_GENERACION_PROMPTS.md`, que es mucho más simple y se enfoca en la conversación y la declaración de intenciones.

---

## 6. API para el Editor de Prompts (v1.7)

La versión 1.7 introduce una serie de endpoints en el backend diseñados específicamente para dar soporte a la aplicación `prompt-editor`, permitiendo la gestión y el desarrollo de agentes de una forma más interactiva.

### Endpoints de Soporte

Estos endpoints permiten al editor poblar sus selectores y obtener la información contextual necesaria para un agente específico.

-   `GET /api/agents/clients`: Devuelve una lista de todos los clientes activos.
-   `GET /api/agents/chatbots?cliente_id=:id`: Devuelve los chatbots activos para un cliente específico.
-   `GET /api/agents/by-client-chatbot?cliente_id=:id&chatbot_id=:id`: Devuelve los agentes para un chatbot específico.
-   `GET /api/agents/:id/tools-editor`: Obtiene las herramientas (APIs y formularios) disponibles para un agente, en un formato simplificado para el panel "Recursos" del editor.
-   `GET /api/agents/:id/handoffs`: Obtiene la configuración de handoffs para un agente.

### Endpoints de Modificación y Asistencia

Estos endpoints gestionan la lógica de guardado, validación y mejora de prompts.

-   `PUT /api/agents/:id/prompt`: Endpoint unificado que recibe y guarda todos los datos editables de un agente: el `system_prompt`, los parámetros del LLM (`temperatura`, `max_tokens`, etc.) y todos los mensajes predefinidos.
-   `POST /api/agents/:id/improve-prompt`: Recibe el prompt actual y una sugerencia del usuario, y utiliza un LLM para generar recomendaciones y una versión mejorada del prompt.
-   `POST /api/agents/:id/validate`: Recibe el prompt actual y utiliza un LLM para realizar un análisis de consistencia contra las herramientas y handoffs configurados para el agente, devolviendo un informe detallado.