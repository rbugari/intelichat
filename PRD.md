# 📑 PRD – InteliChat: Plataforma Multi-Agente con IA (v1.7)

---

## 🚀 Release 1.7 – Arquitectura Basada en Intenciones

Esta release marca una refactorización fundamental de la arquitectura del sistema para mejorar la robustez, fiabilidad y predictibilidad del comportamiento de los agentes. Se abandona el modelo donde el LLM generaba JSON complejo para el control de flujo en favor de un modelo donde el código actúa como director de orquesta.

### 1. Objetivo
- **Aumentar la Fiabilidad:** Eliminar comportamientos erráticos como "ecos", bucles y fallos en los handoffs, moviendo la lógica de control de flujo al código de la aplicación.
- **Simplificar la Creación de Prompts:** Permitir que los desarrolladores de prompts se centren en la calidad de la conversación y no en la generación de JSON preciso.
- **Consolidar el Modelo "Hub-and-Spoke":** Reforzar el rol del agente `INFO` como coordinador central de una manera determinista.

### 2. Filosofía de Diseño (v2): El Código es el Director
- **El Prompt Conversa, el Código Ejecuta:** La responsabilidad del LLM es entender al usuario y declarar una **intención** simple (ej: `call_tool`, `finish_turn`).
- **El Backend Dirige:** El código (`bot_logic.js`) recibe la intención y, basándose en reglas de negocio y la configuración de la BD, ejecuta la acción correspondiente. El flujo de la conversación es ahora predecible.

---

## 🏗️ Arquitectura General del Proyecto

El proyecto consta de tres aplicaciones principales:

1.  **🧪 `intelli_backend/` (Node.js + Express):** El cerebro del sistema. Orquesta la conversación, gestiona el estado, se comunica con el LLM y las herramientas externas, y sirve las APIs para las aplicaciones frontend.
2.  **🌐 `chat-vanilla/` (HTML + JS):** Una interfaz de usuario de chat simple cuya única responsabilidad es mostrar la conversación y enviar las entradas del usuario al backend.
3.  **📝 `prompt-editor/` (HTML + JS):** Un entorno de desarrollo integrado (IDE) para crear, editar, validar y mejorar los `system prompts` de los agentes. Es la herramienta principal para el desarrollo y mantenimiento de la lógica de los agentes.

---

## 🔹 Alcance Funcional (Consolidado en v1.7)

- **Multi-cliente y Multi-idioma:** Funcionalidad sin cambios. El sistema sigue soportando múltiples clientes y lenguajes (ES/EN) configurados desde la base de datos.
- **Theming Básico:** Sin cambios.
- **Editor de Prompts:** La herramienta de edición sigue siendo vital, pero ahora se usará para crear prompts más simples y centrados en el diálogo y la declaración de intenciones.
- **Integración de APIs y Autenticación Dinámica:** Sin cambios. El `dynamicToolsService` sigue gestionando la ejecución de herramientas y la obtención de tokens de forma dinámica.

---

### 3. Sistema de Agentes y Flujo de Handoff (Modelo v2)

El sistema sigue un modelo "Hub-and-Spoke" con `INFO` como el agente coordinador central. Este flujo ahora es gestionado y forzado por el código del backend para garantizar la fiabilidad.

**1. Detección de Intención (`INFO`)**
- El agente `INFO` conversa con el usuario para determinar su necesidad.
- Basado en la conversación, `INFO` declara la intención de hacer un handoff a un especialista (`ONBOARDING` o `CLIENTES`).
- **Ejemplo:** `INFO` genera `{"say": "...", "action": {"type": "handoff", "target_agent": "CLIENTES"}}`.

**2. Ejecución del Especialista (`ONBOARDING` / `CLIENTES`)**
- El backend activa al agente especialista.
- El especialista ejecuta su lógica, que típicamente implica llamar a una herramienta (`call_tool`).
- Una vez que ha informado el resultado de su tarea, el especialista **siempre** debe declarar la intención `finish_turn`.
- **Ejemplo:** `CLIENTES` genera `{"say": "...", "action": {"type": "finish_turn"}}`.

**3. Retorno a INFO (Gestionado por el Código)**
- El backend recibe la intención `finish_turn` del especialista.
- El código **automáticamente** cambia el agente activo de vuelta a `INFO`.
- `INFO` toma el control en el siguiente turno, preguntando al usuario si necesita algo más, asegurando un cierre de ciclo limpio y predecible.

---

## 📊 Estado de la Implementación (v1.7)

- ✅ **Arquitectura Refactorizada:** El núcleo lógico en `bot_logic.js` ha sido rediseñado para operar con intenciones.
- ✅ **Prompts Simplificados:** La nueva guía de prompts (`GUIA_GENERACION_PROMPTS.md`) documenta el nuevo estándar, más simple y robusto.
- ✅ **Flujo de Conversación Fiable:** Los problemas de ecos, bucles y handoffs fallidos han sido solucionados a nivel de arquitectura.
- ✅ **Funcionalidad Existente Preservada:** Multi-tenant, multi-LLM, y la ejecución de herramientas dinámicas siguen 100% operativos.

---

## 🚀 Roadmap Futuro

Con la estabilización de la arquitectura en la v1.7, el roadmap se puede enfocar en la expansión de capacidades.

- **Fase 1: Estabilización (COMPLETADA)**
  - [x] ✅ Refactorización a una arquitectura basada en intenciones.
  - [x] ✅ Solución de problemas de flujo conversacional (ecos, bucles).
  - [x] ✅ Simplificación y unificación de la metodología de creación de prompts.

- **Fase 2: Expansión de Capacidades (Próxima)**
  - [ ] Nuevas herramientas para agentes existentes.
  - [ ] Creación de nuevos agentes especialistas.
  - [ ] Mejorar el `dynamicToolsService` para que el `finish_turn` sea aún más inteligente (ej: basado en la configuración de la BD en lugar de una lista en el código).
  - [ ] Panel de administración web para configuración.

- **Fase 3: Escalabilidad (Futuro)**
  - [ ] Arquitectura distribuida con microservicios.
  - [ ] Monitoreo avanzado y analytics de conversación.