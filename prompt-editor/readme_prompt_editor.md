# Editor de Agentes (Modelo Inspector)

Bienvenido al Editor de Agentes, una herramienta de desarrollo inspirada en IDEs profesionales y diseñada para la creación, edición y optimización de los `system prompts` de tus agentes de IA.

## 🔍 Validación Inteligente y Contextual

El Editor de Agentes incluye un sistema de validación revolucionario que se adapta automáticamente al tipo de agente que estés desarrollando, proporcionando una experiencia de desarrollo más inteligente y eficiente.

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

### 3. Validación Inteligente y Contextual (Modal de Validación)

Lanzado desde el botón `🧪 Validación`, el sistema ahora se adapta automáticamente al tipo de agente que estés desarrollando:

#### Clasificación Automática
El sistema analiza automáticamente tu agente y lo clasifica como:
- **🟢 AGENTE SIMPLE**: Sin herramientas, formularios, handoffs o RAG. Ideal para agentes conversacionales básicos.
- **🔴 AGENTE COMPLEJO**: Con herramientas, formularios, handoffs o RAG. Requiere mayor precisión arquitectónica.

#### Validación Diferenciada
- **Para Agentes Simples**: Validación relajada con sugerencias y recomendaciones que fomentan la creatividad conversacional.
- **Para Agentes Complejos**: Validación estricta con errores críticos que aseguran el cumplimiento de patrones arquitectónicos.

#### Características Avanzadas
*   **Análisis Semántico Contextual**: El sistema utiliza un LLM para verificar de forma inteligente si las herramientas y handoffs configurados están mencionados de manera clara y comprensible en tu prompt, adaptando el nivel de exigencia según el tipo de agente.
*   **Informes Adaptativos**: Recibe un informe estructurado con indicadores visuales (✅, ⚠️, ❌) que se ajustan al contexto de tu agente, proporcionando feedback relevante y accionable.
*   **Transparencia Total**: Los reportes incluyen información sobre la clasificación del agente y el modo de validación aplicado.

## Cómo Empezar

1.  **Asegúrate de que el backend esté corriendo**: Inicia el servidor `intelli_backend` (normalmente con `npm start` en su directorio).
2.  **Inicia el Editor de Prompts**: Navega al directorio `prompt-editor` y ejecuta `npm start`. El editor se abrirá en tu navegador en `http://localhost:5003`.
3.  **Selecciona un Agente**: Utiliza los selectores de Cliente, Chatbot y Agente para cargar el prompt que deseas editar.
4.  **Edita o Mejora**:
    *   Usa las pestañas del panel izquierdo para cambios manuales.
    *   Usa el botón `✨ Asistente` para obtener sugerencias inteligentes.
    *   Usa el botón `🧪 Validación` para verificar la consistencia con validación contextual automática.
5.  **Guarda tus Cambios**: Haz clic en `💾 Guardar` para aplicar las modificaciones al prompt del agente.

## Ventajas de la Validación Inteligente

### Para Desarrolladores de Agentes Simples
- **Mayor Libertad Creativa**: Enfócate en crear conversaciones naturales y atractivas sin preocuparte por restricciones técnicas estrictas.
- **Sugerencias Constructivas**: Recibe recomendaciones que mejoran la calidad conversacional sin bloquear tu creatividad.
- **Desarrollo Ágil**: Itera rápidamente en tus ideas sin barreras técnicas innecesarias.

### Para Desarrolladores de Agentes Complejos
- **Garantía de Calidad**: Asegura que todos los componentes técnicos (herramientas, handoffs, formularios) estén correctamente implementados.
- **Prevención de Errores**: Detecta problemas antes de que lleguen a producción.
- **Cumplimiento Arquitectónico**: Mantiene la consistencia con los patrones establecidos del sistema.

### Para Todos los Desarrolladores
- **Transparencia**: Siempre sabes qué tipo de validación se está aplicando y por qué.
- **Eficiencia**: No pierdas tiempo con validaciones irrelevantes para tu tipo de agente.
- **Aprendizaje**: Comprende mejor las diferencias entre tipos de agentes y cuándo usar cada uno.

¡Esperamos que disfrutes de esta nueva versión del Editor de Agentes!
