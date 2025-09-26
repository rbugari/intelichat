# Editor de Agentes (Modelo Inspector)

Bienvenido al Editor de Agentes, una herramienta de desarrollo inspirada en IDEs profesionales y diseñada para la creación, edición y optimización de los `system prompts` de tus agentes de IA.

## Características Principales

### 1. Interfaz de Usuario "Inspector Model"

El editor se organiza en tres áreas de trabajo claras:

*   **Barra de Herramientas (Superior):** Contiene acciones globales como `Guardar`, y los botones para lanzar las herramientas de `✨ Asistente` y `🧪 Validación`.
*   **Área de Edición (Izquierda):** Un panel con pestañas para editar los diferentes aspectos del agente: el `📝 Prompt`, sus `⚙️ Parámetros` de LLM, y los `💬 Mensajes` predefinidos.
*   **Panel Inspector (Derecha):** Un panel de solo lectura que muestra información contextual clave del agente (Info, Recursos, Handoffs) mientras trabajas.

### 2. Asistencia Inteligente (Modal del Asistente)

Lanzado desde el botón `✨ Asistente`, esta funcionalidad te permite refinar tus prompts con la ayuda de un LLM:

*   **Instrucciones por Voz o Texto**: Introduce tus indicaciones para la IA (ej. "hazlo más amigable", "añade un paso para verificar el email") utilizando texto o dictado por voz.
*   **Generación de Sugerencias**: La IA analizará tu prompt actual y tus instrucciones para generar notas de mejora y una versión optimizada del prompt.
*   **Aplicación Sencilla**: Con un solo clic, puedes aplicar la sugerencia generada por la IA directamente al editor principal.

### 3. Validación de Consistencia (Modal de Validación)

Lanzado desde el botón `🧪 Validación`, asegura que tus prompts sean coherentes con la configuración de tu agente:

*   **Análisis Semántico**: El sistema utiliza un LLM para verificar de forma inteligente si las herramientas y handoffs configurados están mencionados de manera clara y comprensible en tu prompt.
*   **Informes Detallados**: Recibe un informe estructurado con indicadores visuales (✅, ⚠️, ❌) que te ayudarán a identificar rápidamente posibles inconsistencias o áreas de mejora.

## Cómo Empezar

1.  **Asegúrate de que el backend esté corriendo**: Inicia el servidor `intelli_backend` (normalmente con `npm start` en su directorio).
2.  **Inicia el Editor de Prompts**: Navega al directorio `prompt-editor` y ejecuta `npm start`. El editor se abrirá en tu navegador en `http://localhost:5003`.
3.  **Selecciona un Agente**: Utiliza los selectores de Cliente, Chatbot y Agente para cargar el prompt que deseas editar.
4.  **Edita o Mejora**:
    *   Usa las pestañas del panel izquierdo para cambios manuales.
    *   Usa el botón `✨ Asistente` para obtener sugerencias inteligentes.
    *   Usa el botón `🧪 Validación` para verificar la consistencia.
5.  **Guarda tus Cambios**: Haz clic en `💾 Guardar` para aplicar las modificaciones al prompt del agente.

¡Esperamos que disfrutes de esta nueva versión del Editor de Agentes!
