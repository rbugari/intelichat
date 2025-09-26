# PRD: Aplicación de Chat Vanilla (chat-vanilla)

## Resumen del Proyecto
Esta aplicación es una interfaz de chat simple en Vanilla JavaScript, diseñada para interactuar con el backend de Intellichat. El objetivo es asegurar una comunicación fluida, contextual y conversacionalmente natural con los agentes del backend, manejando correctamente el estado de la conversación, las llamadas a herramientas y los handoffs entre agentes.

## Estado Actual y Avances

**Estado General:** Arquitectura de conversación finalizada y robusta. El sistema ahora soporta flujos de múltiples agentes, múltiples mensajes y capacidades de voz (STT/TTS), proporcionando una experiencia de usuario fluida y sin interrupciones.

### Resumen de Cambios y Correcciones

1.  **Re-arquitectura del Flujo de Handoff (General -> Especialista):**
    *   **Problema:** El flujo inicial de derivación era propenso a pausas, mensajes mal atribuidos y una experiencia de usuario confusa.
    *   **Solución:** Se implementó un patrón de 3 pasos robusto.

2.  **Implementación del Ciclo de Vida del Especialista ("Responde y Devuelve")**
    *   **Problema:** Los agentes especialistas retenían la conversación después de cumplir su tarea.
    *   **Solución:** Se modificaron los prompts de los especialistas para que devuelvan el control al agente `general` tras responder.

3.  **Corrección Crítica del Motor Lógico del Backend (`bot_logic.js`):**
    *   **Problema:** El bucle de procesamiento principal se interrumpía prematuramente después de un handoff.
    *   **Solución:** Se reestructuró `handleUserInput` para manejar secuencias complejas (`handoff` -> `call_tool` -> `say`) dentro de un único ciclo.

4.  **Mejora del Formato de Respuesta (`chat.js` y `bot_logic.js`):**
    *   **Problema:** El backend enviaba los mensajes del bot como un solo texto, causando mala atribución en la UI.
    *   **Solución:** El backend ahora genera un array de objetos de mensaje estructurados (texto y agente) para una correcta atribución visual.

5.  **Mejoras en la Experiencia de Usuario (UI):**
    *   **Header Fijo:** Se aseguró que la barra de navegación superior permanezca siempre visible.
    *   **Configuración Dinámica:** Se añadió la capacidad de configurar `cliente_id` y `chatbot_id` desde los parámetros de la URL.
    *   **Manejo de Limitaciones:** Se ajustó el prompt del agente `datos` para comunicar claramente las limitaciones de sus herramientas.

6.  **Implementación de Comandos de Voz (STT/TTS):**
    *   **Speech-to-Text (STT):** Se ha implementado un sistema dual de voz a texto para la entrada del usuario.
        *   **Proveedor Backend (OpenAI):** Se creó un endpoint (`/api/stt/transcribe`) que utiliza el modelo Whisper de OpenAI para transcripciones de alta precisión.
        *   **Proveedor Web (Nativo):** Se integró la API `SpeechRecognition` del navegador como una alternativa directa y sin costo.
        *   **Configuración Centralizada:** El proveedor de STT por defecto (`backend` o `web`) se controla desde la variable de entorno `STT_DEFAULT_PROVIDER` en el archivo `.env`.
    *   **Text-to-Speech (TTS):** Se ha implementado un sistema híbrido de texto a voz para las respuestas de los agentes, utilizando la API nativa `SpeechSynthesis` del navegador.
        *   **Toggle Global:** Un botón en la barra de herramientas (`🔊`/`🔇`) permite activar o desactivar la lectura automática de todos los mensajes entrantes.
        *   **Reproducción por Mensaje:** Cuando la lectura automática está desactivada, cada mensaje del bot muestra un icono (`🔈`) para reproducir ese audio específico a demanda.

7.  **Actualización de Documentación:**
    *   Se actualizaron los documentos `GUIA_GENERACION_PROMPTS.md` y `meta_prompt_recommend.md` para reflejar todos estos nuevos patrones y mejores prácticas.

8.  **Creación de Herramienta de Desarrollo (`prompt-editor`):**
    *   Paralelamente, se ha creado una aplicación completamente nueva y separada, el `prompt-editor`, que funciona como un IDE dedicado para el desarrollo, validación y mejora de los `system prompts` de los agentes.

### Estado Actual del Sistema

*   ✅ **Flujo de Conversación Completo:** El ciclo `general` -> `especialista` -> `general` es robusto y fluido.
*   ✅ **Motor de Lógica Multi-turno:** El backend soporta secuencias de acciones complejas en un solo turno.
*   ✅ **Atribución Correcta de Mensajes:** La UI muestra correctamente qué agente dice cada mensaje.
*   ✅ **Capacidades de Voz (STT/TTS):** El chat ahora soporta entrada por voz y salida por audio, con múltiples modos de configuración.
*   ✅ **Experiencia de Usuario Mejorada:** La interacción es más natural, clara y sin interrupciones.

## Próximos Pasos (Roadmap)

La Fase 2 (Comandos por Voz) se ha **completado con éxito**. El sistema se encuentra en un estado funcional y listo para la siguiente fase de expansión.

### Fase 1: Integración de Formularios Dinámicos

**Estado:** Implementación completada y en fase de pruebas.

**Objetivo:** Permitir que un agente de chat presente un formulario dinámico al usuario, recolecte los datos y los utilice para continuar la conversación.

**Implementación:**

1.  **Backend (`intelli_backend`):
    *   **Nuevo Tipo de Herramienta:** Se ha añadido el tipo `form` a las herramientas (`cfg_herramienta`), permitiendo a los agentes invocar formularios.
    *   **Servicio de Herramientas Dinámicas (`dynamicToolsService.js`):**
        *   Ahora puede identificar y diferenciar las herramientas de tipo `form` de las de tipo `api` basándose en `cfg_herramienta.tipo`.
        *   Se ha mejorado para soportar el reemplazo de parámetros de ruta (ej. `{city}`) en las URLs de las herramientas API, permitiendo una mayor flexibilidad en la definición de endpoints.
    *   **Lógica del Bot (`bot_logic.js`):** Se ha actualizado `handleUserInput` para que, al recibir una `call_tool` del LLM (donde `name` es el `nombre` de la ruta en `cfg_herramienta_ruta` para APIs, o el `nombre` del formulario en `cfg_herramienta` para formularios):
        *   Primero, determina el `tipo` de la herramienta (form o api) consultando `cfg_herramienta_ruta` (para APIs) o `cfg_herramienta` (para formularios).
        *   Si es de tipo `form`, devuelve una acción `call_form` al frontend.
        *   Si es de tipo `api`, procede a llamar a `dynamicToolsService` para ejecutar la API.

    *   **Controlador de Formularios (`formsController.js`):** Se ha creado un nuevo controlador para gestionar la obtención de esquemas de formulario y la recepción de los datos enviados.
    *   **Nuevas Rutas (`forms.js`):** Se han añadido los endpoints `/api/forms/:codigo` (para obtener el esquema del formulario) y `/api/forms/submit` (para recibir los datos).
    *   **Adaptación de la Ruta de Chat (`chat.js`):** Se ha modificado la ruta principal del chat para manejar la acción `call_form` y comunicarla correctamente al cliente.

2.  **Frontend (`chat-vanilla/index.html`):
    *   **Manejo de la Acción `call_form`:** El frontend ahora puede recibir y procesar la acción `call_form` devuelta por el backend.
    *   **Renderizado Dinámico de Formularios:** Al recibir la acción, el cliente realiza una petición al endpoint `/api/forms/:codigo` para obtener el esquema del formulario y lo renderiza dinámicamente en la interfaz de chat.
    *   **Envío de Datos:** Una vez que el usuario completa y envía el formulario, los datos se envían al endpoint `/api/forms/submit`.

3.  **Base de Datos y Caso de Prueba:
    *   **Nuevas Entidades:** Se ha creado un caso de prueba completo con un nuevo cliente (ID 4), un nuevo chatbot (ID 4), un agente (`pruebaForm`), un formulario (`seleccion_ciudad`) y las herramientas correspondientes (`seleccion_ciudad` y `clima`).
    *   **Validación:** Se ha verificado que todas las nuevas entidades se han creado correctamente en la base de datos.

### Pendientes

*   **Cambiar nombre del backend:** Evaluar el cambio de nombre del backend a `intelli_back` (o similar) en el futuro.
*   **Integración OpenRouter:** Agregar OpenRouter como proveedor de LLM.