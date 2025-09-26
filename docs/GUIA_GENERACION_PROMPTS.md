# Guía para la Creación de Prompts en Intellichat (Arquitectura v2)

---

### Herramienta Recomendada: Editor de Agentes

Para aplicar los principios de esta guía, se recomienda encarecidamente utilizar el **Editor de Agentes**, disponible en `http://localhost:5003`.

Esta herramienta proporciona un entorno de desarrollo integrado con asistencia de IA, validación y acceso a toda la configuración del agente, facilitando la creación de prompts robustos y coherentes con la arquitectura del sistema.

---

## 1. Filosofía Principal: El Agente como un Conversador Experto

Bienvenido a la nueva forma de crear agentes. Olvida el JSON complejo y los flujos rígidos. Tu única misión ahora es crear una **personalidad y un cerebro conversacional**.

Piensa en el agente como un **experto en comunicación**, no como un programador. Su trabajo es:
1.  **Conversar** de forma natural con el usuario.
2.  **Entender** lo que el usuario necesita.
3.  **Declarar su intención** de forma clara y simple.

El backend se encargará del resto. Libera al agente de las tareas de programación y déjale hacer lo que mejor sabe hacer: conversar.

---

## 2. La Arquitectura Basada en Intenciones

El sistema ahora funciona con una clara separación de responsabilidades, lo que lo hace mucho más robusto y fácil de depurar.

*   **El Rol del Agente (Tu Prompt):** Define la personalidad, el conocimiento y, lo más importante, las **reglas para decidir qué intención declarar** en cada punto de la conversación.

*   **El Rol del Backend (El Código):** Actúa como el director de orquesta. Recibe la intención declarada por el agente y ejecuta la acción correspondiente (llamar a una herramienta, cambiar de agente, etc.), validando contra la configuración de la base de datos.

---

## 3. El Formato de Salida: La "Comanda" del Agente

La salida de tu agente ahora es un JSON muy simple. En cada turno, el agente debe generar un objeto con dos campos: `say` y `action`.

```json
{
  "say": "El texto que el agente le dice al usuario en este turno. Siempre debe haber algo aquí, aunque sea para confirmar una acción.",
  "action": {
    "type": "...",
    "..."
  }
}
```

-   **`say` (string):** Lo que el agente le dice al usuario. Es el componente conversacional.
-   **`action` (object | null):** La acción que el agente quiere que el backend ejecute. Si el agente solo quiere hablar, este campo puede ser `null`.

---

## 4. El Menú de Intenciones (Valores para `action.type`)

Estas son las únicas "palabras clave" que tu agente necesita aprender.

### a. `call_tool`
- **Propósito:** Usar una de las herramientas que el agente tiene asignadas en la base de datos.
- **Estructura:**
  ```json
  {
    "say": "Claro, déjame consultar el estado de tus documentos.",
    "action": {
      "type": "call_tool",
      "tool_name": "pendingDocuments",
      "args": { "dot_number": "..." }
    }
  }
  ```
- **Tu Tarea en el Prompt:** Solo necesitas enseñarle al agente **cuándo** debe usar la herramienta y con qué **nombre** (`tool_name`). Ya no necesitas los ejemplos de JSON de la herramienta completa.

### b. `handoff`
- **Propósito:** Pasar la conversación a otro agente.
- **Estructura:**
  ```json
  {
    "say": "Veo que aún no estás registrado. ¿Te parece bien si te paso con nuestro especialista de altas?",
    "action": {
      "type": "handoff",
      "target_agent": "ONBOARDING"
    }
  }
  ```
- **Tu Tarea en el Prompt:** Enséñale al agente `INFO` a identificar las situaciones en las que debe proponer un handoff y a qué `target_agent`.

### c. `finish_turn` (La más importante para especialistas)
- **Propósito:** Indicar que un agente especialista ha completado su tarea y debe devolver el control.
- **Estructura:**
  ```json
  {
    "say": "Aquí tienes la lista de documentos que faltan. Con esto he completado mi tarea.",
    "action": {
      "type": "finish_turn"
    }
  }
  ```
- **Tu Tarea en el Prompt:** En los prompts de los agentes especialistas (`CLIENTES`, `ONBOARDING`), la regla final debe ser siempre que, después de dar su resultado, declaren la intención `finish_turn`. El backend se encargará automáticamente de reactivar a `INFO`.

---

## 5. Flujo de Conversación de Ejemplo (Arquitectura v2)

**Escenario:** Un cliente ya registrado (`STATUS_ALREADY_REGISTERED`) quiere ver sus documentos.

**1. Turno de INFO (Propone Handoff)**
- **Usuario dice:** "Quiero ver mis documentos"
- **Prompt de INFO dice:** "Si el usuario es un cliente registrado, propone un handoff a `CLIENTES`."
- **INFO genera:**
  ```json
  {
    "say": "Perfecto, ya eres cliente. ¿Te parece bien si te comunico con Clientes para que revisen tu documentación?",
    "action": { "type": "handoff", "target_agent": "CLIENTES" }
  }
  ```

**2. Turno de CLIENTES (Llama a la Herramienta)**
- **Usuario dice:** "si"
- *El backend recibe la respuesta, ve que el handoff fue aceptado y activa a `CLIENTES`.*
- **Prompt de CLIENTES dice:** "Al activarte, tu primera acción es usar la herramienta `pendingDocuments`."
- **CLIENTES genera:**
  ```json
  {
    "say": "Entendido. Dame un momento mientras verifico el estado de tu documentación...",
    "action": { "type": "call_tool", "tool_name": "pendingDocuments", "args": { "dot_number": "..." } }
  }
  ```

**3. Turno de CLIENTES (Informa y Finaliza)**
- *El backend ejecuta la herramienta y le devuelve el resultado a `CLIENTES`.*
- **Prompt de CLIENTES dice:** "Cuando recibas el resultado, infórmalo y luego declara la intención `finish_turn`."
- **CLIENTES genera:**
  ```json
  {
    "say": "He revisado tu estado y falta el formulario W9.",
    "action": { "type": "finish_turn" }
  }
  ```

**4. Turno de INFO (Recibe el Control)**
- *El backend ve la intención `finish_turn` y reactiva a `INFO`.*
- **Prompt de INFO dice:** "Cuando un especialista te devuelva el control, solo pregunta si el usuario necesita algo más."
- **INFO genera:**
  ```json
  {
    "say": "¿Puedo ayudarte en algo más?",
    "action": null
  }
  ```

La conversación es fluida, lógica y, lo más importante, **fiable**.

---

## 6. Checklist de Verificación (Actualizado)

- [ ] ¿Mi prompt se centra en la **conversación** y no en la generación de código JSON?
- [ ] ¿Le enseño a mi agente a **declarar intenciones** (`call_tool`, `handoff`, `finish_turn`) en lugar de darle estructuras complejas?
- [ ] Para los especialistas, ¿la regla final es siempre declarar `finish_turn` después de dar su resultado?
- [ ] Para `INFO`, ¿existe una regla clara sobre qué hacer cuando un especialista le devuelve el control?
- [ ] ¿Los nombres de `tool_name` y `target_agent` que uso en el prompt coinciden con los configurados en la base de datos?
