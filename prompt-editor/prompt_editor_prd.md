# Documento de Producto (PRD): Editor de Agentes Inteligentes (v3 - The Inspector Model)

## Visión General

El Editor de Agentes ha sido rediseñado desde cero bajo el paradigma **"Inspector Model"**, inspirado en entornos de desarrollo profesionales (IDEs). La nueva visión se centra en una jerarquía de información clara y una experiencia de usuario sin ambigüedades, separando la **edición**, la **consulta** y las **acciones globales**.

La interfaz ahora se divide en tres zonas distintas:
1.  **Barra de Herramientas Global (Arriba):** Contiene todas las acciones globales y la selección de agentes.
2.  **Área de Edición Principal (Izquierda):** Un espacio con un sistema de pestañas único para editar los diferentes "assets" del agente.
3.  **Panel Inspector (Derecha):** Un panel de solo lectura para consultar información contextual relevante.

---

### 1. Cambios en el Frontend: Rediseño a "Inspector Model"

La interfaz ha sido completamente refactorizada para mejorar la claridad y el flujo de trabajo.

*   **Barra de Herramientas Global (Superior)**:
    *   **Propósito**: Centraliza todas las acciones globales y la navegación principal.
    *   **Componentes**:
        *   **Selectores de Agente**: Los menús desplegables para `Cliente`, `Chatbot` y `Agente` ahora residen aquí.
        *   **Acciones Globales**: Se han movido aquí los botones principales: `💾 Guardar`, `✨ Asistente`, `🧪 Validación` y `❓ Ayuda`.
        *   **Control de Tema**: El interruptor de modo oscuro/claro permanece en esta barra.

*   **Área de Edición Principal (Panel Izquierdo)**:
    *   **Propósito**: Es el espacio de trabajo principal, dedicado exclusivamente a la edición de los componentes del agente.
    *   **Sistema de Pestañas Único**: Se ha eliminado el sistema de pestañas anidadas. Ahora existe una sola barra de pestañas principal con:
        *   **`📝 Prompt`**: Contiene el editor de Markdown para el `system_prompt`.
        *   **`⚙️ Parámetros`**: Contiene el formulario para editar los parámetros del LLM (`temperatura`, `top_p`, `max_tokens`).
        *   **`💬 Mensajes`**: Contiene el formulario para editar todos los mensajes predefinidos del agente.

*   **Panel Inspector (Panel Derecho)**:
    *   **Propósito**: Funciona como un panel de **solo lectura** que proporciona contexto útil mientras se edita en el área principal.
    *   **Sin Pestañas**: Se ha eliminado toda la navegación por pestañas en este panel.
    *   **Secciones Estáticas**:
        *   **`ℹ️ Info del Agente`**: Muestra información básica como ID, nombre, estado y modelo LLM.
        *   **`🛠️ Recursos`**: Lista las Herramientas (APIs) y Formularios disponibles.
        *   **`🤝 Handoffs`**: Lista los handoffs configurados.

*   **Funcionalidad en Modales**:
    *   Las herramientas de `Asistente IA` y `Validación` ya no son pestañas en el área de edición. Ahora se lanzan a través de sus respectivos botones en la barra de herramientas global, abriéndose en **ventanas modales** que se superponen a la aplicación. Esto las define claramente como acciones secundarias que operan sobre el agente.

---

### 2. Flujo de Trabajo del Usuario (Rediseñado)

1.  El usuario comienza en la **Barra de Herramientas Global** para seleccionar un `Cliente`, `Chatbot` y `Agente`.
2.  Una vez seleccionado, toda la información del agente se carga en la interfaz:
    *   El `system_prompt` aparece en la pestaña **`📝 Prompt`** del área de edición.
    *   Los parámetros y mensajes se cargan en sus respectivas pestañas **`⚙️ Parámetros`** y **`💬 Mensajes`**.
    *   La información contextual (Info, Recursos, Handoffs) aparece en el **Panel Inspector** de la derecha.
3.  El usuario puede navegar entre las pestañas del **Área de Edición Principal** para modificar cualquier aspecto del agente, mientras consulta la información de referencia en el **Panel Inspector**.
4.  Para obtener ayuda, validar el agente o usar el asistente de IA, el usuario hace clic en los botones correspondientes de la **Barra de Herramientas Global**, que abren la funcionalidad en un modal.
5.  Cuando ha terminado de hacer cambios, el usuario presiona el botón `💾 Guardar` en la **Barra de Herramientas Global** para persistir todos los cambios del agente en una sola operación.

---

### 3. Cambios en el Backend (Soporte)

*   **API de Agentes Unificada (`PUT /api/agents/:id/prompt`)**: Este endpoint sigue siendo crucial y soporta perfectamente el nuevo flujo de guardado unificado.
*   **Servicio de Validación (`validationService.js`)**: La corrección del bug del `agente_id` sigue siendo relevante, aunque el usuario esté experimentando problemas de entorno.

---

## 🚀 Plan de Quick Wins - Mejoras de Alto Impacto (2024)

### **1. Auto-completado Inteligente de Herramientas** ✅
**Problema:** Los usuarios deben recordar y escribir manualmente los nombres de las herramientas en `call_tool()`.
**Solución:** Implementar auto-completado que detecta `call_tool(` o `.` y sugiere herramientas disponibles.
**Impacto:** Reduce errores de escritura y acelera el desarrollo de prompts.
**Estado:** Implementado y funcionando.

### **2. Validación de JSON en Tiempo Real** ✅
**Problema:** Los errores de sintaxis JSON solo se detectan al guardar o ejecutar.
**Solución:** Validación instantánea con marcado visual en el editor.
**Impacto:** Previene errores de sintaxis y mejora la calidad del código.
**Estado:** Implementado con visualización de errores por línea.

### **3. Prevención de Mensajes Duplicados** ✅
**Problema:** Los mensajes de validación se repetían al escribir rápido.
**Solución:** Flag de validación y limpieza completa de widgets antes de mostrar nuevos errores.
**Impacto:** Interfaz más limpia y mejor experiencia de usuario.
**Estado:** Resuelto con flag `isValidating`.

### **4. Soporte para Auto-completado con Punto (`.`)** ✅
**Problema:** Solo funcionaba con `call_tool(`, no con métodos después de punto.
**Solución:** Detectar patrón `objeto.metodo` y sugerir métodos disponibles.
**Impacto:** Completa la experiencia de auto-completado para patrones comunes.
**Estado:** Implementado y funcionando.

### **5. Auto-completado de Snippet "tool"** ✅
**Problema:** Los usuarios necesitan recordar la sintaxis exacta para llamar herramientas.
**Solución:** Al escribir "tool", se muestra un snippet de ejemplo con la sintaxis correcta de `call_tool()`.
**Impacto:** Reduce la curva de aprendizaje y errores de sintaxis al usar herramientas.
**Estado:** Implementado con navegación por teclado (flechas, Enter/Tab, Escape).

---

## 🔮 Próximos Quick Wins (Próximas Iteraciones)

### **6. Auto-completado de Variables de Contexto**
**Idea:** Detectar patrones `${` y sugerir variables del contexto disponibles.
**Beneficio:** Facilitar el uso de variables dinámicas en prompts.

### **7. Snippets de Código Comunes**
**Idea:** Plantillas predefinidas para patrones comunes (`call_tool`, `control`, etc.).
**Beneficio:** Acelerar la escritura de prompts típicos.

### **8. Atajos de Teclado**
**Idea:** Combinaciones rápidas para acciones frecuentes (validar, mejorar, guardar).
**Beneficio:** Productividad mejorada para usuarios avanzados.

### **9. Historial de Cambios Local**
**Idea:** Guardar versiones anteriores del prompt en el navegador.
**Beneficio:** Permitir deshacer cambios y comparar versiones.

### **10. Búsqueda en el Editor**
**Idea:** Barra de búsqueda y reemplazo dentro del editor.
**Beneficio:** Navegación rápida en prompts largos.

### **11. Colaboración en Tiempo Real**
**Idea:** Múltiples usuarios editando el mismo prompt simultáneamente.
**Beneficio:** Trabajo en equipo más eficiente.

---

## 📊 Métricas de Éxito de Quick Wins

- **Tiempo de desarrollo:** 15-30 minutos por mejora
- **Reducción de errores:** 80% menos errores de sintaxis
- **Velocidad de escritura:** 50% más rápido al usar auto-completado
- **Satisfacción del usuario:** Interfaz más limpia e intuitiva

---

## 💡 Criterios para Nuevos Quick Wins

1. **Alto impacto, bajo esfuerzo** - Máximo 30 minutos de implementación
2. **Sin cambios de backend** - Solo mejoras frontend
3. **Mejora UX inmediata** - Visible para el usuario final
4. **Sin breaking changes** - Compatible con funcionalidad existente
5. **Fácil de revertir** - Cambios mínimos y localizados