# Guía Técnica para Desarrolladores: Intellichat (Arquitectura v2)

## 1. Arquitectura y Filosofía General

Este documento desglosa el funcionamiento interno de la aplicación, la interacción entre el frontend y el backend, y las decisiones de diseño clave bajo la nueva **Arquitectura v2: Basada en Intenciones**.

### Arquitectura de Alto Nivel (v2)

El sistema sigue separando la interfaz ("tonta") del backend (inteligente), pero el flujo interno del backend ha sido refactorizado para ser más robusto y predecible.

El LLM ya no genera código JSON complejo. Ahora solo declara su **intención**, y el backend se encarga de la ejecución.

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

### Filosofía de Diseño (v2)

- **Frontend Tonto, Backend Inteligente:** Esta filosofía se mantiene.

- **El Prompt es el Conversador, el Código es el Director:** Este es el cambio fundamental. La lógica de **flujo de control** (qué hacer, en qué orden, cómo manejar errores) ya no reside en el prompt, sino en el código (`bot_logic.js`). El prompt se enfoca exclusivamente en la **calidad de la conversación** y en guiar al LLM para que elija la **intención correcta**.

- **Estado Explícito y Persistente:** Se mantiene. El estado de la conversación se carga al inicio de cada turno y se guarda al final.

- **Backend Agnóstico a la Configuración:** El sistema es ahora aún más agnóstico. El código no sabe qué es la herramienta `findByDotEmail`, solo sabe qué hacer cuando un agente declara la intención `call_tool`. La lógica de qué herramientas puede usar cada agente reside 100% en la base de datos.

### Estrategia de Ramas y Despliegue

Para gestionar el ciclo de vida del desarrollo y despliegue, se utiliza la siguiente estrategia de ramas:

*   **`main`**: Esta rama representa la versión de producción estable. Cualquier `push` a `main` disparará automáticamente el pipeline de CI/CD, desplegando el backend en Railway y el frontend en Vercel.
*   **`dev`**: Esta es la rama principal de desarrollo. Todos los nuevos cambios y características deben implementarse en esta rama (o en ramas de características que luego se fusionen en `dev`). Los `push` a `dev` **no** disparan despliegues automáticos, permitiendo un entorno de trabajo seguro.

### Configuración de CORS

La configuración de CORS (Cross-Origin Resource Sharing) se gestiona en el archivo `intelli_backend/src/app.js`. Se utiliza la librería estándar `cors` para permitir el acceso desde orígenes específicos, incluyendo el frontend desplegado en Vercel (`https://intelichat-five.vercel.app`) y varios orígenes de `localhost` para el desarrollo local. Esto asegura que las comunicaciones entre el frontend y el backend funcionen correctamente tanto en desarrollo como en producción.

---

## 2. Análisis del Frontend (`chat-vanilla/index.html`)

El funcionamiento del frontend no ha cambiado significativamente. Su rol sigue siendo enviar los mensajes del usuario y renderizar las respuestas del backend. La lógica de re-disparo automático para handoffs silenciosos ha sido eliminada, ya que el nuevo flujo del backend la hace innecesaria.

---

## 3. Análisis del Backend (`intelli_backend`)

### a. El Orquestador Central (`routes/chat.js`)

Este archivo no sufre cambios mayores. Su responsabilidad sigue siendo:
1.  Gestionar la sesión.
2.  Cargar el historial y el estado de la conversación.
3.  Llamar al núcleo lógico (`handleUserInput` en `bot_logic.js`).
4.  Persistir los resultados y el nuevo estado en la base de datos.
5.  Enviar la respuesta final al frontend.

### b. El Núcleo de Decisión (`bot_logic.js`) - **Refactorizado**

Este archivo ha sido rediseñado para funcionar como un **director de orquesta basado en intenciones**.

1.  **Llamada al LLM:** Llama a `llm.js` como antes, pero ahora espera un objeto JSON simple con la estructura `{"say": "...", "action": {"type": "..."}}`.

2.  **Interpretación de Intenciones:** El núcleo de la nueva función es un `switch` que lee el valor de `action.type` y ejecuta una lógica específica y determinista para cada caso:
    -   **`case 'call_tool' `:** Si la intención es llamar a una herramienta, el código:
        1.  Usa el `tool_name` proporcionado para buscar la herramienta en `cfg_herramienta_ruta`.
        2.  **Valida** que el agente activo actual tenga permiso para usar esa herramienta (basado en la relación `agente_id` -> `herramienta_id`).
        3.  Llama a `dynamicToolsService` para ejecutarla.
        4.  Añade el resultado al historial y continúa el bucle para que el mismo agente pueda procesar el resultado de su propia herramienta.

    -   **`case 'handoff' `:** Si la intención es un handoff, el código:
        1.  Usa el `target_agent` proporcionado.
        2.  (Futuro) Podría validar si el handoff está permitido en una tabla de configuración.
        3.  Actualiza el `active_agent` en el estado de la sesión.
        4.  Continúa el bucle para que el nuevo agente genere su primera respuesta.

    -   **`case 'finish_turn' `:** Esta es la intención clave para los especialistas. Si la recibe, el código:
        1.  **Ignora** cualquier otra instrucción del LLM.
        2.  **Fuerza** el cambio del `active_agent` a `INFO`.
        3.  Continúa el bucle para que `INFO` tome el control en el siguiente paso. Esta regla de negocio ("los especialistas siempre vuelven a INFO") ahora vive en el código, haciéndola 100% fiable.

    -   **`default` (o si `action` es `null`):** Si el agente solo quiere hablar, el código simplemente procesa el mensaje `say` y termina el turno.

Este nuevo modelo elimina la fragilidad del sistema. El LLM ya no puede "olvidarse" de hacer un handoff; si un especialista declara que ha terminado, el código se encarga de la transición.

## 3. Análisis del Backend (`intelli_backend`)

### a. El Orquestador Central (`routes/chat.js`)

Este archivo no sufre cambios mayores. Su responsabilidad sigue siendo:
1.  Gestionar la sesión.
2.  Cargar el historial y el estado de la conversación.
3.  Llamar al núcleo lógico (`handleUserInput` en `bot_logic.js`).
4.  Persistir los resultados y el nuevo estado en la base de datos.
5.  Enviar la respuesta final al frontend.

### b. El Núcleo de Decisión (`bot_logic.js`) - **Refactorizado**

Este archivo ha sido rediseñado para funcionar como un **director de orquesta basado en intenciones**.

1.  **Llamada al LLM:** Llama a `llm.js` como antes, pero ahora espera un objeto JSON simple con la estructura `{"say": "...", "action": {"type": "..."}}`.

2.  **Interpretación de Intenciones:** El núcleo de la nueva función es un `switch` que lee el valor de `action.type` y ejecuta una lógica específica y determinista para cada caso:
    -   **`case 'call_tool' `:** Si la intención es llamar a una herramienta, el código:
        1.  Usa el `tool_name` proporcionado para buscar la herramienta en `cfg_herramienta_ruta`.
        2.  **Valida** que el agente activo actual tenga permiso para usar esa herramienta (basado en la relación `agente_id` -> `herramienta_id`).
        3.  Llama a `dynamicToolsService` para ejecutarla.
        4.  Añade el resultado al historial y continúa el bucle para que el mismo agente pueda procesar el resultado de su propia herramienta.

    -   **`case 'handoff' `:** Si la intención es un handoff, el código:
        1.  Usa el `target_agent` proporcionado.
        2.  (Futuro) Podría validar si el handoff está permitido en una tabla de configuración.
        3.  Actualiza el `active_agent` en el estado de la sesión.
        4.  Continúa el bucle para que el nuevo agente genere su primera respuesta.

    -   **`case 'finish_turn' `:** Esta es la intención clave para los especialistas. Si la recibe, el código:
        1.  **Ignora** cualquier otra instrucción del LLM.
        2.  **Fuerza** el cambio del `active_agent` a `INFO`.
        3.  Continúa el bucle para que `INFO` tome el control en el siguiente paso. Esta regla de negocio ("los especialistas siempre vuelven a INFO") ahora vive en el código, haciéndola 100% fiable.

    -   **`default` (o si `action` es `null`):** Si el agente solo quiere hablar, el código simplemente procesa el mensaje `say` y termina el turno.

Este nuevo modelo elimina la fragilidad del sistema. El LLM ya no puede "olvidarse" de hacer un handoff; si un especialista declara que ha terminado, el código se encarga de la transición.

### c. El Ejecutor de Herramientas (`dynamicToolsService.js`)

Este servicio no cambia. Sigue siendo un ejecutor genérico de herramientas basado en la configuración de la base de datos. La diferencia es que ahora es invocado por la lógica determinista de `bot_logic.js`, no directamente por la salida (potencialmente errónea) del LLM.

### d. El Conector Multi-LLM (`llm.js`)

Este servicio tampoco cambia. Su responsabilidad sigue siendo abstraer la comunicación con los diferentes proveedores de IA.

---

## 4. El Editor de Agentes (`prompt-editor`)

La Release 1.7 introduce una nueva aplicación frontend dedicada al desarrollo y mantenimiento de los prompts de los agentes. Esta herramienta es fundamental para el flujo de trabajo del desarrollador.

-   **Propósito:** Proporcionar un entorno de desarrollo integrado (IDE) para crear, editar, validar y mejorar los `system prompts` de los agentes.
-   **Tecnología:** HTML, CSS, JavaScript (con la librería EasyMDE para el editor de Markdown).
-   **Servidor:** Corre en `http://localhost:5003` a través de un simple servidor de Express (`server.js`).

### a. Sistema de Validación Inteligente y Contextual

El Editor de Agentes incluye un sistema de validación revolucionario que se adapta automáticamente al tipo de agente:

#### Clasificación Automática de Agentes
El sistema analiza automáticamente la configuración del agente y lo clasifica como:
- **SIMPLE**: Sin herramientas, formularios, handoffs o RAG
- **COMPLEJO**: Con al menos una herramienta, formulario, handoff o RAG

#### Validación Diferenciada
- **Agentes Simples**: Validación relajada con sugerencias y recomendaciones
- **Agentes Complejos**: Validación estricta con errores críticos y cumplimiento obligatorio

#### Implementación Técnica
- **`validationService.js`**: Contiene la lógica de clasificación automática (`classifyAgent()`) y generación de reportes contextuales
- **`meta_prompt_validate_llm.md`**: Template inteligente que adapta las reglas de validación según el tipo de agente
- **Reportes JSON**: Incluyen `agent_classification` y `validation_mode` para transparencia total

### b. API de Soporte en el Backend

Para que el editor funcione, el `intelli_backend` expone una serie de endpoints específicos que le proporcionan los datos necesarios y la lógica de asistencia por IA.

-   `GET /api/agents/clients`, `/api/agents/chatbots`, `/api/agents/by-client-chatbot`: Endpoints para poblar los selectores jerárquicos y permitir al usuario elegir un agente para editar.
-   `GET /api/agents/:id`: Carga todos los datos de un agente específico, incluyendo su prompt, parámetros y mensajes.
-   `GET /api/agents/:id/tools-editor`, `GET /api/agents/:id/handoffs`: Obtienen la información contextual (recursos y handoffs) que se muestra en el panel de solo lectura del editor.
-   `PUT /api/agents/:id/prompt`: Guarda todos los cambios realizados en el editor para un agente (prompt, parámetros y mensajes).
-   `POST /api/agents/:id/improve-prompt`: El núcleo de la función "Asistente", que utiliza un LLM para analizar y mejorar el prompt actual.
-   `POST /api/agents/:id/validate`: El núcleo de la función "Validación", que utiliza el sistema inteligente para generar un informe contextual de consistencia del prompt.
